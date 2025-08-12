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
const TARGET_CLIENTS = ['Belmonte Hotel', 'Havet'];
const TEST_COUNT = 3; // 3 periods per client

async function getSystemUserToken() {
  console.log('🔐 Getting system user authentication...');
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
  
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

async function getRandomPeriodsForClients() {
  console.log('📊 Fetching stored data for Belmonte Hotel and Havet...');
  
  // Get data only for target clients, excluding very recent dates
  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  const cutoffDate = twoMonthsAgo.toISOString().split('T')[0];
  
  const { data: storedData, error } = await supabase
    .from('campaign_summaries')
    .select(`
      *,
      clients(name, email)
    `)
    .in('clients.name', TARGET_CLIENTS)
    .lte('summary_date', cutoffDate)
    .order('summary_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch stored data: ${error.message}`);
  }

  if (!storedData || storedData.length === 0) {
    throw new Error('No stored campaign summaries found for target clients');
  }

  console.log(`✅ Found ${storedData.length} stored summaries for ${TARGET_CLIENTS.join(' and ')}`);
  
  // Group by client and type
  const clientGroups = {};
  storedData.forEach(summary => {
    const clientName = summary.clients?.name;
    if (TARGET_CLIENTS.includes(clientName)) {
      if (!clientGroups[clientName]) {
        clientGroups[clientName] = { monthly: [], weekly: [] };
      }
      clientGroups[clientName][summary.summary_type].push(summary);
    }
  });

  console.log(`📋 Available data:`);
  Object.entries(clientGroups).forEach(([clientName, data]) => {
    console.log(`   • ${clientName}: ${data.monthly.length} monthly, ${data.weekly.length} weekly`);
  });

  // Select random periods for testing
  const testPeriods = [];
  
  for (const clientName of TARGET_CLIENTS) {
    const clientData = clientGroups[clientName];
    if (!clientData) {
      console.warn(`⚠️ No data found for ${clientName}`);
      continue;
    }
    
    // Select random monthly periods
    if (clientData.monthly.length > 0) {
      const monthlyCount = Math.min(2, clientData.monthly.length); // Max 2 monthly
      for (let i = 0; i < monthlyCount; i++) {
        const randomIndex = Math.floor(Math.random() * clientData.monthly.length);
        const period = clientData.monthly[randomIndex];
        if (!testPeriods.find(p => p.id === period.id)) {
          testPeriods.push(period);
        }
      }
    }
    
    // Select random weekly periods
    if (clientData.weekly.length > 0) {
      const weeklyCount = Math.min(1, clientData.weekly.length); // Max 1 weekly
      for (let i = 0; i < weeklyCount; i++) {
        const randomIndex = Math.floor(Math.random() * clientData.weekly.length);
        const period = clientData.weekly[randomIndex];
        if (!testPeriods.find(p => p.id === period.id)) {
          testPeriods.push(period);
        }
      }
    }
  }

  return testPeriods.slice(0, 6); // Max 6 total periods
}

async function fetchRealTimeData(clientId, dateRange, token) {
  console.log(`📡 Fetching real-time data for client ${clientId}...`);
  
  const url = `${BASE_URL}/api/fetch-live-data`;
  
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
          start: dateRange.startDate,
          end: dateRange.endDate
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
    if (campaign.effective_status === 'ACTIVE' || campaign.status === 'ACTIVE') {
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

function compareValues(storedValue, realTimeValue, fieldName, tolerancePercent = 10) {
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
  
  if (summaryType === 'monthly') {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    
    return { 
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  } else {
    // Weekly
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(startDate.getDate() + 6);
    
    return { 
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }
}

async function runBelmonteHavetValidation() {
  console.log('🧪 Testing Storage Database: Belmonte Hotel & Havet');
  console.log('🎯 Comparing 3 random months/weeks vs real-time data');
  console.log('=' .repeat(60));
  
  try {
    // Get authentication token
    const token = await getSystemUserToken();
    
    // Get random periods for testing
    const testPeriods = await getRandomPeriodsForClients();
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
        const dateRange = formatDateRange(storedPeriod.summary_date, storedPeriod.summary_type);
        console.log(`   📅 Date range: ${dateRange.startDate} to ${dateRange.endDate}`);
        
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
    console.log('📊 BELMONTE HOTEL & HAVET VALIDATION SUMMARY');
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
runBelmonteHavetValidation(); 