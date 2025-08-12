require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_COUNT = 3; // Number of random periods to test

async function getRandomStoredPeriods() {
  console.log('📊 Fetching stored data periods...');
  
  // Get stored periods from the past only (avoid future dates)
  const currentDate = new Date();
  const threeMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 3, 1);
  const cutoffDate = threeMonthsAgo.toISOString().split('T')[0];
  
  console.log(`📅 Filtering for periods before: ${cutoffDate}`);
  
  const { data: storedData, error } = await supabase
    .from('campaign_summaries')
    .select(`
      *,
      clients(name, email)
    `)
    .lte('summary_date', cutoffDate)
    .order('summary_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch stored data: ${error.message}`);
  }

  if (!storedData || storedData.length === 0) {
    throw new Error('No stored campaign summaries found in database');
  }

  console.log(`✅ Found ${storedData.length} stored summaries`);
  
  // Group by client and type for better selection
  const clientGroups = {};
  storedData.forEach(summary => {
    const clientKey = `${summary.client_id}_${summary.clients?.name || 'Unknown'}`;
    if (!clientGroups[clientKey]) {
      clientGroups[clientKey] = { monthly: [], weekly: [] };
    }
    clientGroups[clientKey][summary.summary_type].push(summary);
  });

  console.log(`📋 Clients with stored data:`);
  Object.entries(clientGroups).forEach(([clientKey, data]) => {
    const [, clientName] = clientKey.split('_');
    console.log(`   • ${clientName}: ${data.monthly.length} monthly, ${data.weekly.length} weekly`);
  });

  // Select random periods ensuring we have data for testing
  const testPeriods = [];
  const clientKeys = Object.keys(clientGroups);
  
  for (let i = 0; i < Math.min(TEST_COUNT, clientKeys.length); i++) {
    const clientKey = clientKeys[Math.floor(Math.random() * clientKeys.length)];
    const clientData = clientGroups[clientKey];
    
    // Try to get one monthly and one weekly for this client
    if (clientData.monthly.length > 0 && testPeriods.length < TEST_COUNT) {
      const randomMonthly = clientData.monthly[Math.floor(Math.random() * clientData.monthly.length)];
      testPeriods.push(randomMonthly);
    }
    
    if (clientData.weekly.length > 0 && testPeriods.length < TEST_COUNT) {
      const randomWeekly = clientData.weekly[Math.floor(Math.random() * clientData.weekly.length)];
      testPeriods.push(randomWeekly);
    }
  }

  return testPeriods.slice(0, TEST_COUNT);
}

async function getSystemUserToken() {
  console.log('🔐 Getting system user authentication...');
  
  // Use environment variables for admin credentials
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
  
  console.log(`📧 Using email: ${adminEmail}`);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    if (!data.session?.access_token) {
      throw new Error('No access token received');
    }

    console.log('✅ Authentication successful');
    return data.session.access_token;
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    throw error;
  }
}

async function fetchRealTimeData(clientId, dateRange, token) {
  console.log(`📡 Fetching real-time data for client ${clientId}...`);
  
  const url = `${BASE_URL}/api/smart-fetch-data`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: clientId,
        dateRange: {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`API returned error: ${data.error || 'Unknown error'}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Error fetching real-time data:`, error.message);
    throw error;
  }
}

function calculateRealTimeTotals(campaigns) {
  if (!campaigns || campaigns.length === 0) {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      activeCampaigns: 0
    };
  }

  return campaigns.reduce((totals, campaign) => {
    // Count active campaigns
    if (campaign.status === 'ACTIVE') {
      totals.activeCampaigns++;
    }
    
    // Sum metrics
    totals.spend += parseFloat(campaign.spend || 0);
    totals.impressions += parseInt(campaign.impressions || 0);
    totals.clicks += parseInt(campaign.clicks || 0);
    totals.conversions += parseInt(campaign.conversions || 0);
    
    return totals;
  }, {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    activeCampaigns: 0
  });
}

function compareValues(storedValue, realTimeValue, fieldName, tolerancePercent = 5) {
  const stored = parseFloat(storedValue) || 0;
  const realTime = parseFloat(realTimeValue) || 0;
  
  // Handle zero values
  if (stored === 0 && realTime === 0) {
    return { match: true, difference: 0, percentDiff: 0 };
  }
  
  if (stored === 0 || realTime === 0) {
    const nonZero = Math.max(stored, realTime);
    return { 
      match: false, 
      difference: Math.abs(stored - realTime),
      percentDiff: nonZero > 0 ? 100 : 0,
      warning: stored === 0 ? 'Stored value is 0' : 'Real-time value is 0'
    };
  }
  
  const difference = Math.abs(stored - realTime);
  const percentDiff = (difference / realTime) * 100;
  const match = percentDiff <= tolerancePercent;
  
  return { match, difference, percentDiff };
}

function formatDateRange(summaryDate, summaryType) {
  const date = new Date(summaryDate);
  
  // Validate the date
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid summary date: ${summaryDate}`);
  }
  
  if (summaryType === 'monthly') {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // First day of the month
    const startDate = new Date(year, month, 1);
    // Last day of the month
    const endDate = new Date(year, month + 1, 0);
    
    // Validate calculated dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error(`Invalid calculated dates for ${summaryDate}`);
    }
    
    return { 
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  } else {
    // Weekly - summary_date is the start of the week
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(startDate.getDate() + 6);
    
    // Validate calculated dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error(`Invalid calculated dates for ${summaryDate}`);
    }
    
    return { 
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }
}

async function runValidationTest() {
  console.log('🧪 Starting Storage Database Validation Test');
  console.log('=' .repeat(60));
  
  try {
    // Get authentication token
    const token = await getSystemUserToken();
    
    // Get random stored periods to test
    const testPeriods = await getRandomStoredPeriods();
    console.log(`\n🎯 Selected ${testPeriods.length} periods for testing:\n`);
    
    let totalTests = 0;
    let passedTests = 0;
    let issues = [];
    
    for (const storedPeriod of testPeriods) {
      const clientName = storedPeriod.clients?.name || 'Unknown Client';
      const periodDesc = `${storedPeriod.summary_type} ${storedPeriod.summary_date}`;
      
      console.log(`\n📋 Testing: ${clientName} - ${periodDesc}`);
      console.log('-'.repeat(50));
      
             try {
         // Calculate date range for API call
         console.log(`   📅 Summary date from DB: ${storedPeriod.summary_date}`);
         const dateRange = formatDateRange(storedPeriod.summary_date, storedPeriod.summary_type);
         console.log(`   📅 Calculated range: ${dateRange.startDate} to ${dateRange.endDate}`);
        
        // Fetch real-time data
        const realTimeData = await fetchRealTimeData(storedPeriod.client_id, dateRange, token);
        const realTimeTotals = calculateRealTimeTotals(realTimeData.campaigns);
        
        console.log(`   📊 Stored vs Real-time comparison:`);
        
        // Test metrics with correct field mapping
        const metrics = [
          { name: 'Spend', storedField: 'total_spend', realTimeField: 'spend', format: '$' },
          { name: 'Impressions', storedField: 'total_impressions', realTimeField: 'impressions', format: '' },
          { name: 'Clicks', storedField: 'total_clicks', realTimeField: 'clicks', format: '' },
          { name: 'Conversions', storedField: 'total_conversions', realTimeField: 'conversions', format: '' },
          { name: 'Active Campaigns', storedField: 'active_campaigns', realTimeField: 'activeCampaigns', format: '' }
        ];
        
        for (const metric of metrics) {
          totalTests++;
          
          const storedValue = storedPeriod[metric.storedField] || 0;
          const realTimeValue = realTimeTotals[metric.realTimeField] || 0;
          
          const comparison = compareValues(storedValue, realTimeValue, metric.name);
          
          const status = comparison.match ? '✅' : '❌';
          const storedFormatted = metric.format + (typeof storedValue === 'number' ? storedValue.toLocaleString() : storedValue);
          const realTimeFormatted = metric.format + (typeof realTimeValue === 'number' ? realTimeValue.toLocaleString() : realTimeValue);
          
          console.log(`      ${status} ${metric.name}: ${storedFormatted} vs ${realTimeFormatted}`);
          
          if (!comparison.match) {
            const diffFormatted = comparison.percentDiff ? `${comparison.percentDiff.toFixed(1)}%` : 'N/A';
            console.log(`         Difference: ${diffFormatted} (${comparison.warning || 'Outside tolerance'})`);
            issues.push({
              client: clientName,
              period: periodDesc,
              metric: metric.name,
              stored: storedValue,
              realTime: realTimeValue,
              percentDiff: comparison.percentDiff,
              warning: comparison.warning
            });
          } else {
            passedTests++;
          }
        }
        
        console.log(`   🎯 Real-time campaigns found: ${realTimeData.campaigns?.length || 0}`);
        
      } catch (error) {
        console.error(`   ❌ Error testing ${clientName} - ${periodDesc}:`, error.message);
        issues.push({
          client: clientName,
          period: periodDesc,
          error: error.message
        });
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VALIDATION TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${totalTests > 0 ? ((passedTests/totalTests)*100).toFixed(1) : 0}%)`);
    console.log(`Failed: ${totalTests - passedTests}`);
    
    if (issues.length > 0) {
      console.log('\n❌ ISSUES FOUND:');
      issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.client} - ${issue.period}`);
        if (issue.error) {
          console.log(`   Error: ${issue.error}`);
        } else {
          console.log(`   ${issue.metric}: ${issue.stored} vs ${issue.realTime} (${issue.percentDiff?.toFixed(1)}% diff)`);
          if (issue.warning) {
            console.log(`   Warning: ${issue.warning}`);
          }
        }
      });
    } else {
      console.log('\n🎉 All tests passed! Storage data matches real-time data within tolerance.');
    }
    
    const accuracy = totalTests > 0 ? ((passedTests/totalTests)*100).toFixed(1) : 0;
    console.log(`\n🎯 Overall accuracy: ${accuracy}%`);
    
    if (accuracy >= 90) {
      console.log('✅ EXCELLENT: Storage database is highly accurate!');
    } else if (accuracy >= 75) {
      console.log('⚠️  GOOD: Storage database is mostly accurate with minor discrepancies');
    } else {
      console.log('❌ NEEDS ATTENTION: Storage database has significant discrepancies');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runValidationTest(); 