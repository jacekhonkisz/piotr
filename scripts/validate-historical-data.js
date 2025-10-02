/**
 * HISTORICAL DATA VALIDATION SCRIPT
 * 
 * Fetches live data from Meta/Google APIs for random past periods
 * and compares it with stored database data to verify:
 * - Data accuracy
 * - Metric consistency
 * - Campaign details completeness
 * - Conversion funnel accuracy
 * - Meta tables (demographics, placements, etc.)
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to get random past months
function getRandomPastMonths(count = 3) {
  const months = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Get months from the last 13 months (excluding current)
  const availableMonths = [];
  for (let i = 1; i <= 13; i++) {
    const date = new Date(currentYear, currentMonth - i, 1);
    availableMonths.push({
      start: date.toISOString().split('T')[0],
      end: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0],
      label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    });
  }
  
  // Pick random months
  const shuffled = availableMonths.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Helper function to get random past weeks
function getRandomPastWeeks(count = 3) {
  const weeks = [];
  const now = new Date();
  
  // Get weeks from the last 53 weeks (excluding current)
  const availableWeeks = [];
  for (let i = 1; i <= 53; i++) {
    const endDate = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
    const startDate = new Date(endDate.getTime() - (6 * 24 * 60 * 60 * 1000));
    
    availableWeeks.push({
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      label: `Week of ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    });
  }
  
  // Pick random weeks
  const shuffled = availableWeeks.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Fetch data from database
async function fetchFromDatabase(clientId, startDate, endDate, platform = 'meta') {
  console.log(`\n📊 Fetching database data for ${platform}...`);
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const summaryType = daysDiff <= 7 ? 'weekly' : 'monthly';
  
  let storedSummary, error;
  
  if (summaryType === 'weekly') {
    const { data, error: weeklyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'weekly')
      .eq('platform', platform)
      .gte('period_start', startDate)
      .lte('period_end', endDate)
      .order('period_start', { ascending: false })
      .limit(1);
    
    storedSummary = data?.[0];
    error = weeklyError;
  } else {
    const { data, error: monthlyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('summary_type', 'monthly')
      .eq('platform', platform)
      .eq('period_start', startDate)
      .limit(1);
    
    storedSummary = data?.[0];
    error = monthlyError;
  }
  
  if (error || !storedSummary) {
    console.log(`⚠️ No database data found for ${summaryType}`);
    return null;
  }
  
  console.log(`✅ Found database data: ${storedSummary.campaigns?.length || 0} campaigns`);
  return storedSummary;
}

// Fetch live data from API
async function fetchLiveData(clientId, startDate, endDate, platform = 'meta') {
  console.log(`\n🔴 Fetching LIVE data from ${platform} API...`);
  
  try {
    // Use dynamic import for node-fetch
    const fetch = (await import('node-fetch')).default;
    
    const apiEndpoint = platform === 'meta' 
      ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-live-data`
      : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/fetch-google-ads-live-data`;
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId,
        startDate,
        endDate,
        forceFresh: true // Force fresh API call
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

// Compare two data sets
function compareData(dbData, liveData, period) {
  console.log(`\n🔍 COMPARISON RESULTS FOR ${period.label}`);
  console.log('═'.repeat(80));
  
  if (!dbData && !liveData) {
    console.log('❌ BOTH SOURCES EMPTY - No data to compare');
    return { match: false, reason: 'no_data' };
  }
  
  if (!dbData) {
    console.log('⚠️ DATABASE MISSING - Live data exists but not stored');
    return { match: false, reason: 'db_missing', liveData };
  }
  
  if (!liveData) {
    console.log('⚠️ LIVE API FAILED - Cannot verify database data');
    return { match: false, reason: 'api_failed', dbData };
  }
  
  const results = {
    period: period.label,
    dateRange: `${period.start} to ${period.end}`,
    match: true,
    differences: [],
    metrics: {},
    campaigns: {},
    conversions: {},
    metaTables: {}
  };
  
  // Helper to safely get number
  const getNum = (val) => Number(val) || 0;
  
  // Helper to calculate percentage difference
  const percentDiff = (db, live) => {
    if (db === 0 && live === 0) return 0;
    if (db === 0) return 100;
    return Math.abs(((live - db) / db) * 100);
  };
  
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
    const dbVal = getNum(dbData.stats?.[key] || dbData[dbKey]);
    const liveVal = getNum(liveData.stats?.[key]);
    const diff = percentDiff(dbVal, liveVal);
    
    results.metrics[key] = { db: dbVal, live: liveVal, diff: `${diff.toFixed(2)}%` };
    
    const match = diff < 5; // 5% tolerance
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
  
  const dbCampaigns = dbData.campaigns?.length || 0;
  const liveCampaigns = liveData.campaigns?.length || 0;
  
  results.campaigns = { db: dbCampaigns, live: liveCampaigns };
  
  const campaignsMatch = dbCampaigns === liveCampaigns;
  const campaignIcon = campaignsMatch ? '✅' : '⚠️';
  
  console.log(`${campaignIcon} Campaign Count       | DB: ${dbCampaigns.toString().padStart(12)} | Live: ${liveCampaigns.toString().padStart(12)}`);
  
  if (!campaignsMatch) {
    results.differences.push(`Campaign count mismatch: DB ${dbCampaigns} vs Live ${liveCampaigns}`);
  }
  
  // 3. Compare Conversion Funnel
  console.log('\n🎯 CONVERSION FUNNEL:');
  console.log('─'.repeat(80));
  
  const conversions = [
    { key: 'click_to_call', label: 'Click to Call' },
    { key: 'email_contacts', label: 'Email Contacts' },
    { key: 'booking_step_1', label: 'Booking Step 1' },
    { key: 'booking_step_2', label: 'Booking Step 2' },
    { key: 'booking_step_3', label: 'Booking Step 3' },
    { key: 'reservations', label: 'Reservations' },
    { key: 'reservation_value', label: 'Reservation Value' },
    { key: 'roas', label: 'ROAS' }
  ];
  
  conversions.forEach(({ key, label }) => {
    const dbVal = getNum(dbData.conversion_metrics?.[key] || dbData[key]);
    const liveVal = getNum(liveData.conversionMetrics?.[key]);
    const diff = percentDiff(dbVal, liveVal);
    
    results.conversions[key] = { db: dbVal, live: liveVal, diff: `${diff.toFixed(2)}%` };
    
    const match = diff < 5;
    const icon = match ? '✅' : '❌';
    
    console.log(`${icon} ${label.padEnd(20)} | DB: ${dbVal.toFixed(2).padStart(12)} | Live: ${liveVal.toFixed(2).padStart(12)} | Diff: ${diff.toFixed(2)}%`);
    
    if (!match) {
      results.match = false;
      results.differences.push(`${label}: ${diff.toFixed(2)}% difference`);
    }
  });
  
  // 4. Compare Meta Tables (if available)
  if (dbData.meta_tables || liveData.metaTables) {
    console.log('\n📊 META TABLES:');
    console.log('─'.repeat(80));
    
    const dbTables = dbData.meta_tables || {};
    const liveTables = liveData.metaTables || {};
    
    const tables = ['demographics', 'placements', 'devices', 'regions'];
    
    tables.forEach(table => {
      const dbHas = dbTables[table] && dbTables[table].length > 0;
      const liveHas = liveTables[table] && liveTables[table].length > 0;
      
      results.metaTables[table] = { db: dbHas, live: liveHas };
      
      const icon = dbHas && liveHas ? '✅' : dbHas || liveHas ? '⚠️' : '⚠️';
      console.log(`${icon} ${table.padEnd(20)} | DB: ${(dbHas ? 'Present' : 'Missing').padStart(12)} | Live: ${(liveHas ? 'Present' : 'Missing').padStart(12)}`);
      
      if (dbHas !== liveHas) {
        results.differences.push(`${table}: DB ${dbHas ? 'has' : 'missing'} vs Live ${liveHas ? 'has' : 'missing'}`);
      }
    });
  }
  
  // 5. Summary
  console.log('\n' + '═'.repeat(80));
  if (results.match && results.differences.length === 0) {
    console.log('✅ PERFECT MATCH - Database data is accurate!');
  } else if (results.differences.length <= 3) {
    console.log('⚠️ MINOR DIFFERENCES - Database data is mostly accurate');
    console.log('\nDifferences found:');
    results.differences.forEach(diff => console.log(`  • ${diff}`));
  } else {
    console.log('❌ SIGNIFICANT DIFFERENCES - Database data may need review');
    console.log('\nDifferences found:');
    results.differences.forEach(diff => console.log(`  • ${diff}`));
  }
  
  return results;
}

// Main validation function
async function validateHistoricalData() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       HISTORICAL DATA VALIDATION - BELMONTE CLIENT          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Get Belmonte client
  console.log('🔍 Finding Belmonte client...');
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
  
  // Generate random periods
  const randomMonths = getRandomPastMonths(3);
  const randomWeeks = getRandomPastWeeks(3);
  
  console.log('\n📅 SELECTED PERIODS FOR VALIDATION:');
  console.log('─'.repeat(80));
  console.log('\nRandom Past Months:');
  randomMonths.forEach((month, i) => {
    console.log(`  ${i + 1}. ${month.label} (${month.start} to ${month.end})`);
  });
  console.log('\nRandom Past Weeks:');
  randomWeeks.forEach((week, i) => {
    console.log(`  ${i + 1}. ${week.label} (${week.start} to ${week.end})`);
  });
  
  const allPeriods = [...randomMonths, ...randomWeeks];
  const results = {
    client: { id: client.id, name: client.name },
    timestamp: new Date().toISOString(),
    periods: [],
    summary: {
      total: allPeriods.length,
      perfectMatch: 0,
      minorDifferences: 0,
      significantDifferences: 0,
      failed: 0
    }
  };
  
  // Validate each period
  for (const period of allPeriods) {
    console.log('\n' + '═'.repeat(80));
    console.log(`\n🔄 VALIDATING: ${period.label}`);
    console.log(`   Date Range: ${period.start} to ${period.end}`);
    console.log('─'.repeat(80));
    
    // Fetch from both sources
    const dbData = await fetchFromDatabase(client.id, period.start, period.end, 'meta');
    
    // Wait a bit to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const liveData = await fetchLiveData(client.id, period.start, period.end, 'meta');
    
    // Compare
    const comparison = compareData(dbData, liveData, period);
    results.periods.push(comparison);
    
    // Update summary
    if (!comparison || comparison.reason === 'no_data') {
      results.summary.failed++;
    } else if (comparison.match && (!comparison.differences || comparison.differences.length === 0)) {
      results.summary.perfectMatch++;
    } else if (comparison.differences && comparison.differences.length <= 3) {
      results.summary.minorDifferences++;
    } else if (comparison.differences && comparison.differences.length > 3) {
      results.summary.significantDifferences++;
    } else {
      results.summary.failed++;
    }
    
    // Wait between periods to avoid rate limiting
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
  } else if (results.summary.minorDifferences <= 2) {
    console.log('\n✅ GOOD! Database data is mostly accurate with minor differences.');
  } else {
    console.log('\n⚠️ REVIEW NEEDED! Some periods have significant differences.');
  }
  
  // Save results to file
  const fs = require('fs');
  const resultsPath = `validation-results-${Date.now()}.json`;
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

