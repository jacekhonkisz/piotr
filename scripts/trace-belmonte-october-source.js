#!/usr/bin/env node

/**
 * TRACE BELMONTE OCTOBER DATA SOURCE
 * 
 * This script traces where the 572.25 PLN value is coming from
 * for October 2025 in the dashboard
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function traceBelmonteOctoberData() {
  console.log('🔍 TRACING BELMONTE OCTOBER 2025 DATA SOURCE');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Get Belmonte client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .single();

    if (clientError || !client) {
      console.error('❌ Belmonte client not found');
      process.exit(1);
    }

    console.log(`✅ Client: ${client.name} (${client.id})\n`);

    // October 2025 date range
    const octoberStart = '2025-10-01';
    const octoberEnd = '2025-10-31';

    console.log(`📅 Checking data for: ${octoberStart} to ${octoberEnd}\n`);
    console.log('─────────────────────────────────────────────────\n');

    // SOURCE 1: Google Ads Smart Cache (current month cache)
    console.log('1️⃣ CHECKING: google_ads_current_month_cache');
    console.log('   Table: google_ads_current_month_cache');
    console.log('   Period ID: 2025-10\n');

    const { data: smartCache, error: smartCacheError } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', '2025-10')
      .maybeSingle();

    if (smartCache) {
      console.log('   ✅ FOUND in smart cache:');
      console.log(`   Last Updated: ${new Date(smartCache.last_updated).toLocaleString()}`);
      
      if (smartCache.cache_data) {
        const cacheAge = Date.now() - new Date(smartCache.last_updated).getTime();
        const hours = Math.floor(cacheAge / (1000 * 60 * 60));
        const minutes = Math.floor((cacheAge % (1000 * 60 * 60)) / (1000 * 60));
        
        console.log(`   Cache Age: ${hours}h ${minutes}m (${cacheAge > 3 * 60 * 60 * 1000 ? '⚠️ STALE' : '✅ FRESH'})`);
        console.log(`   Spend: ${smartCache.cache_data.stats?.totalSpend || 0} PLN`);
        console.log(`   Impressions: ${smartCache.cache_data.stats?.totalImpressions || 0}`);
        console.log(`   Clicks: ${smartCache.cache_data.stats?.totalClicks || 0}`);
        console.log(`   Conversions: ${smartCache.cache_data.stats?.totalConversions || 0}`);
        console.log(`   Campaigns: ${smartCache.cache_data.campaigns?.length || 0}`);
        
        if (Math.abs(smartCache.cache_data.stats?.totalSpend - 572.25) < 0.01) {
          console.log('\n   🎯 **THIS IS THE SOURCE OF 572.25 PLN!**\n');
        }
      }
    } else {
      console.log('   ❌ NOT FOUND in smart cache');
      if (smartCacheError) console.log(`   Error: ${smartCacheError.message}`);
    }
    console.log('\n─────────────────────────────────────────────────\n');

    // SOURCE 2: Campaign Summaries (monthly)
    console.log('2️⃣ CHECKING: campaign_summaries (monthly)');
    console.log('   Table: campaign_summaries');
    console.log('   Summary Type: monthly\n');

    const { data: monthlySummary, error: monthlySummaryError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('platform', 'google')
      .eq('summary_type', 'monthly')
      .eq('summary_date', '2025-10-01')
      .maybeSingle();

    if (monthlySummary) {
      console.log('   ✅ FOUND in monthly summary:');
      console.log(`   Last Updated: ${new Date(monthlySummary.last_updated).toLocaleString()}`);
      console.log(`   Spend: ${monthlySummary.total_spend} PLN`);
      console.log(`   Impressions: ${monthlySummary.total_impressions}`);
      console.log(`   Clicks: ${monthlySummary.total_clicks}`);
      console.log(`   Conversions: ${monthlySummary.total_conversions}`);
      console.log(`   Data Source: ${monthlySummary.data_source}`);
      
      if (Math.abs(monthlySummary.total_spend - 572.25) < 0.01) {
        console.log('\n   🎯 **THIS IS THE SOURCE OF 572.25 PLN!**\n');
      }
    } else {
      console.log('   ❌ NOT FOUND in monthly summary');
      if (monthlySummaryError) console.log(`   Error: ${monthlySummaryError.message}`);
    }
    console.log('\n─────────────────────────────────────────────────\n');

    // SOURCE 3: Campaign Summaries (weekly aggregated)
    console.log('3️⃣ CHECKING: campaign_summaries (weekly)');
    console.log('   Table: campaign_summaries');
    console.log('   Summary Type: weekly\n');

    const { data: weeklySummaries, error: weeklySummariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('platform', 'google')
      .eq('summary_type', 'weekly')
      .gte('summary_date', octoberStart)
      .lte('summary_date', octoberEnd)
      .order('summary_date', { ascending: true });

    if (weeklySummaries && weeklySummaries.length > 0) {
      console.log(`   ✅ FOUND ${weeklySummaries.length} weekly summaries:`);
      
      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      
      weeklySummaries.forEach((week, index) => {
        const spend = parseFloat(week.total_spend || 0);
        totalSpend += spend;
        totalImpressions += parseInt(week.total_impressions || 0);
        totalClicks += parseInt(week.total_clicks || 0);
        totalConversions += parseFloat(week.total_conversions || 0);
        
        console.log(`   Week ${index + 1} (${week.summary_date}): ${spend.toFixed(2)} PLN`);
      });
      
      console.log(`\n   AGGREGATED TOTAL:`);
      console.log(`   Spend: ${totalSpend.toFixed(2)} PLN`);
      console.log(`   Impressions: ${totalImpressions}`);
      console.log(`   Clicks: ${totalClicks}`);
      console.log(`   Conversions: ${totalConversions.toFixed(2)}`);
      
      if (Math.abs(totalSpend - 572.25) < 0.01) {
        console.log('\n   🎯 **THIS IS THE SOURCE OF 572.25 PLN!**\n');
      }
    } else {
      console.log('   ❌ NOT FOUND weekly summaries');
      if (weeklySummariesError) console.log(`   Error: ${weeklySummariesError.message}`);
    }
    console.log('\n─────────────────────────────────────────────────\n');

    // SOURCE 4: Daily KPI Data
    console.log('4️⃣ CHECKING: daily_kpi_data');
    console.log('   Table: daily_kpi_data\n');

    const { data: dailyKpis, error: dailyKpisError } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', client.id)
      .eq('data_source', 'google_ads_api')
      .gte('date', octoberStart)
      .lte('date', octoberEnd)
      .order('date', { ascending: true });

    if (dailyKpis && dailyKpis.length > 0) {
      console.log(`   ✅ FOUND ${dailyKpis.length} daily records:`);
      
      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalConversions = 0;
      
      dailyKpis.forEach((day) => {
        totalSpend += parseFloat(day.total_spend || 0);
        totalImpressions += parseInt(day.total_impressions || 0);
        totalClicks += parseInt(day.total_clicks || 0);
        totalConversions += parseFloat(day.total_conversions || 0);
      });
      
      console.log(`   AGGREGATED TOTAL:`);
      console.log(`   Spend: ${totalSpend.toFixed(2)} PLN`);
      console.log(`   Impressions: ${totalImpressions}`);
      console.log(`   Clicks: ${totalClicks}`);
      console.log(`   Conversions: ${totalConversions.toFixed(2)}`);
      
      if (Math.abs(totalSpend - 572.25) < 0.01) {
        console.log('\n   🎯 **THIS IS THE SOURCE OF 572.25 PLN!**\n');
      }
    } else {
      console.log('   ❌ NOT FOUND in daily_kpi_data');
      if (dailyKpisError) console.log(`   Error: ${dailyKpisError.message}`);
    }
    console.log('\n─────────────────────────────────────────────────\n');

    // SUMMARY
    console.log('\n📊 SUMMARY OF FINDINGS:');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n🔍 Looking for: 572.25 PLN (from dashboard screenshot)');
    console.log('📅 Period: October 2025 (2025-10-01 to 2025-10-31)');
    console.log('\n📌 Data sources checked:');
    console.log(`   1. Smart Cache: ${smartCache ? '✅ Found' : '❌ Not Found'}`);
    console.log(`   2. Monthly Summary: ${monthlySummary ? '✅ Found' : '❌ Not Found'}`);
    console.log(`   3. Weekly Summaries: ${weeklySummaries?.length || 0} found`);
    console.log(`   4. Daily KPI Data: ${dailyKpis?.length || 0} found`);
    
    console.log('\n💡 The dashboard is using "standardized-fetcher" with');
    console.log('   "google-ads-smart-cache" policy, so it should be using');
    console.log('   one of the sources above.\n');

  } catch (error) {
    console.error('\n❌ Error tracing data:', error);
    console.error('   Details:', error.message);
    process.exit(1);
  }
}

// Run the trace
traceBelmonteOctoberData().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});








