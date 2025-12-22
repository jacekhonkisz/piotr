#!/usr/bin/env node
/**
 * Quick cache status audit
 * Run: node scripts/audit-cache-now.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditCache() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           SMART CACHE STATUS AUDIT - ' + new Date().toISOString().split('T')[0] + '                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Get current week (ISO format)
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  const weekNum = getISOWeek(now);
  const currentWeek = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

  console.log('📅 Current Period Info:');
  console.log(`   Current Month: ${currentMonth}`);
  console.log(`   Current Week: ${currentWeek}`);
  console.log(`   3 Hour Threshold: ${threeHoursAgo.toISOString()}`);
  console.log('');

  // 1. Check Meta Monthly Cache
  console.log('═══ META MONTHLY CACHE (current_month_cache) ═══');
  const { data: metaMonthly, error: err1 } = await supabase
    .from('current_month_cache')
    .select('client_id, period_id, last_updated, cache_data')
    .eq('period_id', currentMonth);

  if (err1) {
    console.log('❌ Error fetching Meta monthly cache:', err1.message);
  } else if (!metaMonthly || metaMonthly.length === 0) {
    console.log('⚠️  No entries for current month');
  } else {
    console.log(`Found ${metaMonthly.length} entries:`);
    for (const entry of metaMonthly) {
      const age = (now.getTime() - new Date(entry.last_updated).getTime()) / (60 * 60 * 1000);
      const isFresh = age < 3;
      const status = isFresh ? '✅ Fresh' : '🔴 Stale';
      const spend = entry.cache_data?.stats?.totalSpend || 0;
      const campaigns = entry.cache_data?.campaigns?.length || 0;
      console.log(`   ${status} | Age: ${age.toFixed(1)}h | Spend: ${spend.toFixed(2)} | Campaigns: ${campaigns} | Updated: ${entry.last_updated}`);
    }
  }
  console.log('');

  // 2. Check Meta Weekly Cache
  console.log('═══ META WEEKLY CACHE (current_week_cache) ═══');
  const { data: metaWeekly, error: err2 } = await supabase
    .from('current_week_cache')
    .select('client_id, period_id, last_updated, cache_data')
    .eq('period_id', currentWeek);

  if (err2) {
    console.log('❌ Error fetching Meta weekly cache:', err2.message);
  } else if (!metaWeekly || metaWeekly.length === 0) {
    console.log('⚠️  No entries for current week');
  } else {
    console.log(`Found ${metaWeekly.length} entries:`);
    for (const entry of metaWeekly) {
      const age = (now.getTime() - new Date(entry.last_updated).getTime()) / (60 * 60 * 1000);
      const isFresh = age < 3;
      const status = isFresh ? '✅ Fresh' : '🔴 Stale';
      const spend = entry.cache_data?.stats?.totalSpend || 0;
      const campaigns = entry.cache_data?.campaigns?.length || 0;
      console.log(`   ${status} | Age: ${age.toFixed(1)}h | Spend: ${spend.toFixed(2)} | Campaigns: ${campaigns} | Updated: ${entry.last_updated}`);
    }
  }
  console.log('');

  // 3. Check Google Ads Monthly Cache
  console.log('═══ GOOGLE ADS MONTHLY CACHE (google_ads_current_month_cache) ═══');
  const { data: googleMonthly, error: err3 } = await supabase
    .from('google_ads_current_month_cache')
    .select('client_id, period_id, last_updated, cache_data')
    .eq('period_id', currentMonth);

  if (err3) {
    console.log('❌ Error fetching Google Ads monthly cache:', err3.message);
  } else if (!googleMonthly || googleMonthly.length === 0) {
    console.log('⚠️  No entries for current month');
  } else {
    console.log(`Found ${googleMonthly.length} entries:`);
    for (const entry of googleMonthly) {
      const age = (now.getTime() - new Date(entry.last_updated).getTime()) / (60 * 60 * 1000);
      const isFresh = age < 3;
      const status = isFresh ? '✅ Fresh' : '🔴 Stale';
      const spend = entry.cache_data?.stats?.totalCost || entry.cache_data?.stats?.totalSpend || 0;
      const campaigns = entry.cache_data?.campaigns?.length || 0;
      console.log(`   ${status} | Age: ${age.toFixed(1)}h | Cost: ${spend.toFixed(2)} | Campaigns: ${campaigns} | Updated: ${entry.last_updated}`);
    }
  }
  console.log('');

  // 4. Check Google Ads Weekly Cache
  console.log('═══ GOOGLE ADS WEEKLY CACHE (google_ads_current_week_cache) ═══');
  const { data: googleWeekly, error: err4 } = await supabase
    .from('google_ads_current_week_cache')
    .select('client_id, period_id, last_updated, cache_data')
    .eq('period_id', currentWeek);

  if (err4) {
    console.log('❌ Error fetching Google Ads weekly cache:', err4.message);
  } else if (!googleWeekly || googleWeekly.length === 0) {
    console.log('⚠️  No entries for current week');
  } else {
    console.log(`Found ${googleWeekly.length} entries:`);
    for (const entry of googleWeekly) {
      const age = (now.getTime() - new Date(entry.last_updated).getTime()) / (60 * 60 * 1000);
      const isFresh = age < 3;
      const status = isFresh ? '✅ Fresh' : '🔴 Stale';
      const spend = entry.cache_data?.stats?.totalCost || entry.cache_data?.stats?.totalSpend || 0;
      const campaigns = entry.cache_data?.campaigns?.length || 0;
      console.log(`   ${status} | Age: ${age.toFixed(1)}h | Cost: ${spend.toFixed(2)} | Campaigns: ${campaigns} | Updated: ${entry.last_updated}`);
    }
  }
  console.log('');

  // 5. Check active clients
  console.log('═══ ACTIVE CLIENTS STATUS ═══');
  const { data: clients, error: err5 } = await supabase
    .from('clients')
    .select('id, name, api_status, meta_access_token, system_user_token, ad_account_id, google_ads_customer_id')
    .eq('api_status', 'valid');

  if (err5) {
    console.log('❌ Error fetching clients:', err5.message);
  } else if (!clients || clients.length === 0) {
    console.log('⚠️  No active clients found');
  } else {
    console.log(`Found ${clients.length} active clients:`);
    for (const client of clients) {
      const hasMeta = !!(client.meta_access_token || client.system_user_token) && !!client.ad_account_id;
      const hasGoogle = !!client.google_ads_customer_id;
      
      // Check if client has cache
      const hasMetaMonthly = metaMonthly?.some(c => c.client_id === client.id);
      const hasMetaWeekly = metaWeekly?.some(c => c.client_id === client.id);
      const hasGoogleMonthly = googleMonthly?.some(c => c.client_id === client.id);
      const hasGoogleWeekly = googleWeekly?.some(c => c.client_id === client.id);
      
      console.log(`   ${client.name}:`);
      console.log(`      Meta: ${hasMeta ? '✅' : '❌'} | Monthly Cache: ${hasMetaMonthly ? '✅' : '❌'} | Weekly Cache: ${hasMetaWeekly ? '✅' : '❌'}`);
      if (hasGoogle) {
        console.log(`      Google: ${hasGoogle ? '✅' : '❌'} | Monthly Cache: ${hasGoogleMonthly ? '✅' : '❌'} | Weekly Cache: ${hasGoogleWeekly ? '✅' : '❌'}`);
      }
    }
  }
  console.log('');

  // Summary
  console.log('═══ SUMMARY ═══');
  const totalMetaMonthly = metaMonthly?.length || 0;
  const freshMetaMonthly = metaMonthly?.filter(e => (now.getTime() - new Date(e.last_updated).getTime()) < 3 * 60 * 60 * 1000).length || 0;
  const totalMetaWeekly = metaWeekly?.length || 0;
  const freshMetaWeekly = metaWeekly?.filter(e => (now.getTime() - new Date(e.last_updated).getTime()) < 3 * 60 * 60 * 1000).length || 0;
  const totalGoogleMonthly = googleMonthly?.length || 0;
  const freshGoogleMonthly = googleMonthly?.filter(e => (now.getTime() - new Date(e.last_updated).getTime()) < 3 * 60 * 60 * 1000).length || 0;
  const totalGoogleWeekly = googleWeekly?.length || 0;
  const freshGoogleWeekly = googleWeekly?.filter(e => (now.getTime() - new Date(e.last_updated).getTime()) < 3 * 60 * 60 * 1000).length || 0;

  console.log(`   Meta Monthly:   ${freshMetaMonthly}/${totalMetaMonthly} fresh (${totalMetaMonthly > 0 ? Math.round(100 * freshMetaMonthly / totalMetaMonthly) : 0}%)`);
  console.log(`   Meta Weekly:    ${freshMetaWeekly}/${totalMetaWeekly} fresh (${totalMetaWeekly > 0 ? Math.round(100 * freshMetaWeekly / totalMetaWeekly) : 0}%)`);
  console.log(`   Google Monthly: ${freshGoogleMonthly}/${totalGoogleMonthly} fresh (${totalGoogleMonthly > 0 ? Math.round(100 * freshGoogleMonthly / totalGoogleMonthly) : 0}%)`);
  console.log(`   Google Weekly:  ${freshGoogleWeekly}/${totalGoogleWeekly} fresh (${totalGoogleWeekly > 0 ? Math.round(100 * freshGoogleWeekly / totalGoogleWeekly) : 0}%)`);
  console.log('');

  if (freshMetaMonthly < totalMetaMonthly || freshMetaWeekly < totalMetaWeekly) {
    console.log('⚠️  Some caches are stale! This may cause slow loading for current periods.');
    console.log('   Cron jobs should refresh automatically every 3 hours.');
    console.log('   Check Vercel dashboard for cron job status.');
  } else if (totalMetaMonthly === 0 && totalMetaWeekly === 0) {
    console.log('🔴 NO CACHE ENTRIES! First requests will be very slow (live API fetch).');
    console.log('   Trigger manual refresh: POST /api/automated/refresh-all-caches');
  } else {
    console.log('✅ All caches are fresh!');
  }
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

auditCache().catch(console.error);

