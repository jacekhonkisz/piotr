/**
 * Check Havet Hotel Google Ads Data
 * Run with: node check-havet-google-ads.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHavetData() {
  console.log('🔍 Checking Havet Hotel Google Ads Data...\n');
  console.log('='.repeat(70));

  // First, get Havet's client ID
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .ilike('name', '%havet%')
    .single();

  if (clientError || !client) {
    console.error('❌ Error finding Havet client:', clientError?.message);
    return;
  }

  console.log(`\n🏨 Client: ${client.name}`);
  console.log(`   ID: ${client.id}`);
  console.log(`   Google Ads Customer ID: ${client.google_ads_customer_id || 'NOT SET'}`);
  console.log(`   Has Refresh Token: ${client.google_ads_refresh_token ? '✅ YES' : '❌ NO'}`);
  console.log('-'.repeat(70));

  const clientId = client.id;
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // 1. Check Current Month Cache
  console.log('\n📦 1. CURRENT MONTH CACHE (January 2026)');
  console.log('-'.repeat(70));
  
  const { data: cacheData, error: cacheError } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_id', currentMonth)
    .single();

  if (cacheError && cacheError.code !== 'PGRST116') {
    console.error('❌ Error:', cacheError.message);
  } else if (!cacheData) {
    console.log('⚠️  No cache data found for current month');
  } else {
    const stats = cacheData.cache_data?.stats || {};
    const metrics = cacheData.cache_data?.conversionMetrics || {};
    const campaigns = cacheData.cache_data?.campaigns || [];
    
    console.log('✅ Cache found:');
    console.log(`   Last Updated: ${new Date(cacheData.last_updated).toLocaleString()}`);
    console.log(`   Period: ${cacheData.period_id}`);
    console.log(`\n   📊 Stats:`);
    console.log(`      Spend: ${stats.totalSpend || 0} PLN`);
    console.log(`      Impressions: ${(stats.totalImpressions || 0).toLocaleString()}`);
    console.log(`      Clicks: ${(stats.totalClicks || 0).toLocaleString()}`);
    console.log(`      Conversions: ${stats.totalConversions || 0}`);
    console.log(`\n   🎯 Funnel Metrics:`);
    console.log(`      Step 1 (Wyszukiwania): ${metrics.booking_step_1 || 0}`);
    console.log(`      Step 2 (Wyświetlenia zawartości): ${metrics.booking_step_2 || 0}`);
    console.log(`      Step 3 (Zainicjowane przejścia): ${metrics.booking_step_3 || 0}`);
    console.log(`      Reservations: ${metrics.reservations || 0}`);
    console.log(`      Reservation Value: ${metrics.reservation_value || 0} PLN`);
    console.log(`      Total Conversion Value: ${metrics.total_conversion_value || metrics.conversion_value || 0} PLN`);
    console.log(`      ROAS: ${metrics.roas ? metrics.roas.toFixed(2) + 'x' : 'N/A'}`);
    console.log(`\n   📋 Campaigns: ${campaigns.length} campaigns`);
    
    if (campaigns.length > 0) {
      console.log(`\n   Top 5 Campaigns:`);
      campaigns.slice(0, 5).forEach((camp, idx) => {
        console.log(`      ${idx + 1}. ${camp.campaignName || 'Unknown'}`);
        console.log(`         Spend: ${camp.spend || 0} PLN | Clicks: ${camp.clicks || 0}`);
        console.log(`         Step 1: ${camp.booking_step_1 || 0} | Step 2: ${camp.booking_step_2 || 0} | Step 3: ${camp.booking_step_3 || 0}`);
        console.log(`         Reservations: ${camp.reservations || 0}`);
      });
    }
  }

  // 2. Check Campaign Summaries
  console.log('\n\n💾 2. CAMPAIGN SUMMARIES (Historical Data)');
  console.log('-'.repeat(70));
  
  const { data: summaries, error: summariesError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('platform', 'google')
    .order('summary_date', { ascending: false })
    .limit(10);

  if (summariesError) {
    console.error('❌ Error:', summariesError.message);
  } else if (!summaries || summaries.length === 0) {
    console.log('⚠️  No campaign summaries found');
  } else {
    console.log(`✅ Found ${summaries.length} summary entries:`);
    summaries.forEach((summary, idx) => {
      console.log(`\n   ${idx + 1}. ${summary.summary_type} - ${summary.summary_date}`);
      console.log(`      Spend: ${summary.total_spend || 0} PLN`);
      console.log(`      Impressions: ${(summary.total_impressions || 0).toLocaleString()}`);
      console.log(`      Clicks: ${(summary.total_clicks || 0).toLocaleString()}`);
      console.log(`      Step 1: ${summary.booking_step_1 || 0} | Step 2: ${summary.booking_step_2 || 0} | Step 3: ${summary.booking_step_3 || 0}`);
      console.log(`      Reservations: ${summary.reservations || 0}`);
      console.log(`      Last Updated: ${new Date(summary.last_updated).toLocaleString()}`);
    });
  }

  // 3. Check Daily KPI Data
  console.log('\n\n📊 3. DAILY KPI DATA');
  console.log('-'.repeat(70));
  
  const { data: dailyKpi, error: dailyKpiError } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', clientId)
    .eq('platform', 'google')
    .order('date', { ascending: false })
    .limit(10);

  if (dailyKpiError) {
    console.error('❌ Error:', dailyKpiError.message);
  } else if (!dailyKpi || dailyKpi.length === 0) {
    console.log('⚠️  No daily KPI data found (this table might be empty)');
  } else {
    console.log(`✅ Found ${dailyKpi.length} daily entries:`);
    dailyKpi.forEach((entry, idx) => {
      console.log(`\n   ${idx + 1}. ${entry.date}`);
      console.log(`      Step 1: ${entry.booking_step_1 || 0} | Step 2: ${entry.booking_step_2 || 0} | Step 3: ${entry.booking_step_3 || 0}`);
      console.log(`      Reservations: ${entry.reservations || 0} | Value: ${entry.reservation_value || 0} PLN`);
    });
  }

  // 4. Summary
  console.log('\n\n📈 4. SUMMARY');
  console.log('-'.repeat(70));
  
  const { count: cacheCount } = await supabase
    .from('google_ads_current_month_cache')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId);
  
  const { count: summariesCount } = await supabase
    .from('campaign_summaries')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('platform', 'google');
  
  const { count: dailyKpiCount } = await supabase
    .from('daily_kpi_data')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('platform', 'google');

  console.log(`Cache entries: ${cacheCount || 0}`);
  console.log(`Campaign summaries: ${summariesCount || 0}`);
  console.log(`Daily KPI records: ${dailyKpiCount || 0}`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ Havet data check complete!');
}

checkHavetData().catch(console.error);

