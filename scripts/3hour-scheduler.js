#!/usr/bin/env node

/**
 * 3-Hour Cache Refresh Scheduler
 * Runs automatically every 3 hours
 */

const cron = require('node-cron');
require('dotenv').config({ path: '.env.local' });

 // For local development, use localhost. For production, use your domain
 const BASE_URL = process.env.NODE_ENV === 'production' 
   ? 'https://your-domain.com' 
   : 'http://localhost:3000';
 const AUTOMATION_URL = BASE_URL + '/api/automated/refresh-3hour-cache';
const AUTOMATION_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Starting 3-hour cache refresh scheduler...');
console.log(`📅 Next refresh: ${new Date(Date.now() + 3 * 60 * 60 * 1000).toLocaleString()}`);

// Run every 3 hours: 0 */3 * * *
const cronExpression = '0 */3 * * *';

cron.schedule(cronExpression, async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔄 [${timestamp}] Starting scheduled 3-hour cache refresh...`);
  
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
      console.log(`✅ [${timestamp}] Cache refresh completed successfully`);
      console.log(`📊 Summary: ${JSON.stringify(data.summary, null, 2)}`);
    } else {
      console.error(`❌ [${timestamp}] Cache refresh failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ [${timestamp}] Cache refresh error: ${error.message}`);
  }
}, {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// Run initial refresh on startup (optional)
console.log('🔄 Running initial cache refresh...');
setTimeout(async () => {
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
      console.log('✅ Initial cache refresh completed');
      console.log(`📊 Summary: ${JSON.stringify(data.summary, null, 2)}`);
    } else {
      console.error(`❌ Initial cache refresh failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ Initial cache refresh error: ${error.message}`);
  }
}, 5000); // Wait 5 seconds after startup

console.log('⏰ Scheduler is running. Press Ctrl+C to stop.');
