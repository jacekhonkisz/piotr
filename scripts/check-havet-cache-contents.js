require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHavetCacheContents() {
  console.log('🔍 CHECKING HAVET SMART CACHE CONTENTS\n');
  console.log('='.repeat(80));

  const HAVET_CLIENT_ID = '93d46876-addc-4b99-b1e1-437428dd54f1';

  try {
    // 1. Check current_month_cache
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', HAVET_CLIENT_ID);

    if (cacheError) {
      console.log('❌ Error fetching cache:', cacheError.message);
      return;
    }

    if (!cacheData || cacheData.length === 0) {
      console.log('⚠️ No cache data found for Havet');
      return;
    }

    console.log(`\n📊 Found ${cacheData.length} cache record(s):\n`);

    cacheData.forEach((cache, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`CACHE RECORD ${index + 1}:`);
      console.log(`${'='.repeat(60)}`);
      console.log(`ID: ${cache.id}`);
      console.log(`Client ID: ${cache.client_id}`);
      console.log(`Period ID: ${cache.period_id}`);
      console.log(`Last Updated: ${cache.last_updated}`);
      console.log(`Created At: ${cache.created_at}`);
      
      if (cache.cached_data) {
        console.log(`\n📈 CACHED DATA CONTENTS:`);
        const data = cache.cached_data;
        
        // Stats
        if (data.stats) {
          console.log(`\n   📊 Stats:`);
          console.log(`      Total Spend: ${data.stats.totalSpend?.toFixed(2) || 0} PLN`);
          console.log(`      Total Impressions: ${(data.stats.totalImpressions || 0).toLocaleString()}`);
          console.log(`      Total Clicks: ${(data.stats.totalClicks || 0).toLocaleString()}`);
          console.log(`      Total Conversions: ${data.stats.totalConversions || 0}`);
          console.log(`      Avg CTR: ${data.stats.averageCtr?.toFixed(2) || 0}%`);
          console.log(`      Avg CPC: ${data.stats.averageCpc?.toFixed(2) || 0} PLN`);
        }
        
        // Conversion Metrics
        if (data.conversionMetrics) {
          console.log(`\n   🎯 Conversion Metrics:`);
          console.log(`      Click to Call: ${data.conversionMetrics.click_to_call || 0}`);
          console.log(`      Email Contacts: ${data.conversionMetrics.email_contacts || 0}`);
          console.log(`      Booking Step 1: ${data.conversionMetrics.booking_step_1 || 0}`);
          console.log(`      Booking Step 2: ${data.conversionMetrics.booking_step_2 || 0}`);
          console.log(`      Booking Step 3: ${data.conversionMetrics.booking_step_3 || 0}`);
          console.log(`      Reservations: ${data.conversionMetrics.reservations || 0}`);
          console.log(`      Reservation Value: ${data.conversionMetrics.reservation_value?.toFixed(2) || 0} PLN`);
          console.log(`      ROAS: ${data.conversionMetrics.roas?.toFixed(2) || 0}`);
          console.log(`      Cost Per Reservation: ${data.conversionMetrics.cost_per_reservation?.toFixed(2) || 0} PLN`);
          console.log(`      Reach: ${(data.conversionMetrics.reach || 0).toLocaleString()}`);
        }
        
        // Campaigns
        if (data.campaigns && data.campaigns.length > 0) {
          console.log(`\n   📋 Campaigns (${data.campaigns.length} total):`);
          data.campaigns.forEach((campaign, i) => {
            console.log(`\n      ${i + 1}. ${campaign.campaign_name || campaign.name || 'Unknown'}`);
            console.log(`         ID: ${campaign.campaign_id || campaign.id}`);
            console.log(`         Spend: ${parseFloat(campaign.spend || 0).toFixed(2)} PLN`);
            console.log(`         Impressions: ${(campaign.impressions || 0).toLocaleString()}`);
            console.log(`         Clicks: ${campaign.clicks || 0}`);
            console.log(`         Reach: ${(campaign.reach || 0).toLocaleString()}`);
            console.log(`         CTR: ${campaign.ctr || 0}%`);
            console.log(`         Reservations: ${campaign.reservations || 0}`);
          });
        } else {
          console.log(`\n   ⚠️ No campaigns in cache data`);
        }
        
        // Debug info
        if (data.debug) {
          console.log(`\n   🔧 Debug Info:`);
          console.log(`      Source: ${data.debug.source || 'N/A'}`);
          console.log(`      From Cache: ${data.debug.fromCache || false}`);
          console.log(`      Cache Age: ${data.debug.cacheAge || 'N/A'}`);
        }
        
      } else {
        console.log('   ⚠️ cached_data is empty or null');
      }
    });

    // 2. Check current_week_cache
    console.log('\n\n' + '='.repeat(80));
    console.log('CHECKING WEEKLY CACHE:');
    console.log('='.repeat(80));
    
    const { data: weekCache, error: weekError } = await supabase
      .from('current_week_cache')
      .select('*')
      .eq('client_id', HAVET_CLIENT_ID);

    if (weekCache && weekCache.length > 0) {
      console.log(`\n📅 Found ${weekCache.length} weekly cache record(s)`);
      weekCache.forEach((cache, i) => {
        console.log(`\n   Week ${i + 1}:`);
        console.log(`      Period ID: ${cache.period_id}`);
        console.log(`      Last Updated: ${cache.last_updated}`);
        if (cache.cached_data?.stats) {
          console.log(`      Total Spend: ${cache.cached_data.stats.totalSpend?.toFixed(2) || 0} PLN`);
        }
      });
    } else {
      console.log('\n⚠️ No weekly cache data found');
    }

    // 3. Compare with expected values
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 COMPARISON WITH REAL META BUSINESS SUITE DATA:');
    console.log('='.repeat(80));
    
    const realTotals = {
      totalSpend: 3735.86,
      totalImpressions: 296749,
      totalReach: 157413,
      totalPurchases: 3,
      activeCampaigns: 11
    };

    console.log('\n   Expected (Meta Business Suite Dec 1-19):');
    console.log(`      Total Spend: ${realTotals.totalSpend.toFixed(2)} PLN`);
    console.log(`      Total Impressions: ${realTotals.totalImpressions.toLocaleString()}`);
    console.log(`      Total Reach: ${realTotals.totalReach.toLocaleString()}`);
    console.log(`      Total Purchases: ${realTotals.totalPurchases}`);
    console.log(`      Active Campaigns: ${realTotals.activeCampaigns}`);

    if (cacheData && cacheData[0]?.cached_data?.stats) {
      const cachedStats = cacheData[0].cached_data.stats;
      const cachedConversions = cacheData[0].cached_data.conversionMetrics || {};
      const cachedCampaigns = cacheData[0].cached_data.campaigns || [];
      
      console.log('\n   Found in Smart Cache:');
      console.log(`      Total Spend: ${cachedStats.totalSpend?.toFixed(2) || 0} PLN`);
      console.log(`      Total Impressions: ${(cachedStats.totalImpressions || 0).toLocaleString()}`);
      console.log(`      Reservations: ${cachedConversions.reservations || 0}`);
      console.log(`      Campaigns Count: ${cachedCampaigns.length}`);
      
      const spendDiff = Math.abs((cachedStats.totalSpend || 0) - realTotals.totalSpend);
      const impressionsDiff = Math.abs((cachedStats.totalImpressions || 0) - realTotals.totalImpressions);
      
      console.log('\n   ⚖️ Differences:');
      console.log(`      Spend Diff: ${spendDiff.toFixed(2)} PLN (${realTotals.totalSpend > 0 ? ((spendDiff / realTotals.totalSpend) * 100).toFixed(1) : 0}%)`);
      console.log(`      Impressions Diff: ${impressionsDiff.toLocaleString()} (${realTotals.totalImpressions > 0 ? ((impressionsDiff / realTotals.totalImpressions) * 100).toFixed(1) : 0}%)`);
      
      if (spendDiff > 100 || impressionsDiff > 10000) {
        console.log('\n   ❌ SIGNIFICANT MISMATCH DETECTED!');
        console.log('   Possible causes:');
        console.log('      1. Token permission issue - API returns error instead of data');
        console.log('      2. Cache contains stale/incorrect data');
        console.log('      3. Different date range or time zone');
      } else if (spendDiff < 10 && impressionsDiff < 1000) {
        console.log('\n   ✅ DATA MATCHES (within acceptable tolerance)');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkHavetCacheContents().catch(console.error);
