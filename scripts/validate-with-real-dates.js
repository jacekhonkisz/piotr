/**
 * HISTORICAL DATA VALIDATION - Using Real Database Dates
 * 
 * Fetches live data and compares with database for ACTUAL stored periods
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to calculate percentage difference
const percentDiff = (db, live) => {
  if (db === 0 && live === 0) return 0;
  if (db === 0) return 100;
  return Math.abs(((live - db) / db) * 100);
};

// Compare two data sets
function compareData(dbData, liveData, period) {
  console.log(`\n🔍 COMPARISON RESULTS FOR ${period.label}`);
  console.log('═'.repeat(80));
  
  if (!liveData || !liveData.campaigns) {
    console.log('❌ LIVE API FAILED - Cannot verify database data');
    return { match: false, reason: 'api_failed' };
  }
  
  const results = {
    period: period.label,
    dateRange: `${period.start} to ${period.end}`,
    match: true,
    differences: [],
    metrics: {},
    campaigns: {},
    conversions: {}
  };
  
  // Helper to safely get number
  const getNum = (val) => Number(val) || 0;
  
  // 1. Compare Core Metrics
  console.log('\n📊 CORE METRICS:');
  console.log('─'.repeat(80));
  
  const metrics = [
    { key: 'totalSpend', dbKey: 'total_spend', label: 'Total Spend' },
    { key: 'totalImpressions', dbKey: 'total_impressions', label: 'Total Impressions' },
    { key: 'totalClicks', dbKey: 'total_clicks', label: 'Total Clicks' },
    { key: 'averageCtr', dbKey: 'average_ctr', label: 'Average CTR' },
    { key: 'averageCpc', dbKey: 'average_cpc', label: 'Average CPC' }
  ];
  
  metrics.forEach(({ key, dbKey, label }) => {
    const dbVal = getNum(dbData[dbKey]);
    const liveVal = getNum(liveData.stats?.[key]);
    const diff = percentDiff(dbVal, liveVal);
    
    results.metrics[key] = { db: dbVal, live: liveVal, diff: `${diff.toFixed(2)}%` };
    
    const match = diff < 2; // 2% tolerance
    const icon = match ? '✅' : '❌';
    
    console.log(`${icon} ${label.padEnd(20)} | DB: ${dbVal.toFixed(2).padStart(12)} | Live: ${liveVal.toFixed(2).padStart(12)} | Diff: ${diff.toFixed(2)}%`);
    
    if (!match) {
      results.match = false;
      results.differences.push(`${label}: ${diff.toFixed(2)}% difference`);
    }
  });
  
  // 2. Compare Campaign Count
  console.log('\n📋 CAMPAIGNS:');
  console.log('─'.repeat(80));
  
  const dbCampaigns = dbData.campaign_data?.length || 0;
  const liveCampaigns = liveData.campaigns?.length || 0;
  
  results.campaigns = { db: dbCampaigns, live: liveCampaigns };
  
  const campaignsMatch = Math.abs(dbCampaigns - liveCampaigns) <= 2; // Allow 2 campaigns difference
  const campaignIcon = campaignsMatch ? '✅' : '⚠️';
  
  console.log(`${campaignIcon} Campaign Count       | DB: ${dbCampaigns.toString().padStart(12)} | Live: ${liveCampaigns.toString().padStart(12)}`);
  
  if (!campaignsMatch) {
    results.differences.push(`Campaign count difference: DB ${dbCampaigns} vs Live ${liveCampaigns}`);
  }
  
  // 3. Summary
  console.log('\n' + '═'.repeat(80));
  if (results.match && results.differences.length === 0) {
    console.log('✅ PERFECT MATCH - Database data is accurate!');
  } else if (results.differences.length <= 2) {
    console.log('⚠️ MINOR DIFFERENCES - Database data is mostly accurate');
    console.log('\nDifferences found:');
    results.differences.forEach(diff => console.log(`  • ${diff}`));
  } else {
    console.log('❌ SIGNIFICANT DIFFERENCES - May need investigation');
    console.log('\nDifferences found:');
    results.differences.forEach(diff => console.log(`  • ${diff}`));
  }
  
  return results;
}

// Fetch live data from API
async function fetchLiveData(clientId, startDate, endDate, platform = 'meta') {
  console.log(`\n🔴 Fetching LIVE data from ${platform} API...`);
  
  try {
    const fetch = (await import('node-fetch')).default;
    
    const apiEndpoint = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-live-data`;
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        startDate,
        endDate,
        forceFresh: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'API call failed');
    }
    
    console.log(`✅ Live data fetched: ${result.data?.campaigns?.length || 0} campaigns`);
    return result.data;
  } catch (error) {
    console.error(`❌ Failed to fetch live data:`, error.message);
    return null;
  }
}

// Main validation function
async function validateHistoricalData() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║    HISTORICAL DATA VALIDATION - USING REAL DATABASE DATES    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Get Belmonte client
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  if (clientError || !clients || clients.length === 0) {
    console.error('❌ Belmonte client not found');
    process.exit(1);
  }
  
  const client = clients[0];
  console.log(`✅ Found client: ${client.name} (${client.id})`);
  
  // Get all available monthly periods
  const { data: allMonths } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('platform', 'meta')
    .order('summary_date', { ascending: false })
    .limit(13);
  
  // Get all available weekly periods
  const { data: allWeeks } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', client.id)
    .eq('summary_type', 'weekly')
    .eq('platform', 'meta')
    .gt('total_campaigns', 0) // Only weeks with campaigns
    .order('summary_date', { ascending: false})
    .limit(10);
  
  // Pick 3 random months
  const shuffledMonths = allMonths.sort(() => 0.5 - Math.random()).slice(0, 3);
  const shuffledWeeks = allWeeks.sort(() => 0.5 - Math.random()).slice(0, 3);
  
  const selectedPeriods = [...shuffledMonths.map(m => ({
    type: 'monthly',
    dbData: m,
    start: m.summary_date,
    end: new Date(new Date(m.summary_date).getFullYear(), new Date(m.summary_date).getMonth() + 1, 0).toISOString().split('T')[0],
    label: new Date(m.summary_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  })), ...shuffledWeeks.map(w => ({
    type: 'weekly',
    dbData: w,
    start: w.summary_date,
    end: new Date(new Date(w.summary_date).getTime() + (6 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
    label: `Week of ${new Date(w.summary_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }))];
  
  console.log('\n📅 SELECTED PERIODS FOR VALIDATION:');
  console.log('─'.repeat(80));
  console.log('\nRandom Past Months:');
  selectedPeriods.filter(p => p.type === 'monthly').forEach((period, i) => {
    console.log(`  ${i + 1}. ${period.label} (${period.start} to ${period.end}) - ${period.dbData.total_campaigns} campaigns in DB`);
  });
  console.log('\nRandom Past Weeks:');
  selectedPeriods.filter(p => p.type === 'weekly').forEach((period, i) => {
    console.log(`  ${i + 1}. ${period.label} (${period.start} to ${period.end}) - ${period.dbData.total_campaigns} campaigns in DB`);
  });
  
  const results = {
    client: { id: client.id, name: client.name },
    timestamp: new Date().toISOString(),
    periods: [],
    summary: {
      total: selectedPeriods.length,
      perfectMatch: 0,
      minorDifferences: 0,
      significantDifferences: 0,
      failed: 0
    }
  };
  
  // Validate each period
  for (const period of selectedPeriods) {
    console.log('\n' + '═'.repeat(80));
    console.log(`\n🔄 VALIDATING: ${period.label}`);
    console.log(`   Date Range: ${period.start} to ${period.end}`);
    console.log(`   DB: ${period.dbData.total_campaigns} campaigns, ${period.dbData.total_spend} spend`);
    console.log('─'.repeat(80));
    
    // Fetch live data
    await new Promise(resolve => setTimeout(resolve, 2000));
    const liveData = await fetchLiveData(client.id, period.start, period.end, 'meta');
    
    // Compare
    const comparison = compareData(period.dbData, liveData, period);
    results.periods.push(comparison);
    
    // Update summary
    if (comparison.match && (!comparison.differences || comparison.differences.length === 0)) {
      results.summary.perfectMatch++;
    } else if (comparison.differences && comparison.differences.length <= 2) {
      results.summary.minorDifferences++;
    } else if (comparison.differences && comparison.differences.length > 2) {
      results.summary.significantDifferences++;
    } else {
      results.summary.failed++;
    }
    
    // Wait between periods
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Final Summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                    VALIDATION SUMMARY                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Total Periods Validated: ${results.summary.total}`);
  console.log(`✅ Perfect Matches:      ${results.summary.perfectMatch}`);
  console.log(`⚠️  Minor Differences:   ${results.summary.minorDifferences}`);
  console.log(`❌ Significant Issues:   ${results.summary.significantDifferences}`);
  console.log(`🔴 Failed Validations:   ${results.summary.failed}`);
  
  const accuracy = ((results.summary.perfectMatch / results.summary.total) * 100).toFixed(1);
  console.log(`\n📊 Overall Accuracy: ${accuracy}%`);
  
  if (results.summary.perfectMatch === results.summary.total) {
    console.log('\n🎉 EXCELLENT! All historical data is perfectly accurate!');
  } else if (results.summary.minorDifferences >= results.summary.significantDifferences) {
    console.log('\n✅ GOOD! Database data is mostly accurate with minor differences.');
    console.log('   Minor differences are expected due to attribution windows.');
  } else {
    console.log('\n⚠️ REVIEW NEEDED! Some periods have significant differences.');
  }
  
  // Save results
  const fs = require('fs');
  const resultsPath = `validation-results-real-dates-${Date.now()}.json`;
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed results saved to: ${resultsPath}`);
  
  return results;
}

// Run validation
validateHistoricalData()
  .then(() => {
    console.log('\n✅ Validation complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Validation failed:', error);
    process.exit(1);
  });









