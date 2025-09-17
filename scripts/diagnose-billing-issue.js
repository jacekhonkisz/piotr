#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseBillingIssue() {
  console.log('🔍 COMPREHENSIVE GOOGLE ADS BILLING DIAGNOSIS');
  console.log('=============================================\n');

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

    // TEST 1: Account Status and Billing Setup
    console.log('🧪 TEST 1: Account Status & Billing Configuration');
    console.log('================================================');
    
    const accountStatusQuery = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.pay_per_conversion_eligibility_failure_reasons,
        customer.optimization_score,
        customer.resource_name
      FROM customer
      LIMIT 1
    `;

    const accountStatus = await customer.query(accountStatusQuery);
    if (accountStatus && accountStatus.length > 0) {
      const account = accountStatus[0].customer;
      console.log('Account Configuration:');
      console.log(`   Account ID: ${account.id}`);
      console.log(`   Name: ${account.descriptiveName || '❌ NOT SET'}`);
      console.log(`   Currency: ${account.currencyCode || '❌ NOT SET'}`);
      console.log(`   Timezone: ${account.timeZone || '❌ NOT SET'}`);
      console.log(`   Optimization Score: ${account.optimizationScore || 'Not available'}`);
      console.log(`   Pay-per-conversion Issues: ${account.payPerConversionEligibilityFailureReasons || 'None'}`);
      
      if (!account.currencyCode) {
        console.log('');
        console.log('🚨 CRITICAL ISSUE: Currency not configured!');
        console.log('   This is likely causing the $0.00 cost issue');
      }
    }
    console.log('');

    // TEST 2: Billing Account Information
    console.log('🧪 TEST 2: Billing Account Information');
    console.log('=====================================');
    
    try {
      const billingQuery = `
        SELECT 
          billing_setup.id,
          billing_setup.status,
          billing_setup.payments_account,
          billing_setup.payments_account_info.payments_account_id,
          billing_setup.payments_account_info.payments_account_name,
          billing_setup.payments_profile_id,
          billing_setup.payments_profile_name,
          billing_setup.secondary_payments_profile_id
        FROM billing_setup
        LIMIT 5
      `;

      const billingInfo = await customer.query(billingQuery);
      if (billingInfo && billingInfo.length > 0) {
        console.log(`Found ${billingInfo.length} billing setup(s):`);
        billingInfo.forEach((row, index) => {
          const billing = row.billing_setup;
          console.log(`   ${index + 1}. Billing Setup ID: ${billing.id}`);
          console.log(`      Status: ${billing.status === 2 ? 'APPROVED' : billing.status === 3 ? 'CANCELLED' : billing.status === 1 ? 'PENDING' : 'UNKNOWN'}`);
          console.log(`      Payments Account: ${billing.paymentsAccount || 'Not set'}`);
          console.log(`      Payments Profile: ${billing.paymentsProfileName || 'Not set'}`);
        });
      } else {
        console.log('❌ NO BILLING SETUP FOUND');
        console.log('   This explains the $0.00 cost issue');
      }
    } catch (error) {
      console.log(`❌ Cannot access billing information: ${error.message}`);
      console.log('   This might indicate API access limitations');
    }
    console.log('');

    // TEST 3: Campaign Budget Information
    console.log('🧪 TEST 3: Campaign Budget Configuration');
    console.log('=======================================');
    
    const budgetQuery = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros,
        campaign_budget.delivery_method,
        campaign_budget.explicitly_shared,
        campaign_budget.reference_count,
        campaign_budget.status
      FROM campaign
      WHERE campaign.status IN (2, 3)
      ORDER BY campaign_budget.amount_micros DESC
      LIMIT 10
    `;

    const budgetInfo = await customer.query(budgetQuery);
    console.log(`Campaign Budget Analysis (${budgetInfo.length} campaigns):`);
    
    let totalBudget = 0;
    let zeroBudgetCampaigns = 0;
    
    budgetInfo.forEach((row, index) => {
      const campaign = row.campaign;
      const budget = row.campaign_budget;
      const budgetAmount = parseInt(budget.amountMicros || 0);
      
      console.log(`   ${index + 1}. ${campaign.name}`);
      console.log(`      Status: ${campaign.status === 2 ? 'ENABLED' : campaign.status === 3 ? 'PAUSED' : 'OTHER'}`);
      console.log(`      Budget: $${(budgetAmount / 1000000).toFixed(2)} per day`);
      console.log(`      Delivery: ${budget.deliveryMethod === 2 ? 'STANDARD' : budget.deliveryMethod === 3 ? 'ACCELERATED' : 'UNKNOWN'}`);
      console.log(`      Shared: ${budget.explicitlyShared ? 'Yes' : 'No'}`);
      console.log(`      Budget Status: ${budget.status === 2 ? 'ENABLED' : 'OTHER'}`);
      
      totalBudget += budgetAmount;
      if (budgetAmount === 0) {
        zeroBudgetCampaigns++;
      }
      console.log('');
    });
    
    console.log('Budget Summary:');
    console.log(`   Total Daily Budget: $${(totalBudget / 1000000).toFixed(2)}`);
    console.log(`   Campaigns with $0 budget: ${zeroBudgetCampaigns}/${budgetInfo.length}`);
    
    if (zeroBudgetCampaigns > 0) {
      console.log('');
      console.log('🚨 ISSUE FOUND: Campaigns with $0 budget detected!');
    }
    console.log('');

    // TEST 4: Historical Cost Data Availability
    console.log('🧪 TEST 4: Historical Cost Data Analysis');
    console.log('=======================================');
    
    const dateRanges = [
      { name: 'Last 7 days', days: 7 },
      { name: 'Last 30 days', days: 30 },
      { name: 'Last 90 days', days: 90 },
      { name: 'Last 365 days', days: 365 }
    ];

    for (const range of dateRanges) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - range.days);
      
      const dateStart = startDate.toISOString().split('T')[0];
      const dateEnd = endDate.toISOString().split('T')[0];
      
      const costQuery = `
        SELECT 
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks
        FROM customer
        WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
      `;

      try {
        const costData = await customer.query(costQuery);
        if (costData && costData.length > 0) {
          const metrics = costData[0].metrics;
          const cost = parseInt(metrics.costMicros || 0);
          const impressions = parseInt(metrics.impressions || 0);
          const clicks = parseInt(metrics.clicks || 0);
          
          console.log(`${range.name}:`);
          console.log(`   Cost: $${(cost / 1000000).toFixed(2)}`);
          console.log(`   Impressions: ${impressions.toLocaleString()}`);
          console.log(`   Clicks: ${clicks.toLocaleString()}`);
          console.log(`   Cost Available: ${cost > 0 ? '✅ YES' : '❌ NO'}`);
        }
      } catch (error) {
        console.log(`${range.name}: Error - ${error.message}`);
      }
    }
    console.log('');

    // TEST 5: API Access Level Check
    console.log('🧪 TEST 5: API Access Level & Permissions');
    console.log('=========================================');
    
    try {
      const accessQuery = `
        SELECT 
          customer.test_account,
          customer.manager,
          customer.auto_tagging_enabled,
          customer.conversion_tracking_setting.conversion_tracking_id
        FROM customer
      `;

      const accessInfo = await customer.query(accessQuery);
      if (accessInfo && accessInfo.length > 0) {
        const account = accessInfo[0].customer;
        console.log('Account Access Information:');
        console.log(`   Test Account: ${account.testAccount ? '⚠️  YES (Limited access)' : '✅ NO (Full access)'}`);
        console.log(`   Manager Account: ${account.manager ? 'YES' : 'NO'}`);
        console.log(`   Auto Tagging: ${account.autoTaggingEnabled ? 'ENABLED' : '❌ DISABLED'}`);
        console.log(`   Conversion Tracking: ${account.conversionTrackingSetting?.conversionTrackingId ? 'CONFIGURED' : '❌ NOT CONFIGURED'}`);
        
        if (account.testAccount) {
          console.log('');
          console.log('🚨 CRITICAL: This is a TEST ACCOUNT');
          console.log('   Test accounts may have limited cost data access');
        }
      }
    } catch (error) {
      console.log(`Cannot determine account access level: ${error.message}`);
    }
    console.log('');

    // DIAGNOSIS SUMMARY
    console.log('📋 DIAGNOSIS SUMMARY & SOLUTIONS');
    console.log('================================');
    
    console.log('🔍 Issues Identified:');
    
    // Check for common issues
    const issues = [];
    const solutions = [];
    
    if (accountStatus && accountStatus.length > 0) {
      const account = accountStatus[0].customer;
      
      if (!account.currencyCode) {
        issues.push('Currency not configured');
        solutions.push('Set account currency in Google Ads interface');
      }
      
      if (!account.timeZone) {
        issues.push('Timezone not configured');
        solutions.push('Set account timezone in Google Ads interface');
      }
    }
    
    if (zeroBudgetCampaigns > 0) {
      issues.push(`${zeroBudgetCampaigns} campaigns have $0 budget`);
      solutions.push('Set proper daily budgets for campaigns');
    }
    
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
    
    console.log('');
    console.log('🛠️  Recommended Solutions:');
    solutions.forEach((solution, index) => {
      console.log(`   ${index + 1}. ${solution}`);
    });
    
    console.log('');
    console.log('🚨 IMMEDIATE ACTIONS REQUIRED:');
    console.log('1. Log into Google Ads interface (ads.google.com)');
    console.log('2. Go to Settings → Account Settings');
    console.log('3. Configure Currency (if not set)');
    console.log('4. Configure Timezone (if not set)');
    console.log('5. Check Billing & Payments section');
    console.log('6. Verify payment method is active');
    console.log('7. Set campaign budgets > $0');
    console.log('8. Enable auto-tagging for better tracking');

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

diagnoseBillingIssue();
