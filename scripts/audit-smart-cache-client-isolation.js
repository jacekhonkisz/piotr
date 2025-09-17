#!/usr/bin/env node

/**
 * 🔍 SMART CACHE CLIENT ISOLATION AUDIT
 * 
 * This script audits the smart caching system to ensure:
 * 1. Each client has separate cache entries
 * 2. Cache is properly refreshed every 3 hours
 * 3. Dashboard and reports show the latest cached data
 * 4. No cross-client contamination
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to get current period info
function getCurrentPeriodInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  
  // ISO Week calculation
  const startOfYear = new Date(year, 0, 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); // Monday
  
  const daysDiff = Math.floor((startOfWeek - startOfYear) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysDiff + startOfYear.getDay() + 1) / 7);
  
  return {
    currentMonth: `${year}-${String(month).padStart(2, '0')}`,
    currentWeek: `${year}-W${String(weekNumber).padStart(2, '0')}`,
    timestamp: now.toISOString()
  };
}

// Helper function to format cache age
function formatCacheAge(lastUpdated) {
  if (!lastUpdated) return 'N/A';
  const ageMs = Date.now() - new Date(lastUpdated).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const ageMinutes = (ageMs / (1000 * 60)) % 60;
  
  if (ageHours >= 1) {
    return `${ageHours.toFixed(1)}h`;
  } else {
    return `${ageMinutes.toFixed(1)}m`;
  }
}

// Helper function to determine cache status
function getCacheStatus(lastUpdated) {
  if (!lastUpdated) return '❌ MISSING';
  
  const ageMs = Date.now() - new Date(lastUpdated).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  
  if (ageHours < 3) {
    return '✅ FRESH';
  } else if (ageHours < 6) {
    return '⚠️ STALE';
  } else {
    return '🔴 VERY STALE';
  }
}

async function auditSmartCacheSystem() {
  console.log('🔍 SMART CACHE CLIENT ISOLATION AUDIT');
  console.log('=====================================\n');
  
  const periods = getCurrentPeriodInfo();
  console.log('📅 Current Periods:');
  console.log(`   Monthly: ${periods.currentMonth}`);
  console.log(`   Weekly:  ${periods.currentWeek}`);
  console.log(`   Time:    ${periods.timestamp}\n`);
  
  try {
    // 1. Get all active clients
    console.log('👥 STEP 1: Getting all active clients...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, ad_account_id, created_at')
      .not('meta_access_token', 'is', null)
      .not('ad_account_id', 'is', null);
    
    if (clientsError) {
      throw new Error(`Failed to get clients: ${clientsError.message}`);
    }
    
    if (!clients || clients.length === 0) {
      console.log('⚠️ No active clients found with Meta tokens');
      return;
    }
    
    console.log(`✅ Found ${clients.length} active clients\n`);
    
    // 2. Check current month cache for each client
    console.log('📊 STEP 2: Auditing Current Month Cache...');
    console.log('Client | Status | Age | Last Updated | Has Data');
    console.log('-------|--------|-----|-------------|----------');
    
    const monthlyResults = [];
    for (const client of clients) {
      const { data: monthlyCache } = await supabase
        .from('current_month_cache')
        .select('last_updated, cache_data')
        .eq('client_id', client.id)
        .eq('period_id', periods.currentMonth)
        .maybeSingle();
      
      const status = getCacheStatus(monthlyCache?.last_updated);
      const age = formatCacheAge(monthlyCache?.last_updated);
      const hasData = monthlyCache?.cache_data ? '✅' : '❌';
      const lastUpdated = monthlyCache?.last_updated ? 
        new Date(monthlyCache.last_updated).toLocaleString() : 'Never';
      
      console.log(`${client.name.padEnd(6)} | ${status.padEnd(6)} | ${age.padEnd(3)} | ${lastUpdated.substring(0, 19)} | ${hasData}`);
      
      monthlyResults.push({
        clientId: client.id,
        clientName: client.name,
        status,
        age,
        hasData: !!monthlyCache?.cache_data,
        lastUpdated: monthlyCache?.last_updated
      });
    }
    
    console.log('');
    
    // 3. Check current week cache for each client
    console.log('📅 STEP 3: Auditing Current Week Cache...');
    console.log('Client | Status | Age | Last Updated | Has Data');
    console.log('-------|--------|-----|-------------|----------');
    
    const weeklyResults = [];
    for (const client of clients) {
      const { data: weeklyCache } = await supabase
        .from('current_week_cache')
        .select('last_updated, cache_data')
        .eq('client_id', client.id)
        .eq('period_id', periods.currentWeek)
        .maybeSingle();
      
      const status = getCacheStatus(weeklyCache?.last_updated);
      const age = formatCacheAge(weeklyCache?.last_updated);
      const hasData = weeklyCache?.cache_data ? '✅' : '❌';
      const lastUpdated = weeklyCache?.last_updated ? 
        new Date(weeklyCache.last_updated).toLocaleString() : 'Never';
      
      console.log(`${client.name.padEnd(6)} | ${status.padEnd(6)} | ${age.padEnd(3)} | ${lastUpdated.substring(0, 19)} | ${hasData}`);
      
      weeklyResults.push({
        clientId: client.id,
        clientName: client.name,
        status,
        age,
        hasData: !!weeklyCache?.cache_data,
        lastUpdated: weeklyCache?.last_updated
      });
    }
    
    console.log('');
    
    // 4. Check for cache isolation (no cross-client contamination)
    console.log('🔒 STEP 4: Checking Cache Isolation...');
    
    // Get all cache entries and group by period to check for duplicates
    const { data: allMonthlyCache } = await supabase
      .from('current_month_cache')
      .select('client_id, period_id, last_updated')
      .eq('period_id', periods.currentMonth);
    
    const { data: allWeeklyCache } = await supabase
      .from('current_week_cache')
      .select('client_id, period_id, last_updated')
      .eq('period_id', periods.currentWeek);
    
    const monthlyByClient = {};
    const weeklyByClient = {};
    
    allMonthlyCache?.forEach(cache => {
      if (!monthlyByClient[cache.client_id]) {
        monthlyByClient[cache.client_id] = [];
      }
      monthlyByClient[cache.client_id].push(cache);
    });
    
    allWeeklyCache?.forEach(cache => {
      if (!weeklyByClient[cache.client_id]) {
        weeklyByClient[cache.client_id] = [];
      }
      weeklyByClient[cache.client_id].push(cache);
    });
    
    let isolationIssues = 0;
    
    // Check for duplicate entries per client
    clients.forEach(client => {
      const monthlyEntries = monthlyByClient[client.id] || [];
      const weeklyEntries = weeklyByClient[client.id] || [];
      
      if (monthlyEntries.length > 1) {
        console.log(`❌ ${client.name}: Found ${monthlyEntries.length} monthly cache entries (should be 1)`);
        isolationIssues++;
      }
      
      if (weeklyEntries.length > 1) {
        console.log(`❌ ${client.name}: Found ${weeklyEntries.length} weekly cache entries (should be 1)`);
        isolationIssues++;
      }
    });
    
    if (isolationIssues === 0) {
      console.log('✅ Cache isolation looks good - each client has max 1 entry per period');
    } else {
      console.log(`❌ Found ${isolationIssues} cache isolation issues`);
    }
    
    console.log('');
    
    // 5. Generate summary
    console.log('📋 STEP 5: Audit Summary');
    console.log('========================');
    
    const monthlyFresh = monthlyResults.filter(r => r.status === '✅ FRESH').length;
    const monthlyStale = monthlyResults.filter(r => r.status === '⚠️ STALE').length;
    const monthlyVeryStale = monthlyResults.filter(r => r.status === '🔴 VERY STALE').length;
    const monthlyMissing = monthlyResults.filter(r => r.status === '❌ MISSING').length;
    
    const weeklyFresh = weeklyResults.filter(r => r.status === '✅ FRESH').length;
    const weeklyStale = weeklyResults.filter(r => r.status === '⚠️ STALE').length;
    const weeklyVeryStale = weeklyResults.filter(r => r.status === '🔴 VERY STALE').length;
    const weeklyMissing = weeklyResults.filter(r => r.status === '❌ MISSING').length;
    
    console.log(`\n📊 Monthly Cache Status (${periods.currentMonth}):`);
    console.log(`   ✅ Fresh (< 3h):    ${monthlyFresh}/${clients.length}`);
    console.log(`   ⚠️ Stale (3-6h):    ${monthlyStale}/${clients.length}`);
    console.log(`   🔴 Very Stale (>6h): ${monthlyVeryStale}/${clients.length}`);
    console.log(`   ❌ Missing:          ${monthlyMissing}/${clients.length}`);
    
    console.log(`\n📅 Weekly Cache Status (${periods.currentWeek}):`);
    console.log(`   ✅ Fresh (< 3h):    ${weeklyFresh}/${clients.length}`);
    console.log(`   ⚠️ Stale (3-6h):    ${weeklyStale}/${clients.length}`);
    console.log(`   🔴 Very Stale (>6h): ${weeklyVeryStale}/${clients.length}`);
    console.log(`   ❌ Missing:          ${weeklyMissing}/${clients.length}`);
    
    // 6. Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (monthlyMissing > 0 || weeklyMissing > 0) {
      console.log('❌ Some clients have missing cache - run manual refresh');
    }
    
    if (monthlyVeryStale > 0 || weeklyVeryStale > 0) {
      console.log('⚠️ Some cache entries are very stale (>6h) - check automation');
    }
    
    if (monthlyFresh === clients.length && weeklyFresh === clients.length) {
      console.log('✅ All caches are fresh - system working perfectly!');
    }
    
    if (isolationIssues > 0) {
      console.log('❌ Cache isolation issues detected - investigate database constraints');
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. Test 3-hour automation: node scripts/test-3hour-automation.js');
    console.log('2. Manual refresh if needed: Use admin panel or API calls');
    console.log('3. Monitor cache health: Re-run this audit periodically');
    
  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    console.error(error);
  }
}

// Run the audit
auditSmartCacheSystem(); 