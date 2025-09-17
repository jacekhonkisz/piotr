#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyBillingFix() {
  console.log('✅ VERIFYING GOOGLE ADS BILLING FIX');
  console.log('==================================\n');

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

    console.log('🔍 VERIFICATION CHECKLIST');
    console.log('=========================');

    // Check 1: Account Configuration
    const accountQuery = `
      SELECT 
        customer.currency_code,
        customer.time_zone,
        customer.auto_tagging_enabled,
        customer.descriptive_name
      FROM customer
    `;

    const accountData = await customer.query(accountQuery);
    if (accountData && accountData.length > 0) {
      const account = accountData[0].customer;
      
      console.log('1. Account Configuration:');
      console.log(`   ✅ Currency: ${account.currencyCode ? account.currencyCode : '❌ STILL NOT SET'}`);
      console.log(`   ✅ Timezone: ${account.timeZone ? account.timeZone : '❌ STILL NOT SET'}`);
      console.log(`   ✅ Auto-tagging: ${account.autoTaggingEnabled ? 'ENABLED' : '❌ STILL DISABLED'}`);
      console.log(`   ✅ Account Name: ${account.descriptiveName ? account.descriptiveName : '❌ STILL NOT SET'}`);
    }
    console.log('');

    // Check 2: Campaign Budgets
    const budgetQuery = `
      SELECT 
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros
      FROM campaign
      WHERE campaign.status = 2
      LIMIT 10
    `;

    const budgetData = await customer.query(budgetQuery);
    console.log('2. Active Campaign Budgets:');
    
    let activeBudgets = 0;
    budgetData.forEach((row, index) => {
      const budget = parseInt(row.campaign_budget.amountMicros || 0);
      const dailyBudget = (budget / 1000000).toFixed(2);
      
      console.log(`   ${index + 1}. ${row.campaign.name}`);
      console.log(`      Budget: $${dailyBudget} ${budget > 0 ? '✅' : '❌'}`);
      
      if (budget > 0) activeBudgets++;
    });
    
    console.log(`   Active budgets: ${activeBudgets}/${budgetData.length}`);
    console.log('');

    // Check 3: Recent Cost Data
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
      LIMIT 5
    `;

    const costData = await customer.query(costQuery);
    console.log('3. Recent Cost Data (Last 7 days):');
    
    let hasCostData = false;
    if (costData.length > 0) {
      costData.forEach((row, index) => {
        const cost = parseInt(row.metrics.costMicros || 0);
        const costDollars = (cost / 1000000).toFixed(2);
        
        console.log(`   ${index + 1}. ${row.segments.date}`);
        console.log(`      Cost: $${costDollars} ${cost > 0 ? '✅' : '❌'}`);
        console.log(`      Impressions: ${row.metrics.impressions}`);
        console.log(`      Clicks: ${row.metrics.clicks}`);
        
        if (cost > 0) hasCostData = true;
      });
    } else {
      console.log('   ❌ No recent data found');
    }
    
    console.log(`   Cost data available: ${hasCostData ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // Final Status
    console.log('🎯 VERIFICATION SUMMARY');
    console.log('======================');
    
    const account = accountData[0]?.customer;
    const issuesFixed = [];
    const issuesRemaining = [];
    
    if (account?.currencyCode) {
      issuesFixed.push('Currency configured');
    } else {
      issuesRemaining.push('Currency still not set');
    }
    
    if (account?.timeZone) {
      issuesFixed.push('Timezone configured');
    } else {
      issuesRemaining.push('Timezone still not set');
    }
    
    if (account?.autoTaggingEnabled) {
      issuesFixed.push('Auto-tagging enabled');
    } else {
      issuesRemaining.push('Auto-tagging still disabled');
    }
    
    if (activeBudgets > 0) {
      issuesFixed.push(`${activeBudgets} campaigns have budgets`);
    } else {
      issuesRemaining.push('No campaign budgets set');
    }
    
    if (hasCostData) {
      issuesFixed.push('Cost data is now available');
    } else {
      issuesRemaining.push('Cost data still missing');
    }
    
    console.log('✅ Issues Fixed:');
    if (issuesFixed.length > 0) {
      issuesFixed.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    } else {
      console.log('   None yet');
    }
    
    console.log('');
    console.log('❌ Issues Remaining:');
    if (issuesRemaining.length > 0) {
      issuesRemaining.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    } else {
      console.log('   None! 🎉');
    }
    
    console.log('');
    if (issuesRemaining.length === 0) {
      console.log('🎉 SUCCESS! All billing issues have been resolved!');
      console.log('   Cost data should now be available in all reports.');
    } else {
      console.log('⚠️  Still need to complete the remaining fixes.');
      console.log('   Please follow the instructions from the diagnosis script.');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

verifyBillingFix();
