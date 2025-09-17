#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseBillingIssueFinal() {
  console.log('🔍 FINAL GOOGLE ADS BILLING DIAGNOSIS');
  console.log('====================================\n');

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

    // TEST 1: Account Configuration (CRITICAL)
    console.log('🚨 CRITICAL TEST: Account Configuration');
    console.log('======================================');
    
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
      console.log('Account Status:');
      console.log(`   Account ID: ${account.id}`);
      console.log(`   Name: ${account.descriptiveName || '❌ NOT SET'}`);
      console.log(`   Currency: ${account.currencyCode || '❌ NOT SET'}`);
      console.log(`   Timezone: ${account.timeZone || '❌ NOT SET'}`);
      console.log(`   Auto Tagging: ${account.autoTaggingEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
      console.log(`   Test Account: ${account.testAccount ? '⚠️  YES' : '✅ NO'}`);
      console.log(`   Manager Account: ${account.manager ? 'YES' : 'NO'}`);
      
      // Critical issues identification
      const criticalIssues = [];
      if (!account.currencyCode) criticalIssues.push('NO CURRENCY SET');
      if (!account.timeZone) criticalIssues.push('NO TIMEZONE SET');
      if (!account.autoTaggingEnabled) criticalIssues.push('AUTO-TAGGING DISABLED');
      if (account.testAccount) criticalIssues.push('TEST ACCOUNT (LIMITED ACCESS)');
      
      if (criticalIssues.length > 0) {
        console.log('');
        console.log('🚨 CRITICAL ISSUES FOUND:');
        criticalIssues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue}`);
        });
      }
    }
    console.log('');

    // TEST 2: Campaign Budget Analysis (Fixed Query)
    console.log('💰 BUDGET ANALYSIS');
    console.log('==================');
    
    const budgetQuery = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros,
        campaign_budget.delivery_method
      FROM campaign
      LIMIT 15
    `;

    const budgetData = await customer.query(budgetQuery);
    console.log(`Found ${budgetData.length} campaigns:`);
    
    let totalBudget = 0;
    let activeCampaigns = 0;
    let zeroBudgetCampaigns = 0;
    
    budgetData.forEach((row, index) => {
      const campaign = row.campaign;
      const budget = row.campaign_budget;
      const budgetAmount = parseInt(budget.amountMicros || 0);
      const status = campaign.status === 2 ? 'ENABLED' : campaign.status === 3 ? 'PAUSED' : campaign.status === 4 ? 'REMOVED' : 'OTHER';
      
      console.log(`   ${index + 1}. ${campaign.name}`);
      console.log(`      Status: ${status}`);
      console.log(`      Daily Budget: $${(budgetAmount / 1000000).toFixed(2)}`);
      
      if (campaign.status === 2) activeCampaigns++;
      totalBudget += budgetAmount;
      if (budgetAmount === 0) zeroBudgetCampaigns++;
      console.log('');
    });
    
    console.log('Budget Summary:');
    console.log(`   Total Daily Budget: $${(totalBudget / 1000000).toFixed(2)}`);
    console.log(`   Active Campaigns: ${activeCampaigns}`);
    console.log(`   Zero Budget Campaigns: ${zeroBudgetCampaigns}`);
    console.log('');

    // TEST 3: Cost Data Availability Test
    console.log('📊 COST DATA AVAILABILITY TEST');
    console.log('==============================');
    
    const costTestQuery = `
      SELECT 
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '2025-05-01' AND '2025-08-27'
        AND metrics.impressions > 0
      ORDER BY segments.date DESC
      LIMIT 10
    `;

    const costData = await customer.query(costTestQuery);
    console.log(`Found ${costData.length} records with impressions:`);
    
    let hasAnyCost = false;
    costData.forEach((row, index) => {
      const metrics = row.metrics;
      const cost = parseInt(metrics.costMicros || 0);
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      
      console.log(`   ${index + 1}. Date: ${row.segments.date}`);
      console.log(`      Impressions: ${impressions}`);
      console.log(`      Clicks: ${clicks}`);
      console.log(`      Cost: $${(cost / 1000000).toFixed(2)}`);
      console.log(`      Cost Data: ${cost > 0 ? '✅ AVAILABLE' : '❌ MISSING'}`);
      
      if (cost > 0) hasAnyCost = true;
      console.log('');
    });
    
    console.log(`Cost Data Summary: ${hasAnyCost ? '✅ SOME COST DATA FOUND' : '❌ NO COST DATA FOUND'}`);
    console.log('');

    // FINAL DIAGNOSIS
    console.log('🎯 FINAL DIAGNOSIS & SOLUTION');
    console.log('=============================');
    
    console.log('ROOT CAUSE ANALYSIS:');
    
    if (accountData && accountData.length > 0) {
      const account = accountData[0].customer;
      
      if (!account.currencyCode) {
        console.log('');
        console.log('🚨 PRIMARY ISSUE: NO CURRENCY CONFIGURED');
        console.log('   Impact: Google Ads cannot track costs without currency');
        console.log('   Solution: Set account currency in Google Ads interface');
        console.log('   Priority: CRITICAL - Must fix first');
      }
      
      if (!account.timeZone) {
        console.log('');
        console.log('⚠️  SECONDARY ISSUE: NO TIMEZONE CONFIGURED');
        console.log('   Impact: Affects reporting accuracy');
        console.log('   Solution: Set account timezone');
        console.log('   Priority: HIGH');
      }
      
      if (!account.autoTaggingEnabled) {
        console.log('');
        console.log('⚠️  TRACKING ISSUE: AUTO-TAGGING DISABLED');
        console.log('   Impact: Limited conversion tracking');
        console.log('   Solution: Enable auto-tagging');
        console.log('   Priority: MEDIUM');
      }
    }
    
    if (totalBudget === 0) {
      console.log('');
      console.log('💰 BUDGET ISSUE: ALL CAMPAIGNS HAVE $0 BUDGET');
      console.log('   Impact: No ads can run, no costs incurred');
      console.log('   Solution: Set daily budgets for campaigns');
      console.log('   Priority: CRITICAL');
    }
    
    console.log('');
    console.log('📋 STEP-BY-STEP FIX INSTRUCTIONS:');
    console.log('=================================');
    console.log('');
    console.log('1. 🌐 LOGIN TO GOOGLE ADS');
    console.log('   - Go to: https://ads.google.com');
    console.log('   - Login with account that has access to Customer ID: 789-260-9395');
    console.log('');
    console.log('2. ⚙️  FIX ACCOUNT SETTINGS');
    console.log('   - Click Settings → Account Settings');
    console.log('   - Set Currency (e.g., USD, EUR, PLN)');
    console.log('   - Set Timezone (e.g., Europe/Warsaw)');
    console.log('   - Enable Auto-tagging');
    console.log('');
    console.log('3. 💳 CHECK BILLING & PAYMENTS');
    console.log('   - Go to Tools & Settings → Billing');
    console.log('   - Verify payment method is active');
    console.log('   - Check account balance');
    console.log('   - Resolve any payment issues');
    console.log('');
    console.log('4. 💰 SET CAMPAIGN BUDGETS');
    console.log('   - Go to Campaigns');
    console.log('   - Set daily budgets > $0 for active campaigns');
    console.log('   - Start with small budgets (e.g., $10-50/day)');
    console.log('');
    console.log('5. ✅ VERIFY FIX');
    console.log('   - Wait 24-48 hours for data to populate');
    console.log('   - Run: node scripts/extract-real-belmonte-data.js');
    console.log('   - Check if cost data appears');
    
    console.log('');
    console.log('🎯 EXPECTED OUTCOME:');
    console.log('   After fixing these issues, you should see:');
    console.log('   - Cost data in API responses');
    console.log('   - Proper CPC calculations');
    console.log('   - Budget utilization tracking');
    console.log('   - Complete financial reporting');

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

diagnoseBillingIssueFinal();
