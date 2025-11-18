/**
 * TRIGGER COMPLETE WEEKLY COLLECTION
 * 
 * This script triggers the incremental weekly collection endpoint
 * which will now parse COMPLETE conversion metrics from Meta API.
 * 
 * What it does:
 * 1. Calls /api/automated/incremental-weekly-collection
 * 2. System checks all clients for missing weeks
 * 3. For each missing week, fetches data from Meta API
 * 4. ✅ NEW: Parses actions array → extracts ALL funnel metrics
 * 5. ✅ NEW: Calculates ROAS and cost per reservation
 * 6. Stores complete data in database
 * 
 * Expected result:
 * - All weeks will have booking_step_1/2/3, reservations, ROAS
 * - No more 0s in the funnel
 * - Complete conversion tracking
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const CRON_SECRET = process.env.CRON_SECRET;
const PRODUCTION_URL = 'https://piotr-gamma.vercel.app';

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET not set!');
  console.error('Please add CRON_SECRET to your .env.local file');
  process.exit(1);
}

console.log('🚀 Triggering COMPLETE weekly collection with parsed conversion metrics...\n');
console.log('⏱️  This may take 2-3 minutes (collecting data for all clients and missing weeks)\n');

const options = {
  hostname: 'piotr-gamma.vercel.app',
  port: 443,
  path: '/api/automated/incremental-weekly-collection',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${CRON_SECRET}`,
    'Content-Type': 'application/json'
  },
  timeout: 300000 // 5 minutes timeout
};

const startTime = Date.now();

const req = https.request(options, (res) => {
  let data = '';

  console.log(`📡 Response Status: ${res.statusCode}\n`);

  res.on('data', (chunk) => {
    data += chunk;
    // Show progress dots
    process.stdout.write('.');
  });

  res.on('end', () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\n⏱️  Completed in ${elapsed}s\n`);

    try {
      const result = JSON.parse(data);
      console.log('✅ COLLECTION COMPLETE!\n');
      console.log('📊 Results:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success) {
        console.log('\n✅ SUCCESS! Weekly data collection completed with complete metrics\n');
        console.log('📋 What was collected:');
        console.log('   - Main metrics: spend, impressions, clicks');
        console.log('   - ✅ Funnel metrics: booking_step_1/2/3, reservations, reservation_value');
        console.log('   - ✅ Calculated metrics: ROAS, cost_per_reservation');
        console.log('\n🔄 Next steps:');
        console.log('   1. Refresh your dashboard');
        console.log('   2. Check Week 46 and other weeks');
        console.log('   3. Verify funnel shows complete data (no more 0s!)');
      } else {
        console.log('\n⚠️  Collection completed but with issues');
        console.log('Check the response above for details');
      }
    } catch (error) {
      console.log('Raw response:', data);
      console.error('⚠️  Could not parse JSON response');
    }
  });
});

req.on('error', (error) => {
  console.error('\n❌ Request failed:', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  console.error('\n⏱️  Request timed out after 5 minutes');
  console.error('This is normal if collecting many weeks. Check Vercel logs for actual status.');
  process.exit(1);
});

req.end();

// Progress indicator
let progressDots = 0;
const progressInterval = setInterval(() => {
  if (progressDots < 60) {
    // Show progress for up to 1 minute
    progressDots++;
  }
}, 1000);

process.on('exit', () => {
  clearInterval(progressInterval);
});

