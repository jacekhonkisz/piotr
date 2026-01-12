/**
 * COMPREHENSIVE HAVET PHONE AUDIT
 * 
 * Purpose: Audit why dashboard shows 12 phones when it should be 2
 * - Check all data sources (cache, database, live API)
 * - Fetch live data from Meta API
 * - Compare what each source returns
 * - Identify where the 12 is coming from
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

async function comprehensiveAudit() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 COMPREHENSIVE HAVET PHONE AUDIT - JANUARY 2026');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Get Havet client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%havet%')
      .single();
    
    if (clientError || !client) {
      console.error('❌ Failed to find Havet client:', clientError);
      return;
    }
    
    console.log('✅ Found Havet client:', {
      id: client.id,
      name: client.name,
      hasMetaToken: !!client.meta_access_token,
      hasSystemUserToken: !!client.system_user_token,
      adAccountId: client.ad_account_id
    });

    // 2. Check current month cache
    console.log('\n' + '-'.repeat(80));
    console.log('📦 STEP 1: CHECKING CURRENT_MONTH_CACHE');
    console.log('-'.repeat(80));
    
    const periodId = '2026-01';
    let cachePhones = 0;
    let sumFromCampaigns = 0;
    let totalPhones = 0;
    
    const { data: cache, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();

    if (cache) {
      cachePhones = cache.cache_data?.conversionMetrics?.click_to_call || 0;
      const cacheCampaigns = cache.cache_data?.campaigns || [];
      sumFromCampaigns = cacheCampaigns.reduce((sum: number, c: any) => {
        return sum + (parseInt(c.click_to_call) || 0);
      }, 0);
      
      console.log('📊 Cache Data:');
      console.log(`   Period: ${cache.period_id}`);
      console.log(`   Last Updated: ${cache.last_updated}`);
      console.log(`   conversionMetrics.click_to_call: ${cachePhones}`);
      console.log(`   Sum from campaigns: ${sumFromCampaigns}`);
      console.log(`   Campaign count: ${cacheCampaigns.length}`);
      
      // Show individual campaign phone counts
      if (cacheCampaigns.length > 0) {
        console.log('\n   📋 Individual Campaign Phone Counts:');
        cacheCampaigns.forEach((campaign: any, idx: number) => {
          const phones = campaign.click_to_call || 0;
          if (phones > 0) {
            console.log(`      ${idx + 1}. ${campaign.campaign_name || campaign.name || 'Unknown'}: ${phones}`);
          }
        });
      }
    } else {
      console.log('⚠️ No cache found');
    }

    // 3. Check campaign_summaries
    console.log('\n' + '-'.repeat(80));
    console.log('📊 STEP 2: CHECKING CAMPAIGN_SUMMARIES');
    console.log('-'.repeat(80));
    
    const { data: summaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('summary_date', '2026-01-01')
      .eq('summary_type', 'monthly')
      .eq('platform', 'meta');

    if (summaries && summaries.length > 0) {
      summaries.forEach((summary: any) => {
        console.log('📊 Summary Data:');
        console.log(`   Date: ${summary.summary_date}`);
        console.log(`   Type: ${summary.summary_type}`);
        console.log(`   Platform: ${summary.platform}`);
        console.log(`   click_to_call: ${summary.click_to_call || 0}`);
        console.log(`   Last Updated: ${summary.last_updated}`);
      });
    } else {
      console.log('⚠️ No campaign_summaries found for January 2026');
    }

    // 4. Check daily_kpi_data
    console.log('\n' + '-'.repeat(80));
    console.log('📅 STEP 3: CHECKING DAILY_KPI_DATA');
    console.log('-'.repeat(80));
    
    const { data: dailyKpi, error: dailyError } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', client.id)
      .gte('date', '2026-01-01')
      .lte('date', '2026-01-31')
      .eq('platform', 'meta')
      .order('date', { ascending: true });

    if (dailyKpi && dailyKpi.length > 0) {
      totalPhones = dailyKpi.reduce((sum: number, day: any) => {
        return sum + (parseInt(day.click_to_call) || 0);
      }, 0);
      
      console.log(`📊 Daily KPI Data (${dailyKpi.length} days):`);
      console.log(`   Total click_to_call: ${totalPhones}`);
      
      // Show daily breakdown
      const daysWithPhones = dailyKpi.filter((d: any) => (d.click_to_call || 0) > 0);
      if (daysWithPhones.length > 0) {
        console.log('\n   📋 Days with phone clicks:');
        daysWithPhones.forEach((day: any) => {
          console.log(`      ${day.date}: ${day.click_to_call} phones (source: ${day.data_source || 'unknown'})`);
        });
      }
    } else {
      console.log('⚠️ No daily_kpi_data found for January 2026');
    }

    // 5. LIVE FETCH FROM META API
    console.log('\n' + '-'.repeat(80));
    console.log('🔄 STEP 4: LIVE FETCH FROM META API');
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
    const endDate = new Date().toISOString().split('T')[0]; // Today
    
    console.log(`📅 Fetching from Meta API: ${startDate} to ${endDate}`);
    
    // Clear cache to ensure fresh data
    metaService.clearCache();
    
    // Fetch raw campaign insights
    const rawCampaignInsights = await metaService.getCampaignInsights(
      adAccountId,
      startDate,
      endDate,
      0 // timeIncrement: 0 for monthly aggregate
    );
    
    console.log(`✅ Fetched ${rawCampaignInsights.length} campaigns from Meta API\n`);
    
    // Analyze phone events
    let totalPBMPhones = 0;
    let totalStandardPhones = 0;
    const phoneBreakdown: any[] = [];
    
    for (const campaign of rawCampaignInsights) {
      const campaignName = campaign.campaign_name || campaign.name || 'Unknown';
      const actions = campaign.actions || [];
      
      // Find all phone-related actions
      const pbmEvents = actions.filter((a: any) => 
        String(a.action_type || '').toLowerCase() === 'offsite_conversion.custom.1470262077092668'
      );
      const standardEvents = actions.filter((a: any) => {
        const type = String(a.action_type || '').toLowerCase();
        return (type.includes('click_to_call') || type.includes('phone')) &&
               !type.includes('1470262077092668');
      });
      
      const pbmCount = pbmEvents.reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
      const standardCount = standardEvents.reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
      
      if (pbmCount > 0 || standardCount > 0) {
        totalPBMPhones += pbmCount;
        totalStandardPhones += standardCount;
        
        phoneBreakdown.push({
          campaignName,
          pbmCount,
          standardCount,
          pbmEvents: pbmEvents.map((a: any) => ({ type: a.action_type, value: a.value })),
          standardEvents: standardEvents.map((a: any) => ({ type: a.action_type, value: a.value }))
        });
      }
    }
    
    console.log('📞 Phone Events from Meta API:');
    console.log(`   PBM events (offsite_conversion.custom.1470262077092668): ${totalPBMPhones}`);
    console.log(`   Standard events (click_to_call_*): ${totalStandardPhones}`);
    console.log(`   Total (if both counted): ${totalPBMPhones + totalStandardPhones}`);
    
    if (phoneBreakdown.length > 0) {
      console.log('\n   📋 Breakdown by Campaign:');
      phoneBreakdown.forEach((breakdown, idx) => {
        console.log(`\n   ${idx + 1}. ${breakdown.campaignName}:`);
        if (breakdown.pbmCount > 0) {
          console.log(`      PBM: ${breakdown.pbmCount}`);
          breakdown.pbmEvents.forEach((e: any) => {
            console.log(`         - ${e.type}: ${e.value}`);
          });
        }
        if (breakdown.standardCount > 0) {
          console.log(`      Standard: ${breakdown.standardCount}`);
          breakdown.standardEvents.forEach((e: any) => {
            console.log(`         - ${e.type}: ${e.value}`);
          });
        }
      });
    }
    
    // 6. Parse with current parser
    console.log('\n' + '-'.repeat(80));
    console.log('🔧 STEP 5: PARSING WITH CURRENT PARSER');
    console.log('-'.repeat(80));
    
    const parsedCampaigns = enhanceCampaignsWithConversions(rawCampaignInsights);
    const aggregated = aggregateConversionMetrics(parsedCampaigns);
    
    console.log('📊 Parser Results:');
    console.log(`   Total click_to_call: ${aggregated.click_to_call}`);
    console.log(`   Campaigns parsed: ${parsedCampaigns.length}`);
    
    // Show per-campaign parser results
    const campaignsWithPhones = parsedCampaigns.filter((c: any) => (c.click_to_call || 0) > 0);
    if (campaignsWithPhones.length > 0) {
      console.log('\n   📋 Parser Results by Campaign:');
      campaignsWithPhones.forEach((campaign: any, idx: number) => {
        console.log(`      ${idx + 1}. ${campaign.campaign_name || campaign.name}: ${campaign.click_to_call} phones`);
      });
    }
    
    // 7. COMPARISON AND CONCLUSIONS
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPARISON & CONCLUSIONS');
    console.log('='.repeat(80));
    
    console.log('\n📈 Data Source Comparison:');
    console.log(`   Cache (conversionMetrics): ${cache?.cache_data?.conversionMetrics?.click_to_call || 0}`);
    console.log(`   Cache (sum of campaigns): ${sumFromCampaigns || 0}`);
    console.log(`   campaign_summaries: ${summaries?.[0]?.click_to_call || 0}`);
    console.log(`   daily_kpi_data (sum): ${totalPhones || 0}`);
    console.log(`   Live API (PBM only): ${totalPBMPhones}`);
    console.log(`   Live API (Standard only): ${totalStandardPhones}`);
    console.log(`   Live API (Both): ${totalPBMPhones + totalStandardPhones}`);
    console.log(`   Parser result: ${aggregated.click_to_call}`);
    console.log(`   Expected (Meta Business Suite): 2`);
    
    console.log('\n🔍 Analysis:');
    if (aggregated.click_to_call === 2) {
      console.log('   ✅ Parser is working correctly (returns 2)');
    } else if (aggregated.click_to_call === totalPBMPhones) {
      console.log('   ✅ Parser correctly counts only PBM events');
      console.log(`   ⚠️ But cache shows ${cachePhones} - cache needs refresh`);
    } else if (aggregated.click_to_call === (totalPBMPhones + totalStandardPhones)) {
      console.log('   ❌ Parser is still double-counting (counting both PBM and standard)');
    } else {
      console.log(`   ⚠️ Unexpected parser result: ${aggregated.click_to_call}`);
    }
    
    if (cachePhones === 12) {
      console.log('\n   🎯 ROOT CAUSE: Cache shows 12 phones');
      if (sumFromCampaigns === 12) {
        console.log('      - Sum of campaigns = 12 (cache is aggregating from campaigns)');
      }
      if (aggregated.click_to_call !== cachePhones) {
        console.log(`      - Parser returns ${aggregated.click_to_call}, but cache has ${cachePhones}`);
        console.log('      - Cache may be from old parser or different source');
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Audit Complete!');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the audit
comprehensiveAudit().catch(console.error);

