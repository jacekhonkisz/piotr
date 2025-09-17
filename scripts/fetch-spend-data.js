#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchSpendData() {
  console.log('💰 FETCHING GOOGLE ADS SPEND DATA FOR BELMONTE');
  console.log('==============================================\n');

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

    console.log('🏨 CLIENT: Belmonte Hotel');
    console.log(`🆔 CUSTOMER ID: ${client.google_ads_customer_id}`);
    console.log('');

    // TEST 1: Try different spend/cost field variations
    console.log('🧪 TEST 1: Different Spend Field Variations');
    console.log('===========================================');
    
    const spendFields = [
      'metrics.cost_micros',
      'metrics.spend_micros', 
      'metrics.total_cost_micros',
      'metrics.cost',
      'metrics.spend'
    ];

    for (const field of spendFields) {
      try {
        console.log(`Testing field: ${field}`);
        
        const testQuery = `
          SELECT 
            campaign.name,
            ${field},
            metrics.impressions,
            metrics.clicks
          FROM campaign
          WHERE segments.date BETWEEN '2025-05-01' AND '2025-08-27'
            AND metrics.impressions > 0
          ORDER BY metrics.impressions DESC
          LIMIT 3
        `;

        const testData = await customer.query(testQuery);
        
        if (testData && testData.length > 0) {
          console.log(`   ✅ Field ${field} works:`);
          testData.forEach((row, index) => {
            const fieldValue = row.metrics[field.split('.')[1]];
            console.log(`      ${index + 1}. ${row.campaign.name}`);
            console.log(`         ${field}: ${fieldValue}`);
            console.log(`         Impressions: ${row.metrics.impressions}`);
            console.log(`         Clicks: ${row.metrics.clicks}`);
          });
        } else {
          console.log(`   ❌ Field ${field}: No data`);
        }
        console.log('');
        
      } catch (error) {
        console.log(`   ❌ Field ${field}: Error - ${error.message}`);
        console.log('');
      }
    }

    // TEST 2: Account-level spend data
    console.log('🧪 TEST 2: Account-Level Spend Data');
    console.log('==================================');
    
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
      
      try {
        const accountSpendQuery = `
          SELECT 
            metrics.cost_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions
          FROM customer
          WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        `;

        const accountData = await customer.query(accountSpendQuery);
        
        if (accountData && accountData.length > 0) {
          const metrics = accountData[0].metrics;
          const cost = parseInt(metrics.costMicros || 0);
          const impressions = parseInt(metrics.impressions || 0);
          const clicks = parseInt(metrics.clicks || 0);
          const conversions = parseFloat(metrics.conversions || 0);
          
          console.log(`${range.name}:`);
          console.log(`   Cost: $${(cost / 1000000).toFixed(2)} ${cost > 0 ? '✅' : '❌'}`);
          console.log(`   Impressions: ${impressions.toLocaleString()}`);
          console.log(`   Clicks: ${clicks.toLocaleString()}`);
          console.log(`   Conversions: ${conversions.toFixed(1)}`);
          console.log(`   Raw cost_micros: ${metrics.costMicros || 'undefined'}`);
        }
      } catch (error) {
        console.log(`${range.name}: Error - ${error.message}`);
      }
      console.log('');
    }

    // TEST 3: Campaign-level spend with detailed breakdown
    console.log('🧪 TEST 3: Campaign-Level Spend Analysis');
    console.log('========================================');
    
    const campaignSpendQuery = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        segments.date
      FROM campaign
      WHERE segments.date BETWEEN '2025-07-01' AND '2025-08-27'
        AND metrics.impressions > 0
      ORDER BY metrics.impressions DESC
      LIMIT 10
    `;

    const campaignSpendData = await customer.query(campaignSpendQuery);
    
    console.log(`Found ${campaignSpendData.length} campaign records with impressions:`);
    console.log('');
    
    let totalSpend = 0;
    let recordsWithSpend = 0;
    
    campaignSpendData.forEach((row, index) => {
      const campaign = row.campaign;
      const metrics = row.metrics;
      const budget = row.campaign_budget;
      
      const cost = parseInt(metrics.costMicros || 0);
      const budgetAmount = parseInt(budget.amountMicros || 0);
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      
      console.log(`${index + 1}. ${campaign.name}`);
      console.log(`   Date: ${row.segments.date}`);
      console.log(`   Status: ${campaign.status === 2 ? 'ENABLED' : campaign.status === 3 ? 'PAUSED' : 'OTHER'}`);
      console.log(`   Daily Budget: $${(budgetAmount / 1000000).toFixed(2)}`);
      console.log(`   Spend: $${(cost / 1000000).toFixed(2)} ${cost > 0 ? '✅' : '❌'}`);
      console.log(`   Impressions: ${impressions.toLocaleString()}`);
      console.log(`   Clicks: ${clicks.toLocaleString()}`);
      console.log(`   Raw cost_micros: ${metrics.costMicros || 'undefined'}`);
      
      totalSpend += cost;
      if (cost > 0) recordsWithSpend++;
      console.log('');
    });
    
    console.log('Spend Summary:');
    console.log(`   Total Spend: $${(totalSpend / 1000000).toFixed(2)}`);
    console.log(`   Records with spend: ${recordsWithSpend}/${campaignSpendData.length}`);
    console.log(`   Spend data available: ${totalSpend > 0 ? '✅ YES' : '❌ NO'}`);
    console.log('');

    // TEST 4: Alternative spend queries
    console.log('🧪 TEST 4: Alternative Spend Query Methods');
    console.log('==========================================');
    
    // Try billing account query
    try {
      console.log('Testing billing account access...');
      const billingQuery = `
        SELECT 
          billing_setup.id,
          billing_setup.status
        FROM billing_setup
        LIMIT 1
      `;
      
      const billingData = await customer.query(billingQuery);
      if (billingData && billingData.length > 0) {
        console.log('✅ Billing setup accessible');
        console.log(`   Billing ID: ${billingData[0].billing_setup.id}`);
        console.log(`   Status: ${billingData[0].billing_setup.status}`);
      } else {
        console.log('❌ No billing setup found');
      }
    } catch (error) {
      console.log(`❌ Billing access error: ${error.message}`);
    }
    console.log('');

    // Try invoice data
    try {
      console.log('Testing invoice data access...');
      const invoiceQuery = `
        SELECT 
          invoice.id,
          invoice.type,
          invoice.billing_setup,
          invoice.payments_account_id
        FROM invoice
        LIMIT 1
      `;
      
      const invoiceData = await customer.query(invoiceQuery);
      if (invoiceData && invoiceData.length > 0) {
        console.log('✅ Invoice data accessible');
        console.log(`   Invoice ID: ${invoiceData[0].invoice.id}`);
      } else {
        console.log('❌ No invoice data found');
      }
    } catch (error) {
      console.log(`❌ Invoice access error: ${error.message}`);
    }
    console.log('');

    // FINAL DIAGNOSIS
    console.log('🎯 SPEND DATA DIAGNOSIS');
    console.log('=======================');
    
    if (totalSpend > 0) {
      console.log('✅ SPEND DATA FOUND!');
      console.log(`   Total spend detected: $${(totalSpend / 1000000).toFixed(2)}`);
      console.log('   The integration can access spend data');
    } else {
      console.log('❌ NO SPEND DATA FOUND');
      console.log('   Possible reasons:');
      console.log('   1. Account currency not configured');
      console.log('   2. Campaign budgets are $0');
      console.log('   3. No actual spending occurred');
      console.log('   4. Billing setup incomplete');
      console.log('   5. API access limitations');
    }
    
    console.log('');
    console.log('💡 RECOMMENDATIONS:');
    console.log('   1. Configure account currency first');
    console.log('   2. Set campaign budgets > $0');
    console.log('   3. Wait 24-48 hours for spend data to appear');
    console.log('   4. Re-run this script to verify spend data');

  } catch (error) {
    console.error('❌ Spend data fetch failed:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

fetchSpendData();
