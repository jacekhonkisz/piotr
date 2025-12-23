#!/usr/bin/env node
/**
 * Update ALL historical Meta data to use inline_link_clicks instead of all clicks
 * This will recalculate CTR and CPC for all past periods to match Meta Business Suite
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized.js';
import { parseMetaActions } from '../src/lib/meta-actions-parser.js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Period {
  summary_date: string;
  summary_type: string;
  id: string;
}

async function updateHistoricalMetaData() {
  console.log('🔄 Updating ALL historical Meta data with link clicks...');
  console.log('');

  // Get all Meta-enabled clients
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, system_user_token, meta_access_token')
    .not('ad_account_id', 'is', null);

  if (clientError || !clients || clients.length === 0) {
    console.error('❌ Error fetching clients:', clientError?.message);
    return;
  }

  console.log(`📊 Found ${clients.length} Meta-enabled clients`);
  console.log('');

  let totalUpdated = 0;
  let totalErrors = 0;

  for (const client of clients) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📍 Processing: ${client.name}`);
    console.log(`${'='.repeat(80)}\n`);

    const token = client.system_user_token || client.meta_access_token;
    if (!token) {
      console.log(`⚠️  No token available for ${client.name}, skipping...`);
      continue;
    }

    const adAccountId = client.ad_account_id.replace('act_', '');
    const metaService = new MetaAPIServiceOptimized(token);

    // Get all historical periods for this client
    const { data: summaries } = await supabase
      .from('campaign_summaries')
      .select('id, summary_date, summary_type')
      .eq('client_id', client.id)
      .eq('platform', 'meta')
      .order('summary_date', { ascending: false });

    if (!summaries || summaries.length === 0) {
      console.log(`   ℹ️  No historical data found`);
      continue;
    }

    console.log(`   📅 Found ${summaries.length} historical periods to update`);

    for (const summary of summaries as Period[]) {
      try {
        const isMonthly = summary.summary_type === 'monthly';
        const displayDate = summary.summary_date.substring(0, isMonthly ? 7 : 10);
        console.log(`   🔄 ${displayDate} (${summary.summary_type})...`);

        // Calculate date range based on summary type
        let periodStart: string;
        let periodEnd: string;
        
        if (isMonthly) {
          // For monthly: use first and last day of month
          const date = new Date(summary.summary_date);
          periodStart = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
          periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
        } else {
          // For weekly: use the week start date + 6 days
          const date = new Date(summary.summary_date);
          periodStart = summary.summary_date;
          const endDate = new Date(date);
          endDate.setDate(endDate.getDate() + 6);
          periodEnd = endDate.toISOString().split('T')[0];
        }

        // Fetch fresh data from Meta API with inline_link_clicks
        const campaigns = await metaService.getCampaignInsights(
          adAccountId,
          periodStart,
          periodEnd
        );

        if (!campaigns || campaigns.length === 0) {
          console.log(`      ⚠️  No campaigns found, skipping`);
          continue;
        }

        // Calculate totals using inline_link_clicks
        let totalSpend = 0;
        let totalImpressions = 0;
        let totalLinkClicks = 0; // ✅ Link clicks only
        let totalConversions = 0;

        const campaignData = campaigns.map(campaign => {
          const spend = parseFloat(campaign.spend || '0');
          const impressions = parseInt(campaign.impressions || '0');
          const linkClicks = parseInt(campaign.inline_link_clicks || campaign.clicks || '0'); // ✅ Link clicks
          const conversions = parseInt(campaign.conversions || '0');

          totalSpend += spend;
          totalImpressions += impressions;
          totalLinkClicks += linkClicks;
          totalConversions += conversions;

          // Recalculate CTR and CPC from link clicks
          const ctr = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
          const cpc = linkClicks > 0 ? spend / linkClicks : 0;

          // Parse funnel metrics
          const funnelMetrics = parseMetaActions(campaign.actions, campaign.action_values);

          return {
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            status: campaign.status || 'ACTIVE',
            spend,
            impressions,
            clicks: linkClicks, // ✅ Store link clicks
            conversions,
            ctr, // ✅ Recalculated from link clicks
            cpc, // ✅ Recalculated from link clicks
            ...funnelMetrics
          };
        });

        // Calculate aggregated metrics
        const avgCtr = totalImpressions > 0 ? (totalLinkClicks / totalImpressions) * 100 : 0;
        const avgCpc = totalLinkClicks > 0 ? totalSpend / totalLinkClicks : 0;

        // Get funnel metrics
        const totalFunnelMetrics = campaignData.reduce((acc, c) => ({
          click_to_call: acc.click_to_call + (c.click_to_call || 0),
          email_contacts: acc.email_contacts + (c.email_contacts || 0),
          booking_step_1: acc.booking_step_1 + (c.booking_step_1 || 0),
          booking_step_2: acc.booking_step_2 + (c.booking_step_2 || 0),
          booking_step_3: acc.booking_step_3 + (c.booking_step_3 || 0),
          reservations: acc.reservations + (c.reservations || 0),
          reservation_value: acc.reservation_value + (c.reservation_value || 0)
        }), {
          click_to_call: 0,
          email_contacts: 0,
          booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0,
          reservations: 0,
          reservation_value: 0
        });

        // Update database
        const { error: updateError } = await supabase
          .from('campaign_summaries')
          .update({
            total_spend: totalSpend,
            total_impressions: totalImpressions,
            total_clicks: totalLinkClicks, // ✅ Link clicks only
            total_conversions: totalConversions || 0, // ✅ Default to 0 if null
            average_ctr: avgCtr, // ✅ From link clicks
            average_cpc: avgCpc, // ✅ From link clicks
            campaign_data: campaignData,
            ...totalFunnelMetrics,
            last_updated: new Date().toISOString()
          })
          .eq('id', summary.id);

        if (updateError) {
          console.log(`      ❌ Error: ${updateError.message}`);
          totalErrors++;
        } else {
          console.log(`      ✅ Updated (CTR: ${avgCtr.toFixed(2)}%, CPC: ${avgCpc.toFixed(2)} zł, Clicks: ${totalLinkClicks})`);
          totalUpdated++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        console.log(`      ❌ Error: ${error.message}`);
        totalErrors++;
      }
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('🎉 UPDATE COMPLETE!');
  console.log('='.repeat(80));
  console.log(`✅ Successfully updated: ${totalUpdated} periods`);
  console.log(`❌ Errors: ${totalErrors}`);
  console.log('');
  console.log('💡 All historical Meta data now uses:');
  console.log('   • inline_link_clicks (link clicks only)');
  console.log('   • Recalculated CTR from link clicks');
  console.log('   • Recalculated CPC from link clicks');
  console.log('');
  console.log('🎯 All values now match Meta Business Suite!');
}

// Run the update
updateHistoricalMetaData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

