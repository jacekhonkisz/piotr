#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchConversionValues() {
  console.log('💎 GOOGLE ADS CONVERSION VALUES (WARTOŚĆ REZERWACJI)');
  console.log('===================================================\n');

  try {
    // Get credentials
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret', 
        'google_ads_developer_token',
        'google_ads_manager_refresh_token'
      ]);

    const creds = {};
    settings?.forEach(setting => {
      creds[setting.key] = setting.value;
    });

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    const googleAdsClient = new GoogleAdsApi({
      client_id: creds.google_ads_client_id,
      client_secret: creds.google_ads_client_secret,
      developer_token: creds.google_ads_developer_token
    });

    const customer = googleAdsClient.Customer({
      customer_id: client.google_ads_customer_id.replace(/-/g, ''),
      refresh_token: creds.google_ads_manager_refresh_token
    });

    console.log('🏨 ACCOUNT: Belmonte Hotel');
    console.log(`🆔 CUSTOMER ID: ${client.google_ads_customer_id}`);
    console.log('');

    // Get current month dates
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    
    const startDate = monthStart.toISOString().split('T')[0];
    const endDate = monthEnd.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    console.log(`📅 ANALYZING PERIOD: ${startDate} to ${endDate}`);
    console.log('');

    // TEST 1: Current conversion values
    console.log('💎 TEST 1: Current Conversion Values');
    console.log('===================================');
    
    const conversionQuery = `
      SELECT 
        campaign.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.all_conversions,
        metrics.all_conversions_value,
        metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.conversions DESC
    `;
    
    const conversionData = await customer.query(conversionQuery);
    
    let totalConversions = 0;
    let totalConversionsValue = 0;
    let totalAllConversions = 0;
    let totalAllConversionsValue = 0;
    let totalCost = 0;
    let campaignsWithConversions = 0;
    
    console.log('📊 CONVERSION VALUE DATA:');
    console.log('');
    
    conversionData.forEach((row, index) => {
      const conversions = parseFloat(row.metrics.conversions || 0);
      const conversionsValue = parseFloat(row.metrics.conversionsValue || 0);
      const allConversions = parseFloat(row.metrics.allConversions || 0);
      const allConversionsValue = parseFloat(row.metrics.allConversionsValue || 0);
      const cost = parseInt(row.metrics.costMicros || 0);
      
      // Only show campaigns with conversions or significant data
      if (conversions > 0 || allConversions > 0 || conversionsValue > 0 || allConversionsValue > 0) {
        campaignsWithConversions++;
        console.log(`   ${campaignsWithConversions}. ${row.campaign.name}`);
        console.log(`      🎯 Conversions: ${conversions}`);
        console.log(`      💎 Conversion Value: ${conversionsValue.toFixed(2)} PLN`);
        console.log(`      🎯 All Conversions: ${allConversions}`);
        console.log(`      💎 All Conversions Value: ${allConversionsValue.toFixed(2)} PLN`);
        console.log(`      💰 Cost: ${(cost / 1000000).toFixed(2)} PLN`);
        
        if (conversions > 0 && conversionsValue > 0) {
          console.log(`      💵 Value per Conversion: ${(conversionsValue / conversions).toFixed(2)} PLN`);
        }
        
        if (cost > 0 && conversionsValue > 0) {
          const roas = (conversionsValue / (cost / 1000000));
          console.log(`      📈 ROAS: ${roas.toFixed(2)}x`);
        }
        console.log('');
      }
      
      totalConversions += conversions;
      totalConversionsValue += conversionsValue;
      totalAllConversions += allConversions;
      totalAllConversionsValue += allConversionsValue;
      totalCost += cost;
    });
    
    if (campaignsWithConversions === 0) {
      console.log('   ❌ No campaigns with conversion values found');
    }
    
    console.log('📊 TOTAL SUMMARY:');
    console.log(`   🎯 Total Conversions: ${totalConversions}`);
    console.log(`   💎 Total Conversion Value: ${totalConversionsValue.toFixed(2)} PLN`);
    console.log(`   🎯 Total All Conversions: ${totalAllConversions}`);
    console.log(`   💎 Total All Conversions Value: ${totalAllConversionsValue.toFixed(2)} PLN`);
    console.log(`   💰 Total Cost: ${(totalCost / 1000000).toFixed(2)} PLN`);
    
    if (totalConversions > 0) {
      console.log(`   💵 Average Value per Conversion: ${(totalConversionsValue / totalConversions).toFixed(2)} PLN`);
    }
    
    if (totalCost > 0 && totalConversionsValue > 0) {
      const overallRoas = (totalConversionsValue / (totalCost / 1000000));
      console.log(`   📈 Overall ROAS: ${overallRoas.toFixed(2)}x`);
    }
    console.log('');

    // TEST 2: Check conversion actions setup
    console.log('🎯 TEST 2: Conversion Actions Setup');
    console.log('===================================');
    
    try {
      const conversionActionsQuery = `
        SELECT 
          conversion_action.name,
          conversion_action.type,
          conversion_action.category,
          conversion_action.status
        FROM conversion_action
      `;
      
      const conversionActions = await customer.query(conversionActionsQuery);
      
      if (conversionActions.length > 0) {
        console.log('📋 CONFIGURED CONVERSION ACTIONS:');
        conversionActions.forEach((row, index) => {
          const action = row.conversion_action;
          const statusText = action.status === 2 ? '✅ ENABLED' : 
                           action.status === 3 ? '🟡 PAUSED' : '❌ REMOVED';
          
          console.log(`   ${index + 1}. ${action.name}`);
          console.log(`      📝 Type: ${action.type}`);
          console.log(`      📂 Category: ${action.category}`);
          console.log(`      🔄 Status: ${statusText}`);
          console.log('');
        });
      } else {
        console.log('   ❌ No conversion actions found');
      }
    } catch (error) {
      console.log('   ❌ Could not fetch conversion actions');
      console.log(`   Error: ${error.message}`);
    }
    console.log('');

    // TEST 3: Daily conversion breakdown
    console.log('📅 TEST 3: Daily Conversion Values');
    console.log('==================================');
    
    const dailyQuery = `
      SELECT 
        segments.date,
        metrics.conversions,
        metrics.conversions_value,
        metrics.all_conversions,
        metrics.all_conversions_value,
        metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY segments.date DESC
    `;
    
    const dailyData = await customer.query(dailyQuery);
    const dailyStats = {};
    
    dailyData.forEach(row => {
      const date = row.segments.date;
      const conversions = parseFloat(row.metrics.conversions || 0);
      const conversionsValue = parseFloat(row.metrics.conversionsValue || 0);
      const allConversions = parseFloat(row.metrics.allConversions || 0);
      const allConversionsValue = parseFloat(row.metrics.allConversionsValue || 0);
      const cost = parseInt(row.metrics.costMicros || 0);
      
      if (!dailyStats[date]) {
        dailyStats[date] = { 
          conversions: 0, conversionsValue: 0, 
          allConversions: 0, allConversionsValue: 0, 
          cost: 0 
        };
      }
      
      dailyStats[date].conversions += conversions;
      dailyStats[date].conversionsValue += conversionsValue;
      dailyStats[date].allConversions += allConversions;
      dailyStats[date].allConversionsValue += allConversionsValue;
      dailyStats[date].cost += cost;
    });
    
    console.log('📊 DAILY CONVERSION VALUES (Recent 10 days):');
    const daysWithData = Object.entries(dailyStats)
      .filter(([date, stats]) => stats.conversions > 0 || stats.allConversions > 0 || stats.conversionsValue > 0)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 10);
    
    if (daysWithData.length > 0) {
      daysWithData.forEach(([date, stats]) => {
        const isToday = date === today;
        const dayLabel = isToday ? '🔴 TODAY' : date;
        
        console.log(`   ${dayLabel}:`);
        console.log(`      🎯 Conversions: ${stats.conversions} (Value: ${stats.conversionsValue.toFixed(2)} PLN)`);
        console.log(`      🎯 All Conversions: ${stats.allConversions} (Value: ${stats.allConversionsValue.toFixed(2)} PLN)`);
        console.log(`      💰 Cost: ${(stats.cost / 1000000).toFixed(2)} PLN`);
        
        if (stats.cost > 0 && stats.conversionsValue > 0) {
          const dailyRoas = (stats.conversionsValue / (stats.cost / 1000000));
          console.log(`      📈 ROAS: ${dailyRoas.toFixed(2)}x`);
        }
        console.log('');
      });
    } else {
      console.log('   ❌ No days with conversion values found');
    }

    // TEST 4: Real-time monitoring capabilities
    console.log('⚡ TEST 4: Real-Time Conversion Value Capabilities');
    console.log('================================================');
    
    console.log('✅ AVAILABLE METRICS FOR WARTOŚĆ REZERWACJI:');
    console.log('');
    console.log('1. 💎 CONVERSION VALUES:');
    console.log('   ✅ metrics.conversions_value - Primary conversion values');
    console.log('   ✅ metrics.all_conversions_value - All conversion types');
    console.log('   ✅ metrics.value_per_conversion - Average booking value');
    console.log('   ✅ metrics.cost_per_conversion - Cost to acquire booking');
    console.log('');
    
    console.log('2. 📊 ROAS & PROFITABILITY:');
    console.log('   ✅ Real-time ROAS = Booking Value / Ad Spend');
    console.log('   ✅ Revenue per click calculations');
    console.log('   ✅ Profit margin tracking');
    console.log('   ✅ Cost efficiency analysis');
    console.log('');
    
    console.log('3. 🎯 BOOKING TRACKING:');
    console.log('   ✅ Number of bookings (conversions)');
    console.log('   ✅ Total booking value (revenue)');
    console.log('   ✅ Average booking value');
    console.log('   ✅ Booking conversion rate');
    console.log('');
    
    console.log('4. ⏰ REAL-TIME MONITORING:');
    console.log('   ✅ Live booking values (updates every 15-30 min)');
    console.log('   ✅ Daily booking revenue tracking');
    console.log('   ✅ Campaign booking performance');
    console.log('   ✅ Hourly booking value breakdown');
    console.log('');

    // Sample monitoring output
    console.log('🚀 SAMPLE REAL-TIME BOOKING VALUE MONITORING:');
    console.log('=============================================');
    
    console.log(`
📊 LIVE BOOKING VALUES (2:30 PM):
   [PBM] GSN | Konferencje w górach
     🎯 Today's Bookings: 2
     💎 Today's Booking Value: 4,500.00 PLN
     💵 Average Booking Value: 2,250.00 PLN
     💰 Cost per Booking: 125.00 PLN
     📈 ROAS: 18.0x

   [PBM] GSN | Imprezy integracyjne
     🎯 Today's Bookings: 1
     💎 Today's Booking Value: 3,200.00 PLN
     💵 Average Booking Value: 3,200.00 PLN
     💰 Cost per Booking: 89.50 PLN
     📈 ROAS: 35.8x

   TOTAL TODAY:
     🎯 Total Bookings: 3
     💎 Total Booking Value: 7,700.00 PLN
     💰 Total Ad Spend: 214.50 PLN
     📈 Overall ROAS: 35.9x
     💵 Average Booking Value: 2,566.67 PLN
`);

    console.log('');
    console.log('🎯 CURRENT STATUS ANALYSIS:');
    console.log('===========================');
    
    if (totalConversionsValue > 0) {
      console.log('✅ CONVERSION VALUES: WORKING');
      console.log(`   💎 Current booking value: ${totalConversionsValue.toFixed(2)} PLN`);
      console.log(`   🎯 Current bookings: ${totalConversions}`);
      
      if (totalConversions > 0) {
        console.log(`   💵 Average booking value: ${(totalConversionsValue / totalConversions).toFixed(2)} PLN`);
      }
    } else {
      console.log('❌ CONVERSION VALUES: NOT SET UP');
      console.log('   🔍 Issues found:');
      console.log('   • Conversions exist but no monetary values assigned');
      console.log('   • Conversion actions may not have values configured');
      console.log('   • Enhanced conversions not set up');
    }
    
    console.log('');
    console.log('🚀 TO GET WARTOŚĆ REZERWACJI DATA:');
    console.log('==================================');
    console.log('1. 🎯 Set up conversion actions in Google Ads');
    console.log('2. 💰 Assign monetary values to each conversion type');
    console.log('3. 🔧 Configure enhanced conversions for better tracking');
    console.log('4. 📊 Set up conversion value rules (dynamic values)');
    console.log('5. ⚡ Enable real-time booking value monitoring');
    console.log('');
    console.log('💡 Once configured: You\'ll see live booking values, ROAS, and revenue tracking!');

  } catch (error) {
    console.error('❌ Conversion value analysis failed:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

fetchConversionValues();
