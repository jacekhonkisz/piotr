#!/usr/bin/env node

/**
 * Daily KPI Data Collector
 * 
 * This script calls the automated daily KPI collection APIs that:
 * 1. Fetches real Meta Ads data for ALL clients
 * 2. Fetches real Google Ads data for ALL clients with Google Ads enabled
 * 3. Stores daily aggregated KPIs in database
 * 4. Maintains rolling 7-day window (adds new day, removes old)
 * 5. Runs daily via cron job
 * 
 * Schedule: 0 1 * * * (daily at 1 AM)
 */

require('dotenv').config({ path: '.env.local' });

/**
 * Call the automated daily KPI collection APIs for both Meta and Google Ads
 */
async function runDailyCollection() {
  try {
    console.log('🚀 Starting daily KPI collection for ALL clients...');
    
    // Get yesterday's date (we collect data for completed days)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0];
    
    console.log(`📊 Collecting data for: ${targetDate}`);
    
    // Collect Meta Ads data
    console.log('\n📱 Collecting Meta Ads data...');
    const metaResponse = await fetch('http://localhost:3000/api/automated/daily-kpi-collection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ date: targetDate })
    });
    
    if (!metaResponse.ok) {
      console.error('❌ Meta Ads API call failed:', metaResponse.status, metaResponse.statusText);
      const errorText = await metaResponse.text();
      console.error('Error details:', errorText);
    } else {
      const metaResult = await metaResponse.json();
      
      if (metaResult.success) {
        console.log(`✅ Meta Ads: ${metaResult.successCount} successful, ${metaResult.failureCount} failed`);
      } else {
        console.error('❌ Meta Ads collection failed:', metaResult.error || 'Unknown error');
      }
    }
    
    // Collect Google Ads data
    console.log('\n🔍 Collecting Google Ads data...');
    const googleResponse = await fetch('http://localhost:3000/api/automated/google-ads-daily-collection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ date: targetDate })
    });
    
    if (!googleResponse.ok) {
      console.error('❌ Google Ads API call failed:', googleResponse.status, googleResponse.statusText);
      const errorText = await googleResponse.text();
      console.error('Error details:', errorText);
    } else {
      const googleResult = await googleResponse.json();
      
      if (googleResult.success) {
        console.log(`✅ Google Ads: ${googleResult.processed} clients processed`);
        if (googleResult.results) {
          console.log(`   📊 Results: ${googleResult.results.filter(r => r.success).length} successful, ${googleResult.results.filter(r => !r.success).length} failed`);
        }
      } else {
        console.error('❌ Google Ads collection failed:', googleResult.error || 'Unknown error');
      }
    }
    
    console.log('\n🎉 Daily KPI collection completed!');
    console.log('💡 Data is now available in dashboard charts and year-over-year comparisons');
    
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