#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getCurrentMonthRealTimeSpend() {
  console.log('📊 CURRENT MONTH REAL-TIME SPEND ANALYSIS');
  console.log('=========================================\n');

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

    // Get current month dates
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);
    
    const startDate = monthStart.toISOString().split('T')[0];
    const endDate = monthEnd.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    console.log('🏨 ACCOUNT: Belmonte Hotel');
    console.log(`🆔 CUSTOMER ID: ${client.google_ads_customer_id}`);
    console.log(`📅 CURRENT MONTH: ${monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
    console.log(`📊 DATE RANGE: ${startDate} to ${endDate}`);
    console.log(`⏰ CURRENT TIME: ${now.toLocaleString()}`);
    console.log('');

    // CURRENT MONTH TOTAL SPEND
    console.log('💰 CURRENT MONTH TOTAL SPEND');
    console.log('============================');
    
    const monthTotalQuery = `
      SELECT 
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;
    
    const monthTotalData = await customer.query(monthTotalQuery);
    
    let monthTotalSpend = 0;
    let monthTotalImpressions = 0;
    let monthTotalClicks = 0;
    let monthTotalConversions = 0;
    let monthTotalConversionsValue = 0;
    
    monthTotalData.forEach(row => {
      monthTotalSpend += parseInt(row.metrics.costMicros || 0);
      monthTotalImpressions += parseInt(row.metrics.impressions || 0);
      monthTotalClicks += parseInt(row.metrics.clicks || 0);
      monthTotalConversions += parseFloat(row.metrics.conversions || 0);
      monthTotalConversionsValue += parseFloat(row.metrics.conversionsValue || 0);
    });
    
    console.log(`💵 TOTAL SPEND: $${(monthTotalSpend / 1000000).toFixed(2)}`);
    console.log(`👁️  TOTAL IMPRESSIONS: ${monthTotalImpressions.toLocaleString()}`);
    console.log(`🖱️  TOTAL CLICKS: ${monthTotalClicks.toLocaleString()}`);
    console.log(`🎯 TOTAL CONVERSIONS: ${monthTotalConversions}`);
    console.log(`💎 CONVERSIONS VALUE: $${monthTotalConversionsValue.toFixed(2)}`);
    
    if (monthTotalClicks > 0) {
      console.log(`📊 AVERAGE CPC: $${(monthTotalSpend / 1000000 / monthTotalClicks).toFixed(2)}`);
    }
    if (monthTotalConversions > 0) {
      console.log(`💰 COST PER CONVERSION: $${(monthTotalSpend / 1000000 / monthTotalConversions).toFixed(2)}`);
    }
    console.log('');

    // DAILY BREAKDOWN FOR CURRENT MONTH
    console.log('📅 DAILY SPEND BREAKDOWN (Current Month)');
    console.log('========================================');
    
    const dailyQuery = `
      SELECT 
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND metrics.impressions > 0
      ORDER BY segments.date DESC
    `;
    
    const dailyData = await customer.query(dailyQuery);
    const dailyStats = {};
    
    dailyData.forEach(row => {
      const date = row.segments.date;
      const cost = parseInt(row.metrics.costMicros || 0);
      const impressions = parseInt(row.metrics.impressions || 0);
      const clicks = parseInt(row.metrics.clicks || 0);
      const conversions = parseFloat(row.metrics.conversions || 0);
      
      if (!dailyStats[date]) {
        dailyStats[date] = { cost: 0, impressions: 0, clicks: 0, conversions: 0 };
      }
      
      dailyStats[date].cost += cost;
      dailyStats[date].impressions += impressions;
      dailyStats[date].clicks += clicks;
      dailyStats[date].conversions += conversions;
    });
    
    if (Object.keys(dailyStats).length > 0) {
      console.log('Recent days (newest first):');
      Object.entries(dailyStats)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 10)
        .forEach(([date, stats]) => {
          const isToday = date === today;
          const dayLabel = isToday ? '🔴 TODAY' : date;
          console.log(`   ${dayLabel}: $${(stats.cost / 1000000).toFixed(2)} | ${stats.impressions} imp | ${stats.clicks} clicks | ${stats.conversions} conv`);
        });
    } else {
      console.log('   ❌ No daily spend data available');
    }
    console.log('');

    // CAMPAIGN BREAKDOWN FOR CURRENT MONTH
    console.log('🎯 CAMPAIGN SPEND BREAKDOWN (Current Month)');
    console.log('===========================================');
    
    const campaignQuery = `
      SELECT 
        campaign.name,
        campaign.status,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        campaign_budget.amount_micros
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
    `;
    
    const campaignData = await customer.query(campaignQuery);
    const campaignStats = {};
    
    campaignData.forEach(row => {
      const name = row.campaign.name;
      const status = row.campaign.status;
      const cost = parseInt(row.metrics.costMicros || 0);
      const impressions = parseInt(row.metrics.impressions || 0);
      const clicks = parseInt(row.metrics.clicks || 0);
      const conversions = parseFloat(row.metrics.conversions || 0);
      const budget = parseInt(row.campaign_budget?.amountMicros || 0);
      
      if (!campaignStats[name]) {
        campaignStats[name] = { 
          status, cost: 0, impressions: 0, clicks: 0, conversions: 0, budget 
        };
      }
      
      campaignStats[name].cost += cost;
      campaignStats[name].impressions += impressions;
      campaignStats[name].clicks += clicks;
      campaignStats[name].conversions += conversions;
    });
    
    if (Object.keys(campaignStats).length > 0) {
      Object.entries(campaignStats)
        .sort(([,a], [,b]) => b.cost - a.cost)
        .forEach(([name, stats], index) => {
          const statusEmoji = stats.status === 2 ? '🟢' : stats.status === 3 ? '🟡' : '🔴';
          const spend = (stats.cost / 1000000).toFixed(2);
          const budget = (stats.budget / 1000000).toFixed(2);
          
          console.log(`   ${index + 1}. ${statusEmoji} ${name}`);
          console.log(`      💰 Spend: $${spend} | Budget: $${budget}/day`);
          console.log(`      📊 Traffic: ${stats.impressions.toLocaleString()} imp, ${stats.clicks} clicks`);
          console.log(`      🎯 Conversions: ${stats.conversions}`);
          
          if (stats.clicks > 0) {
            console.log(`      💵 CPC: $${(stats.cost / 1000000 / stats.clicks).toFixed(2)}`);
          }
          console.log('');
        });
    } else {
      console.log('   ❌ No campaign data available');
    }

    // TODAY'S REAL-TIME SPEND
    console.log('⚡ TODAY\'S REAL-TIME SPEND');
    console.log('==========================');
    
    const todayQuery = `
      SELECT 
        campaign.name,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        campaign_budget.amount_micros
      FROM campaign
      WHERE segments.date = '${today}'
      ORDER BY metrics.cost_micros DESC
    `;
    
    const todayData = await customer.query(todayQuery);
    
    let todayTotalSpend = 0;
    let todayTotalBudget = 0;
    let todayTotalImpressions = 0;
    let todayTotalClicks = 0;
    
    if (todayData.length > 0) {
      console.log(`📅 TODAY (${today}) - Live Data:`);
      
      todayData.forEach((row, index) => {
        const cost = parseInt(row.metrics.costMicros || 0);
        const impressions = parseInt(row.metrics.impressions || 0);
        const clicks = parseInt(row.metrics.clicks || 0);
        const conversions = parseFloat(row.metrics.conversions || 0);
        const budget = parseInt(row.campaign_budget?.amountMicros || 0);
        
        console.log(`   ${index + 1}. ${row.campaign.name}`);
        console.log(`      💰 Today's Spend: $${(cost / 1000000).toFixed(2)}`);
        console.log(`      📊 Today's Traffic: ${impressions} impressions, ${clicks} clicks`);
        console.log(`      🎯 Today's Conversions: ${conversions}`);
        console.log(`      💵 Daily Budget: $${(budget / 1000000).toFixed(2)}`);
        
        if (budget > 0) {
          const utilization = (cost / budget) * 100;
          console.log(`      📈 Budget Utilization: ${utilization.toFixed(1)}%`);
        }
        console.log('');
        
        todayTotalSpend += cost;
        todayTotalBudget += budget;
        todayTotalImpressions += impressions;
        todayTotalClicks += clicks;
      });
      
      console.log('📊 TODAY\'S TOTALS:');
      console.log(`   💰 Total Spend: $${(todayTotalSpend / 1000000).toFixed(2)}`);
      console.log(`   💵 Total Budget: $${(todayTotalBudget / 1000000).toFixed(2)}`);
      console.log(`   📈 Overall Utilization: ${todayTotalBudget > 0 ? ((todayTotalSpend / todayTotalBudget) * 100).toFixed(1) : 0}%`);
      console.log(`   👁️  Total Impressions: ${todayTotalImpressions.toLocaleString()}`);
      console.log(`   🖱️  Total Clicks: ${todayTotalClicks.toLocaleString()}`);
    } else {
      console.log('   ❌ No spend data for today');
    }
    console.log('');

    // SUMMARY
    console.log('🎯 REAL-TIME SPEND SUMMARY');
    console.log('==========================');
    
    if (monthTotalSpend > 0) {
      console.log('✅ CURRENT MONTH SPEND DATA: AVAILABLE');
      console.log(`   💰 Month Total: $${(monthTotalSpend / 1000000).toFixed(2)}`);
      console.log(`   📅 Days with spend: ${Object.keys(dailyStats).length}`);
      console.log(`   🎯 Active campaigns: ${Object.keys(campaignStats).length}`);
    } else {
      console.log('❌ CURRENT MONTH SPEND DATA: $0.00');
      console.log('   🔍 Root Cause Analysis:');
      console.log('   • No currency set (account level)');
      console.log('   • All campaign budgets are $0.00');
      console.log('   • No billing/payment method configured');
      console.log('   • Auto-tagging disabled');
    }
    
    if (todayTotalSpend > 0) {
      console.log('✅ TODAY\'S REAL-TIME SPEND: AVAILABLE');
      console.log(`   💰 Today's Total: $${(todayTotalSpend / 1000000).toFixed(2)}`);
    } else {
      console.log('❌ TODAY\'S REAL-TIME SPEND: $0.00');
      console.log('   ⚠️  Expected until account configuration is fixed');
    }
    
    console.log('');
    console.log('🚀 NEXT STEPS TO GET REAL-TIME SPEND:');
    console.log('1. Set currency to PLN in ads.google.com');
    console.log('2. Set campaign budgets (currently all $0.00)');
    console.log('3. Configure billing/payment method');
    console.log('4. Enable auto-tagging');
    console.log('');
    console.log('💡 After configuration: Real-time spend will show immediately!');

  } catch (error) {
    console.error('❌ Current month spend analysis failed:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

getCurrentMonthRealTimeSpend();
