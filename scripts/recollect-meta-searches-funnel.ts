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
 * Re-collects ALL Meta data (monthly + weekly) with UPDATED funnel mapping
 * 
 * CHANGE: booking_step_1 now uses omni_search (searches) instead of link_click
 * 
 * This script will:
 * 1. Fetch fresh data from Meta API
 * 2. Parse using UPDATED meta-actions-parser.ts (searches for Step 1)
 * 3. Update campaign_summaries for both monthly AND weekly data
 */

function getAllMondays(startDate: Date, endDate: Date): Date[] {
  const mondays: Date[] = [];
  const current = new Date(startDate);
  
  // Find first Monday
  while (current.getUTCDay() !== 1) {
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  while (current <= endDate) {
    mondays.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  
  return mondays;
}

async function recollectMetaData() {
  console.log('🔄 Starting Meta data re-collection with SEARCHES for funnel Step 1...\n');

  // Import services dynamically
  const { MetaAPIServiceOptimized } = await import('../src/lib/meta-api-optimized');
  const { enhanceCampaignsWithConversions } = await import('../src/lib/meta-actions-parser');

  // Get all Meta-enabled clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, system_user_token, meta_access_token')
    .not('ad_account_id', 'is', null)
    .or('system_user_token.not.is.null,meta_access_token.not.is.null');

  if (clientsError || !clients?.length) {
    console.error('❌ Error fetching clients:', clientsError?.message);
    return;
  }

  console.log(`📊 Found ${clients.length} Meta-enabled clients\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // PART 1: MONTHLY DATA (Dec 2024 - Present)
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n' + '═'.repeat(80));
  console.log('📅 PART 1: MONTHLY DATA COLLECTION');
  console.log('═'.repeat(80) + '\n');

  const monthlyPeriods: Array<{ date: string; start: string; end: string }> = [];
  const now = new Date();
  for (let year = 2024; year <= now.getFullYear(); year++) {
    const startMonth = year === 2024 ? 12 : 1;
    const endMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
    
    for (let month = startMonth; month <= endMonth; month++) {
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      monthlyPeriods.push({
        date: `${year}-${String(month).padStart(2, '0')}-01`,
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      });
    }
  }

  console.log(`📅 Will re-collect ${monthlyPeriods.length} months\n`);

  let monthlySuccessCount = 0;
  let monthlyErrorCount = 0;

  for (const client of clients) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📱 Client: ${client.name}`);
    console.log(`${'─'.repeat(80)}\n`);

    const accessToken = client.system_user_token || client.meta_access_token;
    if (!accessToken) {
      console.log('   ❌ No access token available\n');
      continue;
    }

    const metaService = new MetaAPIServiceOptimized(
      accessToken,
      client.ad_account_id
    );

    for (const period of monthlyPeriods) {
      const monthStr = period.date.substring(0, 7);
      
      try {
        console.log(`   🔄 ${monthStr}...`);
        
        // Fetch fresh data from Meta API
        const rawData = await metaService.getCampaignInsights(
          client.ad_account_id,
          period.start,
          period.end
        );

        if (!rawData?.length) {
          console.log(`      ⚠️ No campaigns found`);
          continue;
        }

        // Parse using the UPDATED parser (searches for Step 1)
        const campaignsWithConversions = enhanceCampaignsWithConversions(rawData);

        // Aggregate metrics
        let totalSpend = 0;
        let totalImpressions = 0;
        let totalClicks = 0;
        let totalReach = 0;
        let totalClickToCall = 0;
        let totalEmailContacts = 0;
        let totalBookingStep1 = 0;
        let totalBookingStep2 = 0;
        let totalBookingStep3 = 0;
        let totalReservations = 0;
        let totalReservationValue = 0;

        for (const campaign of campaignsWithConversions) {
          totalSpend += parseFloat(campaign.spend || '0');
          totalImpressions += parseInt(campaign.impressions || '0', 10);
          totalClicks += parseInt(campaign.inline_link_clicks || campaign.clicks || '0', 10);
          totalReach += parseInt(campaign.reach || '0', 10);
          totalClickToCall += campaign.click_to_call || 0;
          totalEmailContacts += campaign.email_contacts || 0;
          totalBookingStep1 += campaign.booking_step_1 || 0;
          totalBookingStep2 += campaign.booking_step_2 || 0;
          totalBookingStep3 += campaign.booking_step_3 || 0;
          totalReservations += campaign.reservations || 0;
          totalReservationValue += campaign.reservation_value || 0;
        }

        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
        const roas = totalSpend > 0 ? totalReservationValue / totalSpend : 0;
        const costPerReservation = totalReservations > 0 ? totalSpend / totalReservations : 0;

        // Upsert to campaign_summaries
        const { error: upsertError } = await supabase
          .from('campaign_summaries')
          .upsert({
            client_id: client.id,
            platform: 'meta',
            summary_type: 'monthly',
            summary_date: period.date,
            total_spend: totalSpend,
            total_impressions: totalImpressions,
            total_clicks: totalClicks,
            total_conversions: totalReservations,
            average_ctr: ctr,
            average_cpc: cpc,
            average_cpa: costPerReservation,
            click_to_call: totalClickToCall,
            email_contacts: totalEmailContacts,
            booking_step_1: totalBookingStep1,
            booking_step_2: totalBookingStep2,
            booking_step_3: totalBookingStep3,
            reservations: totalReservations,
            reservation_value: totalReservationValue,
            roas: roas,
            cost_per_reservation: costPerReservation,
            campaign_data: campaignsWithConversions,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'client_id,platform,summary_type,summary_date'
          });

        if (upsertError) {
          throw upsertError;
        }

        monthlySuccessCount++;
        console.log(`      ✅ Success - Searches: ${totalBookingStep1}, Step 2: ${totalBookingStep2}, Step 3: ${totalBookingStep3}`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        monthlyErrorCount++;
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
        console.error(`      ❌ Error: ${errorMessage}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PART 2: WEEKLY DATA (Dec 2024 - Present)
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n\n' + '═'.repeat(80));
  console.log('📅 PART 2: WEEKLY DATA COLLECTION');
  console.log('═'.repeat(80) + '\n');

  const startDate = new Date('2024-12-01T00:00:00Z');
  const endDate = new Date();
  const allMondays = getAllMondays(startDate, endDate);

  console.log(`📅 Will re-collect ${allMondays.length} weeks\n`);

  let weeklySuccessCount = 0;
  let weeklyErrorCount = 0;
  let weeklySkippedCount = 0;

  for (const client of clients) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📱 Client: ${client.name}`);
    console.log(`${'─'.repeat(80)}\n`);

    const accessToken = client.system_user_token || client.meta_access_token;
    if (!accessToken) {
      console.log('   ❌ No access token available\n');
      continue;
    }

    const metaService = new MetaAPIServiceOptimized(
      accessToken,
      client.ad_account_id
    );

    for (const monday of allMondays) {
      const sunday = new Date(monday);
      sunday.setUTCDate(sunday.getUTCDate() + 6);

      const weekStart = monday.toISOString().split('T')[0];
      const weekEnd = sunday.toISOString().split('T')[0];
      const weekDate = monday.toISOString().split('T')[0];
      
      try {
        console.log(`   🔄 Week ${weekDate}...`);
        
        // Fetch fresh data from Meta API
        const rawData = await metaService.getCampaignInsights(
          client.ad_account_id,
          weekStart,
          weekEnd
        );

        if (!rawData?.length) {
          console.log(`      ⚠️ No campaigns found`);
          weeklySkippedCount++;
          continue;
        }

        // Parse using the UPDATED parser (searches for Step 1)
        const campaignsWithConversions = enhanceCampaignsWithConversions(rawData);

        // Aggregate metrics
        let totalSpend = 0;
        let totalImpressions = 0;
        let totalClicks = 0;
        let totalReach = 0;
        let totalClickToCall = 0;
        let totalEmailContacts = 0;
        let totalBookingStep1 = 0;
        let totalBookingStep2 = 0;
        let totalBookingStep3 = 0;
        let totalReservations = 0;
        let totalReservationValue = 0;

        for (const campaign of campaignsWithConversions) {
          totalSpend += parseFloat(campaign.spend || '0');
          totalImpressions += parseInt(campaign.impressions || '0', 10);
          totalClicks += parseInt(campaign.inline_link_clicks || campaign.clicks || '0', 10);
          totalReach += parseInt(campaign.reach || '0', 10);
          totalClickToCall += campaign.click_to_call || 0;
          totalEmailContacts += campaign.email_contacts || 0;
          totalBookingStep1 += campaign.booking_step_1 || 0;
          totalBookingStep2 += campaign.booking_step_2 || 0;
          totalBookingStep3 += campaign.booking_step_3 || 0;
          totalReservations += campaign.reservations || 0;
          totalReservationValue += campaign.reservation_value || 0;
        }

        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
        const roas = totalSpend > 0 ? totalReservationValue / totalSpend : 0;
        const costPerReservation = totalReservations > 0 ? totalSpend / totalReservations : 0;

        // Upsert to campaign_summaries
        const { error: upsertError } = await supabase
          .from('campaign_summaries')
          .upsert({
            client_id: client.id,
            platform: 'meta',
            summary_type: 'weekly',
            summary_date: weekDate,
            total_spend: totalSpend,
            total_impressions: totalImpressions,
            total_clicks: totalClicks,
            total_conversions: totalReservations,
            average_ctr: ctr,
            average_cpc: cpc,
            average_cpa: costPerReservation,
            click_to_call: totalClickToCall,
            email_contacts: totalEmailContacts,
            booking_step_1: totalBookingStep1,
            booking_step_2: totalBookingStep2,
            booking_step_3: totalBookingStep3,
            reservations: totalReservations,
            reservation_value: totalReservationValue,
            roas: roas,
            cost_per_reservation: costPerReservation,
            campaign_data: campaignsWithConversions,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'client_id,platform,summary_type,summary_date'
          });

        if (upsertError) {
          throw upsertError;
        }

        weeklySuccessCount++;
        console.log(`      ✅ Success - Searches: ${totalBookingStep1}, Step 2: ${totalBookingStep2}, Step 3: ${totalBookingStep3}`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        weeklyErrorCount++;
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
        console.error(`      ❌ Error: ${errorMessage}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 RE-COLLECTION COMPLETE');
  console.log('═'.repeat(80));
  console.log('\n📅 MONTHLY DATA:');
  console.log(`   ✅ Success: ${monthlySuccessCount}`);
  console.log(`   ❌ Errors: ${monthlyErrorCount}`);
  console.log('\n📅 WEEKLY DATA:');
  console.log(`   ✅ Success: ${weeklySuccessCount}`);
  console.log(`   ⏭️  Skipped: ${weeklySkippedCount} (no campaigns)`);
  console.log(`   ❌ Errors: ${weeklyErrorCount}`);
  console.log('\n💡 All historical data updated with NEW funnel mapping:');
  console.log(`   - Krok 1 (booking_step_1): Now uses omni_search (WYSZUKIWANIA) ✓`);
  console.log(`   - Krok 2 (booking_step_2): Still uses omni_view_content ✓`);
  console.log(`   - Krok 3 (booking_step_3): Still uses omni_initiated_checkout ✓`);
  console.log('\n🔄 Refresh your browser to see updated values!');
  console.log('═'.repeat(80) + '\n');
}

recollectMetaData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

