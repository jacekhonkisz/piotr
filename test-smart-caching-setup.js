#!/usr/bin/env node

/**
 * 🔧 SMART CACHING & DATABASE LOGIC TEST SCRIPT
 * 
 * This script tests the smart caching and database-first implementation
 * to verify that reports display uses the correct data sources.
 */

const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_CLIENT_ID = process.env.TEST_CLIENT_ID || 'test-client-id';

// Test scenarios
const testScenarios = [
  {
    name: '🟢 Current Month - Should Use Smart Cache',
    dateRange: getCurrentMonthRange(),
    expectedSource: 'smart-cache',
    description: 'Current month data should use smart cache (fresh or stale)'
  },
  {
    name: '🔵 Historical Month - Should Use Database',
    dateRange: getHistoricalMonthRange(),
    expectedSource: 'database',
    description: 'Historical month data should use database'
  },
  {
    name: '🟡 Current Week - Should Use Smart Cache',
    dateRange: getCurrentWeekRange(),
    expectedSource: 'smart-cache',
    description: 'Current week data should use smart cache'
  },
  {
    name: '🔵 Historical Week - Should Use Database',
    dateRange: getHistoricalWeekRange(),
    expectedSource: 'database',
    description: 'Historical week data should use database'
  },
  {
    name: '🔴 Force Refresh - Should Use Live API',
    dateRange: getCurrentMonthRange(),
    expectedSource: 'live-api',
    forceFresh: true,
    description: 'Force refresh should bypass cache and use live API'
  }
];

// Helper functions to generate date ranges
function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  return { start: startDate, end: endDate };
}

function getHistoricalMonthRange() {
  const now = new Date();
  const historicalDate = new Date(now.getFullYear(), now.getMonth() - 2, 1); // 2 months ago
  const year = historicalDate.getFullYear();
  const month = historicalDate.getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];
  return { start: startDate, end: endDate };
}

function getCurrentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

function getHistoricalWeekRange() {
  const now = new Date();
  const historicalDate = new Date(now);
  historicalDate.setDate(now.getDate() - 21); // 3 weeks ago
  
  const dayOfWeek = historicalDate.getDay();
  const monday = new Date(historicalDate);
  monday.setDate(historicalDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

// Test execution function
async function runTest(scenario) {
  console.log(`\n🧪 Testing: ${scenario.name}`);
  console.log(`📅 Date Range: ${scenario.dateRange.start} to ${scenario.dateRange.end}`);
  console.log(`🎯 Expected Source: ${scenario.expectedSource}`);
  console.log(`📝 Description: ${scenario.description}`);
  
  const requestBody = {
    dateRange: scenario.dateRange,
    clientId: TEST_CLIENT_ID,
    platform: 'meta',
    ...(scenario.forceFresh && { forceFresh: true })
  };
  
  try {
    console.log('📡 Making API request...');
    const response = await fetch(`${BASE_URL}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In real testing, you'd need proper authentication headers
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const result = await response.json();
    
    // Extract data source information
    const validation = result.data?.dataSourceValidation;
    const debug = result.debug;
    const actualSource = debug?.source || validation?.actualSource || 'unknown';
    
    console.log('📊 Response Analysis:');
    console.log(`   Actual Source: ${actualSource}`);
    console.log(`   Expected Source: ${scenario.expectedSource}`);
    console.log(`   Cache First Enforced: ${validation?.cacheFirstEnforced || 'unknown'}`);
    console.log(`   Cache Policy: ${debug?.cachePolicy || 'unknown'}`);
    
    if (validation?.potentialCacheBypassed) {
      console.log('⚠️  WARNING: Potential cache bypass detected!');
    }
    
    // Determine if test passed
    const sourceMatches = actualSource.includes(scenario.expectedSource) || 
                         (scenario.expectedSource === 'smart-cache' && 
                          (actualSource.includes('cache') || actualSource.includes('stale'))) ||
                         (scenario.expectedSource === 'database' && 
                          actualSource.includes('database')) ||
                         (scenario.expectedSource === 'live-api' && 
                          actualSource.includes('live'));
    
    if (sourceMatches) {
      console.log('✅ TEST PASSED: Data source matches expectation');
      return { success: true, actualSource, expectedSource: scenario.expectedSource };
    } else {
      console.log('❌ TEST FAILED: Data source does not match expectation');
      return { success: false, actualSource, expectedSource: scenario.expectedSource };
    }
    
  } catch (error) {
    console.log(`❌ Test Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 SMART CACHING & DATABASE LOGIC TEST SUITE');
  console.log('='.repeat(60));
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`👤 Test Client ID: ${TEST_CLIENT_ID}`);
  console.log(`⏰ Test Time: ${new Date().toISOString()}`);
  
  const results = [];
  
  for (const scenario of testScenarios) {
    const result = await runTest(scenario);
    results.push({
      name: scenario.name,
      ...result
    });
    
    // Wait between tests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n📋 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (!result.success && result.actualSource && result.expectedSource) {
      console.log(`     Expected: ${result.expectedSource}, Got: ${result.actualSource}`);
    }
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });
  
  console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Smart caching and database logic is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please review the implementation.');
  }
  
  return { passed, total, results };
}

// Usage instructions
function printUsage() {
  console.log(`
🔧 SMART CACHING TEST SCRIPT USAGE:

Environment Variables:
  BASE_URL         - Base URL of your application (default: http://localhost:3000)
  TEST_CLIENT_ID   - Client ID to test with (default: test-client-id)

Examples:
  # Test against local development server
  node test-smart-caching-setup.js
  
  # Test against production
  BASE_URL=https://your-app.vercel.app node test-smart-caching-setup.js
  
  # Test with specific client
  TEST_CLIENT_ID=real-client-id node test-smart-caching-setup.js

Note: This script tests the API endpoints directly. For full testing,
you'll need proper authentication credentials in your environment.
`);
}

// Run tests if script is executed directly
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  runAllTests()
    .then(({ passed, total }) => {
      process.exit(passed === total ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testScenarios };
