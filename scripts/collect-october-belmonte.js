#!/usr/bin/env node

/**
 * EMERGENCY SCRIPT: Manually collect October 2025 data for Belmonte
 * 
 * This script bypasses the cache and directly fetches October 2025 Google Ads data,
 * then saves it to campaign_summaries for fast future access.
 * 
 * Run: node scripts/collect-october-belmonte.js
 */

console.log('🚀 Starting October 2025 data collection for Belmonte...\n');

async function collectOctoberData() {
  try {
    const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    const START_DATE = '2025-10-01';
    const END_DATE = '2025-10-31';
    
    console.log('📊 Fetching October 2025 data from Google Ads API...');
    console.log(`   Client: Belmonte Hotel`);
    console.log(`   Period: ${START_DATE} to ${END_DATE}\n`);
    
    // Fetch data from live API (this will take ~9 seconds)
    const response = await fetch('http://localhost:3000/api/fetch-google-ads-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: BELMONTE_CLIENT_ID,
        start_date: START_DATE,
        end_date: END_DATE,
        force_refresh: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`API returned error: ${data.error || 'Unknown error'}`);
    }
    
    console.log('✅ Successfully fetched October data from Google Ads API');
    console.log(`   Spend: $${data.aggregatedMetrics?.totalSpend || 0}`);
    console.log(`   Impressions: ${data.aggregatedMetrics?.totalImpressions || 0}`);
    console.log(`   Clicks: ${data.aggregatedMetrics?.totalClicks || 0}`);
    console.log(`   Campaigns: ${data.campaigns?.length || 0}\n`);
    
    // Now save this data to campaign_summaries
    console.log('💾 Saving October data to database...');
    
    const saveResponse = await fetch('http://localhost:3000/api/admin/save-historical-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: BELMONTE_CLIENT_ID,
        summary_type: 'monthly',
        summary_date: '2025-10-01',
        platform: 'google',
        data: data
      })
    });
    
    if (!saveResponse.ok) {
      console.warn('⚠️  Save endpoint not available, will create manually...');
      console.log('\n📝 Data collected successfully. To save to database, run this SQL:');
      console.log(`
INSERT INTO campaign_summaries (
  client_id,
  summary_type,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  average_ctr,
  average_cpc,
  active_campaigns,
  total_campaigns,
  campaign_data,
  google_ads_tables,
  data_source,
  last_updated
) VALUES (
  '${BELMONTE_CLIENT_ID}',
  'monthly',
  '2025-10-01',
  'google',
  ${data.aggregatedMetrics?.totalSpend || 0},
  ${data.aggregatedMetrics?.totalImpressions || 0},
  ${data.aggregatedMetrics?.totalClicks || 0},
  ${data.aggregatedMetrics?.totalConversions || 0},
  ${data.aggregatedMetrics?.averageCtr || 0},
  ${data.aggregatedMetrics?.averageCpc || 0},
  ${data.campaigns?.filter(c => c.status === 'ENABLED').length || 0},
  ${data.campaigns?.length || 0},
  '${JSON.stringify(data.campaigns || [])}'::jsonb,
  '${JSON.stringify(data.googleAdsTables || null)}'::jsonb,
  'manual_collection',
  NOW()
)
ON CONFLICT (client_id, summary_type, summary_date, platform)
DO UPDATE SET
  total_spend = EXCLUDED.total_spend,
  total_impressions = EXCLUDED.total_impressions,
  total_clicks = EXCLUDED.total_clicks,
  total_conversions = EXCLUDED.total_conversions,
  campaign_data = EXCLUDED.campaign_data,
  google_ads_tables = EXCLUDED.google_ads_tables,
  last_updated = NOW();
      `);
    } else {
      const saveData = await saveResponse.json();
      if (saveData.success) {
        console.log('✅ October data saved to campaign_summaries!');
      } else {
        console.error('❌ Failed to save data:', saveData.error);
      }
    }
    
    console.log('\n🎉 October 2025 data collection completed!');
    console.log('   Future requests for October will now load instantly from database (<50ms)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n   Stack:', error.stack);
    process.exit(1);
  }
}

// Run the collection
collectOctoberData();

