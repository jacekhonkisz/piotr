/**
 * Force Cache Refresh for Belmonte - Get Latest Data
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Belmonte Hotel Client ID
const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function forceCacheRefreshBelmonte() {
  console.log('🔄 FORCE CACHE REFRESH FOR BELMONTE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏨 Client: Belmonte Hotel`);
  console.log(`🆔 Client ID: ${BELMONTE_CLIENT_ID}`);
  console.log('');

  try {
    // Step 1: Check current cache
    console.log('🔍 STEP 1: Checking current cache...');
    
    const { data: oldCache, error: oldCacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .single();

    if (oldCache) {
      console.log(`📅 Current cache period: ${oldCache.period_id}`);
      console.log(`🕐 Last updated: ${oldCache.last_updated}`);
      console.log(`💰 Current spend in cache: ${oldCache.cache_data?.stats?.totalSpend || oldCache.cache_data?.totals?.spend || 'unknown'} PLN`);
    } else {
      console.log('⚠️ No current cache found');
    }

    // Step 2: Delete old cache to force refresh
    console.log('\n🔍 STEP 2: Deleting old cache to force refresh...');
    
    const { error: deleteError } = await supabase
      .from('current_month_cache')
      .delete()
      .eq('client_id', BELMONTE_CLIENT_ID);

    if (deleteError) {
      console.log('❌ Failed to delete cache:', deleteError.message);
    } else {
      console.log('✅ Old cache deleted successfully');
    }

    // Step 3: Force fetch fresh data using MetaAPI directly
    console.log('\n🔍 STEP 3: Fetching fresh data from Meta API...');
    
    // Get client credentials
    const { data: belmonteClient, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', BELMONTE_CLIENT_ID)
      .single();

    if (clientError || !belmonteClient) {
      console.log('❌ Failed to get Belmonte client:', clientError);
      return;
    }

    console.log(`✅ Client found: ${belmonteClient.name}`);
    console.log(`🎯 Ad Account: ${belmonteClient.ad_account_id}`);

    // Calculate current month date range
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    console.log(`📅 Date range: ${startDate} to ${endDate}`);

    // Make direct Meta API call to get latest data
    const accessToken = belmonteClient.meta_access_token;
    const adAccountId = belmonteClient.ad_account_id.startsWith('act_') 
      ? belmonteClient.ad_account_id 
      : `act_${belmonteClient.ad_account_id}`;

    const campaignFields = [
      'campaign_id',
      'campaign_name', 
      'impressions',
      'clicks',
      'spend',
      'ctr',
      'cpc',
      'conversions',
      'actions',
      'action_values'
    ].join(',');

    const campaignParams = new URLSearchParams({
      access_token: accessToken,
      fields: campaignFields,
      time_range: JSON.stringify({
        since: startDate,
        until: endDate,
      }),
      level: 'campaign',
      limit: '100',
    });

    const campaignUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?${campaignParams.toString()}`;
    
    console.log('📡 Fetching fresh campaign data...');
    const response = await fetch(campaignUrl);
    const data = await response.json();

    if (!response.ok || data.error) {
      console.log('❌ Meta API error:', data.error?.message || 'Unknown error');
      return;
    }

    const campaigns = data.data || [];
    console.log(`✅ Fetched ${campaigns.length} campaigns`);

    // Calculate totals
    const totals = campaigns.reduce((acc, campaign) => {
      acc.spend += parseFloat(campaign.spend || '0');
      acc.impressions += parseInt(campaign.impressions || '0');
      acc.clicks += parseInt(campaign.clicks || '0');
      return acc;
    }, { spend: 0, impressions: 0, clicks: 0 });

    console.log(`💰 Fresh total spend: ${totals.spend.toFixed(2)} PLN`);
    console.log(`👁️ Fresh total impressions: ${totals.impressions.toLocaleString()}`);
    console.log(`🖱️ Fresh total clicks: ${totals.clicks.toLocaleString()}`);

    // Step 4: Fetch Meta Tables
    console.log('\n🔍 STEP 4: Fetching Meta tables...');
    
    const placementFields = ['spend', 'impressions', 'clicks'].join(',');
    const placementParams = new URLSearchParams({
      access_token: accessToken,
      fields: placementFields,
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      breakdowns: 'publisher_platform,platform_position',
      level: 'campaign',
      limit: '100',
    });

    const placementUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?${placementParams.toString()}`;
    const placementResponse = await fetch(placementUrl);
    const placementData = await placementResponse.json();
    
    const demographicFields = ['spend', 'impressions', 'clicks', 'actions', 'action_values'].join(',');
    const demographicParams = new URLSearchParams({
      access_token: accessToken,
      fields: demographicFields,
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      breakdowns: 'age,gender',
      level: 'campaign',
      limit: '100',
    });

    const demographicUrl = `https://graph.facebook.com/v18.0/${adAccountId}/insights?${demographicParams.toString()}`;
    const demographicResponse = await fetch(demographicUrl);
    const demographicData = await demographicResponse.json();

    console.log(`📊 Placement records: ${placementData.data?.length || 0}`);
    console.log(`👥 Demographic records: ${demographicData.data?.length || 0}`);

    // Step 5: Store fresh data in cache
    console.log('\n🔍 STEP 5: Storing fresh data in cache...');
    
    const periodId = `${year}-${String(month).padStart(2, '0')}`;
    const freshCacheData = {
      client: {
        id: BELMONTE_CLIENT_ID,
        name: belmonteClient.name,
        currency: 'PLN'
      },
      campaigns: campaigns,
      stats: {
        totalSpend: totals.spend,
        totalImpressions: totals.impressions,
        totalClicks: totals.clicks,
        totalConversions: 0,
        averageCtr: totals.clicks > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        averageCpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0
      },
      totals: {
        spend: totals.spend,
        impressions: totals.impressions,
        clicks: totals.clicks
      },
      metaTables: {
        placementPerformance: placementData.data || [],
        demographicPerformance: demographicData.data || [],
        adRelevanceResults: []
      },
      dateRange: { start: startDate, end: endDate },
      fromCache: true
    };

    const { error: insertError } = await supabase
      .from('current_month_cache')
      .insert({
        client_id: BELMONTE_CLIENT_ID,
        period_id: periodId,
        cache_data: freshCacheData,
        last_updated: new Date().toISOString()
      });

    if (insertError) {
      console.log('❌ Failed to store fresh cache:', insertError.message);
    } else {
      console.log('✅ Fresh data stored in cache successfully!');
    }

    // Step 6: Verify new cache
    console.log('\n🔍 STEP 6: Verifying new cache...');
    
    const { data: newCache, error: newCacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .single();

    if (newCache) {
      console.log(`📅 New cache period: ${newCache.period_id}`);
      console.log(`🕐 Last updated: ${newCache.last_updated}`);
      console.log(`💰 New spend in cache: ${newCache.cache_data?.stats?.totalSpend || 'unknown'} PLN`);
      console.log(`📊 Campaigns in cache: ${newCache.cache_data?.campaigns?.length || 0}`);
    }

    console.log('\n🎉 CACHE REFRESH COMPLETED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Fresh data fetched from Meta API');
    console.log('✅ Old cache deleted and replaced');
    console.log('✅ New cache stored with latest data');
    console.log('');
    console.log('🔄 NEXT STEPS:');
    console.log('1. Reload your dashboard page');
    console.log('2. You should now see the updated data');
    console.log(`3. Expected spend: ~${totals.spend.toFixed(2)} PLN (instead of 4369,53 zł)`);
    console.log('4. Dashboard should load faster using the fresh cache');

  } catch (error) {
    console.error('\n💥 CACHE REFRESH ERROR:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the cache refresh
if (require.main === module) {
  forceCacheRefreshBelmonte();
}

module.exports = { forceCacheRefreshBelmonte }; 