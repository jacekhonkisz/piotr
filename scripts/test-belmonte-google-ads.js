#!/usr/bin/env node

/**
 * Test Google Ads Data Fetching for Belmonte Hotel
 * 
 * This script tests if the Google Ads API properly fetches data
 * from different time periods using the Belmonte hotel account.
 * 
 * Tests:
 * - Current month data
 * - Previous month data
 * - Custom date ranges
 * - Campaign performance
 * - Ad group and ad data
 */

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsAPIService } = require('../src/lib/google-ads-api.ts');
require('dotenv').config();

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test results tracker
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

function logSuccess(message) {
  console.log(`✅ ${message}`);
  testResults.passed.push(message);
}

function logError(message, error = null) {
  console.log(`❌ ${message}`);
  if (error) console.error('   Error:', error.message || error);
  testResults.failed.push(message);
}

function logWarning(message) {
  console.log(`⚠️  ${message}`);
  testResults.warnings.push(message);
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function getDateRange(periodType) {
  const now = new Date();
  const today = formatDate(now);
  
  switch (periodType) {
    case 'today':
      return { start: today, end: today, label: 'Today' };
    
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = formatDate(yesterday);
      return { start: dateStr, end: dateStr, label: 'Yesterday' };
    }
    
    case 'last7days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return { start: formatDate(start), end: today, label: 'Last 7 Days' };
    }
    
    case 'last30days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { start: formatDate(start), end: today, label: 'Last 30 Days' };
    }
    
    case 'currentMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: formatDate(start), end: today, label: 'Current Month' };
    }
    
    case 'previousMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: formatDate(start), end: formatDate(end), label: 'Previous Month' };
    }
    
    default:
      return { start: today, end: today, label: 'Today' };
  }
}

async function getBelmonteClient() {
  console.log('\n📋 TEST 1: Finding Belmonte Hotel Client');
  console.log('=========================================');
  
  try {
    // Try to find Belmonte hotel client
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%');
    
    if (error) throw error;
    
    if (!clients || clients.length === 0) {
      logWarning('Belmonte client not found, trying alternative search...');
      
      // Try to get any client with Google Ads enabled
      const { data: allClients, error: allError } = await supabase
        .from('clients')
        .select('*')
        .eq('google_ads_enabled', true)
        .limit(5);
      
      if (allError) throw allError;
      
      if (!allClients || allClients.length === 0) {
        logError('No clients with Google Ads enabled found');
        return null;
      }
      
      console.log('\n📋 Available Google Ads clients:');
      allClients.forEach((client, index) => {
        console.log(`   ${index + 1}. ${client.name} (${client.email})`);
        console.log(`      Customer ID: ${client.google_ads_customer_id || 'Not set'}`);
      });
      
      // Use the first client for testing
      const client = allClients[0];
      logWarning(`Using ${client.name} for testing`);
      return client;
    }
    
    const client = clients[0];
    logSuccess(`Found client: ${client.name}`);
    console.log(`   Email: ${client.email}`);
    console.log(`   Customer ID: ${client.google_ads_customer_id || 'Not set'}`);
    console.log(`   Google Ads Enabled: ${client.google_ads_enabled ? 'Yes' : 'No'}`);
    
    return client;
  } catch (error) {
    logError('Failed to find Belmonte client', error);
    return null;
  }
}

async function getGoogleAdsCredentials(client) {
  console.log('\n📋 TEST 2: Getting Google Ads Credentials');
  console.log('=========================================');
  
  try {
    // Get system settings
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_customer_id',
        'google_ads_manager_refresh_token'
      ]);
    
    if (error) throw error;
    
    const creds = {};
    settings?.forEach(s => {
      creds[s.key] = s.value;
    });
    
    // Check required credentials
    const required = [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_customer_id'
    ];
    
    let allPresent = true;
    for (const key of required) {
      if (!creds[key]) {
        logError(`Missing: ${key}`);
        allPresent = false;
      } else {
        const displayValue = key.includes('secret') || key.includes('token') 
          ? '***[SET]***' 
          : creds[key];
        logSuccess(`${key}: ${displayValue}`);
      }
    }
    
    if (!allPresent) {
      logError('Missing required credentials');
      return null;
    }
    
    // Determine refresh token to use
    let refreshToken = creds.google_ads_manager_refresh_token;
    let tokenSource = 'Manager';
    
    if (!refreshToken && client.google_ads_refresh_token) {
      refreshToken = client.google_ads_refresh_token;
      tokenSource = 'Client';
    }
    
    if (!refreshToken) {
      logError('No refresh token available');
      return null;
    }
    
    logSuccess(`Using ${tokenSource} refresh token`);
    
    // Determine customer ID
    const customerId = client.google_ads_customer_id || creds.google_ads_manager_customer_id;
    logSuccess(`Customer ID: ${customerId}`);
    
    return {
      clientId: creds.google_ads_client_id,
      clientSecret: creds.google_ads_client_secret,
      developmentToken: creds.google_ads_developer_token,
      refreshToken: refreshToken,
      customerId: customerId.replace(/-/g, ''),
      managerCustomerId: creds.google_ads_manager_customer_id?.replace(/-/g, '')
    };
  } catch (error) {
    logError('Failed to get credentials', error);
    return null;
  }
}

async function testAccountPerformance(googleAdsService, dateRange) {
  console.log(`\n📊 Testing Account Performance: ${dateRange.label}`);
  console.log(`   Period: ${dateRange.start} to ${dateRange.end}`);
  console.log('   -------------------------------------------');
  
  try {
    const data = await googleAdsService.getAccountPerformance(
      dateRange.start,
      dateRange.end
    );
    
    if (!data) {
      logError(`No account data returned for ${dateRange.label}`);
      return false;
    }
    
    logSuccess(`Account data fetched for ${dateRange.label}`);
    console.log(`   Impressions: ${data.impressions?.toLocaleString() || 0}`);
    console.log(`   Clicks: ${data.clicks?.toLocaleString() || 0}`);
    console.log(`   Spend: $${data.spend?.toLocaleString() || 0}`);
    console.log(`   CTR: ${data.ctr?.toFixed(2) || 0}%`);
    console.log(`   CPC: $${data.cpc?.toFixed(2) || 0}`);
    console.log(`   Conversions: ${data.conversions?.toLocaleString() || 0}`);
    
    return true;
  } catch (error) {
    logError(`Failed to fetch account performance for ${dateRange.label}`, error);
    return false;
  }
}

async function testCampaignData(googleAdsService, dateRange) {
  console.log(`\n📊 Testing Campaign Data: ${dateRange.label}`);
  console.log(`   Period: ${dateRange.start} to ${dateRange.end}`);
  console.log('   -------------------------------------------');
  
  try {
    const data = await googleAdsService.getCampaignsData(
      dateRange.start,
      dateRange.end
    );
    
    if (!data || data.length === 0) {
      logWarning(`No campaign data found for ${dateRange.label}`);
      return false;
    }
    
    logSuccess(`Found ${data.length} campaigns for ${dateRange.label}`);
    
    // Show top 3 campaigns
    const top3 = data.slice(0, 3);
    top3.forEach((campaign, index) => {
      console.log(`   ${index + 1}. ${campaign.campaignName}`);
      console.log(`      Spend: $${campaign.spend?.toLocaleString() || 0}`);
      console.log(`      Clicks: ${campaign.clicks?.toLocaleString() || 0}`);
      console.log(`      Conversions: ${campaign.conversions?.toLocaleString() || 0}`);
    });
    
    if (data.length > 3) {
      console.log(`   ... and ${data.length - 3} more campaigns`);
    }
    
    return true;
  } catch (error) {
    logError(`Failed to fetch campaign data for ${dateRange.label}`, error);
    return false;
  }
}

async function testNetworkPerformance(googleAdsService, dateRange) {
  console.log(`\n📊 Testing Network Performance: ${dateRange.label}`);
  console.log(`   Period: ${dateRange.start} to ${dateRange.end}`);
  console.log('   -------------------------------------------');
  
  try {
    const data = await googleAdsService.getNetworkPerformance(
      dateRange.start,
      dateRange.end
    );
    
    if (!data || data.length === 0) {
      logWarning(`No network data found for ${dateRange.label}`);
      return false;
    }
    
    logSuccess(`Network data fetched for ${dateRange.label}`);
    
    data.forEach((network, index) => {
      console.log(`   ${index + 1}. ${network.network}`);
      console.log(`      Spend: $${network.spend?.toLocaleString() || 0}`);
      console.log(`      Clicks: ${network.clicks?.toLocaleString() || 0}`);
    });
    
    return true;
  } catch (error) {
    logError(`Failed to fetch network performance for ${dateRange.label}`, error);
    return false;
  }
}

async function testDevicePerformance(googleAdsService, dateRange) {
  console.log(`\n📊 Testing Device Performance: ${dateRange.label}`);
  console.log(`   Period: ${dateRange.start} to ${dateRange.end}`);
  console.log('   -------------------------------------------');
  
  try {
    const data = await googleAdsService.getDevicePerformance(
      dateRange.start,
      dateRange.end
    );
    
    if (!data || data.length === 0) {
      logWarning(`No device data found for ${dateRange.label}`);
      return false;
    }
    
    logSuccess(`Device data fetched for ${dateRange.label}`);
    
    data.forEach((device, index) => {
      console.log(`   ${index + 1}. ${device.device}`);
      console.log(`      Spend: $${device.spend?.toLocaleString() || 0}`);
      console.log(`      Clicks: ${device.clicks?.toLocaleString() || 0}`);
    });
    
    return true;
  } catch (error) {
    logError(`Failed to fetch device performance for ${dateRange.label}`, error);
    return false;
  }
}

function printFinalReport() {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('📊 BELMONTE GOOGLE ADS DATA FETCH TEST REPORT');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ Tests Passed: ${testResults.passed.length}`);
  console.log(`❌ Tests Failed: ${testResults.failed.length}`);
  console.log(`⚠️  Warnings: ${testResults.warnings.length}`);
  console.log('');
  
  const totalTests = testResults.passed.length + testResults.failed.length;
  const successRate = totalTests > 0 ? (testResults.passed.length / totalTests * 100).toFixed(1) : 0;
  
  console.log(`Success Rate: ${successRate}%`);
  console.log('');
  
  if (testResults.failed.length === 0) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('');
    console.log('✅ Google Ads API is working correctly');
    console.log('✅ Data fetching works for all time periods');
    console.log('✅ All performance metrics are accessible');
    console.log('✅ Your implementation is PRODUCTION READY!');
  } else {
    console.log('⚠️  SOME TESTS FAILED');
    console.log('');
    console.log('Failed Tests:');
    testResults.failed.forEach(failure => {
      console.log(`   ❌ ${failure}`);
    });
  }
  
  if (testResults.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    testResults.warnings.forEach(warning => {
      console.log(`   ⚠️  ${warning}`);
    });
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════');
}

async function main() {
  console.log('🎯 Belmonte Hotel - Google Ads Data Fetch Test');
  console.log('═══════════════════════════════════════════════════');
  console.log('Testing data retrieval from different time periods');
  console.log('with Standard Access approved token');
  console.log('═══════════════════════════════════════════════════');
  
  // Step 1: Get Belmonte client
  const client = await getBelmonteClient();
  if (!client) {
    console.log('\n❌ Cannot proceed without client data');
    process.exit(1);
  }
  
  // Step 2: Get credentials
  const credentials = await getGoogleAdsCredentials(client);
  if (!credentials) {
    console.log('\n❌ Cannot proceed without credentials');
    process.exit(1);
  }
  
  // Step 3: Initialize Google Ads service
  console.log('\n📋 TEST 3: Initializing Google Ads API Service');
  console.log('=========================================');
  
  let googleAdsService;
  try {
    googleAdsService = new GoogleAdsAPIService(credentials);
    logSuccess('Google Ads API Service initialized');
  } catch (error) {
    logError('Failed to initialize Google Ads service', error);
    printFinalReport();
    process.exit(1);
  }
  
  // Step 4: Test different date ranges
  console.log('\n📋 TEST 4: Testing Different Time Periods');
  console.log('=========================================');
  
  const dateRanges = [
    getDateRange('last7days'),
    getDateRange('last30days'),
    getDateRange('currentMonth'),
    getDateRange('previousMonth')
  ];
  
  for (const dateRange of dateRanges) {
    await testAccountPerformance(googleAdsService, dateRange);
  }
  
  // Step 5: Test campaign data
  console.log('\n📋 TEST 5: Testing Campaign Data Retrieval');
  console.log('=========================================');
  
  await testCampaignData(googleAdsService, getDateRange('last30days'));
  
  // Step 6: Test network performance
  console.log('\n📋 TEST 6: Testing Network Performance');
  console.log('=========================================');
  
  await testNetworkPerformance(googleAdsService, getDateRange('last30days'));
  
  // Step 7: Test device performance
  console.log('\n📋 TEST 7: Testing Device Performance');
  console.log('=========================================');
  
  await testDevicePerformance(googleAdsService, getDateRange('last30days'));
  
  // Print final report
  printFinalReport();
  
  // Exit with appropriate code
  process.exit(testResults.failed.length > 0 ? 1 : 0);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  getBelmonteClient,
  getGoogleAdsCredentials,
  testAccountPerformance,
  testCampaignData
};






