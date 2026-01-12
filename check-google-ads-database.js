/**
 * Check Google Ads Data in Database
 * Run with: node check-google-ads-database.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGoogleAdsData() {
  console.log('🔍 Checking Google Ads Data in Database...\n');
  console.log('='.repeat(60));

  // 1. Check Current Month Cache
  console.log('\n📦 1. CURRENT MONTH CACHE (google_ads_current_month_cache)');
  console.log('-'.repeat(60));
  
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data: cacheData, error: cacheError } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('period_id', currentMonth)
    .order('last_updated', { ascending: false })
    .limit(5);

  if (cacheError) {
    console.error('❌ Error:', cacheError.message);
  } else if (!cacheData || cacheData.length === 0) {
    console.log('⚠️  No cache data found for current month:', currentMonth);
  } else {
    console.log(`✅ Found ${cacheData.length} cache entries:`);
    cacheData.forEach((entry, idx) => {
      const stats = entry.cache_data?.stats || {};
      const metrics = entry.cache_data?.conversionMetrics || {};
      console.log(`\n  Entry ${idx + 1}:`);
      console.log(`    Client ID: ${entry.client_id}`);
      console.log(`    Period: ${entry.period_id}`);
      console.log(`    Spend: ${stats.totalSpend || 0}`);
      console.log(`    Impressions: ${stats.totalImpressions || 0}`);
      console.log(`    Clicks: ${stats.totalClicks || 0}`);
      console.log(`    Step 1: ${metrics.booking_step_1 || 0}`);
      console.log(`    Step 2: ${metrics.booking_step_2 || 0}`);
      console.log(`    Step 3: ${metrics.booking_step_3 || 0}`);
      console.log(`    Reservations: ${metrics.reservations || 0}`);
      console.log(`    Reservation Value: ${metrics.reservation_value || 0}`);
      console.log(`    Last Updated: ${new Date(entry.last_updated).toLocaleString()}`);
    });
  }

  // 2. Check Campaign Summaries
  console.log('\n\n💾 2. CAMPAIGN SUMMARIES (campaign_summaries)');
  console.log('-'.repeat(60));
  
  const { data: summaries, error: summariesError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('platform', 'google')
    .gte('summary_date', '2025-01-01')
    .order('last_updated', { ascending: false })
    .limit(10);

  if (summariesError) {
    console.error('❌ Error:', summariesError.message);
  } else if (!summaries || summaries.length === 0) {
    console.log('⚠️  No campaign summaries found for Google Ads');
  } else {
    console.log(`✅ Found ${summaries.length} summary entries:`);
    summaries.forEach((summary, idx) => {
      console.log(`\n  Entry ${idx + 1}:`);
      console.log(`    Client ID: ${summary.client_id}`);
      console.log(`    Type: ${summary.summary_type}`);
      console.log(`    Date: ${summary.summary_date}`);
      console.log(`    Spend: ${summary.total_spend || 0}`);
      console.log(`    Impressions: ${summary.total_impressions || 0}`);
      console.log(`    Clicks: ${summary.total_clicks || 0}`);
      console.log(`    Step 1: ${summary.booking_step_1 || 0}`);
      console.log(`    Step 2: ${summary.booking_step_2 || 0}`);
      console.log(`    Step 3: ${summary.booking_step_3 || 0}`);
      console.log(`    Reservations: ${summary.reservations || 0}`);
      console.log(`    Last Updated: ${new Date(summary.last_updated).toLocaleString()}`);
    });
  }

  // 3. Check Daily KPI Data
  console.log('\n\n📊 3. DAILY KPI DATA (daily_kpi_data)');
  console.log('-'.repeat(60));
  
  const { data: dailyKpi, error: dailyKpiError } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('platform', 'google')
    .gte('date', '2025-01-01')
    .order('date', { ascending: false })
    .limit(10);

  if (dailyKpiError) {
    console.error('❌ Error:', dailyKpiError.message);
  } else if (!dailyKpi || dailyKpi.length === 0) {
    console.log('⚠️  No daily KPI data found for Google Ads');
  } else {
    console.log(`✅ Found ${dailyKpi.length} daily KPI entries:`);
    dailyKpi.forEach((entry, idx) => {
      console.log(`\n  Entry ${idx + 1}:`);
      console.log(`    Client ID: ${entry.client_id}`);
      console.log(`    Date: ${entry.date}`);
      console.log(`    Step 1: ${entry.booking_step_1 || 0}`);
      console.log(`    Step 2: ${entry.booking_step_2 || 0}`);
      console.log(`    Step 3: ${entry.booking_step_3 || 0}`);
      console.log(`    Reservations: ${entry.reservations || 0}`);
      console.log(`    Reservation Value: ${entry.reservation_value || 0}`);
    });
  }

  // 4. Summary Statistics
  console.log('\n\n📈 4. SUMMARY STATISTICS');
  console.log('-'.repeat(60));
  
  // Count total records
  const { count: cacheCount } = await supabase
    .from('google_ads_current_month_cache')
    .select('*', { count: 'exact', head: true });
  
  const { count: summariesCount } = await supabase
    .from('campaign_summaries')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'google');
  
  const { count: dailyKpiCount } = await supabase
    .from('daily_kpi_data')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'google');

  console.log(`Cache entries: ${cacheCount || 0}`);
  console.log(`Campaign summaries: ${summariesCount || 0}`);
  console.log(`Daily KPI records: ${dailyKpiCount || 0}`);

  // Check clients with Google Ads
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id')
    .not('google_ads_customer_id', 'is', null)
    .limit(10);

  if (!clientsError && clients && clients.length > 0) {
    console.log(`\n✅ Clients with Google Ads configured: ${clients.length}`);
    clients.forEach(client => {
      console.log(`  - ${client.name} (${client.id})`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Database check complete!');
}

checkGoogleAdsData().catch(console.error);

