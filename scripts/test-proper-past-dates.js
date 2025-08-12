require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL = 'http://localhost:3000';
const TARGET_CLIENTS = ['Belmonte Hotel', 'Havet'];

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

async function getValidPastPeriods() {
  console.log('📊 Fetching stored data from actual PAST periods...');
  
  // Get current date and ensure we only test past months
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Create boundaries for valid past data
  const oneYearAgo = new Date(currentYear - 1, currentMonth, 1);
  const threeMonthsAgo = new Date(currentYear, currentMonth - 3, 1);
  
  console.log(`📅 Searching for data between ${oneYearAgo.toISOString().split('T')[0]} and ${threeMonthsAgo.toISOString().split('T')[0]}`);
  
  const { data: storedData, error } = await supabase
    .from('campaign_summaries')
    .select(`
      *,
      clients(name, email)
    `)
    .in('clients.name', TARGET_CLIENTS)
    .gte('summary_date', oneYearAgo.toISOString().split('T')[0])
    .lte('summary_date', threeMonthsAgo.toISOString().split('T')[0])
    .order('summary_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch stored data: ${error.message}`);
  }

  if (!storedData || storedData.length === 0) {
    console.log('⚠️  No stored data found in the valid past period');
    
    // Fallback: just get the 10 oldest stored entries 
    console.log('📊 Fallback: Fetching oldest stored data...');
    
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('campaign_summaries')
      .select(`
        *,
        clients(name, email)
      `)
      .in('clients.name', TARGET_CLIENTS)
      .order('summary_date', { ascending: true })
      .limit(10);
      
    if (fallbackError || !fallbackData) {
      throw new Error('No stored data found at all');
    }
    
    console.log(`✅ Found ${fallbackData.length} oldest stored summaries as fallback`);
    return fallbackData;
  }

  console.log(`✅ Found ${storedData.length} stored summaries in valid past period`);
  
  // Group by client and select random periods
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

  console.log(`📋 Available past data:`);
  Object.entries(clientGroups).forEach(([clientName, data]) => {
    console.log(`   • ${clientName}: ${data.monthly.length} monthly, ${data.weekly.length} weekly`);
  });

  // Select test periods
  const testPeriods = [];
  for (const clientName of TARGET_CLIENTS) {
    const clientData = clientGroups[clientName];
    if (!clientData) continue;
    
    // Select 1-2 monthly periods
    if (clientData.monthly.length > 0) {
      const count = Math.min(2, clientData.monthly.length);
      for (let i = 0; i < count; i++) {
        const randomIndex = Math.floor(Math.random() * clientData.monthly.length);
        const period = clientData.monthly[randomIndex];
        if (!testPeriods.find(p => p.id === period.id)) {
          testPeriods.push(period);
        }
      }
    }
    
    // Select 1 weekly period
    if (clientData.weekly.length > 0) {
      const randomIndex = Math.floor(Math.random() * clientData.weekly.length);
      const period = clientData.weekly[randomIndex];
      if (!testPeriods.find(p => p.id === period.id)) {
        testPeriods.push(period);
      }
    }
  }

  return testPeriods.slice(0, 6);
}

async function fetchRealTimeData(clientId, dateRange, token) {
  console.log(`📡 Fetching real-time data for client ${clientId}...`);
  console.log(`   📅 Date range: ${dateRange.start} to ${dateRange.end}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: clientId,
        dateRange: dateRange
      })
    });

    console.log(`   📊 API Response: ${response.status} ${response.statusText}`);

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
    
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    
    return { 
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  } else {
    // Weekly
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(start.getDate() + 6);
    
    return { 
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }
}

async function runProperPastDatesValidation() {
  console.log('🧪 Testing Storage Database with PROPER PAST DATES');
  console.log('🎯 Using actual past periods to avoid "future date" errors');
  console.log('=' .repeat(60));
  
  try {
    // Get authentication token
    const token = await getSystemUserToken();
    
    // Get valid past periods for testing
    const testPeriods = await getValidPastPeriods();
    console.log(`\n🎯 Selected ${testPeriods.length} past periods for testing:\n`);
    
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
        console.log(`   🗄️ Data source: ${realTimeData.dataSource || 'Meta API'}`);
        console.log(`   💾 From cache: ${realTimeData.fromCache || false}`);
        
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
    console.log('📊 PROPER PAST DATES VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${totalTests > 0 ? ((passedTests/totalTests)*100).toFixed(1) : 0}%)`);
    console.log(`Failed: ${totalTests - passedTests}`);
    
    if (issues.length > 0) {
      console.log('\n❌ ISSUES FOUND:');
      let errorCount = 0;
      let discrepancyCount = 0;
      
      issues.forEach((issue, index) => {
        if (issue.error) {
          errorCount++;
        } else {
          discrepancyCount++;
        }
        
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
      
      console.log(`\n📈 Issue breakdown:`);
      console.log(`   API Errors: ${errorCount}`);
      console.log(`   Data Discrepancies: ${discrepancyCount}`);
    } else {
      console.log('\n🎉 All tests passed! Storage data matches real-time data within tolerance.');
    }
    
    const accuracy = totalTests > 0 ? ((passedTests/totalTests)*100).toFixed(1) : 0;
    console.log(`\n🎯 Overall accuracy: ${accuracy}%`);
    
    if (accuracy >= 90) {
      console.log('✅ EXCELLENT: Storage database is highly accurate!');
    } else if (accuracy >= 75) {
      console.log('⚠️  GOOD: Storage database is mostly accurate with minor discrepancies');
    } else if (accuracy >= 50) {
      console.log('🔄 MODERATE: Storage database needs some improvements');
    } else {
      console.log('❌ NEEDS ATTENTION: Storage database has significant discrepancies');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runProperPastDatesValidation(); 