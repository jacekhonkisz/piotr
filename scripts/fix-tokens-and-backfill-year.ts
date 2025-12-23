/**
 * FIX SYSTEM TOKENS AND BACKFILL ENTIRE PAST YEAR
 * 
 * This script:
 * 1. Copies the shared system_user_token from Belmonte to ALL clients
 * 2. Backfills 12 months of Meta data for all clients with zeros
 * 
 * Run with: npx tsx scripts/fix-tokens-and-backfill-year.ts
 * 
 * Options:
 *   --dry-run     : Don't make changes, just show what would happen
 *   --skip-tokens : Skip token copying, only do backfill
 *   --months=N    : Number of months to backfill (default: 12)
 */

// Load environment variables from .env.local
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { enhanceCampaignsWithConversions } from '../src/lib/meta-actions-parser';

// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables!');
  console.error('   Make sure .env.local contains:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SKIP_TOKENS = args.includes('--skip-tokens');
const monthsArg = args.find(a => a.startsWith('--months='));
const MONTHS_TO_BACKFILL = monthsArg ? parseInt(monthsArg.split('=')[1]) : 12;

interface Client {
  id: string;
  name: string;
  meta_access_token?: string;
  system_user_token?: string;
  ad_account_id?: string;
}

// Get month boundaries (timezone-safe)
function getMonthBoundaries(year: number, month: number): { start: string; end: string } {
  // First day of month
  const startDate = new Date(year, month - 1, 1);
  // Last day of month
  const endDate = new Date(year, month, 0);
  
  // Format as YYYY-MM-DD without timezone issues
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  
  return {
    start: formatDate(startDate),
    end: formatDate(endDate)
  };
}

// Get list of past months to backfill
function getMonthsToBackfill(count: number): { year: number; month: number; label: string }[] {
  const months: { year: number; month: number; label: string }[] = [];
  const now = new Date();
  
  // Start from last complete month (not current month)
  for (let i = 1; i <= count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    months.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: `${monthNames[date.getMonth()]} ${date.getFullYear()}`
    });
  }
  
  return months;
}

async function main() {
  console.log('🚀 FIX TOKENS AND BACKFILL PAST YEAR');
  console.log('='.repeat(70));
  console.log(`📋 Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚡ LIVE (making changes)'}`);
  console.log(`📅 Months to backfill: ${MONTHS_TO_BACKFILL}`);
  console.log(`🔑 Token fix: ${SKIP_TOKENS ? 'SKIPPED' : 'ENABLED'}`);
  console.log('='.repeat(70));

  // =========================================================================
  // STEP 1: Fix System User Tokens
  // =========================================================================
  
  if (!SKIP_TOKENS) {
    console.log('\n\n📌 STEP 1: COPYING SHARED SYSTEM USER TOKEN TO ALL CLIENTS');
    console.log('─'.repeat(70));
    
    // Get the system_user_token from Belmonte (or first client that has one)
    const { data: sourceClient, error: sourceError } = await supabase
      .from('clients')
      .select('name, system_user_token')
      .not('system_user_token', 'is', null)
      .limit(1)
      .single();
    
    if (sourceError || !sourceClient?.system_user_token) {
      console.log('❌ No client found with system_user_token!');
      console.log('   Please manually set system_user_token on at least one client first.');
      return;
    }
    
    console.log(`✅ Found shared token from: ${sourceClient.name}`);
    console.log(`   Token preview: ${sourceClient.system_user_token.substring(0, 30)}...`);
    
    // Get all clients that need the token
    const { data: clientsNeedingToken, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, system_user_token, meta_access_token, ad_account_id')
      .not('ad_account_id', 'is', null); // Only clients with Meta ad accounts
    
    if (clientsError) {
      console.log('❌ Error fetching clients:', clientsError);
      return;
    }
    
    const needsUpdate = (clientsNeedingToken || []).filter(c => 
      c.system_user_token !== sourceClient.system_user_token
    );
    
    console.log(`\n📊 Clients needing token update: ${needsUpdate.length}`);
    
    for (const client of needsUpdate) {
      console.log(`   - ${client.name}: ${client.system_user_token ? 'Different token' : 'No system token'}`);
      
      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ system_user_token: sourceClient.system_user_token })
          .eq('id', client.id);
        
        if (updateError) {
          console.log(`     ❌ Update failed: ${updateError.message}`);
        } else {
          console.log(`     ✅ Token updated!`);
        }
      }
    }
    
    if (DRY_RUN && needsUpdate.length > 0) {
      console.log(`\n   💡 Run without --dry-run to update ${needsUpdate.length} clients`);
    }
  }

  // =========================================================================
  // STEP 2: Backfill Past Year of Meta Data
  // =========================================================================
  
  console.log('\n\n📌 STEP 2: BACKFILLING META DATA FOR PAST YEAR');
  console.log('─'.repeat(70));
  
  // Get all clients with Meta credentials
  const { data: clients, error: fetchError } = await supabase
    .from('clients')
    .select('id, name, system_user_token, meta_access_token, ad_account_id')
    .not('ad_account_id', 'is', null);
  
  if (fetchError || !clients) {
    console.log('❌ Error fetching clients:', fetchError);
    return;
  }
  
  console.log(`📊 Found ${clients.length} clients with Meta ad accounts`);
  
  const monthsToBackfill = getMonthsToBackfill(MONTHS_TO_BACKFILL);
  console.log(`📅 Months to check: ${monthsToBackfill.map(m => m.label).join(', ')}`);
  
  // Track results
  const results: { client: string; month: string; status: string; spend?: number }[] = [];
  
  for (const client of clients as Client[]) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📌 CLIENT: ${client.name}`);
    console.log(`${'═'.repeat(60)}`);
    
    const metaToken = client.system_user_token || client.meta_access_token;
    
    if (!metaToken) {
      console.log('   ⏭️ Skipping - No Meta token');
      continue;
    }
    
    // Validate token once per client
    let metaService: MetaAPIServiceOptimized;
    try {
      metaService = new MetaAPIServiceOptimized(metaToken);
      const validation = await metaService.validateToken();
      
      if (!validation.valid) {
        console.log(`   ❌ Invalid token: ${validation.error}`);
        for (const month of monthsToBackfill) {
          results.push({ client: client.name, month: month.label, status: '❌ Invalid token' });
        }
        continue;
      }
      console.log('   ✅ Token valid');
    } catch (error) {
      console.log(`   ❌ Token error: ${error}`);
      continue;
    }
    
    const processedAdAccountId = client.ad_account_id!.startsWith('act_') 
      ? client.ad_account_id!.substring(4) 
      : client.ad_account_id!;
    
    // Process each month
    for (const monthData of monthsToBackfill) {
      const { start, end } = getMonthBoundaries(monthData.year, monthData.month);
      
      // Check if we already have good data for this month
      const { data: existing } = await supabase
        .from('campaign_summaries')
        .select('total_spend, total_impressions, campaign_data')
        .eq('client_id', client.id)
        .eq('platform', 'meta')
        .eq('summary_type', 'monthly')
        .eq('summary_date', start)
        .single();
      
      const hasGoodData = existing && 
        (parseFloat(existing.total_spend) > 0 || existing.total_impressions > 0) &&
        existing.campaign_data && 
        Array.isArray(existing.campaign_data) && 
        existing.campaign_data.length > 0;
      
      if (hasGoodData) {
        console.log(`   ⏭️ ${monthData.label}: Already has good data (${existing.total_spend} PLN)`);
        results.push({ 
          client: client.name, 
          month: monthData.label, 
          status: '⏭️ Skipped (has data)',
          spend: parseFloat(existing.total_spend)
        });
        continue;
      }
      
      console.log(`   📡 ${monthData.label}: Fetching from Meta API...`);
      
      if (DRY_RUN) {
        console.log(`      🔍 DRY RUN: Would fetch ${start} to ${end}`);
        results.push({ client: client.name, month: monthData.label, status: '🔍 Would fetch' });
        continue;
      }
      
      try {
        // Fetch campaign insights
        const rawCampaignInsights = await metaService.getCampaignInsights(
          processedAdAccountId,
          start,
          end,
          0  // timeIncrement = 0 for period totals
        );
        
        // Parse conversion metrics
        const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);
        
        if (campaignInsights.length === 0) {
          console.log(`      ⚠️ No campaigns returned from API`);
          results.push({ client: client.name, month: monthData.label, status: '⚠️ No campaigns' });
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
        
        // Save to database
        const { error: saveError } = await supabase
          .from('campaign_summaries')
          .upsert({
            client_id: client.id,
            platform: 'meta',
            summary_type: 'monthly',
            summary_date: start,
            total_spend: totals.spend,
            total_impressions: totals.impressions,
            total_clicks: totals.clicks,
            total_conversions: totals.conversions,
            average_ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
            average_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
            click_to_call: Math.round(totals.click_to_call),
            email_contacts: Math.round(totals.email_contacts),
            booking_step_1: Math.round(totals.booking_step_1),
            booking_step_2: Math.round(totals.booking_step_2),
            booking_step_3: Math.round(totals.booking_step_3),
            reservations: Math.round(totals.reservations),
            reservation_value: totals.reservation_value,
            campaign_data: campaignInsights,
            data_source: 'api_backfill_yearly',
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'client_id,summary_type,summary_date,platform'
          });
        
        if (saveError) {
          console.log(`      ❌ Save error: ${saveError.message}`);
          results.push({ client: client.name, month: monthData.label, status: '❌ Save failed' });
        } else {
          console.log(`      ✅ Saved: ${totals.spend.toFixed(2)} PLN, ${campaignInsights.length} campaigns`);
          results.push({ 
            client: client.name, 
            month: monthData.label, 
            status: '✅ Backfilled',
            spend: totals.spend
          });
        }
        
        // Small delay between API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.log(`      ❌ Error: ${errorMsg}`);
        results.push({ client: client.name, month: monthData.label, status: `❌ ${errorMsg}` });
      }
    }
  }

  // =========================================================================
  // FINAL SUMMARY
  // =========================================================================
  
  console.log('\n\n' + '═'.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(70));
  
  const backfilled = results.filter(r => r.status === '✅ Backfilled');
  const skipped = results.filter(r => r.status.includes('Skipped'));
  const failed = results.filter(r => r.status.includes('❌'));
  const noCampaigns = results.filter(r => r.status.includes('No campaigns'));
  
  console.log(`\n✅ Successfully backfilled: ${backfilled.length}`);
  console.log(`⏭️  Skipped (already had data): ${skipped.length}`);
  console.log(`⚠️  No campaigns from API: ${noCampaigns.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📊 Total processed: ${results.length}`);
  
  if (backfilled.length > 0) {
    const totalSpend = backfilled.reduce((sum, r) => sum + (r.spend || 0), 0);
    console.log(`\n💰 Total spend backfilled: ${totalSpend.toFixed(2)} PLN`);
  }
  
  if (failed.length > 0) {
    console.log('\n🚨 FAILED ITEMS:');
    for (const f of failed.slice(0, 20)) {
      console.log(`   - ${f.client} / ${f.month}: ${f.status}`);
    }
    if (failed.length > 20) {
      console.log(`   ... and ${failed.length - 20} more`);
    }
  }
  
  if (DRY_RUN) {
    console.log('\n💡 This was a DRY RUN. Run without --dry-run to make actual changes.');
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n🏁 Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('🔥 Fatal error:', error);
    process.exit(1);
  });

