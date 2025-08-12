#!/usr/bin/env node

/**
 * Daily KPI Data Collector
 * 
 * This script calls the automated daily KPI collection API that:
 * 1. Fetches real Meta Ads data for ALL clients
 * 2. Stores daily aggregated KPIs in database
 * 3. Maintains rolling 7-day window (adds new day, removes old)
 * 4. Runs daily via cron job
 * 
 * Schedule: 0 1 * * * (daily at 1 AM)
 */

require('dotenv').config({ path: '.env.local' });

/**
 * Call the automated daily KPI collection API
 */
async function runDailyCollection() {
  try {
    console.log('🚀 Starting daily KPI collection for ALL clients...');
    
    // Get yesterday's date (we collect data for completed days)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0];
    
    console.log(`📊 Collecting real Meta data for: ${targetDate}`);
    
    // Call the automated collection API
    const response = await fetch('http://localhost:3000/api/automated/daily-kpi-collection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ date: targetDate })
    });
    
    if (!response.ok) {
      console.error('❌ API call failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      process.exit(1);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('❌ Collection failed:', result.error || 'Unknown error');
      process.exit(1);
    }
    
    console.log('\n📊 Collection Summary:');
    console.log(`📅 Target date: ${result.targetDate}`);
    console.log(`👥 Total clients: ${result.totalClients}`);
    console.log(`✅ Successful: ${result.successCount}`);
    console.log(`❌ Failed: ${result.failureCount}`);
    
    // Show details for each client
    console.log('\n📋 Client Results:');
    result.results.forEach((clientResult, index) => {
      const status = clientResult.success ? '✅' : '❌';
      console.log(`  ${status} ${clientResult.clientName}:`);
      
      if (clientResult.success && clientResult.data) {
        const data = clientResult.data;
        console.log(`     📊 ${data.totalClicks} clicks, €${data.totalSpend} spend, ${data.totalConversions} conversions`);
        console.log(`     📈 ${data.campaignsCount} campaigns processed`);
      } else {
        console.log(`     ⚠️ ${clientResult.error}`);
      }
    });
    
    if (result.successCount > 0) {
      console.log(`\n🎉 Successfully collected real Meta data for ${result.successCount} clients!`);
      console.log('💡 Data is now available in dashboard charts as real daily KPIs');
    }
    
    if (result.failureCount > 0) {
      console.log(`\n⚠️ ${result.failureCount} clients had issues - check Meta API tokens and permissions`);
    }
    
  } catch (error) {
    console.error('❌ Daily collection script failed:', error);
    process.exit(1);
  }
}

// Run the collection
if (require.main === module) {
  runDailyCollection()
    .then(() => {
      console.log('\n👋 Daily KPI collection script finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { runDailyCollection }; 