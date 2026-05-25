/**
 * Backfill Historical CTR/CPC for All Clients
 * 
 * This script updates all historical Meta Ads data in campaign_summaries
 * to use account-level insights CTR/CPC values from Meta API instead of calculated values.
 * 
 * Usage:
 *   npx tsx scripts/backfill-historical-ctr-cpc-all-clients.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface HistoricalSummary {
  id: string;
  client_id: string;
  summary_type: 'weekly' | 'monthly';
  summary_date: string;
  platform: string;
  average_ctr: number;
  average_cpc: number;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
}

interface ClientInfo {
  id: string;
  name: string;
  meta_access_token: string | null;
  system_user_token: string | null;
  ad_account_id: string | null;
}

async function backfillHistoricalCTRCPC() {
  console.log('🔄 BACKFILL: Historical CTR/CPC for All Clients\n');
  console.log('='.repeat(70));

  try {
    // 1. Get all clients with Meta Ads configured
    console.log('1️⃣ Finding all clients with Meta Ads...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, system_user_token, ad_account_id')
      .or('meta_access_token.not.is.null,system_user_token.not.is.null')
      .not('ad_account_id', 'is', null);

    if (clientsError || !clients || clients.length === 0) {
      console.error('❌ Error finding clients:', clientsError);
      return;
    }

    console.log(`✅ Found ${clients.length} clients with Meta Ads configured\n`);

    // 2. Get all historical Meta Ads summaries
    console.log('2️⃣ Finding all historical Meta Ads summaries...');
    const { data: summaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('id, client_id, summary_type, summary_date, platform, average_ctr, average_cpc, total_spend, total_impressions, total_clicks')
      .eq('platform', 'meta')
      .order('client_id', { ascending: true })
      .order('summary_date', { ascending: true });

    if (summariesError) {
      console.error('❌ Error finding summaries:', summariesError);
      return;
    }

    if (!summaries || summaries.length === 0) {
      console.log('⚠️  No historical summaries found');
      return;
    }

    console.log(`✅ Found ${summaries.length} historical summaries\n`);

    // 3. Group summaries by client
    const summariesByClient = new Map<string, HistoricalSummary[]>();
    summaries.forEach((summary: HistoricalSummary) => {
      if (!summariesByClient.has(summary.client_id)) {
        summariesByClient.set(summary.client_id, []);
      }
      summariesByClient.get(summary.client_id)!.push(summary);
    });

    console.log(`📊 Processing ${summariesByClient.size} clients...\n`);

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // 4. Process each client
    for (const client of clients) {
      const clientSummaries = summariesByClient.get(client.id);
      if (!clientSummaries || clientSummaries.length === 0) {
        console.log(`⏭️  Skipping ${client.name} - no historical summaries`);
        continue;
      }

      console.log(`\n${'='.repeat(70)}`);
      console.log(`📊 Processing: ${client.name}`);
      console.log(`   Client ID: ${client.id}`);
      console.log(`   Summaries: ${clientSummaries.length}`);
      console.log(`   Ad Account: ${client.ad_account_id || 'NOT SET'}`);

      if (!client.ad_account_id) {
        console.log(`   ⚠️  Skipping - no ad account ID`);
        totalSkipped += clientSummaries.length;
        continue;
      }

      const metaToken = client.system_user_token || client.meta_access_token;
      if (!metaToken) {
        console.log(`   ⚠️  Skipping - no Meta token`);
        totalSkipped += clientSummaries.length;
        continue;
      }

      // Clean ad account ID
      const adAccountId = client.ad_account_id.startsWith('act_') 
        ? client.ad_account_id.substring(4) 
        : client.ad_account_id;

      const metaService = new MetaAPIServiceOptimized(metaToken);

      // 5. Process each summary for this client
      for (const summary of clientSummaries) {
        totalProcessed++;

        try {
          // Calculate date range for this summary
          let startDate: string;
          let endDate: string;

          if (summary.summary_type === 'monthly') {
            // Monthly: summary_date is first day of month
            startDate = summary.summary_date;
            const date = new Date(summary.summary_date);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            endDate = lastDay.toISOString().split('T')[0];
          } else {
            // Weekly: summary_date is start date, calculate end date (7 days later)
            startDate = summary.summary_date;
            const date = new Date(summary.summary_date);
            date.setDate(date.getDate() + 6);
            endDate = date.toISOString().split('T')[0];
          }

          // Skip if no spend (likely no data)
          if (summary.total_spend === 0 && summary.total_impressions === 0) {
            console.log(`   ⏭️  Skipping ${summary.summary_type} ${summary.summary_date} - no data`);
            totalSkipped++;
            continue;
          }

          // Fetch account-level insights
          console.log(`   🔄 Fetching API values for ${summary.summary_type} ${summary.summary_date}...`);
          const accountInsights = await metaService.getAccountInsights(adAccountId, startDate, endDate);

          if (!accountInsights) {
            console.log(`   ⚠️  No account insights available, keeping calculated values`);
            totalSkipped++;
            continue;
          }

          // Extract API values
          const apiCtr = parseFloat(accountInsights.inline_link_click_ctr || accountInsights.ctr || '0');
          const apiCpc = parseFloat(accountInsights.cost_per_inline_link_click || accountInsights.cpc || '0');

          // Calculate what the current value is (for comparison)
          const currentCtr = summary.average_ctr || 0;
          const currentCpc = summary.average_cpc || 0;

          // Check if values are different (more than 0.01% or 0.01 zł difference)
          const ctrDiff = Math.abs(apiCtr - currentCtr);
          const cpcDiff = Math.abs(apiCpc - currentCpc);

          if (ctrDiff < 0.01 && cpcDiff < 0.01) {
            console.log(`   ✅ Values match (CTR: ${apiCtr.toFixed(2)}%, CPC: ${apiCpc.toFixed(2)} zł) - skipping update`);
            totalSkipped++;
            continue;
          }

          // Update database
          const { error: updateError } = await supabase
            .from('campaign_summaries')
            .update({
              average_ctr: apiCtr,
              average_cpc: apiCpc,
              last_updated: new Date().toISOString()
            })
            .eq('id', summary.id);

          if (updateError) {
            console.error(`   ❌ Error updating ${summary.summary_type} ${summary.summary_date}:`, updateError.message);
            totalErrors++;
          } else {
            console.log(`   ✅ Updated ${summary.summary_type} ${summary.summary_date}:`);
            console.log(`      CTR: ${currentCtr.toFixed(2)}% → ${apiCtr.toFixed(2)}% (diff: ${ctrDiff.toFixed(2)}%)`);
            console.log(`      CPC: ${currentCpc.toFixed(2)} zł → ${apiCpc.toFixed(2)} zł (diff: ${cpcDiff.toFixed(2)} zł)`);
            totalUpdated++;
          }

          // Rate limiting: wait 100ms between API calls
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          console.error(`   ❌ Error processing ${summary.summary_type} ${summary.summary_date}:`, error.message);
          totalErrors++;
        }
      }

      // Wait between clients to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 6. Summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Summaries Processed: ${totalProcessed}`);
    console.log(`✅ Successfully Updated: ${totalUpdated}`);
    console.log(`⏭️  Skipped (no change or no data): ${totalSkipped}`);
    console.log(`❌ Errors: ${totalErrors}`);
    console.log(`\n✅ Backfill complete!`);

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the script
backfillHistoricalCTRCPC()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });



