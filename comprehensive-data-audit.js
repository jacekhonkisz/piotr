/**
 * Comprehensive Data Audit - Check ALL data sources
 * To find why data stopped showing for all clients
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

async function comprehensiveAudit() {
  console.log('🔍 COMPREHENSIVE DATA AUDIT');
  console.log('='.repeat(80));
  console.log('Checking ALL data sources to find why data stopped showing...\n');

  // =====================================================
  // 1. CHECK ALL CACHE TABLES
  // =====================================================
  console.log('\n📦 1. CACHE TABLES STATUS');
  console.log('='.repeat(80));

  // Meta Current Month Cache
  const { data: metaMonthCache, count: metaMonthCount } = await supabase
    .from('current_month_cache')
    .select('*', { count: 'exact' })
    .order('last_updated', { ascending: false })
    .limit(5);
  
  console.log(`\n📊 META Current Month Cache: ${metaMonthCount || 0} entries`);
  if (metaMonthCache && metaMonthCache.length > 0) {
    console.log('   Latest entries:');
    metaMonthCache.forEach(entry => {
      const stats = entry.cache_data?.stats || {};
      console.log(`   - Client: ${entry.client_id.substring(0, 8)}... | Period: ${entry.period_id}`);
      console.log(`     Spend: ${stats.totalSpend || 0} | Updated: ${new Date(entry.last_updated).toLocaleString()}`);
    });
  } else {
    console.log('   ⚠️ NO META CACHE DATA FOUND!');
  }

  // Google Ads Current Month Cache
  const { data: googleMonthCache, count: googleMonthCount } = await supabase
    .from('google_ads_current_month_cache')
    .select('*', { count: 'exact' })
    .order('last_updated', { ascending: false })
    .limit(5);
  
  console.log(`\n📊 GOOGLE ADS Current Month Cache: ${googleMonthCount || 0} entries`);
  if (googleMonthCache && googleMonthCache.length > 0) {
    console.log('   Latest entries:');
    googleMonthCache.forEach(entry => {
      const stats = entry.cache_data?.stats || {};
      console.log(`   - Client: ${entry.client_id.substring(0, 8)}... | Period: ${entry.period_id}`);
      console.log(`     Spend: ${stats.totalSpend || 0} | Updated: ${new Date(entry.last_updated).toLocaleString()}`);
    });
  } else {
    console.log('   ⚠️ NO GOOGLE ADS CACHE DATA FOUND!');
  }

  // Weekly caches
  const { count: metaWeekCount } = await supabase
    .from('current_week_cache')
    .select('*', { count: 'exact', head: true });
  
  const { count: googleWeekCount } = await supabase
    .from('google_ads_current_week_cache')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Weekly Cache Counts:`);
  console.log(`   - Meta Weekly: ${metaWeekCount || 0} entries`);
  console.log(`   - Google Ads Weekly: ${googleWeekCount || 0} entries`);

  // =====================================================
  // 2. CHECK CAMPAIGN SUMMARIES (HISTORICAL DATA)
  // =====================================================
  console.log('\n\n💾 2. CAMPAIGN SUMMARIES (Historical Data)');
  console.log('='.repeat(80));

  // Count by platform
  const { data: metaSummaries } = await supabase
    .from('campaign_summaries')
    .select('*', { count: 'exact' })
    .eq('platform', 'meta')
    .order('last_updated', { ascending: false })
    .limit(3);

  const { data: googleSummaries } = await supabase
    .from('campaign_summaries')
    .select('*', { count: 'exact' })
    .eq('platform', 'google')
    .order('last_updated', { ascending: false })
    .limit(3);

  const { count: totalMetaSummaries } = await supabase
    .from('campaign_summaries')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'meta');

  const { count: totalGoogleSummaries } = await supabase
    .from('campaign_summaries')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'google');

  console.log(`\n📊 Meta Campaign Summaries: ${totalMetaSummaries || 0} total`);
  if (metaSummaries && metaSummaries.length > 0) {
    console.log('   Latest:');
    metaSummaries.forEach(s => {
      console.log(`   - ${s.summary_type} | ${s.summary_date} | Spend: ${s.total_spend} | Updated: ${new Date(s.last_updated).toLocaleString()}`);
    });
  }

  console.log(`\n📊 Google Campaign Summaries: ${totalGoogleSummaries || 0} total`);
  if (googleSummaries && googleSummaries.length > 0) {
    console.log('   Latest:');
    googleSummaries.forEach(s => {
      console.log(`   - ${s.summary_type} | ${s.summary_date} | Spend: ${s.total_spend} | Updated: ${new Date(s.last_updated).toLocaleString()}`);
    });
  }

  // =====================================================
  // 3. CHECK DAILY KPI DATA
  // =====================================================
  console.log('\n\n📊 3. DAILY KPI DATA');
  console.log('='.repeat(80));

  const { count: dailyKpiMeta } = await supabase
    .from('daily_kpi_data')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'meta');

  const { count: dailyKpiGoogle } = await supabase
    .from('daily_kpi_data')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'google');

  console.log(`\n   - Meta Daily KPI: ${dailyKpiMeta || 0} entries`);
  console.log(`   - Google Daily KPI: ${dailyKpiGoogle || 0} entries`);

  if ((dailyKpiMeta || 0) === 0 && (dailyKpiGoogle || 0) === 0) {
    console.log('   ⚠️ DAILY KPI TABLE IS EMPTY!');
  }

  // =====================================================
  // 4. CHECK CLIENTS CONFIGURATION
  // =====================================================
  console.log('\n\n👥 4. CLIENTS CONFIGURATION');
  console.log('='.repeat(80));

  const { data: clients, count: clientCount } = await supabase
    .from('clients')
    .select('id, name, meta_access_token, google_ads_customer_id, google_ads_refresh_token')
    .order('name');

  console.log(`\nTotal Clients: ${clientCount || clients?.length || 0}`);
  
  let metaConfigured = 0;
  let googleConfigured = 0;
  let metaWithToken = 0;
  let googleWithToken = 0;

  if (clients) {
    clients.forEach(client => {
      if (client.meta_access_token) {
        metaConfigured++;
        metaWithToken++;
      }
      if (client.google_ads_customer_id) {
        googleConfigured++;
        if (client.google_ads_refresh_token) {
          googleWithToken++;
        }
      }
    });

    console.log(`\n   Meta Configured: ${metaConfigured} clients with access_token`);
    console.log(`   Google Configured: ${googleConfigured} clients with customer_id`);
    console.log(`   Google with Individual Token: ${googleWithToken} clients`);

    console.log('\n   Client List:');
    clients.forEach(client => {
      const metaStatus = client.meta_access_token ? '✅' : '❌';
      const googleStatus = client.google_ads_customer_id ? '✅' : '❌';
      console.log(`   - ${client.name}: Meta ${metaStatus} | Google ${googleStatus}`);
    });
  }

  // =====================================================
  // 5. CHECK SYSTEM SETTINGS
  // =====================================================
  console.log('\n\n⚙️ 5. SYSTEM SETTINGS');
  console.log('='.repeat(80));

  const { data: allSettings } = await supabase
    .from('system_settings')
    .select('key, value, updated_at');

  console.log('\n   All System Settings:');
  if (allSettings) {
    allSettings.forEach(setting => {
      const valuePreview = setting.value ? 
        (setting.value.length > 40 ? setting.value.substring(0, 40) + '...' : setting.value) : 
        'NULL';
      console.log(`   - ${setting.key}: ${valuePreview}`);
      if (setting.updated_at) {
        console.log(`     Updated: ${new Date(setting.updated_at).toLocaleString()}`);
      }
    });
  }

  // =====================================================
  // 6. CHECK FOR RECENT DATA UPDATES
  // =====================================================
  console.log('\n\n🕐 6. RECENT DATA UPDATES (Last 7 Days)');
  console.log('='.repeat(80));

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentMetaCache } = await supabase
    .from('current_month_cache')
    .select('client_id, period_id, last_updated')
    .gte('last_updated', sevenDaysAgo.toISOString())
    .order('last_updated', { ascending: false });

  const { data: recentGoogleCache } = await supabase
    .from('google_ads_current_month_cache')
    .select('client_id, period_id, last_updated')
    .gte('last_updated', sevenDaysAgo.toISOString())
    .order('last_updated', { ascending: false });

  console.log(`\n   Meta Cache Updates: ${recentMetaCache?.length || 0}`);
  console.log(`   Google Cache Updates: ${recentGoogleCache?.length || 0}`);

  if (recentMetaCache && recentMetaCache.length > 0) {
    console.log('\n   Recent Meta Updates:');
    recentMetaCache.slice(0, 5).forEach(entry => {
      console.log(`   - ${entry.period_id} | ${new Date(entry.last_updated).toLocaleString()}`);
    });
  }

  if (recentGoogleCache && recentGoogleCache.length > 0) {
    console.log('\n   Recent Google Updates:');
    recentGoogleCache.slice(0, 5).forEach(entry => {
      console.log(`   - ${entry.period_id} | ${new Date(entry.last_updated).toLocaleString()}`);
    });
  }

  // =====================================================
  // 7. CHECK FOR ZEROS IN DATA
  // =====================================================
  console.log('\n\n⚠️ 7. DATA QUALITY CHECK');
  console.log('='.repeat(80));

  // Check Meta cache for zeros
  const { data: metaCacheWithData } = await supabase
    .from('current_month_cache')
    .select('client_id, period_id, cache_data')
    .eq('period_id', new Date().toISOString().slice(0, 7));

  let metaWithZeros = 0;
  let metaWithData = 0;

  if (metaCacheWithData) {
    metaCacheWithData.forEach(entry => {
      const spend = entry.cache_data?.stats?.totalSpend || 0;
      if (spend === 0) metaWithZeros++;
      else metaWithData++;
    });
  }

  console.log(`\n   META Current Month (${new Date().toISOString().slice(0, 7)}):`);
  console.log(`   - With Data (spend > 0): ${metaWithData}`);
  console.log(`   - With Zeros: ${metaWithZeros}`);

  // Check Google cache for zeros
  const { data: googleCacheWithData } = await supabase
    .from('google_ads_current_month_cache')
    .select('client_id, period_id, cache_data')
    .eq('period_id', new Date().toISOString().slice(0, 7));

  let googleWithZeros = 0;
  let googleWithData = 0;

  if (googleCacheWithData) {
    googleCacheWithData.forEach(entry => {
      const spend = entry.cache_data?.stats?.totalSpend || 0;
      if (spend === 0) googleWithZeros++;
      else googleWithData++;
    });
  }

  console.log(`\n   GOOGLE Current Month (${new Date().toISOString().slice(0, 7)}):`);
  console.log(`   - With Data (spend > 0): ${googleWithData}`);
  console.log(`   - With Zeros: ${googleWithZeros}`);

  // =====================================================
  // 8. CHECK WHAT CHANGED
  // =====================================================
  console.log('\n\n🔄 8. ANALYSIS & DIAGNOSIS');
  console.log('='.repeat(80));

  const issues = [];

  // Check if caches are empty
  if ((metaMonthCount || 0) === 0) {
    issues.push('❌ Meta current month cache is EMPTY');
  }
  if ((googleMonthCount || 0) === 0) {
    issues.push('❌ Google Ads current month cache is EMPTY');
  }

  // Check if daily KPI is empty
  if ((dailyKpiMeta || 0) === 0 && (dailyKpiGoogle || 0) === 0) {
    issues.push('⚠️ Daily KPI data table is empty (some endpoints rely on this)');
  }

  // Check if all current month data is zeros
  if (metaWithData === 0 && metaWithZeros > 0) {
    issues.push('⚠️ All Meta cache entries for current month have ZERO spend');
  }
  if (googleWithData === 0 && googleWithZeros > 0) {
    issues.push('⚠️ All Google cache entries for current month have ZERO spend');
  }

  // Check client configuration
  if (metaConfigured === 0) {
    issues.push('❌ No clients have Meta access tokens configured');
  }
  if (googleConfigured === 0) {
    issues.push('❌ No clients have Google Ads customer IDs configured');
  }

  if (issues.length > 0) {
    console.log('\n   🚨 ISSUES FOUND:');
    issues.forEach(issue => console.log(`   ${issue}`));
  } else {
    console.log('\n   ✅ No obvious issues found in data structure');
  }

  // =====================================================
  // 9. SUMMARY
  // =====================================================
  console.log('\n\n📋 9. SUMMARY');
  console.log('='.repeat(80));

  console.log(`
  Data Inventory:
  ├── Meta Monthly Cache: ${metaMonthCount || 0} entries
  ├── Google Monthly Cache: ${googleMonthCount || 0} entries
  ├── Meta Weekly Cache: ${metaWeekCount || 0} entries
  ├── Google Weekly Cache: ${googleWeekCount || 0} entries
  ├── Meta Campaign Summaries: ${totalMetaSummaries || 0} entries
  ├── Google Campaign Summaries: ${totalGoogleSummaries || 0} entries
  ├── Daily KPI (Meta): ${dailyKpiMeta || 0} entries
  └── Daily KPI (Google): ${dailyKpiGoogle || 0} entries

  Client Configuration:
  ├── Total Clients: ${clientCount || clients?.length || 0}
  ├── Meta Configured: ${metaConfigured}
  └── Google Configured: ${googleConfigured}

  Current Month Quality:
  ├── Meta with data: ${metaWithData} / Meta with zeros: ${metaWithZeros}
  └── Google with data: ${googleWithData} / Google with zeros: ${googleWithZeros}
  `);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Comprehensive audit complete!');
}

comprehensiveAudit().catch(console.error);

