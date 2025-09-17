#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCurrentStatus() {
  console.log('🔍 CHECKING CURRENT GOOGLE ADS CONFIGURATION STATUS');
  console.log('==================================================\n');

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

    // CHECK 1: Account Configuration
    console.log('1️⃣ ACCOUNT CONFIGURATION CHECK');
    console.log('==============================');
    
    const accountQuery = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.auto_tagging_enabled,
        customer.test_account,
        customer.manager
      FROM customer
      LIMIT 1
    `;

    const accountData = await customer.query(accountQuery);
    if (accountData && accountData.length > 0) {
      const account = accountData[0].customer;
      
      console.log('Account Settings:');
      console.log(`   Account Name: ${account.descriptiveName || '❌ NOT SET'} ${account.descriptiveName ? '✅' : '❌'}`);
      console.log(`   Currency: ${account.currencyCode || '❌ NOT SET'} ${account.currencyCode ? '✅' : '❌'}`);
      console.log(`   Timezone: ${account.timeZone || '❌ NOT SET'} ${account.timeZone ? '✅' : '❌'}`);
      console.log(`   Auto-tagging: ${account.autoTaggingEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
      console.log(`   Test Account: ${account.testAccount ? 'YES ⚠️' : 'NO ✅'}`);
      console.log(`   Manager Account: ${account.manager ? 'YES' : 'NO'}`);
      
      // Count configured items
      let configuredItems = 0;
      let totalItems = 4;
      
      if (account.descriptiveName) configuredItems++;
      if (account.currencyCode) configuredItems++;
      if (account.timeZone) configuredItems++;
      if (account.autoTaggingEnabled) configuredItems++;
      
      console.log(`   Configuration Status: ${configuredItems}/${totalItems} items configured`);
    }
    console.log('');

    // CHECK 2: Campaign Status and Budgets
    console.log('2️⃣ CAMPAIGN BUDGET CHECK');
    console.log('========================');
    
    const campaignQuery = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros,
        campaign_budget.delivery_method
      FROM campaign
      ORDER BY campaign.status, campaign_budget.amount_micros DESC
    `;

    const campaignData = await customer.query(campaignQuery);
    
    let enabledCampaigns = 0;
    let pausedCampaigns = 0;
    let removedCampaigns = 0;
    let campaignsWithBudget = 0;
    let totalBudget = 0;
    
    console.log('Campaign Status Summary:');
    campaignData.forEach((row, index) => {
      const campaign = row.campaign;
      const budget = row.campaign_budget;
      const budgetAmount = parseInt(budget.amountMicros || 0);
      const status = campaign.status === 2 ? 'ENABLED' : campaign.status === 3 ? 'PAUSED' : campaign.status === 4 ? 'REMOVED' : 'OTHER';
      
      if (campaign.status === 2) enabledCampaigns++;
      else if (campaign.status === 3) pausedCampaigns++;
      else if (campaign.status === 4) removedCampaigns++;
      
      if (budgetAmount > 0) campaignsWithBudget++;
      totalBudget += budgetAmount;
      
      // Only show first 5 campaigns to avoid clutter
      if (index < 5) {
        console.log(`   ${index + 1}. ${campaign.name}`);
        console.log(`      Status: ${status} ${campaign.status === 2 ? '✅' : campaign.status === 3 ? '⏸️' : '❌'}`);
        console.log(`      Budget: $${(budgetAmount / 1000000).toFixed(2)}/day ${budgetAmount > 0 ? '✅' : '❌'}`);
        console.log('');
      }
    });
    
    console.log('Campaign Summary:');
    console.log(`   Total Campaigns: ${campaignData.length}`);
    console.log(`   Enabled: ${enabledCampaigns} ${enabledCampaigns > 0 ? '✅' : '❌'}`);
    console.log(`   Paused: ${pausedCampaigns}`);
    console.log(`   Removed: ${removedCampaigns}`);
    console.log(`   With Budget > $0: ${campaignsWithBudget}/${campaignData.length} ${campaignsWithBudget > 0 ? '✅' : '❌'}`);
    console.log(`   Total Daily Budget: $${(totalBudget / 1000000).toFixed(2)} ${totalBudget > 0 ? '✅' : '❌'}`);
    console.log('');

    // CHECK 3: Recent Cost Data
    console.log('3️⃣ COST DATA AVAILABILITY CHECK');
    console.log('===============================');
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];

    const costQuery = `
      SELECT 
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
      ORDER BY segments.date DESC
      LIMIT 3
    `;

    const costData = await customer.query(costQuery);
    
    let totalCost = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let daysWithCost = 0;
    
    console.log('Recent Activity (Last 7 days):');
    if (costData.length > 0) {
      costData.forEach((row, index) => {
        const cost = parseInt(row.metrics.costMicros || 0);
        const impressions = parseInt(row.metrics.impressions || 0);
        const clicks = parseInt(row.metrics.clicks || 0);
        
        console.log(`   ${row.segments.date}:`);
        console.log(`      Impressions: ${impressions.toLocaleString()}`);
        console.log(`      Clicks: ${clicks.toLocaleString()}`);
        console.log(`      Cost: $${(cost / 1000000).toFixed(2)} ${cost > 0 ? '✅' : '❌'}`);
        
        totalCost += cost;
        totalImpressions += impressions;
        totalClicks += clicks;
        if (cost > 0) daysWithCost++;
      });
    } else {
      console.log('   ❌ No recent activity found');
    }
    
    console.log('');
    console.log('Cost Data Summary:');
    console.log(`   Total Cost (7 days): $${(totalCost / 1000000).toFixed(2)} ${totalCost > 0 ? '✅' : '❌'}`);
    console.log(`   Days with cost data: ${daysWithCost}/${costData.length} ${daysWithCost > 0 ? '✅' : '❌'}`);
    console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`   Total Clicks: ${totalClicks.toLocaleString()}`);
    console.log('');

    // FINAL STATUS SUMMARY
    console.log('📊 OVERALL STATUS SUMMARY');
    console.log('=========================');
    
    const account = accountData[0]?.customer;
    const statusItems = [
      { name: 'Account Name', status: !!account?.descriptiveName, critical: false },
      { name: 'Currency', status: !!account?.currencyCode, critical: true },
      { name: 'Timezone', status: !!account?.timeZone, critical: true },
      { name: 'Auto-tagging', status: !!account?.autoTaggingEnabled, critical: false },
      { name: 'Active Campaigns', status: enabledCampaigns > 0, critical: true },
      { name: 'Campaign Budgets', status: campaignsWithBudget > 0, critical: true },
      { name: 'Cost Data', status: totalCost > 0, critical: true }
    ];
    
    const configured = statusItems.filter(item => item.status).length;
    const critical = statusItems.filter(item => item.critical && !item.status).length;
    
    console.log('Configuration Checklist:');
    statusItems.forEach((item, index) => {
      const icon = item.status ? '✅' : '❌';
      const priority = item.critical ? ' (CRITICAL)' : '';
      console.log(`   ${index + 1}. ${item.name}: ${icon}${priority}`);
    });
    
    console.log('');
    console.log(`Overall Progress: ${configured}/${statusItems.length} items configured`);
    
    if (critical === 0) {
      console.log('🎉 SUCCESS: All critical items are configured!');
      console.log('   Your Google Ads integration should be working properly.');
    } else {
      console.log(`⚠️  ATTENTION: ${critical} critical items need configuration:`);
      statusItems.filter(item => item.critical && !item.status).forEach(item => {
        console.log(`   - ${item.name}`);
      });
    }
    
    console.log('');
    console.log('🔧 NEXT STEPS:');
    if (critical === 0) {
      console.log('   ✅ Configuration appears complete!');
      console.log('   ✅ Run data extraction to verify everything is working');
      console.log('   📊 Command: node scripts/extract-real-belmonte-data.js');
    } else {
      console.log('   🌐 Login to Google Ads: https://ads.google.com');
      console.log('   ⚙️  Go to Settings → Account Settings');
      console.log('   🔧 Fix the remaining critical items listed above');
    }

  } catch (error) {
    console.error('❌ Status check failed:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

checkCurrentStatus();
