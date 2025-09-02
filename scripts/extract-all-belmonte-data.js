#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function extractAllBelmonteData() {
  console.log('🔍 EXTRACTING ALL AVAILABLE GOOGLE ADS DATA FOR BELMONTE');
  console.log('========================================================\n');

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

    console.log('🏨 CLIENT INFORMATION');
    console.log('====================');
    console.log(`Name: ${client.name}`);
    console.log(`Email: ${client.email}`);
    console.log(`Google Ads Customer ID: ${client.google_ads_customer_id}`);
    console.log(`Account Status: ${client.google_ads_enabled ? 'ENABLED' : 'DISABLED'}`);
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

    // Date ranges
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];

    console.log(`📅 DATA PERIOD: ${dateStart} to ${dateEnd} (Last 30 Days)`);
    console.log('');

    // 1. ACCOUNT DETAILS
    console.log('🏢 ACCOUNT DETAILS');
    console.log('==================');
    const accountQuery = `
      SELECT 
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.auto_tagging_enabled,
        customer.conversion_tracking_setting.conversion_tracking_id,
        customer.conversion_tracking_setting.cross_account_conversion_tracking_id
      FROM customer
      LIMIT 1
    `;

    const accountData = await customer.query(accountQuery);
    if (accountData && accountData.length > 0) {
      const account = accountData[0].customer;
      console.log(`Account ID: ${account.id}`);
      console.log(`Account Name: ${account.descriptiveName || 'Not set'}`);
      console.log(`Currency: ${account.currencyCode || 'Not set'}`);
      console.log(`Timezone: ${account.timeZone || 'Not set'}`);
      console.log(`Auto Tagging: ${account.autoTaggingEnabled ? 'Enabled' : 'Disabled'}`);
      console.log(`Conversion Tracking ID: ${account.conversionTrackingSetting?.conversionTrackingId || 'Not set'}`);
    }
    console.log('');

    // 2. CAMPAIGNS WITH FULL METRICS
    console.log('📈 CAMPAIGN PERFORMANCE');
    console.log('=======================');
    const campaignQuery = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        campaign.start_date,
        campaign.end_date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value,
        metrics.view_through_conversions,
        metrics.all_conversions,
        metrics.all_conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
      ORDER BY metrics.impressions DESC
    `;

    const campaigns = await customer.query(campaignQuery);
    console.log(`Found ${campaigns.length} campaigns with data:\n`);

    let totalImpressions = 0, totalClicks = 0, totalCost = 0, totalConversions = 0;

    campaigns.forEach((row, index) => {
      const campaign = row.campaign;
      const metrics = row.metrics;
      
      console.log(`${index + 1}. ${campaign.name}`);
      console.log(`   ID: ${campaign.id}`);
      console.log(`   Status: ${campaign.status === 2 ? 'ENABLED' : campaign.status === 3 ? 'PAUSED' : campaign.status === 4 ? 'REMOVED' : 'OTHER'}`);
      console.log(`   Type: ${campaign.advertisingChannelType === 2 ? 'SEARCH' : campaign.advertisingChannelType === 3 ? 'DISPLAY' : campaign.advertisingChannelType === 6 ? 'SHOPPING' : campaign.advertisingChannelType === 12 ? 'PERFORMANCE_MAX' : 'OTHER'}`);
      console.log(`   Bidding: ${campaign.biddingStrategyType || 'Not set'}`);
      console.log(`   Start Date: ${campaign.startDate || 'Not set'}`);
      console.log(`   End Date: ${campaign.endDate || 'Ongoing'}`);
      console.log(`   Impressions: ${parseInt(metrics.impressions || 0).toLocaleString()}`);
      console.log(`   Clicks: ${parseInt(metrics.clicks || 0).toLocaleString()}`);
      console.log(`   Cost: $${(parseInt(metrics.costMicros || 0) / 1000000).toFixed(2)}`);
      console.log(`   CTR: ${(parseFloat(metrics.ctr || 0) * 100).toFixed(2)}%`);
      console.log(`   Avg CPC: $${(parseInt(metrics.averageCpc || 0) / 1000000).toFixed(2)}`);
      console.log(`   Conversions: ${parseFloat(metrics.conversions || 0).toFixed(1)}`);
      console.log(`   Conversion Value: $${parseFloat(metrics.conversionsValue || 0).toFixed(2)}`);
      console.log(`   View-through Conversions: ${parseFloat(metrics.viewThroughConversions || 0).toFixed(1)}`);
      console.log(`   All Conversions: ${parseFloat(metrics.allConversions || 0).toFixed(1)}`);
      console.log(`   All Conversions Value: $${parseFloat(metrics.allConversionsValue || 0).toFixed(2)}`);
      console.log('');

      totalImpressions += parseInt(metrics.impressions || 0);
      totalClicks += parseInt(metrics.clicks || 0);
      totalCost += parseInt(metrics.costMicros || 0);
      totalConversions += parseFloat(metrics.conversions || 0);
    });

    // 3. AD GROUPS
    console.log('📂 AD GROUPS');
    console.log('============');
    const adGroupQuery = `
      SELECT 
        campaign.name,
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.conversions
      FROM ad_group
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
      ORDER BY metrics.impressions DESC
      LIMIT 20
    `;

    const adGroups = await customer.query(adGroupQuery);
    console.log(`Found ${adGroups.length} ad groups with impressions:\n`);

    adGroups.forEach((row, index) => {
      const adGroup = row.ad_group;
      const metrics = row.metrics;
      
      console.log(`${index + 1}. ${adGroup.name}`);
      console.log(`   Campaign: ${row.campaign.name}`);
      console.log(`   ID: ${adGroup.id}`);
      console.log(`   Status: ${adGroup.status === 2 ? 'ENABLED' : adGroup.status === 3 ? 'PAUSED' : 'OTHER'}`);
      console.log(`   Type: ${adGroup.type || 'Not set'}`);
      console.log(`   Impressions: ${parseInt(metrics.impressions || 0).toLocaleString()}`);
      console.log(`   Clicks: ${parseInt(metrics.clicks || 0).toLocaleString()}`);
      console.log(`   Cost: $${(parseInt(metrics.costMicros || 0) / 1000000).toFixed(2)}`);
      console.log(`   CTR: ${(parseFloat(metrics.ctr || 0) * 100).toFixed(2)}%`);
      console.log(`   Conversions: ${parseFloat(metrics.conversions || 0).toFixed(1)}`);
      console.log('');
    });

    // 4. KEYWORDS
    console.log('🔑 KEYWORDS PERFORMANCE');
    console.log('=======================');
    const keywordQuery = `
      SELECT 
        campaign.name,
        ad_group.name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.quality_info.quality_score,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.conversions,
        metrics.average_cpc
      FROM keyword_view
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
      ORDER BY metrics.impressions DESC
      LIMIT 30
    `;

    const keywords = await customer.query(keywordQuery);
    console.log(`Found ${keywords.length} keywords with impressions:\n`);

    keywords.forEach((row, index) => {
      const keyword = row.ad_group_criterion;
      const metrics = row.metrics;
      
      console.log(`${index + 1}. "${keyword.keyword.text}"`);
      console.log(`   Campaign: ${row.campaign.name}`);
      console.log(`   Ad Group: ${row.ad_group.name}`);
      console.log(`   Match Type: ${keyword.keyword.matchType === 2 ? 'EXACT' : keyword.keyword.matchType === 3 ? 'PHRASE' : keyword.keyword.matchType === 4 ? 'BROAD' : 'OTHER'}`);
      console.log(`   Quality Score: ${keyword.qualityInfo?.qualityScore || 'Not available'}`);
      console.log(`   Impressions: ${parseInt(metrics.impressions || 0).toLocaleString()}`);
      console.log(`   Clicks: ${parseInt(metrics.clicks || 0).toLocaleString()}`);
      console.log(`   Cost: $${(parseInt(metrics.costMicros || 0) / 1000000).toFixed(2)}`);
      console.log(`   CTR: ${(parseFloat(metrics.ctr || 0) * 100).toFixed(2)}%`);
      console.log(`   Avg CPC: $${(parseInt(metrics.averageCpc || 0) / 1000000).toFixed(2)}`);
      console.log(`   Conversions: ${parseFloat(metrics.conversions || 0).toFixed(1)}`);
      console.log('');
    });

    // 5. GEOGRAPHIC PERFORMANCE
    console.log('🌍 GEOGRAPHIC PERFORMANCE');
    console.log('=========================');
    const geoQuery = `
      SELECT 
        geographic_view.location_type,
        geographic_view.country_criterion_id,
        geographic_view.region_criterion_id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM geographic_view
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
      ORDER BY metrics.impressions DESC
      LIMIT 20
    `;

    try {
      const geoData = await customer.query(geoQuery);
      console.log(`Found ${geoData.length} geographic locations with data:\n`);

      geoData.forEach((row, index) => {
        const geo = row.geographic_view;
        const metrics = row.metrics;
        
        console.log(`${index + 1}. Location`);
        console.log(`   Type: ${geo.locationType || 'Not specified'}`);
        console.log(`   Country ID: ${geo.countryCriterionId || 'Not specified'}`);
        console.log(`   Region ID: ${geo.regionCriterionId || 'Not specified'}`);
        console.log(`   Impressions: ${parseInt(metrics.impressions || 0).toLocaleString()}`);
        console.log(`   Clicks: ${parseInt(metrics.clicks || 0).toLocaleString()}`);
        console.log(`   Cost: $${(parseInt(metrics.costMicros || 0) / 1000000).toFixed(2)}`);
        console.log(`   Conversions: ${parseFloat(metrics.conversions || 0).toFixed(1)}`);
        console.log('');
      });
    } catch (error) {
      console.log('Geographic data not available or restricted');
      console.log('');
    }

    // 6. DEVICE PERFORMANCE
    console.log('📱 DEVICE PERFORMANCE');
    console.log('====================');
    const deviceQuery = `
      SELECT 
        segments.device,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
      ORDER BY metrics.impressions DESC
    `;

    const deviceData = await customer.query(deviceQuery);
    const deviceStats = {};
    
    deviceData.forEach(row => {
      const device = row.segments.device === 1 ? 'MOBILE' : row.segments.device === 2 ? 'TABLET' : row.segments.device === 3 ? 'DESKTOP' : 'OTHER';
      const metrics = row.metrics;
      
      if (!deviceStats[device]) {
        deviceStats[device] = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
      }
      
      deviceStats[device].impressions += parseInt(metrics.impressions || 0);
      deviceStats[device].clicks += parseInt(metrics.clicks || 0);
      deviceStats[device].cost += parseInt(metrics.costMicros || 0);
      deviceStats[device].conversions += parseFloat(metrics.conversions || 0);
    });

    Object.entries(deviceStats).forEach(([device, stats]) => {
      if (stats.impressions > 0) {
        console.log(`${device}:`);
        console.log(`   Impressions: ${stats.impressions.toLocaleString()}`);
        console.log(`   Clicks: ${stats.clicks.toLocaleString()}`);
        console.log(`   Cost: $${(stats.cost / 1000000).toFixed(2)}`);
        console.log(`   CTR: ${stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) + '%' : '0.00%'}`);
        console.log(`   Conversions: ${stats.conversions.toFixed(1)}`);
        console.log('');
      }
    });

    // 7. TIME PERFORMANCE
    console.log('⏰ TIME PERFORMANCE (Hour of Day)');
    console.log('=================================');
    const timeQuery = `
      SELECT 
        segments.hour,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
      ORDER BY segments.hour
    `;

    try {
      const timeData = await customer.query(timeQuery);
      const hourlyStats = {};
      
      timeData.forEach(row => {
        const hour = row.segments.hour;
        const metrics = row.metrics;
        
        if (!hourlyStats[hour]) {
          hourlyStats[hour] = { impressions: 0, clicks: 0, cost: 0, conversions: 0 };
        }
        
        hourlyStats[hour].impressions += parseInt(metrics.impressions || 0);
        hourlyStats[hour].clicks += parseInt(metrics.clicks || 0);
        hourlyStats[hour].cost += parseInt(metrics.costMicros || 0);
        hourlyStats[hour].conversions += parseFloat(metrics.conversions || 0);
      });

      Object.entries(hourlyStats).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([hour, stats]) => {
        console.log(`${hour}:00 - ${hour}:59`);
        console.log(`   Impressions: ${stats.impressions.toLocaleString()}`);
        console.log(`   Clicks: ${stats.clicks.toLocaleString()}`);
        console.log(`   Cost: $${(stats.cost / 1000000).toFixed(2)}`);
        console.log(`   Conversions: ${stats.conversions.toFixed(1)}`);
        console.log('');
      });
    } catch (error) {
      console.log('Hourly performance data not available');
      console.log('');
    }

    // 8. FINAL SUMMARY
    console.log('📊 COMPLETE ACCOUNT SUMMARY');
    console.log('===========================');
    console.log(`Total Campaigns: ${campaigns.length}`);
    console.log(`Active Ad Groups: ${adGroups.length}`);
    console.log(`Active Keywords: ${keywords.length}`);
    console.log(`Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`Total Clicks: ${totalClicks.toLocaleString()}`);
    console.log(`Total Cost: $${(totalCost / 1000000).toFixed(2)}`);
    console.log(`Overall CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0.00%'}`);
    console.log(`Average CPC: $${totalClicks > 0 ? ((totalCost / totalClicks) / 1000000).toFixed(2) : '0.00'}`);
    console.log(`Total Conversions: ${totalConversions.toFixed(1)}`);
    console.log(`Conversion Rate: ${totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) + '%' : '0.00%'}`);
    console.log(`Cost Per Conversion: $${totalConversions > 0 ? ((totalCost / 1000000) / totalConversions).toFixed(2) : '0.00'}`);

  } catch (error) {
    console.error('❌ Error extracting data:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

extractAllBelmonteData();
