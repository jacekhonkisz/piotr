#!/usr/bin/env node

/**
 * OPTIMIZED DAILY COLLECTION
 * 
 * Schedule: Daily at 02:00 AM
 * API Calls: 14 clients × 1 call = 14 calls/day
 * Purpose: Collect yesterday's data for all clients
 */

const cron = require('node-cron');
require('dotenv').config({ path: '.env.local' });

// Configuration
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.NEXT_PUBLIC_SITE_URL 
  : 'http://localhost:3000';
const AUTOMATION_URL = BASE_URL + '/api/optimized/daily-collection';
const AUTOMATION_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Starting OPTIMIZED daily collection scheduler...');
console.log('📅 Schedule: Daily at 02:00 AM');
console.log('📊 Expected API calls: 20 per day');

// Run daily at 02:00 AM: 0 2 * * *
const cronExpression = '0 2 * * *';

cron.schedule(cronExpression, async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔄 [${timestamp}] Starting OPTIMIZED daily collection...`);
  
  try {
    const response = await fetch(AUTOMATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTOMATION_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ [${timestamp}] Daily collection completed successfully`);
      console.log(`📊 Summary: ${JSON.stringify(data.summary, null, 2)}`);
      console.log(`🔢 API Calls: ${data.apiCalls || 20}`);
    } else {
      console.error(`❌ [${timestamp}] Daily collection failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ [${timestamp}] Daily collection error: ${error.message}`);
  }
}, {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

console.log('✅ OPTIMIZED daily collection scheduler started');
console.log('📅 Next run: Tomorrow at 02:00 AM');
