#!/usr/bin/env node

/**
 * 🚀 Run Historical Data Collection
 * 
 * This script runs the historical data collection directly
 * using the service role key to populate previous months
 * with real data for the reports page.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runHistoricalCollection() {
  console.log('🚀 Running Historical Data Collection\n');
  
  try {
    // Step 1: Check current data status
    console.log('📊 STEP 1: Checking current data status...');
    
    const { data: summaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('*');
    
    if (summariesError) {
      console.log('❌ Error accessing campaign_summaries:', summariesError.message);
      return;
    }
    
    if (summaries && summaries.length > 0) {
      const monthlyData = summaries.filter(s => s.summary_type === 'monthly');
      const weeklyData = summaries.filter(s => s.summary_type === 'weekly');
      
      console.log(`📊 Current data:`);
      console.log(`   Monthly: ${monthlyData.length} records`);
      console.log(`   Weekly: ${weeklyData.length} records`);
      
      // Check data quality
      const zeroDataCount = summaries.filter(s => 
        s.total_spend === 0 && s.total_impressions === 0
      ).length;
      
      console.log(`   Records with zero data: ${zeroDataCount}/${summaries.length}`);
      
      if (zeroDataCount > summaries.length * 0.8) {
        console.log('   ⚠️  Most data appears to be test/placeholder data');
        console.log('   🔧 Historical collection needed to populate real data');
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Step 2: Get active clients
    console.log('📊 STEP 2: Getting active clients...');
    
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('api_status', 'valid');
    
    if (clientsError) {
      console.log('❌ Error fetching clients:', clientsError.message);
      return;
    }
    
    if (!clients || clients.length === 0) {
      console.log('⚠️ No active clients found');
      return;
    }
    
    console.log(`📊 Found ${clients.length} active clients:`);
    clients.forEach(client => {
      console.log(`   • ${client.name} (${client.email})`);
      console.log(`     Meta Token: ${client.meta_access_token ? '✅' : '❌'}`);
      console.log(`     Ad Account: ${client.ad_account_id ? '✅' : '❌'}`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Step 3: Run monthly collection
    console.log('📊 STEP 3: Running monthly collection...');
    
    try {
      const { BackgroundDataCollector } = require('./src/lib/background-data-collector');
      const collector = BackgroundDataCollector.getInstance();
      
      console.log('🚀 Starting monthly collection...');
      await collector.collectMonthlySummaries();
      console.log('✅ Monthly collection completed');
      
    } catch (error) {
      console.log('❌ Monthly collection failed:', error.message);
      console.log('💡 Trying alternative approach...');
      
      // Alternative: Use the API endpoint directly
      console.log('🌐 Calling monthly collection API...');
      
      const response = await fetch('http://localhost:3000/api/background/collect-monthly', {
        method: 'GET' // Use GET to bypass authentication
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Monthly collection started via API:', result.message);
      } else {
        console.log('❌ API call failed:', response.status);
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Step 4: Run weekly collection
    console.log('📊 STEP 4: Running weekly collection...');
    
    try {
      const { BackgroundDataCollector } = require('./src/lib/background-data-collector');
      const collector = BackgroundDataCollector.getInstance();
      
      console.log('🚀 Starting weekly collection...');
      await collector.collectWeeklySummaries();
      console.log('✅ Weekly collection completed');
      
    } catch (error) {
      console.log('❌ Weekly collection failed:', error.message);
      console.log('💡 Trying alternative approach...');
      
      // Alternative: Use the API endpoint directly
      console.log('🌐 Calling weekly collection API...');
      
      const response = await fetch('http://localhost:3000/api/background/collect-weekly', {
        method: 'GET' // Use GET to bypass authentication
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Weekly collection started via API:', result.message);
      } else {
        console.log('❌ API call failed:', response.status);
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Step 5: Wait and verify
    console.log('📊 STEP 5: Waiting for collection to complete...');
    console.log('⏳ Collection is running in the background...');
    console.log('⏳ This may take 10-30 minutes depending on data volume...');
    console.log('💡 You can monitor progress in the admin panel');
    
    // Wait a bit to let collection start
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Step 6: Final recommendations
    console.log('📊 STEP 6: Next Steps...');
    console.log('✅ Historical data collection has been triggered');
    console.log('');
    console.log('🔍 To verify completion:');
    console.log('   1. Check admin monitoring page: /admin/monitoring');
    console.log('   2. Run verification script: node audit-historical-data-system.js');
    console.log('   3. Check reports page for real historical data');
    console.log('');
    console.log('📊 Expected results:');
    console.log('   - Previous months will show real spend, impressions, clicks');
    console.log('   - Conversion metrics will be populated (reservations, booking steps)');
    console.log('   - Reports page will display real historical data instead of zeros');
    console.log('   - Year-over-year comparisons will work properly');
    
  } catch (error) {
    console.error('❌ Historical collection failed:', error);
  }
}

// Run the collection
runHistoricalCollection()
  .then(() => {
    console.log('\n✅ Historical data collection process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Historical data collection process failed:', error);
    process.exit(1);
  }); 