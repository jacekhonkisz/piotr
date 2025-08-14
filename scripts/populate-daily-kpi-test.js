#!/usr/bin/env node

/**
 * Daily KPI Data Population Script
 * 
 * This script manually populates the daily_kpi_data table with test data
 * to verify the metrics component is working correctly.
 * 
 * Run with: node scripts/populate-daily-kpi-test.js
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Populate daily KPI data for the last 7 days
 */
async function populateDailyKPIData() {
  try {
    console.log('🚀 Starting daily KPI data population...');
    
    // Get all clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email')
      .limit(5);

    if (clientError) {
      console.error('❌ Error fetching clients:', clientError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️ No clients found');
      return;
    }

    console.log(`👥 Found ${clients.length} clients to process`);

    // Generate data for the last 7 days (excluding today)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const sevenDaysAgo = new Date(yesterday);
    sevenDaysAgo.setDate(yesterday.getDate() - 6);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo);
      date.setDate(sevenDaysAgo.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    console.log('📅 Generating data for dates:', dates);

    // Process each client
    for (const client of clients) {
      console.log(`\n📊 Processing client: ${client.name}`);
      
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        
        // Generate realistic test data with some variation
        const baseMultiplier = 1 + (i * 0.1); // Slight increase over time
        const randomVariation = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
        
        const dailyData = {
          client_id: client.id,
          date: date,
          total_clicks: Math.round((50 + i * 10) * baseMultiplier * randomVariation),
          total_impressions: Math.round((5000 + i * 500) * baseMultiplier * randomVariation),
          total_spend: Math.round((100 + i * 20) * baseMultiplier * randomVariation * 100) / 100,
          total_conversions: Math.round((5 + i * 2) * baseMultiplier * randomVariation),
          click_to_call: Math.round((2 + i * 1) * baseMultiplier * randomVariation),
          email_contacts: Math.round((3 + i * 1) * baseMultiplier * randomVariation),
          booking_step_1: Math.round((4 + i * 1) * baseMultiplier * randomVariation),
          reservations: Math.round((1 + i * 0.5) * baseMultiplier * randomVariation),
          reservation_value: Math.round((150 + i * 30) * baseMultiplier * randomVariation * 100) / 100,
          booking_step_2: Math.round((1 + i * 0.3) * baseMultiplier * randomVariation),
          campaigns_count: 3 + Math.floor(Math.random() * 5),
          data_source: 'test-data',
          last_updated: new Date().toISOString()
        };

        // Calculate derived metrics
        dailyData.average_ctr = dailyData.total_impressions > 0 
          ? Math.round((dailyData.total_clicks / dailyData.total_impressions) * 100 * 100) / 100
          : 0;
        
        dailyData.average_cpc = dailyData.total_clicks > 0 
          ? Math.round((dailyData.total_spend / dailyData.total_clicks) * 100) / 100
          : 0;
        
        dailyData.roas = dailyData.total_spend > 0 
          ? Math.round((dailyData.reservation_value / dailyData.total_spend) * 100) / 100
          : 0;
        
        dailyData.cost_per_reservation = dailyData.reservations > 0 
          ? Math.round((dailyData.total_spend / dailyData.reservations) * 100) / 100
          : 0;

        // Upsert the record
        const { error: upsertError } = await supabase
          .from('daily_kpi_data')
          .upsert(dailyData, { 
            onConflict: 'client_id,date',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error(`❌ Error upserting data for ${client.name} on ${date}:`, upsertError);
        } else {
          console.log(`✅ ${date}: ${dailyData.total_clicks} clicks, €${dailyData.total_spend}, ${dailyData.total_conversions} conversions`);
        }
      }
    }

    console.log('\n🎉 Daily KPI data population completed!');
    console.log('\n📊 Next steps:');
    console.log('1. Refresh your dashboard page');
    console.log('2. Check the metrics component charts');
    console.log('3. Verify the bars show different values for each day');
    console.log('4. Check that dates are properly displayed');

  } catch (error) {
    console.error('❌ Error in daily KPI population:', error);
  }
}

// Run the script
if (require.main === module) {
  populateDailyKPIData()
    .then(() => {
      console.log('✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { populateDailyKPIData }; 