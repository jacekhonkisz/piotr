#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getBelmonteData() {
  console.log('📊 Fetching Complete Google Ads Data for Belmonte');
  console.log('================================================\n');

  try {
    // Get credentials
    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret', 
        'google_ads_developer_token',
        'google_ads_manager_refresh_token'
      ]);

    if (settingsError) throw settingsError;

    const creds = {};
    settings?.forEach(setting => {
      creds[setting.key] = setting.value;
    });

    // Get Belmonte client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .single();

    if (clientError) throw clientError;

    console.log('🏨 Client Information:');
    console.log(`   Name: ${client.name}`);
    console.log(`   Email: ${client.email}`);
    console.log(`   Google Ads Customer ID: ${client.google_ads_customer_id}`);
    console.log('');

    // Initialize Google Ads API
    const googleAdsClient = new GoogleAdsApi({
      client_id: creds.google_ads_client_id,
      client_secret: creds.google_ads_client_secret,
      developer_token: creds.google_ads_developer_token
    });

    const customer = googleAdsClient.Customer({
      customer_id: client.google_ads_customer_id.replace(/-/g, ''),
      refresh_token: creds.google_ads_manager_refresh_token
    });

    console.log('✅ Google Ads API client initialized');
    console.log('');

    // Get date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];
    
    console.log(`📅 Date Range: ${dateStart} to ${dateEnd}`);
    console.log('');

    // 1. Get Customer Info
    console.log('🔍 Fetching Customer Information...');
    const customerQuery = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;

    const customerData = await customer.query(customerQuery);
    if (customerData && customerData.length > 0) {
      const custInfo = customerData[0].customer;
      console.log('✅ Customer Details:');
      console.log(`   ID: ${custInfo.id}`);
      console.log(`   Name: ${custInfo.descriptiveName || 'Not set'}`);
      console.log(`   Currency: ${custInfo.currencyCode || 'Not set'}`);
      console.log(`   Timezone: ${custInfo.timeZone || 'Not set'}`);
    }
    console.log('');

    // 2. Get Campaign Data with Metrics
    console.log('📈 Fetching Campaign Data with Metrics...');
    const campaignQuery = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
      ORDER BY metrics.impressions DESC
    `;

    const campaigns = await customer.query(campaignQuery);
    
    console.log(`✅ Found ${campaigns.length} campaigns with data`);
    console.log('');

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalCost = 0;
    let totalConversions = 0;
    let totalConversionsValue = 0;

    campaigns.forEach((row, index) => {
      const campaign = row.campaign;
      const metrics = row.metrics;
      
      console.log(`${index + 1}. ${campaign.name}`);
      console.log(`   Campaign ID: ${campaign.id}`);
      console.log(`   Status: ${campaign.status === 2 ? 'ENABLED' : campaign.status === 3 ? 'PAUSED' : 'OTHER'}`);
      console.log(`   Type: ${campaign.advertisingChannelType || 'Unknown'}`);
      console.log(`   Impressions: ${metrics.impressions?.toLocaleString() || 0}`);
      console.log(`   Clicks: ${metrics.clicks?.toLocaleString() || 0}`);
      console.log(`   Cost: $${metrics.costMicros ? (metrics.costMicros / 1000000).toFixed(2) : '0.00'}`);
      console.log(`   CTR: ${metrics.ctr ? (metrics.ctr * 100).toFixed(2) + '%' : '0.00%'}`);
      console.log(`   Avg CPC: $${metrics.averageCpc ? (metrics.averageCpc / 1000000).toFixed(2) : '0.00'}`);
      console.log(`   Conversions: ${metrics.conversions || 0}`);
      console.log(`   Conversions Value: $${metrics.conversionsValue ? metrics.conversionsValue.toFixed(2) : '0.00'}`);
      const campaignClicks = parseInt(metrics.clicks || 0);
      const campaignConversions = parseFloat(metrics.conversions || 0);
      const conversionRate = campaignClicks > 0 ? (campaignConversions / campaignClicks) * 100 : 0;
      console.log(`   Conversion Rate: ${conversionRate.toFixed(2)}%`);
      console.log('');

      // Add to totals
      totalImpressions += parseInt(metrics.impressions || 0);
      totalClicks += parseInt(metrics.clicks || 0);
      totalCost += parseInt(metrics.costMicros || 0);
      totalConversions += parseFloat(metrics.conversions || 0);
      totalConversionsValue += parseFloat(metrics.conversionsValue || 0);
    });

    // 3. Summary
    console.log('📊 ACCOUNT SUMMARY (Last 30 Days):');
    console.log('==================================');
    console.log(`Total Campaigns: ${campaigns.length}`);
    console.log(`Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`Total Clicks: ${totalClicks.toLocaleString()}`);
    console.log(`Total Cost: $${(totalCost / 1000000).toFixed(2)}`);
    console.log(`Overall CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0.00%'}`);
    console.log(`Average CPC: $${totalClicks > 0 ? ((totalCost / totalClicks) / 1000000).toFixed(2) : '0.00'}`);
    console.log(`Total Conversions: ${totalConversions.toFixed(1)}`);
    console.log(`Total Conversions Value: $${totalConversionsValue.toFixed(2)}`);
    console.log(`Overall Conversion Rate: ${totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) + '%' : '0.00%'}`);
    console.log(`Cost Per Conversion: $${totalConversions > 0 ? ((totalCost / 1000000) / totalConversions).toFixed(2) : '0.00'}`);
    console.log(`ROAS: ${totalConversionsValue > 0 ? (totalConversionsValue / (totalCost / 1000000)).toFixed(2) : '0.00'}`);

  } catch (error) {
    console.error('❌ Error fetching data:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

getBelmonteData();
