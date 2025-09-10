/**
 * Test script for StandardizedDataFetcher
 * Testing Belmonte client for September 2025 data
 */

const { StandardizedDataFetcher } = require('./src/lib/standardized-data-fetcher.ts');

async function testBelmonteSeptember() {
  console.log('🧪 Testing StandardizedDataFetcher for Belmonte September 2025...\n');
  
  // Belmonte client ID from database
  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
  
  // September 2025 date range
  const dateRange = {
    start: '2025-09-01',
    end: '2025-09-30'
  };
  
  try {
    console.log('📊 Test Parameters:');
    console.log(`  Client ID: ${clientId}`);
    console.log(`  Date Range: ${dateRange.start} to ${dateRange.end}`);
    console.log(`  Platform: meta`);
    console.log(`  Reason: audit-test\n`);
    
    // Test Meta platform
    console.log('🎯 Testing Meta platform...');
    const metaResult = await StandardizedDataFetcher.fetchData({
      clientId,
      dateRange,
      platform: 'meta',
      reason: 'audit-test'
    });
    
    console.log('📈 Meta Results:');
    console.log(`  Success: ${metaResult.success}`);
    console.log(`  Source: ${metaResult.debug?.source}`);
    console.log(`  Cache Policy: ${metaResult.debug?.cachePolicy}`);
    console.log(`  Response Time: ${metaResult.debug?.responseTime}ms`);
    console.log(`  Period Type: ${metaResult.debug?.periodType}`);
    console.log(`  Data Source Priority: ${metaResult.debug?.dataSourcePriority?.join(' → ')}`);
    console.log(`  Validation: ${metaResult.validation?.isConsistent ? '✅ Consistent' : '❌ Inconsistent'}`);
    console.log(`  Expected Source: ${metaResult.validation?.expectedSource}`);
    console.log(`  Actual Source: ${metaResult.validation?.actualSource}\n`);
    
    if (metaResult.success && metaResult.data) {
      console.log('💰 Financial Metrics:');
      console.log(`  Total Spend: ${metaResult.data.stats?.totalSpend || 0} PLN`);
      console.log(`  Total Impressions: ${metaResult.data.stats?.totalImpressions || 0}`);
      console.log(`  Total Clicks: ${metaResult.data.stats?.totalClicks || 0}`);
      console.log(`  Total Conversions: ${metaResult.data.stats?.totalConversions || 0}`);
      console.log(`  Average CTR: ${metaResult.data.stats?.averageCtr?.toFixed(2) || 0}%`);
      console.log(`  Average CPC: ${metaResult.data.stats?.averageCpc?.toFixed(2) || 0} PLN\n`);
      
      console.log('🎯 Conversion Metrics:');
      console.log(`  Click to Call: ${metaResult.data.conversionMetrics?.click_to_call || 0}`);
      console.log(`  Email Contacts: ${metaResult.data.conversionMetrics?.email_contacts || 0}`);
      console.log(`  Booking Step 1: ${metaResult.data.conversionMetrics?.booking_step_1 || 0}`);
      console.log(`  Booking Step 2: ${metaResult.data.conversionMetrics?.booking_step_2 || 0}`);
      console.log(`  Booking Step 3: ${metaResult.data.conversionMetrics?.booking_step_3 || 0}`);
      console.log(`  Reservations: ${metaResult.data.conversionMetrics?.reservations || 0}`);
      console.log(`  Reservation Value: ${metaResult.data.conversionMetrics?.reservation_value || 0} PLN`);
      console.log(`  ROAS: ${metaResult.data.conversionMetrics?.roas?.toFixed(2) || 0}`);
      console.log(`  Cost per Reservation: ${metaResult.data.conversionMetrics?.cost_per_reservation?.toFixed(2) || 0} PLN\n`);
      
      console.log(`📊 Campaigns: ${metaResult.data.campaigns?.length || 0} campaigns found\n`);
    } else {
      console.log('❌ No data returned from Meta platform\n');
    }
    
    // Test Google platform
    console.log('🎯 Testing Google platform...');
    const googleResult = await StandardizedDataFetcher.fetchData({
      clientId,
      dateRange,
      platform: 'google',
      reason: 'audit-test'
    });
    
    console.log('📈 Google Results:');
    console.log(`  Success: ${googleResult.success}`);
    console.log(`  Source: ${googleResult.debug?.source}`);
    console.log(`  Cache Policy: ${googleResult.debug?.cachePolicy}`);
    console.log(`  Response Time: ${googleResult.debug?.responseTime}ms`);
    console.log(`  Period Type: ${googleResult.debug?.periodType}`);
    console.log(`  Data Source Priority: ${googleResult.debug?.dataSourcePriority?.join(' → ')}`);
    console.log(`  Validation: ${googleResult.validation?.isConsistent ? '✅ Consistent' : '❌ Inconsistent'}`);
    console.log(`  Expected Source: ${googleResult.validation?.expectedSource}`);
    console.log(`  Actual Source: ${googleResult.validation?.actualSource}\n`);
    
    if (googleResult.success && googleResult.data) {
      console.log('💰 Google Financial Metrics:');
      console.log(`  Total Spend: ${googleResult.data.stats?.totalSpend || 0} PLN`);
      console.log(`  Total Impressions: ${googleResult.data.stats?.totalImpressions || 0}`);
      console.log(`  Total Clicks: ${googleResult.data.stats?.totalClicks || 0}`);
      console.log(`  Total Conversions: ${googleResult.data.stats?.totalConversions || 0}`);
      console.log(`  Average CTR: ${googleResult.data.stats?.averageCtr?.toFixed(2) || 0}%`);
      console.log(`  Average CPC: ${googleResult.data.stats?.averageCpc?.toFixed(2) || 0} PLN\n`);
    } else {
      console.log('❌ No data returned from Google platform\n');
    }
    
    // Analysis
    console.log('🔍 ANALYSIS:');
    console.log('='.repeat(50));
    
    if (metaResult.success) {
      const spend = metaResult.data.stats?.totalSpend || 0;
      if (spend > 5000) {
        console.log('✅ GOOD: Meta spend is above 5k PLN - smart cache working properly');
      } else if (spend > 0) {
        console.log('⚠️  WARNING: Meta spend is low - may be using fallback data');
      } else {
        console.log('❌ ERROR: No Meta spend data - smart cache failed');
      }
    } else {
      console.log('❌ ERROR: Meta data fetch failed completely');
    }
    
    console.log('\n📋 RECOMMENDATIONS:');
    if (metaResult.debug?.source === 'smart-cache-system') {
      console.log('✅ Smart cache is being used correctly');
    } else if (metaResult.debug?.source === 'campaign-summaries-database') {
      console.log('⚠️  Using database fallback instead of smart cache');
    } else if (metaResult.debug?.source === 'live-api-with-cache-storage') {
      console.log('⚠️  Using live API fallback - smart cache may be failing');
    } else {
      console.log('❌ Unknown data source - investigate further');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testBelmonteSeptember().catch(console.error);
