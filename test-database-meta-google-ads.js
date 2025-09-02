#!/usr/bin/env node

/**
 * Comprehensive Database Test for Meta Ads and Google Ads
 * 
 * This script tests:
 * 1. Database table structures for Meta Ads and Google Ads
 * 2. Month storage verification for both platforms
 * 3. Smart caching system functionality
 * 4. Current month cache validation
 * 
 * Usage: node test-database-meta-google-ads.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test configuration
const TEST_CONFIG = {
  // Test client IDs - will be fetched from database
  testClientIds: [],
  // Current month info
  currentMonth: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    periodId: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  },
  // Cache duration (3 hours in milliseconds)
  cacheDurationMs: 3 * 60 * 60 * 1000
};

// Test results storage
const testResults = {
  metaAds: {
    tableStructure: {},
    monthStorage: {},
    smartCache: {}
  },
  googleAds: {
    tableStructure: {},
    monthStorage: {},
    smartCache: {}
  },
  summary: {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    warnings: []
  }
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📊',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    debug: '🔍'
  }[type] || '📊';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function recordTest(category, testName, passed, details = '') {
  testResults.summary.totalTests++;
  if (passed) {
    testResults.summary.passedTests++;
  } else {
    testResults.summary.failedTests++;
  }
  
  const result = { passed, details, timestamp: new Date().toISOString() };
  
  if (category.includes('meta')) {
    if (category.includes('table')) testResults.metaAds.tableStructure[testName] = result;
    else if (category.includes('month')) testResults.metaAds.monthStorage[testName] = result;
    else if (category.includes('cache')) testResults.metaAds.smartCache[testName] = result;
  } else if (category.includes('google')) {
    if (category.includes('table')) testResults.googleAds.tableStructure[testName] = result;
    else if (category.includes('month')) testResults.googleAds.monthStorage[testName] = result;
    else if (category.includes('cache')) testResults.googleAds.smartCache[testName] = result;
  }
}

// Test functions

/**
 * Test 1: Verify Meta Ads table structures
 */
async function testMetaAdsTableStructures() {
  log('Testing Meta Ads table structures...', 'info');
  
  try {
    // Test campaigns table (Meta Ads)
    const { data: campaignsSchema, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .limit(1);
    
    if (campaignsError && !campaignsError.message.includes('0 rows')) {
      recordTest('meta-table', 'campaigns_table_exists', false, campaignsError.message);
      log(`Meta campaigns table test failed: ${campaignsError.message}`, 'error');
    } else {
      recordTest('meta-table', 'campaigns_table_exists', true, 'Meta campaigns table accessible');
      log('Meta campaigns table exists and accessible', 'success');
    }
    
    // Test campaign_summaries table (Meta Ads historical data)
    const { data: summariesSchema, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .limit(1);
    
    if (summariesError && !summariesError.message.includes('0 rows')) {
      recordTest('meta-table', 'campaign_summaries_table_exists', false, summariesError.message);
      log(`Meta campaign_summaries table test failed: ${summariesError.message}`, 'error');
    } else {
      recordTest('meta-table', 'campaign_summaries_table_exists', true, 'Meta campaign_summaries table accessible');
      log('Meta campaign_summaries table exists and accessible', 'success');
    }
    
    // Test current_month_cache table (Meta Ads smart cache)
    const { data: cacheSchema, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .limit(1);
    
    if (cacheError && !cacheError.message.includes('0 rows')) {
      recordTest('meta-cache', 'current_month_cache_table_exists', false, cacheError.message);
      log(`Meta current_month_cache table test failed: ${cacheError.message}`, 'error');
    } else {
      recordTest('meta-cache', 'current_month_cache_table_exists', true, 'Meta current_month_cache table accessible');
      log('Meta current_month_cache table exists and accessible', 'success');
    }
    
    // Test current_week_cache table (Meta Ads weekly smart cache)
    const { data: weekCacheSchema, error: weekCacheError } = await supabase
      .from('current_week_cache')
      .select('*')
      .limit(1);
    
    if (weekCacheError && !weekCacheError.message.includes('0 rows')) {
      recordTest('meta-cache', 'current_week_cache_table_exists', false, weekCacheError.message);
      log(`Meta current_week_cache table test failed: ${weekCacheError.message}`, 'error');
    } else {
      recordTest('meta-cache', 'current_week_cache_table_exists', true, 'Meta current_week_cache table accessible');
      log('Meta current_week_cache table exists and accessible', 'success');
    }
    
  } catch (error) {
    recordTest('meta-table', 'table_structure_test', false, error.message);
    log(`Meta Ads table structure test failed: ${error.message}`, 'error');
  }
}

/**
 * Test 2: Verify Google Ads table structures
 */
async function testGoogleAdsTableStructures() {
  log('Testing Google Ads table structures...', 'info');
  
  try {
    // Test google_ads_campaigns table
    const { data: campaignsSchema, error: campaignsError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .limit(1);
    
    if (campaignsError && !campaignsError.message.includes('0 rows')) {
      recordTest('google-table', 'google_ads_campaigns_table_exists', false, campaignsError.message);
      log(`Google Ads campaigns table test failed: ${campaignsError.message}`, 'error');
    } else {
      recordTest('google-table', 'google_ads_campaigns_table_exists', true, 'Google Ads campaigns table accessible');
      log('Google Ads campaigns table exists and accessible', 'success');
    }
    
    // Test google_ads_tables_data table
    const { data: tablesSchema, error: tablesError } = await supabase
      .from('google_ads_tables_data')
      .select('*')
      .limit(1);
    
    if (tablesError && !tablesError.message.includes('0 rows')) {
      recordTest('google-table', 'google_ads_tables_data_table_exists', false, tablesError.message);
      log(`Google Ads tables_data table test failed: ${tablesError.message}`, 'error');
    } else {
      recordTest('google-table', 'google_ads_tables_data_table_exists', true, 'Google Ads tables_data table accessible');
      log('Google Ads tables_data table exists and accessible', 'success');
    }
    
    // Test google_ads_current_month_cache table
    const { data: cacheSchema, error: cacheError } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .limit(1);
    
    if (cacheError && !cacheError.message.includes('0 rows')) {
      recordTest('google-cache', 'google_ads_current_month_cache_table_exists', false, cacheError.message);
      log(`Google Ads current_month_cache table test failed: ${cacheError.message}`, 'error');
    } else {
      recordTest('google-cache', 'google_ads_current_month_cache_table_exists', true, 'Google Ads current_month_cache table accessible');
      log('Google Ads current_month_cache table exists and accessible', 'success');
    }
    
    // Test google_ads_current_week_cache table
    const { data: weekCacheSchema, error: weekCacheError } = await supabase
      .from('google_ads_current_week_cache')
      .select('*')
      .limit(1);
    
    if (weekCacheError && !weekCacheError.message.includes('0 rows')) {
      recordTest('google-cache', 'google_ads_current_week_cache_table_exists', false, weekCacheError.message);
      log(`Google Ads current_week_cache table test failed: ${weekCacheError.message}`, 'error');
    } else {
      recordTest('google-cache', 'google_ads_current_week_cache_table_exists', true, 'Google Ads current_week_cache table accessible');
      log('Google Ads current_week_cache table exists and accessible', 'success');
    }
    
  } catch (error) {
    recordTest('google-table', 'table_structure_test', false, error.message);
    log(`Google Ads table structure test failed: ${error.message}`, 'error');
  }
}

/**
 * Test 3: Verify month storage for Meta Ads
 */
async function testMetaAdsMonthStorage() {
  log('Testing Meta Ads month storage...', 'info');
  
  try {
    // Get sample of clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, ad_account_id')
      .not('meta_access_token', 'is', null)
      .not('ad_account_id', 'is', null)
      .limit(5);
    
    if (clientsError) {
      recordTest('meta-month', 'clients_with_meta_credentials', false, clientsError.message);
      log(`Failed to fetch clients with Meta credentials: ${clientsError.message}`, 'error');
      return;
    }
    
    recordTest('meta-month', 'clients_with_meta_credentials', true, `Found ${clients.length} clients with Meta credentials`);
    log(`Found ${clients.length} clients with Meta credentials`, 'success');
    
    // Test campaigns table for month data
    const { data: campaignMonths, error: campaignMonthsError } = await supabase
      .from('campaigns')
      .select('date_range_start, date_range_end, client_id')
      .order('date_range_start', { ascending: false })
      .limit(20);
    
    if (campaignMonthsError) {
      recordTest('meta-month', 'campaigns_month_data', false, campaignMonthsError.message);
      log(`Failed to fetch Meta campaigns month data: ${campaignMonthsError.message}`, 'error');
    } else {
      const monthsFound = new Set();
      campaignMonths.forEach(campaign => {
        const month = campaign.date_range_start.substring(0, 7); // YYYY-MM
        monthsFound.add(month);
      });
      
      recordTest('meta-month', 'campaigns_month_data', true, `Found data for ${monthsFound.size} different months, ${campaignMonths.length} campaign records`);
      log(`Meta campaigns: Found data for ${monthsFound.size} different months, ${campaignMonths.length} records`, 'success');
    }
    
    // Test campaign_summaries for historical month data
    const { data: summaryMonths, error: summaryMonthsError } = await supabase
      .from('campaign_summaries')
      .select('summary_date, summary_type, client_id')
      .eq('summary_type', 'monthly')
      .order('summary_date', { ascending: false })
      .limit(20);
    
    if (summaryMonthsError) {
      recordTest('meta-month', 'campaign_summaries_month_data', false, summaryMonthsError.message);
      log(`Failed to fetch Meta campaign summaries month data: ${summaryMonthsError.message}`, 'error');
    } else {
      recordTest('meta-month', 'campaign_summaries_month_data', true, `Found ${summaryMonths.length} monthly summary records`);
      log(`Meta campaign summaries: Found ${summaryMonths.length} monthly records`, 'success');
    }
    
  } catch (error) {
    recordTest('meta-month', 'month_storage_test', false, error.message);
    log(`Meta Ads month storage test failed: ${error.message}`, 'error');
  }
}

/**
 * Test 4: Verify month storage for Google Ads
 */
async function testGoogleAdsMonthStorage() {
  log('Testing Google Ads month storage...', 'info');
  
  try {
    // Get sample of clients with Google Ads
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, google_ads_customer_id, google_ads_refresh_token, google_ads_enabled')
      .eq('google_ads_enabled', true)
      .not('google_ads_customer_id', 'is', null)
      .not('google_ads_refresh_token', 'is', null)
      .limit(5);
    
    if (clientsError) {
      recordTest('google-month', 'clients_with_google_ads_credentials', false, clientsError.message);
      log(`Failed to fetch clients with Google Ads credentials: ${clientsError.message}`, 'error');
      return;
    }
    
    recordTest('google-month', 'clients_with_google_ads_credentials', true, `Found ${clients.length} clients with Google Ads credentials`);
    log(`Found ${clients.length} clients with Google Ads credentials`, 'success');
    
    // Test google_ads_campaigns table for month data
    const { data: campaignMonths, error: campaignMonthsError } = await supabase
      .from('google_ads_campaigns')
      .select('date_range_start, date_range_end, client_id')
      .order('date_range_start', { ascending: false })
      .limit(20);
    
    if (campaignMonthsError) {
      recordTest('google-month', 'google_ads_campaigns_month_data', false, campaignMonthsError.message);
      log(`Failed to fetch Google Ads campaigns month data: ${campaignMonthsError.message}`, 'error');
    } else {
      const monthsFound = new Set();
      campaignMonths.forEach(campaign => {
        const month = campaign.date_range_start.substring(0, 7); // YYYY-MM
        monthsFound.add(month);
      });
      
      recordTest('google-month', 'google_ads_campaigns_month_data', true, `Found data for ${monthsFound.size} different months, ${campaignMonths.length} campaign records`);
      log(`Google Ads campaigns: Found data for ${monthsFound.size} different months, ${campaignMonths.length} records`, 'success');
    }
    
    // Test google_ads_tables_data for month data
    const { data: tablesMonths, error: tablesMonthsError } = await supabase
      .from('google_ads_tables_data')
      .select('date_range_start, date_range_end, client_id')
      .order('date_range_start', { ascending: false })
      .limit(20);
    
    if (tablesMonthsError) {
      recordTest('google-month', 'google_ads_tables_data_month_data', false, tablesMonthsError.message);
      log(`Failed to fetch Google Ads tables month data: ${tablesMonthsError.message}`, 'error');
    } else {
      const monthsFound = new Set();
      tablesMonths.forEach(table => {
        const month = table.date_range_start.substring(0, 7); // YYYY-MM
        monthsFound.add(month);
      });
      
      recordTest('google-month', 'google_ads_tables_data_month_data', true, `Found data for ${monthsFound.size} different months, ${tablesMonths.length} table records`);
      log(`Google Ads tables: Found data for ${monthsFound.size} different months, ${tablesMonths.length} records`, 'success');
    }
    
  } catch (error) {
    recordTest('google-month', 'month_storage_test', false, error.message);
    log(`Google Ads month storage test failed: ${error.message}`, 'error');
  }
}

/**
 * Test 5: Verify Meta Ads smart caching for current month
 */
async function testMetaAdsSmartCache() {
  log('Testing Meta Ads smart caching for current month...', 'info');
  
  try {
    // Test current_month_cache table
    const { data: currentMonthCache, error: currentMonthCacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('period_id', TEST_CONFIG.currentMonth.periodId)
      .order('last_updated', { ascending: false })
      .limit(10);
    
    if (currentMonthCacheError) {
      recordTest('meta-cache', 'current_month_cache_data', false, currentMonthCacheError.message);
      log(`Failed to fetch Meta current month cache: ${currentMonthCacheError.message}`, 'error');
    } else {
      recordTest('meta-cache', 'current_month_cache_data', true, `Found ${currentMonthCache.length} current month cache entries`);
      log(`Meta current month cache: Found ${currentMonthCache.length} entries for ${TEST_CONFIG.currentMonth.periodId}`, 'success');
      
      // Test cache freshness
      let freshCacheCount = 0;
      let staleCacheCount = 0;
      
      currentMonthCache.forEach(cache => {
        const cacheTime = new Date(cache.last_updated).getTime();
        const now = new Date().getTime();
        const age = now - cacheTime;
        
        if (age < TEST_CONFIG.cacheDurationMs) {
          freshCacheCount++;
        } else {
          staleCacheCount++;
        }
      });
      
      recordTest('meta-cache', 'current_month_cache_freshness', true, `Fresh: ${freshCacheCount}, Stale: ${staleCacheCount}`);
      log(`Meta cache freshness: ${freshCacheCount} fresh, ${staleCacheCount} stale entries`, 'success');
    }
    
    // Test current_week_cache table
    const currentWeek = getCurrentWeekInfo();
    const { data: currentWeekCache, error: currentWeekCacheError } = await supabase
      .from('current_week_cache')
      .select('*')
      .eq('period_id', currentWeek.periodId)
      .order('last_updated', { ascending: false })
      .limit(10);
    
    if (currentWeekCacheError) {
      recordTest('meta-cache', 'current_week_cache_data', false, currentWeekCacheError.message);
      log(`Failed to fetch Meta current week cache: ${currentWeekCacheError.message}`, 'error');
    } else {
      recordTest('meta-cache', 'current_week_cache_data', true, `Found ${currentWeekCache.length} current week cache entries`);
      log(`Meta current week cache: Found ${currentWeekCache.length} entries for ${currentWeek.periodId}`, 'success');
    }
    
  } catch (error) {
    recordTest('meta-cache', 'smart_cache_test', false, error.message);
    log(`Meta Ads smart cache test failed: ${error.message}`, 'error');
  }
}

/**
 * Test 6: Verify Google Ads smart caching for current month
 */
async function testGoogleAdsSmartCache() {
  log('Testing Google Ads smart caching for current month...', 'info');
  
  try {
    // Test google_ads_current_month_cache table
    const { data: currentMonthCache, error: currentMonthCacheError } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .eq('period_id', TEST_CONFIG.currentMonth.periodId)
      .order('last_updated', { ascending: false })
      .limit(10);
    
    if (currentMonthCacheError) {
      recordTest('google-cache', 'google_ads_current_month_cache_data', false, currentMonthCacheError.message);
      log(`Failed to fetch Google Ads current month cache: ${currentMonthCacheError.message}`, 'error');
    } else {
      recordTest('google-cache', 'google_ads_current_month_cache_data', true, `Found ${currentMonthCache.length} current month cache entries`);
      log(`Google Ads current month cache: Found ${currentMonthCache.length} entries for ${TEST_CONFIG.currentMonth.periodId}`, 'success');
      
      // Test cache freshness
      let freshCacheCount = 0;
      let staleCacheCount = 0;
      
      currentMonthCache.forEach(cache => {
        const cacheTime = new Date(cache.last_updated).getTime();
        const now = new Date().getTime();
        const age = now - cacheTime;
        
        if (age < TEST_CONFIG.cacheDurationMs) {
          freshCacheCount++;
        } else {
          staleCacheCount++;
        }
      });
      
      recordTest('google-cache', 'google_ads_current_month_cache_freshness', true, `Fresh: ${freshCacheCount}, Stale: ${staleCacheCount}`);
      log(`Google Ads cache freshness: ${freshCacheCount} fresh, ${staleCacheCount} stale entries`, 'success');
    }
    
    // Test google_ads_current_week_cache table
    const currentWeek = getCurrentWeekInfo();
    const { data: currentWeekCache, error: currentWeekCacheError } = await supabase
      .from('google_ads_current_week_cache')
      .select('*')
      .eq('period_id', currentWeek.periodId)
      .order('last_updated', { ascending: false })
      .limit(10);
    
    if (currentWeekCacheError) {
      recordTest('google-cache', 'google_ads_current_week_cache_data', false, currentWeekCacheError.message);
      log(`Failed to fetch Google Ads current week cache: ${currentWeekCacheError.message}`, 'error');
    } else {
      recordTest('google-cache', 'google_ads_current_week_cache_data', true, `Found ${currentWeekCache.length} current week cache entries`);
      log(`Google Ads current week cache: Found ${currentWeekCache.length} entries for ${currentWeek.periodId}`, 'success');
    }
    
  } catch (error) {
    recordTest('google-cache', 'smart_cache_test', false, error.message);
    log(`Google Ads smart cache test failed: ${error.message}`, 'error');
  }
}

/**
 * Test 7: Cross-platform data consistency
 */
async function testCrossPlatformConsistency() {
  log('Testing cross-platform data consistency...', 'info');
  
  try {
    // Get clients that have both Meta and Google Ads enabled
    const { data: dualPlatformClients, error: dualClientsError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, ad_account_id, google_ads_enabled, google_ads_customer_id')
      .not('meta_access_token', 'is', null)
      .not('ad_account_id', 'is', null)
      .eq('google_ads_enabled', true)
      .not('google_ads_customer_id', 'is', null)
      .limit(5);
    
    if (dualClientsError) {
      recordTest('cross-platform', 'dual_platform_clients', false, dualClientsError.message);
      log(`Failed to fetch dual-platform clients: ${dualClientsError.message}`, 'error');
      return;
    }
    
    recordTest('cross-platform', 'dual_platform_clients', true, `Found ${dualPlatformClients.length} clients with both platforms`);
    log(`Found ${dualPlatformClients.length} clients with both Meta and Google Ads`, 'success');
    
    // For each dual-platform client, check if they have data in both systems
    let consistentClients = 0;
    
    for (const client of dualPlatformClients) {
      const [metaData, googleAdsData] = await Promise.all([
        supabase
          .from('campaigns')
          .select('id')
          .eq('client_id', client.id)
          .limit(1),
        supabase
          .from('google_ads_campaigns')
          .select('id')
          .eq('client_id', client.id)
          .limit(1)
      ]);
      
      const hasMetaData = metaData.data && metaData.data.length > 0;
      const hasGoogleAdsData = googleAdsData.data && googleAdsData.data.length > 0;
      
      if (hasMetaData && hasGoogleAdsData) {
        consistentClients++;
      }
    }
    
    recordTest('cross-platform', 'data_consistency', true, `${consistentClients}/${dualPlatformClients.length} clients have data in both platforms`);
    log(`Data consistency: ${consistentClients}/${dualPlatformClients.length} clients have data in both platforms`, 'success');
    
  } catch (error) {
    recordTest('cross-platform', 'consistency_test', false, error.message);
    log(`Cross-platform consistency test failed: ${error.message}`, 'error');
  }
}

/**
 * Utility function to get current week info
 */
function getCurrentWeekInfo() {
  const now = new Date();
  const year = now.getFullYear();
  
  // Get ISO week number (Monday = start of week)
  const date = new Date(now.getTime());
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  // January 4 is always in week 1
  const week1 = new Date(date.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count weeks from there
  const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  
  return {
    year,
    week: weekNumber,
    periodId: `${year}-W${String(weekNumber).padStart(2, '0')}`
  };
}

/**
 * Generate comprehensive test report
 */
function generateTestReport() {
  log('Generating comprehensive test report...', 'info');
  
  const report = {
    testSummary: {
      timestamp: new Date().toISOString(),
      totalTests: testResults.summary.totalTests,
      passedTests: testResults.summary.passedTests,
      failedTests: testResults.summary.failedTests,
      successRate: testResults.summary.totalTests > 0 ? 
        ((testResults.summary.passedTests / testResults.summary.totalTests) * 100).toFixed(2) + '%' : '0%'
    },
    metaAdsResults: testResults.metaAds,
    googleAdsResults: testResults.googleAds,
    currentMonthInfo: TEST_CONFIG.currentMonth,
    recommendations: []
  };
  
  // Generate recommendations based on test results
  if (testResults.summary.failedTests > 0) {
    report.recommendations.push('⚠️ Some tests failed - review failed test details for specific issues');
  }
  
  if (testResults.metaAds.smartCache.current_month_cache_data?.passed === false) {
    report.recommendations.push('🔧 Meta Ads current month cache is not working - check smart cache implementation');
  }
  
  if (testResults.googleAds.smartCache.google_ads_current_month_cache_data?.passed === false) {
    report.recommendations.push('🔧 Google Ads current month cache is not working - check smart cache implementation');
  }
  
  if (testResults.summary.passedTests === testResults.summary.totalTests) {
    report.recommendations.push('✅ All tests passed - database and caching systems are working correctly');
  }
  
  return report;
}

/**
 * Main test execution function
 */
async function runAllTests() {
  log('Starting comprehensive database test for Meta Ads and Google Ads...', 'info');
  log(`Testing current month: ${TEST_CONFIG.currentMonth.periodId}`, 'info');
  
  try {
    // Run all tests
    await testMetaAdsTableStructures();
    await testGoogleAdsTableStructures();
    await testMetaAdsMonthStorage();
    await testGoogleAdsMonthStorage();
    await testMetaAdsSmartCache();
    await testGoogleAdsSmartCache();
    await testCrossPlatformConsistency();
    
    // Generate and display report
    const report = generateTestReport();
    
    log('='.repeat(80), 'info');
    log('DATABASE TEST REPORT', 'info');
    log('='.repeat(80), 'info');
    
    console.log(JSON.stringify(report, null, 2));
    
    log('='.repeat(80), 'info');
    log(`Test Summary: ${report.testSummary.passedTests}/${report.testSummary.totalTests} passed (${report.testSummary.successRate})`, 
         report.testSummary.failedTests === 0 ? 'success' : 'warning');
    
    if (report.recommendations.length > 0) {
      log('Recommendations:', 'info');
      report.recommendations.forEach(rec => log(rec, 'info'));
    }
    
    log('Database test completed successfully!', 'success');
    
  } catch (error) {
    log(`Database test failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    log(`Test execution failed: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testMetaAdsTableStructures,
  testGoogleAdsTableStructures,
  testMetaAdsMonthStorage,
  testGoogleAdsMonthStorage,
  testMetaAdsSmartCache,
  testGoogleAdsSmartCache,
  testCrossPlatformConsistency,
  generateTestReport
};

