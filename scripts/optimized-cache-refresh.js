#!/usr/bin/env node

/**
 * OPTIMIZED SMART CACHE REFRESH
 * 
 * Schedule: Every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
 * API Calls: ~1 call per refresh (only when cache is stale)
 * Purpose: Keep current data fresh with intelligent refresh
 */

const cron = require('node-cron');
require('dotenv').config({ path: '.env.local' });

// Configuration
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.NEXT_PUBLIC_SITE_URL 
  : 'http://localhost:3000';
const AUTOMATION_URL = BASE_URL + '/api/optimized/smart-cache-refresh';
const AUTOMATION_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Starting OPTIMIZED smart cache refresh scheduler...');
console.log('📅 Schedule: Every 4 hours');
console.log('📊 Expected API calls: ~2 per day (only when needed)');

// Run every 4 hours: 0 */4 * * *
const cronExpression = '0 */4 * * *';

cron.schedule(cronExpression, async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔄 [${timestamp}] Starting OPTIMIZED smart cache refresh...`);
  
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
      console.log(`✅ [${timestamp}] Smart cache refresh completed successfully`);
      console.log(`📊 Summary: ${JSON.stringify(data.summary, null, 2)}`);
      console.log(`🔢 API Calls: ${data.apiCalls || 0} (only when needed)`);
      console.log(`⏭️ Skipped: ${data.skipped || 0} (cache was fresh)`);
    } else {
      console.error(`❌ [${timestamp}] Smart cache refresh failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ [${timestamp}] Smart cache refresh error: ${error.message}`);
  }
}, {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

console.log('✅ OPTIMIZED smart cache refresh scheduler started');
console.log('📅 Next run: Every 4 hours');
