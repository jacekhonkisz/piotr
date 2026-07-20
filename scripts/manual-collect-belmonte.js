#!/usr/bin/env node

/**
 * EMERGENCY: Manual Weekly Data Collection for Belmonte Hotel
 * 
 * Run this locally to populate database with weekly data
 * Usage: node scripts/manual-collect-belmonte.js
 * 
 * Requirements:
 * - Node.js installed
 * - .env.local with DATABASE_URL
 */

const https = require('https');

const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET environment variable is required');
  process.exit(1);
}
const API_URL = 'https://piotr-gamma.vercel.app';

console.log('🚀 Starting incremental weekly data collection...');
console.log(`📅 This will collect ONLY missing weeks for all clients`);
console.log(`⏱️  Estimated time: 1-2 minutes\n`);

const data = '';  // No body needed - collects for all clients

const options = {
  hostname: 'piotr-gamma.vercel.app',
  port: 443,
  path: '/api/automated/incremental-weekly-collection',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CRON_SECRET}`
  },
  timeout: 300000 // 5 minutes
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
        console.log('✅ SUCCESS! Incremental weekly data collection completed');
        console.log(`📊 Summary:`);
        console.log(`   - Clients processed: ${result.summary?.clientsProcessed || 'N/A'}`);
        console.log(`   - Weeks collected: ${result.summary?.totalWeeksCollected || 'N/A'}`);
        console.log(`   - Time: ${result.summary?.responseTimeMs ? (result.summary.responseTimeMs/1000).toFixed(2) + 's' : 'N/A'}`);
        console.log(`\n🎯 Next steps:`);
        console.log(`   1. Go to Reports page`);
        console.log(`   2. Select Weekly view`);
        console.log(`   3. Verify Week 46 shows correct data (~3,500 zł)`);
      } else {
        console.error('❌ FAILED:', result.error || result.message);
        console.error('Details:', result.details || 'No additional details');
      }
    } catch (e) {
      console.error('❌ Failed to parse response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.log(`\n💡 Troubleshooting:`);
  console.log(`   - Check if deployment is complete`);
  console.log(`   - Verify CRON_SECRET is set correctly`);
  console.log(`   - Check Vercel function logs for errors`);
});

req.on('timeout', () => {
  console.error('⏱️  Request timed out after 5 minutes');
  console.log(`\n📝 Note: Collection might still be running in background`);
  console.log(`   Check Vercel function logs to verify completion`);
  req.destroy();
});

console.log('📡 Sending request to API...\n');
req.end();

