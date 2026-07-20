/**
 * DIRECT WEEK 46 COLLECTION
 * 
 * Collects Week 46 data directly (bypassing status checks)
 * This will force-populate the database with Week 46 data
 */

const https = require('https');

const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET environment variable is required');
  process.exit(1);
}
const WEEK_START = '2025-11-10'; // Week 46 starts Monday Nov 10

console.log('🚀 Starting DIRECT collection for Week 46...');
console.log(`📅 Client: Belmonte Hotel`);
console.log(`📅 Week: ${WEEK_START} to 2025-11-16`);
console.log(`⏱️  Estimated time: 30 seconds\n`);

const data = JSON.stringify({
  clientId: BELMONTE_CLIENT_ID,
  weekStart: WEEK_START
});

const options = {
  hostname: 'piotr-gamma.vercel.app',
  port: 443,
  path: '/api/admin/collect-single-week',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': `Bearer ${CRON_SECRET}`
  },
  timeout: 120000 // 2 minutes
};

const req = https.request(options, (res) => {
  console.log(`📡 Response status: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
    process.stdout.write('.');
  });
  
  res.on('end', () => {
    console.log('\n');
    try {
      const result = JSON.parse(responseData);
      
      if (result.success) {
        console.log('✅ SUCCESS! Week 46 data collected and stored');
        console.log(`📊 Details:`);
        console.log(`   - Client: ${result.data.clientName}`);
        console.log(`   - Week: ${result.data.weekStart} to ${result.data.weekEnd}`);
        console.log(`   - Campaigns: ${result.data.campaignsCount}`);
        console.log(`   - Spend: ${result.data.totalSpend.toFixed(2)} PLN`);
        console.log(`   - Impressions: ${result.data.totalImpressions.toLocaleString()}`);
        console.log(`   - Clicks: ${result.data.totalClicks.toLocaleString()}`);
        console.log(`\n🎯 Next steps:`);
        console.log(`   1. Go to: https://piotr-gamma.vercel.app/reports`);
        console.log(`   2. Select: Tygodniowy (Weekly)`);
        console.log(`   3. Select: Week 46 (10.11 - 16.11.2025)`);
        console.log(`   4. Hard refresh: Ctrl+Shift+R`);
        console.log(`\n✨ Week 46 should now show ${result.data.campaignsCount} campaigns!`);
      } else {
        console.error('❌ FAILED:', result.error || result.message);
        console.error('Details:', result.details || 'No additional details');
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', responseData);
      console.error('Parse error:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
  console.error('\n🔍 Troubleshooting:');
  console.error('   1. Check internet connection');
  console.error('   2. Verify deployment is complete');
  console.error('   3. Check CRON_SECRET is correct');
});

req.on('timeout', () => {
  console.error('❌ Request timed out after 2 minutes');
  console.log(`\n📝 Note: Collection might still be running in background`);
  console.log(`   Check Vercel function logs to verify completion`);
  req.destroy();
});

console.log('📡 Sending request to API...\n');
req.write(data);
req.end();

