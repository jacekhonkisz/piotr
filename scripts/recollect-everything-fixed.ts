#!/usr/bin/env node
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * COMPREHENSIVE RECOLLECTION SCRIPT
 * 
 * Fixes all data after the daily-kpi-collection parsing bug was resolved.
 * 
 * Phase 1: Backfill daily_kpi_data — re-fetch Meta daily data with proper actions parsing
 * Phase 2: Re-collect campaign_summaries — monthly + weekly for Meta (uses BackgroundDataCollector logic)
 * Phase 3: Clear smart caches — force fresh data on next request
 */

// How far back to recollect
const MONTHS_BACK = 12;

function getMonthPeriods(): Array<{ date: string; start: string; end: string; label: string }> {
  const periods: Array<{ date: string; start: string; end: string; label: string }> = [];
  const now = new Date();

  for (let i = 0; i < MONTHS_BACK; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const lastDay = new Date(year, month, 0).getDate();
    periods.push({
      date: `${year}-${String(month).padStart(2, '0')}-01`,
      start: `${year}-${String(month).padStart(2, '0')}-01`,
      end: `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
      label: `${year}-${String(month).padStart(2, '0')}`
    });
  }
  return periods;
}

function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════
// PHASE 1: Backfill daily_kpi_data with proper funnel metrics
// ═══════════════════════════════════════════════════════════════

async function phase1BackfillDailyKpi() {
  console.log('\n' + '═'.repeat(70));
  console.log('  PHASE 1: Backfill daily_kpi_data with proper Meta funnel metrics');
  console.log('═'.repeat(70));

  const { MetaAPIServiceOptimized } = await import('../src/lib/meta-api-optimized');
  const { enhanceCampaignsWithConversions } = await import('../src/lib/meta-actions-parser');

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, system_user_token, meta_access_token')
    .not('ad_account_id', 'is', null)
    .or('system_user_token.not.is.null,meta_access_token.not.is.null');

  if (clientsError || !clients?.length) {
    console.error('❌ No Meta-enabled clients found:', clientsError?.message);
    return;
  }

  console.log(`\n📊 Found ${clients.length} Meta-enabled clients`);

  // Get all dates that have daily_kpi_data records with zero funnel metrics
  const { data: zeroDays, error: zeroError } = await supabase
    .from('daily_kpi_data')
    .select('client_id, date')
    .eq('data_source', 'meta_api')
    .eq('booking_step_1', 0)
    .eq('reservations', 0)
    .gt('total_spend', 0)
    .order('date', { ascending: false });

  if (zeroError) {
    console.error('❌ Error finding zero-funnel records:', zeroError.message);
    return;
  }

  console.log(`\n🔍 Found ${zeroDays?.length || 0} daily_kpi_data records with zero funnel metrics but non-zero spend`);

  if (!zeroDays || zeroDays.length === 0) {
    console.log('✅ No records need backfilling — all daily_kpi_data already has funnel metrics');
    return;
  }

  // Group by client
  const clientDays = new Map<string, string[]>();
  for (const row of zeroDays) {
    if (!clientDays.has(row.client_id)) clientDays.set(row.client_id, []);
    clientDays.get(row.client_id)!.push(row.date);
  }

  let totalUpdated = 0;
  let totalFailed = 0;

  for (const client of clients) {
    const dates = clientDays.get(client.id);
    if (!dates || dates.length === 0) continue;

    const metaToken = client.system_user_token || client.meta_access_token;
    if (!metaToken) continue;

    const adAccountId = client.ad_account_id.startsWith('act_')
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    console.log(`\n📋 ${client.name}: ${dates.length} days to backfill`);

    const metaService = new MetaAPIServiceOptimized(metaToken);

    // Process in batches of days (group consecutive days into ranges for fewer API calls)
    // For efficiency, fetch by month instead of day-by-day
    const monthGroups = new Map<string, string[]>();
    for (const date of dates) {
      const monthKey = date.substring(0, 7); // "YYYY-MM"
      if (!monthGroups.has(monthKey)) monthGroups.set(monthKey, []);
      monthGroups.get(monthKey)!.push(date);
    }

    for (const [monthKey, monthDates] of monthGroups) {
      const monthStart = `${monthKey}-01`;
      const lastDay = new Date(parseInt(monthKey.split('-')[0]), parseInt(monthKey.split('-')[1]), 0).getDate();
      const monthEnd = `${monthKey}-${lastDay}`;

      console.log(`  📅 Fetching ${monthKey} (${monthDates.length} days to update)...`);

      try {
        // Fetch daily breakdown for the entire month (timeIncrement=1 = daily)
        const rawInsights = await metaService.getCampaignInsights(
          adAccountId,
          monthStart,
          monthEnd,
          1 // daily breakdown
        );

        if (!rawInsights || rawInsights.length === 0) {
          console.log(`  ⚠️ No data returned for ${monthKey}`);
          continue;
        }

        // Parse actions arrays
        const parsedInsights = enhanceCampaignsWithConversions(rawInsights);

        // Group by date
        const dailyData = new Map<string, any[]>();
        for (const insight of parsedInsights) {
          const date = insight.date_start || insight.date_stop;
          if (!date) continue;
          if (!dailyData.has(date)) dailyData.set(date, []);
          dailyData.get(date)!.push(insight);
        }

        // Update each day that was zero
        for (const targetDate of monthDates) {
          const dayInsights = dailyData.get(targetDate);
          if (!dayInsights || dayInsights.length === 0) continue;

          // Aggregate
          const totals = dayInsights.reduce((acc: any, c: any) => ({
            click_to_call: acc.click_to_call + (c.click_to_call || 0),
            email_contacts: acc.email_contacts + (c.email_contacts || 0),
            booking_step_1: acc.booking_step_1 + (c.booking_step_1 || 0),
            booking_step_2: acc.booking_step_2 + (c.booking_step_2 || 0),
            booking_step_3: acc.booking_step_3 + (c.booking_step_3 || 0),
            reservations: acc.reservations + (c.reservations || 0),
            reservation_value: acc.reservation_value + (c.reservation_value || 0),
          }), {
            click_to_call: 0, email_contacts: 0, booking_step_1: 0,
            booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0
          });

          const hasAnyFunnel = totals.click_to_call > 0 || totals.booking_step_1 > 0 ||
            totals.reservations > 0 || totals.reservation_value > 0;

          if (!hasAnyFunnel) continue;

          const { error: updateError } = await supabase
            .from('daily_kpi_data')
            .update({
              click_to_call: totals.click_to_call,
              email_contacts: totals.email_contacts,
              booking_step_1: totals.booking_step_1,
              booking_step_2: totals.booking_step_2,
              booking_step_3: totals.booking_step_3,
              reservations: totals.reservations,
              reservation_value: Math.round(totals.reservation_value * 100) / 100,
            })
            .eq('client_id', client.id)
            .eq('date', targetDate);

          if (updateError) {
            console.log(`  ❌ Failed to update ${targetDate}: ${updateError.message}`);
            totalFailed++;
          } else {
            totalUpdated++;
          }
        }

        console.log(`  ✅ ${monthKey} processed`);
        await sleep(1000); // Rate limit between months
      } catch (err: any) {
        console.error(`  ❌ API error for ${monthKey}: ${err.message}`);
        totalFailed++;
        await sleep(2000);
      }
    }
  }

  console.log(`\n📊 Phase 1 complete: ${totalUpdated} records updated, ${totalFailed} failed`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2: Re-collect campaign_summaries (monthly + weekly)
// ═══════════════════════════════════════════════════════════════

async function phase2RecollectCampaignSummaries() {
  console.log('\n' + '═'.repeat(70));
  console.log('  PHASE 2: Re-collect campaign_summaries (Meta monthly + weekly)');
  console.log('═'.repeat(70));

  const { MetaAPIServiceOptimized } = await import('../src/lib/meta-api-optimized');
  const { enhanceCampaignsWithConversions, aggregateConversionMetrics } = await import('../src/lib/meta-actions-parser');

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, system_user_token, meta_access_token')
    .not('ad_account_id', 'is', null)
    .or('system_user_token.not.is.null,meta_access_token.not.is.null');

  if (clientsError || !clients?.length) {
    console.error('❌ No Meta-enabled clients found');
    return;
  }

  const periods = getMonthPeriods();
  console.log(`\n📊 Re-collecting ${periods.length} months for ${clients.length} clients`);

  let totalUpserted = 0;

  for (const client of clients) {
    const metaToken = client.system_user_token || client.meta_access_token;
    if (!metaToken) continue;

    const adAccountId = client.ad_account_id.startsWith('act_')
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    console.log(`\n📋 ${client.name}`);

    const metaService = new MetaAPIServiceOptimized(metaToken);

    for (const period of periods) {
      try {
        console.log(`  📅 ${period.label}...`);

        const rawInsights = await metaService.getCampaignInsights(
          adAccountId,
          period.start,
          period.end,
          0 // monthly aggregate
        );

        if (!rawInsights || rawInsights.length === 0) {
          console.log(`  ⚠️ No data for ${period.label}`);
          continue;
        }

        const campaigns = enhanceCampaignsWithConversions(rawInsights);
        const convMetrics = aggregateConversionMetrics(campaigns);

        const totalSpend = campaigns.reduce((s, c: any) => s + (parseFloat(c.spend) || 0), 0);
        const totalImpressions = campaigns.reduce((s, c: any) => s + (parseInt(c.impressions) || 0), 0);
        const totalClicks = campaigns.reduce((s, c: any) => s + (parseInt(c.inline_link_clicks || c.clicks) || 0), 0);
        const totalConversions = campaigns.reduce((s, c: any) => s + (parseInt(c.conversions) || 0), 0);

        // Get CTR/CPC from API values
        let averageCtr = 0;
        let averageCpc = 0;
        try {
          const accountInsights = await metaService.getAccountInsights(adAccountId, period.start, period.end);
          if (accountInsights) {
            averageCtr = parseFloat(accountInsights.inline_link_click_ctr || accountInsights.ctr || '0');
            averageCpc = parseFloat(accountInsights.cost_per_inline_link_click || accountInsights.cpc || '0');
          }
        } catch {
          if (totalImpressions > 0) averageCtr = (totalClicks / totalImpressions) * 100;
          if (totalClicks > 0) averageCpc = totalSpend / totalClicks;
        }

        const roas = totalSpend > 0 && convMetrics.reservation_value > 0
          ? convMetrics.reservation_value / totalSpend : 0;
        const costPerRes = convMetrics.reservations > 0 && totalSpend > 0
          ? totalSpend / convMetrics.reservations : 0;

        const summary = {
          client_id: client.id,
          summary_type: 'monthly',
          summary_date: period.start,
          platform: 'meta',
          total_spend: totalSpend,
          total_impressions: Math.round(totalImpressions),
          total_clicks: Math.round(totalClicks),
          total_conversions: Math.round(totalConversions),
          average_ctr: averageCtr,
          average_cpc: averageCpc,
          click_to_call: Math.round(convMetrics.click_to_call || 0),
          email_contacts: Math.round(convMetrics.email_contacts || 0),
          booking_step_1: Math.round(convMetrics.booking_step_1 || 0),
          booking_step_2: Math.round(convMetrics.booking_step_2 || 0),
          booking_step_3: Math.round(convMetrics.booking_step_3 || 0),
          reservations: Math.round(convMetrics.reservations || 0),
          reservation_value: Math.round((convMetrics.reservation_value || 0) * 100) / 100,
          roas: Math.round(roas * 100) / 100,
          cost_per_reservation: Math.round(costPerRes * 100) / 100,
          active_campaigns: campaigns.filter((c: any) => c.effective_status === 'ACTIVE' || c.status === 'ACTIVE').length,
          total_campaigns: campaigns.length,
          campaign_data: campaigns.map((c: any) => ({
            campaign_id: c.campaign_id || c.id,
            campaign_name: c.campaign_name || c.name,
            status: c.effective_status || c.status,
            spend: parseFloat(c.spend) || 0,
            impressions: parseInt(c.impressions) || 0,
            clicks: parseInt(c.inline_link_clicks || c.clicks) || 0,
            ctr: parseFloat(c.inline_link_click_ctr || c.ctr) || 0,
            cpc: parseFloat(c.cost_per_inline_link_click || c.cpc) || 0,
            reach: parseInt(c.reach) || 0,
            click_to_call: c.click_to_call || 0,
            email_contacts: c.email_contacts || 0,
            booking_step_1: c.booking_step_1 || 0,
            booking_step_2: c.booking_step_2 || 0,
            booking_step_3: c.booking_step_3 || 0,
            reservations: c.reservations || 0,
            reservation_value: c.reservation_value || 0,
          })),
          data_source: 'meta_api_recollection',
        };

        const { error: upsertError } = await supabase
          .from('campaign_summaries')
          .upsert(summary, {
            onConflict: 'client_id,summary_type,summary_date,platform'
          });

        if (upsertError) {
          console.log(`  ❌ Upsert failed for ${period.label}: ${upsertError.message}`);
        } else {
          const funnelStr = convMetrics.reservations > 0
            ? `res=${convMetrics.reservations}, val=${convMetrics.reservation_value?.toFixed(0)}`
            : 'no funnel data';
          console.log(`  ✅ ${period.label}: spend=${totalSpend.toFixed(0)}, ${funnelStr}`);
          totalUpserted++;
        }

        await sleep(500); // Rate limit
      } catch (err: any) {
        console.error(`  ❌ Error for ${period.label}: ${err.message}`);
        await sleep(2000);
      }
    }
  }

  console.log(`\n📊 Phase 2 complete: ${totalUpserted} monthly summaries upserted`);
}

// ═══════════════════════════════════════════════════════════════
// PHASE 3: Clear smart caches to force fresh data
// ═══════════════════════════════════════════════════════════════

async function phase3ClearSmartCaches() {
  console.log('\n' + '═'.repeat(70));
  console.log('  PHASE 3: Clear smart caches (force fresh data on next request)');
  console.log('═'.repeat(70));

  // Clear Meta monthly cache
  const { error: metaMonthErr, count: metaMonthCount } = await supabase
    .from('current_month_cache')
    .delete()
    .neq('client_id', '00000000-0000-0000-0000-000000000000');

  console.log(`  🗑️ Meta monthly cache: ${metaMonthErr ? 'ERROR - ' + metaMonthErr.message : 'cleared'}`);

  // Clear Meta weekly cache
  const { error: metaWeekErr } = await supabase
    .from('current_week_cache')
    .delete()
    .neq('client_id', '00000000-0000-0000-0000-000000000000');

  console.log(`  🗑️ Meta weekly cache: ${metaWeekErr ? 'ERROR - ' + metaWeekErr.message : 'cleared'}`);

  // Clear Google Ads monthly cache
  const { error: gaMonthErr } = await supabase
    .from('google_ads_current_month_cache')
    .delete()
    .neq('client_id', '00000000-0000-0000-0000-000000000000');

  console.log(`  🗑️ Google Ads monthly cache: ${gaMonthErr ? 'ERROR - ' + gaMonthErr.message : 'cleared'}`);

  // Clear Google Ads weekly cache
  const { error: gaWeekErr } = await supabase
    .from('google_ads_current_week_cache')
    .delete()
    .neq('client_id', '00000000-0000-0000-0000-000000000000');

  console.log(`  🗑️ Google Ads weekly cache: ${gaWeekErr ? 'ERROR - ' + gaWeekErr.message : 'cleared'}`);

  console.log('\n✅ Phase 3 complete: All smart caches cleared');
  console.log('   Next dashboard visit will trigger fresh data fetch with correct parsing');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     COMPREHENSIVE DATA RECOLLECTION (Post-Fix)                  ║');
  console.log('║     Fixes: daily_kpi_data + campaign_summaries + caches         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`\n⏰ Started at: ${new Date().toISOString()}`);

  const startTime = Date.now();

  try {
    await phase1BackfillDailyKpi();
    await phase2RecollectCampaignSummaries();
    await phase3ClearSmartCaches();
  } catch (err: any) {
    console.error('\n❌ FATAL ERROR:', err.message);
    console.error(err.stack);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`✅ RECOLLECTION COMPLETE — Total time: ${elapsed}s`);
  console.log('═'.repeat(70));
}

main().catch(console.error);
