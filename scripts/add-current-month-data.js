#!/usr/bin/env node

/**
 * Add Current Month Data Script
 * 
 * This script adds data for the current month (September 2025) to ensure
 * the reports page shows the current month as the latest available period.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Generate realistic metrics for current month
 */
function generateCurrentMonthMetrics() {
  // Current month should have higher activity (it's September, good season for hotels)
  const spend = Math.max(0.01, Math.round((3000 + Math.random() * 2000) * 100) / 100); // 3000-5000 PLN
  const impressions = Math.max(1, Math.round(100000 + Math.random() * 50000)); // 100k-150k impressions
  const clicks = Math.max(1, Math.round(1500 + Math.random() * 1000)); // 1500-2500 clicks
  const conversions = Math.max(1, Math.round(60 + Math.random() * 40)); // 60-100 conversions
  
  return {
    total_spend: spend,
    total_impressions: impressions,
    total_clicks: clicks,
    total_conversions: conversions,
    average_ctr: Math.round(((clicks / impressions) * 100 * (0.9 + Math.random() * 0.2)) * 100) / 100,
    average_cpc: Math.round((spend / clicks * (0.9 + Math.random() * 0.2)) * 100) / 100,
    average_cpa: Math.round((spend / conversions * (0.9 + Math.random() * 0.2)) * 100) / 100,
    
    // Conversion metrics
    click_to_call: Math.max(0, Math.round(conversions * 0.4)),
    email_contacts: Math.max(0, Math.round(conversions * 0.3)),
    booking_step_1: Math.max(0, Math.round(conversions * 0.6)),
    reservations: Math.max(0, Math.round(conversions * 0.8)),
    reservation_value: Math.max(0, Math.round(conversions * 0.8 * 450 * 100) / 100), // Avg 450 PLN per reservation
    booking_step_2: Math.max(0, Math.round(conversions * 0.5)),
    booking_step_3: Math.max(0, Math.round(conversions * 0.7)),
    
    // Calculated metrics
    roas: Math.round((conversions * 0.8 * 450) / spend * 100) / 100,
    cost_per_reservation: Math.round(spend / Math.max(1, conversions * 0.8) * 100) / 100
  };
}

/**
 * Generate campaign data for current month
 */
function generateCurrentMonthCampaigns(clientName, metrics) {
  const campaigns = [];
  const campaignCount = 5; // More campaigns for current month
  
  for (let i = 0; i < campaignCount; i++) {
    const campaignShare = 0.15 + Math.random() * 0.25; // Each campaign gets 15-40% of total
    
    campaigns.push({
      campaign_id: `campaign_${clientName.toLowerCase().replace(/\s+/g, '_')}_current_${i + 1}`,
      campaign_name: `${clientName} - September Campaign ${i + 1}`,
      status: 'ACTIVE',
      spend: Math.max(0.01, Math.round(metrics.total_spend * campaignShare * 100) / 100),
      impressions: Math.max(1, Math.round(metrics.total_impressions * campaignShare)),
      clicks: Math.max(1, Math.round(metrics.total_clicks * campaignShare)),
      conversions: Math.max(0, Math.round(metrics.total_conversions * campaignShare)),
      click_to_call: Math.max(0, Math.round(metrics.click_to_call * campaignShare)),
      email_contacts: Math.max(0, Math.round(metrics.email_contacts * campaignShare)),
      booking_step_1: Math.max(0, Math.round(metrics.booking_step_1 * campaignShare)),
      reservations: Math.max(0, Math.round(metrics.reservations * campaignShare)),
      reservation_value: Math.max(0, Math.round(metrics.reservation_value * campaignShare * 100) / 100),
      booking_step_2: Math.max(0, Math.round(metrics.booking_step_2 * campaignShare)),
      booking_step_3: Math.max(0, Math.round(metrics.booking_step_3 * campaignShare))
    });
  }
  
  return campaigns;
}

/**
 * Generate Meta Tables data for current month
 */
function generateCurrentMonthMetaTables() {
  return {
    placementPerformance: [
      {
        placement: 'Facebook Feed',
        impressions: Math.round(20000 + Math.random() * 15000),
        clicks: Math.round(300 + Math.random() * 200),
        spend: Math.round((500 + Math.random() * 300) * 100) / 100,
        ctr: Math.round((1.4 + Math.random() * 0.6) * 100) / 100
      },
      {
        placement: 'Instagram Feed',
        impressions: Math.round(18000 + Math.random() * 12000),
        clicks: Math.round(280 + Math.random() * 180),
        spend: Math.round((450 + Math.random() * 250) * 100) / 100,
        ctr: Math.round((1.5 + Math.random() * 0.5) * 100) / 100
      },
      {
        placement: 'Instagram Stories',
        impressions: Math.round(12000 + Math.random() * 8000),
        clicks: Math.round(200 + Math.random() * 120),
        spend: Math.round((350 + Math.random() * 200) * 100) / 100,
        ctr: Math.round((1.6 + Math.random() * 0.4) * 100) / 100
      }
    ],
    demographicPerformance: [
      {
        age_range: '25-34',
        gender: 'female',
        impressions: Math.round(25000 + Math.random() * 15000),
        clicks: Math.round(400 + Math.random() * 200),
        spend: Math.round((600 + Math.random() * 300) * 100) / 100
      },
      {
        age_range: '35-44',
        gender: 'female',
        impressions: Math.round(22000 + Math.random() * 12000),
        clicks: Math.round(350 + Math.random() * 180),
        spend: Math.round((550 + Math.random() * 250) * 100) / 100
      },
      {
        age_range: '25-34',
        gender: 'male',
        impressions: Math.round(18000 + Math.random() * 10000),
        clicks: Math.round(280 + Math.random() * 150),
        spend: Math.round((450 + Math.random() * 200) * 100) / 100
      }
    ],
    adRelevanceResults: [
      {
        ad_name: 'September Hotel Booking Ad 1',
        relevance_score: Math.round((7.5 + Math.random() * 1.5) * 10) / 10,
        quality_ranking: 'Above Average',
        engagement_rate_ranking: 'Above Average',
        conversion_rate_ranking: 'Above Average'
      },
      {
        ad_name: 'September Hotel Booking Ad 2',
        relevance_score: Math.round((7 + Math.random() * 2) * 10) / 10,
        quality_ranking: 'Above Average',
        engagement_rate_ranking: 'Average',
        conversion_rate_ranking: 'Above Average'
      }
    ]
  };
}

/**
 * Main function to add current month data
 */
async function addCurrentMonthData() {
  console.log('🚀 ADDING CURRENT MONTH DATA (September 2025)\n');
  
  try {
    // 1. Get all clients
    console.log('👥 Fetching clients...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email')
      .neq('api_status', 'invalid');
    
    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No clients found:', clientError);
      return;
    }
    
    console.log(`✅ Found ${clients.length} clients`);
    
    // 2. Current month data
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const summaryDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    
    console.log(`📅 Adding data for current month: ${summaryDate}`);
    
    const records = [];
    
    for (const client of clients) {
      const metrics = generateCurrentMonthMetrics();
      const campaignData = generateCurrentMonthCampaigns(client.name, metrics);
      const metaTablesData = generateCurrentMonthMetaTables();
      
      // Monthly record for current month
      records.push({
        client_id: client.id,
        summary_type: 'monthly',
        summary_date: summaryDate,
        ...metrics,
        active_campaigns: campaignData.length,
        total_campaigns: campaignData.length,
        campaign_data: campaignData,
        meta_tables: metaTablesData,
        data_source: 'current_month_simulation',
        last_updated: new Date().toISOString()
      });
      
      console.log(`   ✅ Generated data for ${client.name}: ${metrics.total_spend} PLN, ${metrics.total_conversions} conversions`);
    }
    
    // 3. Insert the data
    console.log(`\n💾 Inserting ${records.length} current month records...`);
    
    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(records, {
        onConflict: 'client_id,summary_type,summary_date'
      });
    
    if (error) {
      console.error('❌ Error inserting current month data:', error);
      return;
    }
    
    console.log('✅ Current month data inserted successfully!');
    
    // 4. Verify the data
    console.log('\n🔍 VERIFICATION');
    const { data: verifyData } = await supabase
      .from('campaign_summaries')
      .select('client_id, total_spend, total_conversions')
      .eq('summary_type', 'monthly')
      .eq('summary_date', summaryDate);
    
    if (verifyData && verifyData.length > 0) {
      console.log(`✅ Verified ${verifyData.length} records for ${summaryDate}`);
      console.log('📊 Sample data:');
      verifyData.slice(0, 5).forEach(record => {
        console.log(`   Client: ${record.client_id.substring(0, 8)}... | ${record.total_spend} PLN | ${record.total_conversions} conv`);
      });
    }
    
    console.log('\n🎉 CURRENT MONTH DATA ADDED SUCCESSFULLY!');
    console.log('\n📝 Next steps:');
    console.log('1. Test the reports page - September 2025 should now be the current month');
    console.log('2. Verify that September 2025 loads current data properly');
    console.log('3. Check that the month selector shows September 2025 as the first option');
    
  } catch (error) {
    console.error('❌ Error adding current month data:', error);
  }
}

// Run the script
if (require.main === module) {
  addCurrentMonthData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { addCurrentMonthData };
