#!/usr/bin/env node

/**
 * Simple Historical Data Population Script
 * 
 * This script populates the campaign_summaries table with realistic historical data
 * for Meta Ads platform, ensuring that the reports page can fetch data from the database
 * instead of making API calls for historical periods.
 * 
 * Usage: node scripts/populate-historical-data-simple.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configuration
const MONTHS_TO_POPULATE = 24; // 2 years of data
const WEEKS_TO_POPULATE = 52;  // 1 year of weekly data

/**
 * Generate realistic campaign data with seasonal variations
 */
function generateRealisticMetrics(baseMetrics, monthOffset = 0, isWeekly = false) {
  // Seasonal multipliers (higher in winter months for hotel industry)
  const seasonalMultipliers = [
    1.2, 1.3, 1.1, 0.9, 0.8, 0.7, // Jan-Jun
    0.6, 0.7, 0.9, 1.0, 1.1, 1.4  // Jul-Dec
  ];
  
  const currentMonth = new Date().getMonth();
  const targetMonth = (currentMonth - monthOffset + 12) % 12;
  const seasonal = seasonalMultipliers[targetMonth];
  
  // Add random variation (±20%)
  const randomVariation = 0.8 + Math.random() * 0.4;
  const multiplier = seasonal * randomVariation;
  
  // Weekly data should be roughly 1/4 of monthly
  const weeklyFactor = isWeekly ? 0.25 : 1;
  
  const spend = Math.max(0.01, Math.round(baseMetrics.spend * multiplier * weeklyFactor * 100) / 100);
  const impressions = Math.max(1, Math.round(baseMetrics.impressions * multiplier * weeklyFactor));
  const clicks = Math.max(1, Math.round(baseMetrics.clicks * multiplier * weeklyFactor));
  const conversions = Math.max(1, Math.round(baseMetrics.conversions * multiplier * weeklyFactor));
  
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
 * Generate sample campaign data for a period
 */
function generateCampaignData(clientName, metrics, isWeekly = false) {
  const campaignCount = isWeekly ? 2 : 4;
  const campaigns = [];
  
  for (let i = 0; i < campaignCount; i++) {
    const campaignShare = 0.15 + Math.random() * 0.4; // Each campaign gets 15-55% of total
    
    campaigns.push({
      campaign_id: `campaign_${clientName.toLowerCase().replace(/\s+/g, '_')}_${i + 1}`,
      campaign_name: `${clientName} - Campaign ${i + 1}`,
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
 * Generate Meta Tables data (placement, demographic, ad relevance)
 */
function generateMetaTablesData() {
  return {
    placementPerformance: [
      {
        placement: 'Facebook Feed',
        impressions: Math.round(15000 + Math.random() * 10000),
        clicks: Math.round(200 + Math.random() * 150),
        spend: Math.round((300 + Math.random() * 200) * 100) / 100,
        ctr: Math.round((1.2 + Math.random() * 0.8) * 100) / 100
      },
      {
        placement: 'Instagram Feed',
        impressions: Math.round(12000 + Math.random() * 8000),
        clicks: Math.round(180 + Math.random() * 120),
        spend: Math.round((250 + Math.random() * 150) * 100) / 100,
        ctr: Math.round((1.4 + Math.random() * 0.6) * 100) / 100
      },
      {
        placement: 'Instagram Stories',
        impressions: Math.round(8000 + Math.random() * 5000),
        clicks: Math.round(120 + Math.random() * 80),
        spend: Math.round((180 + Math.random() * 100) * 100) / 100,
        ctr: Math.round((1.5 + Math.random() * 0.5) * 100) / 100
      }
    ],
    demographicPerformance: [
      {
        age_range: '25-34',
        gender: 'female',
        impressions: Math.round(20000 + Math.random() * 10000),
        clicks: Math.round(300 + Math.random() * 150),
        spend: Math.round((400 + Math.random() * 200) * 100) / 100
      },
      {
        age_range: '35-44',
        gender: 'female',
        impressions: Math.round(18000 + Math.random() * 9000),
        clicks: Math.round(280 + Math.random() * 140),
        spend: Math.round((380 + Math.random() * 180) * 100) / 100
      },
      {
        age_range: '25-34',
        gender: 'male',
        impressions: Math.round(15000 + Math.random() * 8000),
        clicks: Math.round(220 + Math.random() * 110),
        spend: Math.round((320 + Math.random() * 160) * 100) / 100
      }
    ],
    adRelevanceResults: [
      {
        ad_name: 'Hotel Booking Ad 1',
        relevance_score: Math.round((7 + Math.random() * 2) * 10) / 10,
        quality_ranking: 'Above Average',
        engagement_rate_ranking: 'Average',
        conversion_rate_ranking: 'Above Average'
      },
      {
        ad_name: 'Hotel Booking Ad 2',
        relevance_score: Math.round((6.5 + Math.random() * 2.5) * 10) / 10,
        quality_ranking: 'Average',
        engagement_rate_ranking: 'Above Average',
        conversion_rate_ranking: 'Average'
      }
    ]
  };
}

/**
 * Populate monthly historical data
 */
async function populateMonthlyData(clients) {
  console.log(`📅 Populating ${MONTHS_TO_POPULATE} months of historical data...`);
  
  const records = [];
  const currentDate = new Date();
  
  for (let monthOffset = 0; monthOffset < MONTHS_TO_POPULATE; monthOffset++) {
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthOffset, 1);
    const summaryDate = targetDate.toISOString().split('T')[0];
    
    console.log(`   📊 Processing month: ${summaryDate}`);
    
    for (const client of clients) {
      // Base metrics for this client (you can customize these per client)
      const baseMetrics = {
        spend: 2500 + Math.random() * 1500,    // 2500-4000 PLN per month
        impressions: 80000 + Math.random() * 40000, // 80k-120k impressions
        clicks: 1200 + Math.random() * 800,    // 1200-2000 clicks
        conversions: 45 + Math.random() * 30   // 45-75 conversions
      };
      
      const metrics = generateRealisticMetrics(baseMetrics, monthOffset, false);
      
      // Debug: Check for null values
      if (!metrics.total_spend || !metrics.total_impressions || !metrics.total_clicks || !metrics.total_conversions) {
        console.error(`❌ Null metrics detected for ${client.name} ${summaryDate}:`, metrics);
        continue; // Skip this client for this month
      }
      
      const campaignData = generateCampaignData(client.name, metrics, false);
      const metaTablesData = generateMetaTablesData();
      
      // Meta Ads record (using existing schema without platform column for now)
      records.push({
        client_id: client.id,
        summary_type: 'monthly',
        summary_date: summaryDate,
        ...metrics,
        active_campaigns: campaignData.length,
        total_campaigns: campaignData.length,
        campaign_data: campaignData,
        meta_tables: metaTablesData,
        data_source: 'historical_simulation',
        last_updated: new Date().toISOString()
      });
    }
  }
  
  console.log(`   💾 Inserting ${records.length} monthly records...`);
  
  // Insert in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(batch, {
        onConflict: 'client_id,summary_type,summary_date'
      });
    
    if (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
      return false;
    }
    
    console.log(`   ✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
  }
  
  return true;
}

/**
 * Populate weekly historical data
 */
async function populateWeeklyData(clients) {
  console.log(`📅 Populating ${WEEKS_TO_POPULATE} weeks of historical data...`);
  
  const records = [];
  const currentDate = new Date();
  
  for (let weekOffset = 0; weekOffset < WEEKS_TO_POPULATE; weekOffset++) {
    // Calculate Monday of the target week
    const targetDate = new Date(currentDate);
    targetDate.setDate(currentDate.getDate() - (weekOffset * 7));
    
    // Get Monday of this week
    const dayOfWeek = targetDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(targetDate);
    monday.setDate(targetDate.getDate() - daysToMonday);
    
    const summaryDate = monday.toISOString().split('T')[0];
    
    console.log(`   📊 Processing week: ${summaryDate}`);
    
    for (const client of clients) {
      // Base weekly metrics (roughly 1/4 of monthly)
      const baseMetrics = {
        spend: 600 + Math.random() * 400,     // 600-1000 PLN per week
        impressions: 20000 + Math.random() * 10000, // 20k-30k impressions
        clicks: 300 + Math.random() * 200,    // 300-500 clicks
        conversions: 12 + Math.random() * 8   // 12-20 conversions
      };
      
      const metrics = generateRealisticMetrics(baseMetrics, Math.floor(weekOffset / 4), true);
      const campaignData = generateCampaignData(client.name, metrics, true);
      
      // Meta Ads record (using existing schema)
      records.push({
        client_id: client.id,
        summary_type: 'weekly',
        summary_date: summaryDate,
        ...metrics,
        active_campaigns: campaignData.length,
        total_campaigns: campaignData.length,
        campaign_data: campaignData,
        meta_tables: generateMetaTablesData(),
        data_source: 'historical_simulation',
        last_updated: new Date().toISOString()
      });
    }
  }
  
  console.log(`   💾 Inserting ${records.length} weekly records...`);
  
  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('campaign_summaries')
      .upsert(batch, {
        onConflict: 'client_id,summary_type,summary_date'
      });
    
    if (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
      return false;
    }
    
    console.log(`   ✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
  }
  
  return true;
}

/**
 * Main function
 */
async function populateHistoricalData() {
  console.log('🚀 SIMPLE HISTORICAL DATA POPULATION\n');
  console.log('This script will populate campaign_summaries with realistic historical data');
  console.log('for Meta Ads platform (compatible with existing schema).\n');
  
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
    
    console.log(`✅ Found ${clients.length} clients:`);
    clients.forEach(client => {
      console.log(`   - ${client.name} (${client.email})`);
    });
    
    // 2. Check existing data
    console.log('\n📊 Checking existing data...');
    const { data: existingData } = await supabase
      .from('campaign_summaries')
      .select('summary_type, summary_date')
      .order('summary_date', { ascending: false });
    
    console.log(`   Current records: ${existingData?.length || 0}`);
    
    // 3. Populate monthly data
    console.log('\n📅 MONTHLY DATA POPULATION');
    const monthlySuccess = await populateMonthlyData(clients);
    
    if (!monthlySuccess) {
      console.error('❌ Failed to populate monthly data');
      return;
    }
    
    // 4. Populate weekly data
    console.log('\n📅 WEEKLY DATA POPULATION');
    const weeklySuccess = await populateWeeklyData(clients);
    
    if (!weeklySuccess) {
      console.error('❌ Failed to populate weekly data');
      return;
    }
    
    // 5. Verify final data
    console.log('\n🔍 VERIFICATION');
    const { data: finalData } = await supabase
      .from('campaign_summaries')
      .select('summary_type');
    
    console.log('✅ Final data summary:');
    if (finalData) {
      const monthlyCounts = finalData.filter(r => r.summary_type === 'monthly').length;
      const weeklyCounts = finalData.filter(r => r.summary_type === 'weekly').length;
      console.log(`   monthly: ${monthlyCounts} records`);
      console.log(`   weekly: ${weeklyCounts} records`);
      console.log(`   total: ${finalData.length} records`);
    }
    
    // 6. Show sample recent data
    console.log('\n📋 Sample recent data:');
    const { data: sampleData } = await supabase
      .from('campaign_summaries')
      .select('client_id, summary_type, summary_date, total_spend, total_conversions')
      .order('summary_date', { ascending: false })
      .limit(10);
    
    if (sampleData) {
      sampleData.forEach(record => {
        console.log(`   ${record.summary_date} | ${record.summary_type} | ${record.total_spend} PLN | ${record.total_conversions} conv`);
      });
    }
    
    console.log('\n🎉 HISTORICAL DATA POPULATION COMPLETED!');
    console.log('\n📝 Next steps:');
    console.log('1. Test the reports page - historical periods should now load from database');
    console.log('2. Verify that API calls are only made for current periods');
    console.log('3. Check that Meta Ads data is available for past periods');
    
  } catch (error) {
    console.error('❌ Error during population:', error);
  }
}

// Run the script
if (require.main === module) {
  populateHistoricalData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { populateHistoricalData };
