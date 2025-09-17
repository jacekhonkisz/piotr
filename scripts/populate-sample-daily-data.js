#!/usr/bin/env node

/**
 * Populate Sample Daily KPI Data
 * 
 * This script creates sample daily KPI data for the previous 7 days
 * so you can see real data in the charts instead of empty charts.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function populateSampleDailyData() {
  try {
    console.log('📊 Populating sample daily KPI data for previous 7 days...');
    
    // Get the first client to use for sample data
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .limit(1);
    
    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No clients found or error:', clientError);
      return;
    }
    
    const clientId = clients[0].id;
    console.log(`📝 Using client: ${clients[0].name} (${clientId})`);
    
    // Generate data for previous 7 days (excluding today)
    const today = new Date();
    const sampleData = [];
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Generate realistic but varied daily data
      const baseClicks = 150;
      const baseSpend = 45;
      const baseImpressions = 2500;
      
      // Weekend factor (Saturday = 6, Sunday = 0)
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const weekendFactor = isWeekend ? 0.6 : 1.0;
      
      // Random variation ±30%
      const variation = 0.7 + (Math.random() * 0.6);
      
      const dailyClicks = Math.round(baseClicks * weekendFactor * variation);
      const dailySpend = Math.round(baseSpend * weekendFactor * variation * 100) / 100;
      const dailyImpressions = Math.round(baseImpressions * weekendFactor * variation);
      const dailyConversions = Math.round(dailyClicks * 0.02); // 2% conversion rate
      
      const dailyCtr = dailyImpressions > 0 ? (dailyClicks / dailyImpressions) * 100 : 0;
      const dailyCpc = dailyClicks > 0 ? dailySpend / dailyClicks : 0;
      
      sampleData.push({
        client_id: clientId,
        date: dateStr,
        total_clicks: dailyClicks,
        total_impressions: dailyImpressions,
        total_spend: dailySpend,
        total_conversions: dailyConversions,
        click_to_call: Math.round(dailyConversions * 0.3),
        email_contacts: Math.round(dailyConversions * 0.4),
        booking_step_1: Math.round(dailyConversions * 0.6),
        reservations: Math.round(dailyConversions * 0.2),
        reservation_value: Math.round(dailyConversions * 0.2 * 150), // €150 avg booking value
        booking_step_2: Math.round(dailyConversions * 0.15),
        average_ctr: Math.round(dailyCtr * 100) / 100,
        average_cpc: Math.round(dailyCpc * 100) / 100,
        roas: dailySpend > 0 ? Math.round((dailyConversions * 150) / dailySpend * 100) / 100 : 0,
        cost_per_reservation: dailyConversions > 0 ? Math.round(dailySpend / (dailyConversions * 0.2) * 100) / 100 : 0,
        campaigns_count: 3,
        data_source: 'api'
      });
    }
    
    console.log('📊 Sample data generated:', {
      totalRecords: sampleData.length,
      dateRange: {
        start: sampleData[sampleData.length - 1].date,
        end: sampleData[0].date
      },
      sampleRecord: sampleData[0]
    });
    
    // Insert sample data (upsert to avoid duplicates)
    const { data: insertedData, error: insertError } = await supabase
      .from('daily_kpi_data')
      .upsert(sampleData, { 
        onConflict: 'client_id,date',
        ignoreDuplicates: false 
      })
      .select();
    
    if (insertError) {
      console.error('❌ Error inserting sample data:', insertError);
      return;
    }
    
    console.log(`✅ Successfully inserted ${insertedData?.length || sampleData.length} daily KPI records`);
    
    // Verify the data
    const { data: verifyData, error: verifyError } = await supabase
      .from('daily_kpi_data')
      .select('date, total_clicks, total_spend')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
      .limit(7);
    
    if (verifyError) {
      console.warn('⚠️ Error verifying data:', verifyError);
    } else {
      console.log('📊 Verification - Recent daily data:');
      verifyData?.forEach((day, index) => {
        console.log(`  ${index + 1}. ${day.date}: ${day.total_clicks} clicks, ${day.total_spend} spend`);
      });
    }
    
    console.log('🎉 Sample daily KPI data populated successfully!');
    console.log('💡 Now refresh your dashboard to see REAL daily data in the charts');
    
  } catch (error) {
    console.error('❌ Failed to populate sample data:', error);
    process.exit(1);
  }
}

// Run the script
populateSampleDailyData()
  .then(() => {
    console.log('👋 Sample data population completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }); 