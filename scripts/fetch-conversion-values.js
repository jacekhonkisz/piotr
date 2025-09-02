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

    // TEST 1: Check available conversion metrics
    console.log('🔍 TEST 1: Available Conversion Metrics');
    console.log('======================================');
    
    const conversionMetricsQuery = `
      SELECT 
        campaign.name,
        metrics.conversions,
        metrics.conversions_value,
        metrics.conversions_from_interactions_rate,
        metrics.cost_per_conversion,
        metrics.value_per_conversion,
        metrics.all_conversions,
        metrics.all_conversions_value,
        metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND metrics.conversions > 0
      ORDER BY metrics.conversions_value DESC
    `;
    
    console.log('📊 CONVERSION VALUE METRICS:');
    const conversionData = await customer.query(conversionMetricsQuery);
    
    let totalConversions = 0;
    let totalConversionsValue = 0;
    let totalAllConversions = 0;
    let totalAllConversionsValue = 0;
    let totalCost = 0;
    
    if (conversionData.length > 0) {
      console.log('');
      conversionData.forEach((row, index) => {
        const conversions = parseFloat(row.metrics.conversions || 0);
        const conversionsValue = parseFloat(row.metrics.conversionsValue || 0);
        const allConversions = parseFloat(row.metrics.allConversions || 0);
        const allConversionsValue = parseFloat(row.metrics.allConversionsValue || 0);
        const cost = parseInt(row.metrics.costMicros || 0);
        const costPerConversion = parseFloat(row.metrics.costPerConversion || 0);
        const valuePerConversion = parseFloat(row.metrics.valuePerConversion || 0);
        
        console.log(`   ${index + 1}. ${row.campaign.name}`);
        console.log(`      🎯 Conversions: ${conversions}`);
        console.log(`      💎 Conversion Value: ${conversionsValue.toFixed(2)} PLN`);
        console.log(`      🎯 All Conversions: ${allConversions}`);
        console.log(`      💎 All Conversions Value: ${allConversionsValue.toFixed(2)} PLN`);
        console.log(`      💰 Cost per Conversion: ${(costPerConversion / 1000000).toFixed(2)} PLN`);
        console.log(`      💵 Value per Conversion: ${valuePerConversion.toFixed(2)} PLN`);
        
        if (conversions > 0 && conversionsValue > 0) {
          const roas = (conversionsValue / (cost / 1000000));
          console.log(`      📈 ROAS: ${roas.toFixed(2)}x`);
        }
        console.log('');
        
        totalConversions += conversions;
        totalConversionsValue += conversionsValue;
        totalAllConversions += allConversions;
        totalAllConversionsValue += allConversionsValue;
        totalCost += cost;
      });
      
      console.log('📊 TOTAL CONVERSION VALUES:');
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
    } else {
      console.log('   ❌ No conversion value data available');
      console.log('   🔍 Possible reasons:');
      console.log('   • Conversion tracking not set up');
      console.log('   • No conversion values assigned');
      console.log('   • Conversions exist but without values');
    }
    console.log('');

    // TEST 2: Check conversion actions (types of conversions)
    console.log('🎯 TEST 2: Conversion Actions (Types)');
    console.log('====================================');
    
    try {
      const conversionActionsQuery = `
        SELECT 
          conversion_action.name,
          conversion_action.type,
          conversion_action.category,
          conversion_action.status,
          conversion_action.primary_for_goal,
          conversion_action.value_settings.default_value,
          conversion_action.value_settings.default_currency_code
        FROM conversion_action
        WHERE conversion_action.status = 2
      `;
      
      const conversionActions = await customer.query(conversionActionsQuery);
      
      if (conversionActions.length > 0) {
        console.log('📋 CONFIGURED CONVERSION ACTIONS:');
        conversionActions.forEach((row, index) => {
          const action = row.conversion_action;
          console.log(`   ${index + 1}. ${action.name}`);
          console.log(`      📝 Type: ${action.type}`);
          console.log(`      📂 Category: ${action.category}`);
          console.log(`      ✅ Status: ${action.status === 2 ? 'ENABLED' : 'DISABLED'}`);
          console.log(`      🎯 Primary for Goal: ${action.primaryForGoal ? 'YES' : 'NO'}`);
          
          if (action.valueSettings) {
            console.log(`      💰 Default Value: ${action.valueSettings.defaultValue || 'Not set'}`);
            console.log(`      💱 Currency: ${action.valueSettings.defaultCurrencyCode || 'Not set'}`);
          }
          console.log('');
        });
      } else {
        console.log('   ❌ No conversion actions configured');
      }
    } catch (error) {
      console.log('   ❌ Could not fetch conversion actions');
      console.log(`   Error: ${error.message}`);
    }
    console.log('');

    // TEST 3: Daily conversion values breakdown
    console.log('📅 TEST 3: Daily Conversion Values');
    console.log('==================================');
    
    const dailyConversionsQuery = `
      SELECT 
        segments.date,
        metrics.conversions,
        metrics.conversions_value,
        metrics.all_conversions,
        metrics.all_conversions_value,
        metrics.cost_micros
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND (metrics.conversions > 0 OR metrics.all_conversions > 0)
      ORDER BY segments.date DESC
    `;
    
    const dailyConversions = await customer.query(dailyConversionsQuery);
    const dailyStats = {};
    
    dailyConversions.forEach(row => {
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
    
    if (Object.keys(dailyStats).length > 0) {
      console.log('📊 DAILY CONVERSION VALUES:');
      Object.entries(dailyStats)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 10)
        .forEach(([date, stats]) => {
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
      console.log('   ❌ No daily conversion value data');
    }

    // TEST 4: Real-time conversion value monitoring capabilities
    console.log('⚡ TEST 4: Real-Time Conversion Value Monitoring');
    console.log('===============================================');
    
    console.log('✅ AVAILABLE CONVERSION VALUE METRICS:');
    console.log('');
    console.log('1. 💎 CONVERSION VALUES:');
    console.log('   - metrics.conversions_value (primary conversions)');
    console.log('   - metrics.all_conversions_value (all conversion types)');
    console.log('   - metrics.value_per_conversion (average value)');
    console.log('   - metrics.cost_per_conversion (cost efficiency)');
    console.log('');
    
    console.log('2. 📊 ROAS CALCULATIONS:');
    console.log('   - Real-time ROAS = Conversion Value / Ad Spend');
    console.log('   - Campaign-level ROAS tracking');
    console.log('   - Daily ROAS monitoring');
    console.log('');
    
    console.log('3. 🎯 CONVERSION TRACKING:');
    console.log('   - Conversion actions by type');
    console.log('   - Primary vs secondary conversions');
    console.log('   - Conversion attribution models');
    console.log('');
    
    console.log('4. 💰 VALUE OPTIMIZATION:');
    console.log('   - Value per click calculations');
    console.log('   - Revenue per impression');
    console.log('   - Profit margin analysis');
    console.log('');

    // Sample real-time monitoring function
    console.log('🚀 REAL-TIME CONVERSION VALUE MONITORING FUNCTION:');
    console.log('==================================================');
    
    console.log(`
// Real-time conversion value monitoring
async function monitorConversionValues() {
  const today = new Date().toISOString().split('T')[0];
  
  const query = \`
    SELECT 
      campaign.name,
      metrics.conversions,
      metrics.conversions_value,
      metrics.cost_micros,
      metrics.value_per_conversion,
      metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date = '\${today}'
      AND metrics.conversions > 0
    ORDER BY metrics.conversions_value DESC
  \`;
  
  const data = await customer.query(query);
  
  console.log('💎 LIVE CONVERSION VALUES (\${new Date().toLocaleTimeString()}):');
  
  let totalValue = 0;
  let totalCost = 0;
  let totalConversions = 0;
  
  data.forEach(row => {
    const conversions = parseFloat(row.metrics.conversions || 0);
    const value = parseFloat(row.metrics.conversionsValue || 0);
    const cost = parseInt(row.metrics.costMicros || 0) / 1000000;
    const valuePerConv = parseFloat(row.metrics.valuePerConversion || 0);
    const costPerConv = parseFloat(row.metrics.costPerConversion || 0) / 1000000;
    
    console.log(\`   \${row.campaign.name}\`);
    console.log(\`     🎯 Conversions: \${conversions}\`);
    console.log(\`     💎 Total Value: \${value.toFixed(2)} PLN\`);
    console.log(\`     💵 Value per Conversion: \${valuePerConv.toFixed(2)} PLN\`);
    console.log(\`     💰 Cost per Conversion: \${costPerConv.toFixed(2)} PLN\`);
    
    if (cost > 0 && value > 0) {
      const roas = value / cost;
      console.log(\`     📈 ROAS: \${roas.toFixed(2)}x\`);
    }
    
    totalValue += value;
    totalCost += cost;
    totalConversions += conversions;
  });
  
  console.log(\`\\n   TOTAL TODAY:\`);
  console.log(\`     💎 Total Value: \${totalValue.toFixed(2)} PLN\`);
  console.log(\`     💰 Total Cost: \${totalCost.toFixed(2)} PLN\`);
  console.log(\`     🎯 Total Conversions: \${totalConversions}\`);
  
  if (totalCost > 0 && totalValue > 0) {
    const overallRoas = totalValue / totalCost;
    console.log(\`     📈 Overall ROAS: \${overallRoas.toFixed(2)}x\`);
  }
  
  if (totalConversions > 0) {
    const avgValue = totalValue / totalConversions;
    console.log(\`     💵 Avg Value per Conversion: \${avgValue.toFixed(2)} PLN\`);
  }
}

// Run every 30 minutes
setInterval(monitorConversionValues, 30 * 60 * 1000);
`);

    console.log('');
    console.log('🎯 SUMMARY - CONVERSION VALUE TRACKING:');
    console.log('=======================================');
    
    if (totalConversionsValue > 0) {
      console.log('✅ CONVERSION VALUES: AVAILABLE');
      console.log(`   💎 Total Value: ${totalConversionsValue.toFixed(2)} PLN`);
      console.log(`   🎯 Total Conversions: ${totalConversions}`);
      console.log(`   💵 Avg Value per Conversion: ${(totalConversionsValue / totalConversions).toFixed(2)} PLN`);
      
      if (totalCost > 0) {
        const roas = totalConversionsValue / (totalCost / 1000000);
        console.log(`   📈 ROAS: ${roas.toFixed(2)}x`);
      }
    } else {
      console.log('❌ CONVERSION VALUES: NOT AVAILABLE');
      console.log('   🔍 Possible reasons:');
      console.log('   • Conversion tracking not configured');
      console.log('   • No conversion values assigned in Google Ads');
      console.log('   • Conversions exist but without monetary values');
      console.log('   • Enhanced conversions not set up');
    }
    
    console.log('');
    console.log('✅ REAL-TIME CAPABILITIES:');
    console.log('   - Live conversion value tracking');
    console.log('   - Real-time ROAS calculations');
    console.log('   - Daily/hourly value breakdowns');
    console.log('   - Campaign value performance');
    console.log('   - Cost per conversion monitoring');
    console.log('   - Value per conversion analysis');
    
    console.log('');
    console.log('🚀 NEXT STEPS FOR CONVERSION VALUES:');
    console.log('1. Set up conversion actions in Google Ads');
    console.log('2. Assign monetary values to conversions');
    console.log('3. Configure enhanced conversions');
    console.log('4. Set up conversion value rules');
    console.log('5. Enable real-time value monitoring');

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
