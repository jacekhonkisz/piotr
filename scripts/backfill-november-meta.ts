/**
 * BACKFILL NOVEMBER 2025 META DATA
 * 
 * This script re-fetches Meta Ads data for November 2025 for all clients
 * that have zeros in their campaign_summaries table.
 * 
 * Run with: npx tsx scripts/backfill-november-meta.ts
 */

import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { enhanceCampaignsWithConversions } from '../src/lib/meta-actions-parser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// November 2025 date range
const NOVEMBER_START = '2025-11-01';
const NOVEMBER_END = '2025-11-30';

interface Client {
  id: string;
  name: string;
  meta_access_token?: string;
  system_user_token?: string;
  ad_account_id?: string;
}

async function backfillNovemberMeta() {
  console.log('🚀 Starting November 2025 Meta Data Backfill');
  console.log('='.repeat(60));
  
  // Step 1: Find clients with zero Meta data for November
  const { data: zeroDataClients, error: queryError } = await supabase
    .from('campaign_summaries')
    .select(`
      client_id,
      total_spend,
      total_impressions,
      clients!inner(id, name, meta_access_token, system_user_token, ad_account_id)
    `)
    .eq('summary_date', NOVEMBER_START)
    .eq('summary_type', 'monthly')
    .eq('platform', 'meta')
    .eq('total_spend', 0);

  if (queryError) {
    console.error('❌ Query error:', queryError);
    return;
  }

  console.log(`\n📊 Found ${zeroDataClients?.length || 0} clients with zero Meta data for November 2025\n`);

  if (!zeroDataClients || zeroDataClients.length === 0) {
    console.log('✅ No clients need backfilling!');
    return;
  }

  // Step 2: Process each client
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const record of zeroDataClients) {
    const client = record.clients as unknown as Client;
    
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📌 Processing: ${client.name}`);
    
    // Check if client has Meta credentials
    const metaToken = client.system_user_token || client.meta_access_token;
    
    if (!metaToken) {
      console.log(`⏭️  Skipping - No Meta token available`);
      skippedCount++;
      continue;
    }
    
    if (!client.ad_account_id) {
      console.log(`⏭️  Skipping - No Ad Account ID`);
      skippedCount++;
      continue;
    }

    try {
      // Initialize Meta API service
      const metaService = new MetaAPIServiceOptimized(metaToken);
      
      // Validate token first
      console.log(`🔑 Validating token...`);
      const tokenValidation = await metaService.validateToken();
      
      if (!tokenValidation.valid) {
        console.log(`❌ Invalid token: ${tokenValidation.error}`);
        failedCount++;
        continue;
      }
      
      console.log(`✅ Token valid. Fetching November data...`);
      
      // Fetch campaign insights
      const processedAdAccountId = client.ad_account_id.startsWith('act_') 
        ? client.ad_account_id.substring(4) 
        : client.ad_account_id;
      
      const rawCampaignInsights = await metaService.getCampaignInsights(
        processedAdAccountId,
        NOVEMBER_START,
        NOVEMBER_END,
        0  // timeIncrement = 0 for period totals
      );
      
      // Parse conversion metrics
      const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);
      
      console.log(`📊 Retrieved ${campaignInsights.length} campaigns`);
      
      if (campaignInsights.length === 0) {
        console.log(`⚠️  No campaigns returned from API`);
        failedCount++;
        continue;
      }
      
      // Calculate totals
      const totals = campaignInsights.reduce((acc: any, campaign: any) => ({
        spend: acc.spend + (parseFloat(campaign.spend) || 0),
        impressions: acc.impressions + (parseInt(campaign.impressions) || 0),
        clicks: acc.clicks + (parseInt(campaign.clicks) || 0),
        conversions: acc.conversions + (parseInt(campaign.conversions) || 0),
        reach: acc.reach + (parseInt(campaign.reach) || 0),
        click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
        email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
        booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
        booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
        booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
        reservations: acc.reservations + (campaign.reservations || 0),
        reservation_value: acc.reservation_value + (campaign.reservation_value || 0)
      }), { 
        spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0,
        click_to_call: 0, email_contacts: 0, booking_step_1: 0, 
        booking_step_2: 0, booking_step_3: 0, reservations: 0, reservation_value: 0
      });
      
      console.log(`💰 Total spend: ${totals.spend.toFixed(2)} PLN`);
      console.log(`👁️  Impressions: ${totals.impressions.toLocaleString()}`);
      console.log(`👆 Clicks: ${totals.clicks.toLocaleString()}`);
      console.log(`🎯 Reservations: ${totals.reservations}`);
      
      // Save to database
      const { error: saveError } = await supabase
        .from('campaign_summaries')
        .upsert({
          client_id: client.id,
          platform: 'meta',
          summary_type: 'monthly',
          summary_date: NOVEMBER_START,
          total_spend: totals.spend,
          total_impressions: totals.impressions,
          total_clicks: totals.clicks,
          total_conversions: totals.conversions,
          average_ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
          average_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
          click_to_call: totals.click_to_call,
          email_contacts: totals.email_contacts,
          booking_step_1: totals.booking_step_1,
          booking_step_2: totals.booking_step_2,
          booking_step_3: totals.booking_step_3,
          reservations: totals.reservations,
          reservation_value: totals.reservation_value,
          campaign_data: campaignInsights,
          data_source: 'api_backfill_november',
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'client_id,summary_type,summary_date,platform'
        });
      
      if (saveError) {
        console.log(`❌ Save error: ${saveError.message}`);
        failedCount++;
      } else {
        console.log(`✅ Successfully saved November data!`);
        successCount++;
      }
      
      // Small delay between clients to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failedCount++;
    }
  }
  
  // Final summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 BACKFILL COMPLETE');
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);
  console.log(`⏭️  Skipped: ${skippedCount}`);
  console.log(`📊 Total: ${zeroDataClients.length}`);
}

// Run the backfill
backfillNovemberMeta()
  .then(() => {
    console.log('\n🏁 Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('🔥 Fatal error:', error);
    process.exit(1);
  });

