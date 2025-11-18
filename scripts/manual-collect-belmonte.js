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
const CRON_SECRET = process.env.CRON_SECRET || 'KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK';
const API_URL = 'https://piotr-gamma.vercel.app';

console.log('🚀 Starting manual weekly data collection for Belmonte Hotel...');
console.log(`📅 This will collect 53 weeks + current week of data`);
console.log(`⏱️  Estimated time: 2-3 minutes\n`);

const data = JSON.stringify({
  clientId: BELMONTE_CLIENT_ID
});

const options = {
  hostname: 'piotr-gamma.vercel.app',
  port: 443,
  path: '/api/manual/collect-client-weekly',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
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
        console.log('✅ SUCCESS! Weekly data collection completed');
        console.log(`📊 Details:`, result.details || result.message);
        console.log(`\n🎯 Next steps:`);
        console.log(`   1. Go to Reports page`);
        console.log(`   2. Select Week 46 (Nov 10-16)`);
        console.log(`   3. Verify data shows correct weekly totals (~3,500 zł)`);
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
req.write(data);
req.end();

