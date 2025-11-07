/**
 * EMERGENCY SCRIPT: Collect October 2025 Google Ads Data
 * 
 * This script manually triggers the background data collector
 * to fetch and store October 2025 data for Belmonte client.
 * 
 * Run: node scripts/collect-october-data.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function collectOctoberData() {
  console.log('🚀 Starting October 2025 data collection for Belmonte...\n');
  
  try {
    // Call the background data collection API for this specific client and month
    const response = await fetch('http://localhost:3000/api/admin/collect-historical-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: BELMONTE_CLIENT_ID,
        year: 2025,
        month: 10, // October
        platform: 'google'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    console.log('\n✅ Data collection triggered:', result);
    
    // Wait a bit for data to be collected
    console.log('\n⏳ Waiting 30 seconds for data collection to complete...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Verify data was stored
    console.log('\n🔍 Verifying October data was stored...');
    const { data, error } = await supabase
      .from('campaign_summaries')
      .select('summary_date, platform, total_spend, total_impressions, total_clicks, reservations')
      .eq('client_id', BELMONTE_CLIENT_ID)
      .eq('summary_type', 'monthly')
      .eq('platform', 'google')
      .gte('summary_date', '2025-10-01')
      .lte('summary_date', '2025-10-31');
    
    if (error) {
      console.error('❌ Error checking data:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('\n✅ SUCCESS! October 2025 data is now in database:');
      console.table(data);
      console.log('\n✨ Past period loading should now be instant (<50ms) instead of slow (~9s)');
    } else {
      console.log('\n⚠️  No data found - collection may still be in progress or failed');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Alternative: Manually run the archival endpoint:');
    console.log('   curl -X POST http://localhost:3000/api/admin/archive-completed-periods');
  }
}

collectOctoberData();

