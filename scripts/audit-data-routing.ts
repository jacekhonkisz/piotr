/**
 * AUDIT: Data Routing Verification
 * 
 * Purpose: Verify if parser results are properly routed to cache and dashboard
 * - Check what parser returns
 * - Check what's in cache
 * - Check what dashboard would receive
 * - Trace the complete data flow
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { parseMetaActions, enhanceCampaignsWithConversions, aggregateConversionMetrics } from '../src/lib/meta-actions-parser';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Timeout wrapper
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`${errorMessage} (timeout after ${timeoutMs}ms)`));
      }, timeoutMs);
    })
  ]);
}

async function auditDataRouting() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 AUDIT: DATA ROUTING VERIFICATION');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Get Havet client (with timeout)
    console.log('📡 Fetching Havet client...');
    const { data: client, error: clientError } = await withTimeout(
      supabase
        .from('clients')
        .select('*')
        .ilike('name', '%havet%')
        .single()
        .then(({ data, error }) => ({ data, error })),
      10000,
      'Timeout fetching client'
    );
    
    if (clientError || !client) {
      console.error('❌ Failed to find Havet client:', clientError);
      return;
    }
    
    console.log('✅ Found Havet client:', client.name);

    // 2. Check current cache (with timeout)
    console.log('\n' + '-'.repeat(80));
    console.log('📦 STEP 1: CHECK CURRENT CACHE');
    console.log('-'.repeat(80));
    
    const periodId = '2026-01';
    console.log('📡 Fetching cache...');
    const { data: cache } = await withTimeout(
      supabase
        .from('current_month_cache')
        .select('*')
        .eq('client_id', client.id)
        .eq('period_id', periodId)
        .single()
        .then(({ data }) => ({ data })),
      10000,
      'Timeout fetching cache'
    );

    if (cache) {
      const cachePhones = cache.cache_data?.conversionMetrics?.click_to_call || 0;
      const cacheCampaigns = cache.cache_data?.campaigns || [];
      const sumFromCampaigns = cacheCampaigns.reduce((sum: number, c: any) => {
        return sum + (parseInt(c.click_to_call) || 0);
      }, 0);
      
      console.log('📊 Cache Data:');
      console.log(`   conversionMetrics.click_to_call: ${cachePhones}`);
      console.log(`   Sum from campaigns array: ${sumFromCampaigns}`);
      console.log(`   Last updated: ${cache.last_updated}`);
      console.log(`   Campaign count: ${cacheCampaigns.length}`);
      
      // Show campaign breakdown
      if (cacheCampaigns.length > 0) {
        console.log('\n   📋 Campaign Phone Counts in Cache:');
        cacheCampaigns.forEach((campaign: any, idx: number) => {
          const phones = campaign.click_to_call || 0;
          if (phones > 0 || idx < 5) { // Show first 5 or any with phones
            console.log(`      ${idx + 1}. ${campaign.campaign_name || campaign.name || 'Unknown'}: ${phones} phones`);
          }
        });
      }
    } else {
      console.log('⚠️ No cache found');
    }

    // 3. Fetch fresh and parse
    console.log('\n' + '-'.repeat(80));
    console.log('🔄 STEP 2: FETCH FRESH FROM META API AND PARSE');
    console.log('-'.repeat(80));
    
    const metaToken = client.system_user_token || client.meta_access_token;
    if (!metaToken) {
      console.error('❌ No Meta token available');
      return;
    }

    const metaService = new MetaAPIServiceOptimized(metaToken);
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    const startDate = '2026-01-01';
    const endDate = new Date().toISOString().split('T')[0];
    
    console.log(`📅 Fetching: ${startDate} to ${endDate}`);
    
    // Clear API cache
    metaService.clearCache();
    
    // Fetch raw (with timeout)
    console.log('📡 Fetching from Meta API (20s timeout)...');
    let rawCampaignInsights: any[] = [];
    try {
      rawCampaignInsights = await withTimeout(
        metaService.getCampaignInsights(
          adAccountId,
          startDate,
          endDate,
          0
        ),
        20000,
        'Timeout fetching from Meta API'
      );
      console.log(`✅ Fetched ${rawCampaignInsights.length} campaigns\n`);
    } catch (apiError) {
      console.error('❌ Failed to fetch from Meta API:', apiError instanceof Error ? apiError.message : apiError);
      console.log('⚠️ Continuing with cache data only...\n');
      // Continue with cache data if API fails
    }
    
    // Parse with current parser (with account-level PBM detection)
    let aggregated = { click_to_call: 0 };
    if (rawCampaignInsights.length > 0) {
      console.log('🔧 Parsing with account-level PBM detection...');
      const parsedCampaigns = enhanceCampaignsWithConversions(rawCampaignInsights);
      aggregated = aggregateConversionMetrics(parsedCampaigns);
      
      console.log('📊 Parser Results:');
      console.log(`   Total click_to_call: ${aggregated.click_to_call}`);
      console.log(`   Expected: 2 (PBM only)`);
      
      // Show per-campaign parser results
      const campaignsWithPhones = parsedCampaigns.filter((c: any) => (c.click_to_call || 0) > 0);
      if (campaignsWithPhones.length > 0) {
        console.log(`\n   📋 Campaigns with phones (${campaignsWithPhones.length}):`);
        campaignsWithPhones.slice(0, 10).forEach((campaign: any, idx: number) => {
          console.log(`      ${idx + 1}. ${campaign.campaign_name || campaign.name}: ${campaign.click_to_call} phones`);
        });
        if (campaignsWithPhones.length > 10) {
          console.log(`      ... and ${campaignsWithPhones.length - 10} more`);
        }
      }
    } else {
      console.log('⚠️ No campaign data to parse (API fetch failed or empty)');
    }
    
    // 4. Check what smart cache helper would do
    console.log('\n' + '-'.repeat(80));
    console.log('🔧 STEP 3: SIMULATE SMART CACHE HELPER LOGIC');
    console.log('-'.repeat(80));
    
    // Check daily_kpi_data (with timeout)
    console.log('📡 Fetching daily_kpi_data...');
    const { data: dailyKpi } = await withTimeout(
      supabase
        .from('daily_kpi_data')
        .select('*')
        .eq('client_id', client.id)
        .gte('date', '2026-01-01')
        .lte('date', '2026-01-31')
        .eq('platform', 'meta')
        .then(({ data }) => ({ data })),
      10000,
      'Timeout fetching daily_kpi_data'
    );
    
    const dailyKpiPhones = dailyKpi?.reduce((sum: number, d: any) => sum + (parseInt(d.click_to_call) || 0), 0) || 0;
    
    console.log('📊 Smart Cache Helper Priority Logic:');
    console.log(`   1. Fresh parser result: ${aggregated.click_to_call}`);
    console.log(`   2. daily_kpi_data: ${dailyKpiPhones}`);
    console.log(`   3. Final choice: ${aggregated.click_to_call > 0 ? aggregated.click_to_call : dailyKpiPhones}`);
    
    // 5. Compare cache vs fresh parser
    console.log('\n' + '-'.repeat(80));
    console.log('🔍 STEP 4: COMPARE CACHE VS FRESH PARSER');
    console.log('-'.repeat(80));
    
    if (cache) {
      const cachePhones = cache.cache_data?.conversionMetrics?.click_to_call || 0;
      console.log(`📊 Comparison:`);
      console.log(`   Cache value: ${cachePhones}`);
      console.log(`   Fresh parser: ${aggregated.click_to_call}`);
      console.log(`   Match: ${cachePhones === aggregated.click_to_call ? '✅ YES' : '❌ NO'}`);
      
      if (cachePhones !== aggregated.click_to_call) {
        console.log(`\n   ⚠️ MISMATCH DETECTED!`);
        console.log(`   → Cache has old value (${cachePhones})`);
        console.log(`   → Fresh parser returns correct value (${aggregated.click_to_call})`);
        console.log(`   → Cache needs to be refreshed`);
        
        // Check cache age
        const cacheAge = Date.now() - new Date(cache.last_updated).getTime();
        const cacheAgeHours = cacheAge / (1000 * 60 * 60);
        console.log(`\n   Cache age: ${cacheAgeHours.toFixed(2)} hours`);
        
        if (cacheAgeHours < 3) {
          console.log(`   → Cache is fresh (< 3 hours), but has wrong value`);
          console.log(`   → This means cache was populated with old parser logic`);
        } else {
          console.log(`   → Cache is stale (> 3 hours), should refresh automatically`);
        }
      }
    }
    
    // 6. Check if dashboard would use cache or fresh data
    console.log('\n' + '-'.repeat(80));
    console.log('🎯 STEP 5: DASHBOARD DATA SOURCE');
    console.log('-'.repeat(80));
    
    if (cache) {
      const cacheAge = Date.now() - new Date(cache.last_updated).getTime();
      const cacheAgeHours = cacheAge / (1000 * 60 * 60);
      const isCacheFresh = cacheAgeHours < 3;
      
      console.log(`📊 Dashboard Logic:`);
      console.log(`   Cache exists: ✅ YES`);
      console.log(`   Cache age: ${cacheAgeHours.toFixed(2)} hours`);
      console.log(`   Cache is fresh: ${isCacheFresh ? '✅ YES' : '❌ NO'}`);
      
      if (isCacheFresh) {
        console.log(`   → Dashboard will use CACHE (${cache.cache_data?.conversionMetrics?.click_to_call || 0} phones)`);
        console.log(`   → This is why you see 12 phones!`);
      } else {
        console.log(`   → Dashboard should refresh cache (stale)`);
        console.log(`   → But may still use stale cache if refresh fails`);
      }
    } else {
      console.log(`   Cache doesn't exist`);
      console.log(`   → Dashboard will fetch fresh data`);
      console.log(`   → Should show ${aggregated.click_to_call} phones`);
    }
    
    // 7. Recommendations
    console.log('\n' + '='.repeat(80));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    if (cache && cache.cache_data?.conversionMetrics?.click_to_call === 12) {
      console.log('\n❌ ISSUE: Cache has wrong value (12 phones)');
      console.log('\n✅ SOLUTION:');
      console.log('   1. Delete cache:');
      console.log(`      DELETE FROM current_month_cache WHERE client_id = '${client.id}' AND period_id = '${periodId}';`);
      console.log('   2. Refresh dashboard (will fetch fresh with new parser)');
      console.log('   3. Expected result: 2 phones');
    } else if (aggregated.click_to_call === 12) {
      console.log('\n❌ ISSUE: Parser still returns 12 phones');
      console.log('   → Account-level PBM detection may not be working');
      console.log('   → Need to debug parser logic further');
    } else if (aggregated.click_to_call === 2) {
      console.log('\n✅ Parser is working correctly (returns 2 phones)');
      console.log('   → Cache just needs to be cleared and refreshed');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Audit complete!');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

auditDataRouting().catch(console.error);

