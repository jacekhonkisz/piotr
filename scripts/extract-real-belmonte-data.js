#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { GoogleAdsApi } = require('google-ads-api');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function extractRealBelmonteData() {
  console.log('📊 EXTRACTING REAL GOOGLE ADS DATA FOR BELMONTE');
  console.log('===============================================\n');

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
    console.log(`📧 EMAIL: ${client.email}`);
    console.log(`🆔 CUSTOMER ID: ${client.google_ads_customer_id}`);
    console.log('');

    // Use 90-day range since that's where the real data is
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    
    const dateStart = startDate.toISOString().split('T')[0];
    const dateEnd = endDate.toISOString().split('T')[0];
    
    console.log(`📅 DATA PERIOD: ${dateStart} to ${dateEnd} (Last 90 Days)`);
    console.log('');

    // 1. COMPREHENSIVE CAMPAIGN DATA
    console.log('📈 COMPREHENSIVE CAMPAIGN PERFORMANCE');
    console.log('====================================');
    
    const campaignQuery = `
      SELECT 
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.bidding_strategy_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value,
        metrics.all_conversions,
        metrics.all_conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
      ORDER BY metrics.impressions DESC
    `;

    const campaigns = await customer.query(campaignQuery);
    console.log(`Found ${campaigns.length} campaigns with traffic:\n`);

    let totalImpressions = 0, totalClicks = 0, totalCost = 0, totalConversions = 0;

    campaigns.forEach((row, index) => {
      const campaign = row.campaign;
      const metrics = row.metrics;
      
      const impressions = parseInt(metrics.impressions || 0);
      const clicks = parseInt(metrics.clicks || 0);
      const costMicros = parseInt(metrics.costMicros || 0);
      const conversions = parseFloat(metrics.conversions || 0);
      
      console.log(`${index + 1}. ${campaign.name}`);
      console.log(`   Campaign ID: ${campaign.id}`);
      console.log(`   Status: ${campaign.status === 2 ? 'ENABLED' : campaign.status === 3 ? 'PAUSED' : campaign.status === 4 ? 'REMOVED' : 'OTHER'}`);
      console.log(`   Channel: ${campaign.advertisingChannelType === 2 ? 'SEARCH' : campaign.advertisingChannelType === 3 ? 'DISPLAY' : campaign.advertisingChannelType === 12 ? 'PERFORMANCE_MAX' : 'OTHER'}`);
      console.log(`   Impressions: ${impressions.toLocaleString()}`);
      console.log(`   Clicks: ${clicks.toLocaleString()}`);
      console.log(`   CTR: ${(parseFloat(metrics.ctr || 0) * 100).toFixed(2)}%`);
      
      // Handle cost data more carefully
      if (metrics.costMicros !== undefined && metrics.costMicros !== null) {
        console.log(`   Cost: $${(costMicros / 1000000).toFixed(2)}`);
        console.log(`   Avg CPC: $${(parseInt(metrics.averageCpc || 0) / 1000000).toFixed(2)}`);
      } else {
        console.log(`   Cost: Not available (possibly $0 budget or billing issue)`);
        console.log(`   Avg CPC: Not available`);
      }
      
      console.log(`   Conversions: ${conversions.toFixed(1)}`);
      console.log(`   All Conversions: ${parseFloat(metrics.allConversions || 0).toFixed(1)}`);
      
      if (metrics.conversionsValue !== undefined && metrics.conversionsValue !== null) {
        console.log(`   Conversion Value: $${parseFloat(metrics.conversionsValue || 0).toFixed(2)}`);
      }
      
      console.log('');

      totalImpressions += impressions;
      totalClicks += clicks;
      totalCost += costMicros;
      totalConversions += conversions;
    });

    // 2. TOP KEYWORDS (90-day range)
    console.log('🔑 TOP KEYWORDS (90-Day Performance)');
    console.log('====================================');
    
    const keywordQuery = `
      SELECT 
        campaign.name,
        ad_group.name,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.conversions
      FROM keyword_view
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
      ORDER BY metrics.impressions DESC
      LIMIT 20
    `;

    const keywords = await customer.query(keywordQuery);
    console.log(`Found ${keywords.length} keywords with traffic:\n`);

    keywords.forEach((row, index) => {
      const keyword = row.ad_group_criterion;
      const metrics = row.metrics;
      
      console.log(`${index + 1}. "${keyword.keyword.text}"`);
      console.log(`   Campaign: ${row.campaign.name}`);
      console.log(`   Ad Group: ${row.ad_group.name}`);
      console.log(`   Match Type: ${keyword.keyword.matchType === 2 ? 'EXACT' : keyword.keyword.matchType === 3 ? 'PHRASE' : keyword.keyword.matchType === 4 ? 'BROAD' : 'OTHER'}`);
      console.log(`   Impressions: ${parseInt(metrics.impressions || 0).toLocaleString()}`);
      console.log(`   Clicks: ${parseInt(metrics.clicks || 0).toLocaleString()}`);
      console.log(`   CTR: ${(parseFloat(metrics.ctr || 0) * 100).toFixed(2)}%`);
      
      if (metrics.costMicros !== undefined && metrics.costMicros !== null) {
        console.log(`   Cost: $${(parseInt(metrics.costMicros || 0) / 1000000).toFixed(2)}`);
      } else {
        console.log(`   Cost: Not available`);
      }
      
      console.log(`   Conversions: ${parseFloat(metrics.conversions || 0).toFixed(1)}`);
      console.log('');
    });

    // 3. DEVICE PERFORMANCE (90-day)
    console.log('📱 DEVICE PERFORMANCE (90 Days)');
    console.log('===============================');
    
    const deviceQuery = `
      SELECT 
        segments.device,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND metrics.impressions > 0
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
        console.log(`   CTR: ${stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) + '%' : '0.00%'}`);
        
        if (stats.cost > 0) {
          console.log(`   Cost: $${(stats.cost / 1000000).toFixed(2)}`);
          console.log(`   Avg CPC: $${stats.clicks > 0 ? ((stats.cost / stats.clicks) / 1000000).toFixed(2) : '0.00'}`);
        } else {
          console.log(`   Cost: Not available`);
        }
        
        console.log(`   Conversions: ${stats.conversions.toFixed(1)}`);
        console.log('');
      }
    });

    // 4. FINAL SUMMARY
    console.log('📊 COMPLETE ACCOUNT SUMMARY (90 Days)');
    console.log('=====================================');
    console.log(`Total Campaigns with Traffic: ${campaigns.length}`);
    console.log(`Total Keywords: ${keywords.length}`);
    console.log(`Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`Total Clicks: ${totalClicks.toLocaleString()}`);
    console.log(`Overall CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0.00%'}`);
    
    if (totalCost > 0) {
      console.log(`Total Cost: $${(totalCost / 1000000).toFixed(2)}`);
      console.log(`Average CPC: $${totalClicks > 0 ? ((totalCost / totalClicks) / 1000000).toFixed(2) : '0.00'}`);
      console.log(`Cost Per Conversion: $${totalConversions > 0 ? ((totalCost / 1000000) / totalConversions).toFixed(2) : '0.00'}`);
    } else {
      console.log(`Total Cost: Not available (likely $0 budget or billing not configured)`);
      console.log(`Average CPC: Not available`);
    }
    
    console.log(`Total Conversions: ${totalConversions.toFixed(1)}`);
    console.log(`Conversion Rate: ${totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) + '%' : '0.00%'}`);

    // 5. ACCOUNT DIAGNOSIS
    console.log('');
    console.log('🔍 ACCOUNT DIAGNOSIS');
    console.log('===================');
    
    if (totalCost === 0) {
      console.log('⚠️  COST DATA ISSUE DETECTED:');
      console.log('   - All cost metrics show $0.00');
      console.log('   - This could indicate:');
      console.log('     1. Billing not set up properly');
      console.log('     2. Campaigns running with $0 bids');
      console.log('     3. Account suspended or limited');
      console.log('     4. API access limitations');
      console.log('');
      console.log('✅ POSITIVE INDICATORS:');
      console.log(`   - Account is generating traffic (${totalImpressions.toLocaleString()} impressions)`);
      console.log(`   - Clicks are being recorded (${totalClicks.toLocaleString()} clicks)`);
      console.log(`   - Conversions are tracked (${totalConversions.toFixed(1)} conversions)`);
      console.log('   - API access is working properly');
    }

  } catch (error) {
    console.error('❌ Error extracting real data:', error);
    if (error.errors) {
      error.errors.forEach(err => {
        console.error(`   Error: ${err.message}`);
      });
    }
  }
}

extractRealBelmonteData();
