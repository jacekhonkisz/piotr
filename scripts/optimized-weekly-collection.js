#!/usr/bin/env node

/**
 * OPTIMIZED WEEKLY COLLECTION
 * 
 * Schedule: Monday at 03:00 AM
 * API Calls: 14 clients × 1 call = 14 calls/week (2 calls/day average)
 * Purpose: Collect previous week's data for all clients
 */

const cron = require('node-cron');
require('dotenv').config({ path: '.env.local' });

// Configuration
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.NEXT_PUBLIC_SITE_URL 
  : 'http://localhost:3000';
const AUTOMATION_URL = BASE_URL + '/api/optimized/weekly-collection';
const AUTOMATION_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Starting OPTIMIZED weekly collection scheduler...');
console.log('📅 Schedule: Monday at 03:00 AM');
console.log('📊 Expected API calls: 20 per week (2.9 per day average)');

// Run weekly on Monday at 03:00 AM: 0 3 * * 1
const cronExpression = '0 3 * * 1';

cron.schedule(cronExpression, async () => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔄 [${timestamp}] Starting OPTIMIZED weekly collection...`);
  
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
      console.log(`✅ [${timestamp}] Weekly collection completed successfully`);
      console.log(`📊 Summary: ${JSON.stringify(data.summary, null, 2)}`);
      console.log(`🔢 API Calls: ${data.apiCalls || 20}`);
    } else {
      console.error(`❌ [${timestamp}] Weekly collection failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ [${timestamp}] Weekly collection error: ${error.message}`);
  }
}, {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

console.log('✅ OPTIMIZED weekly collection scheduler started');
console.log('📅 Next run: Next Monday at 03:00 AM');
