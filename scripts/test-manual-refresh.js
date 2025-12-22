#!/usr/bin/env node
/**
 * Test manual cache refresh
 * Run: node scripts/test-manual-refresh.js
 */

require('dotenv').config({ path: '.env.local' });

async function testManualRefresh() {
  console.log('🧪 Testing manual cache refresh...\n');
  
  const CRON_SECRET = process.env.CRON_SECRET;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('📋 Environment check:');
  console.log(`   CRON_SECRET: ${CRON_SECRET ? '✅ Set' : '❌ Not set'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Not set'}`);
  console.log('');
  
  // Try to call refresh-current-month-cache directly with CRON_SECRET
  const baseUrl = 'http://localhost:3000';
  const authToken = CRON_SECRET || SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('🔄 Testing /api/automated/refresh-current-month-cache...');
  try {
    const response = await fetch(`${baseUrl}/api/automated/refresh-current-month-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    if (data.summary) {
      console.log(`   Summary: ${JSON.stringify(data.summary)}`);
    }
    if (data.error) {
      console.log(`   Error: ${data.error}`);
      console.log(`   Message: ${data.message || data.details || 'N/A'}`);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  console.log('');
  
  console.log('🔄 Testing /api/automated/refresh-current-week-cache...');
  try {
    const response = await fetch(`${baseUrl}/api/automated/refresh-current-week-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    if (data.summary) {
      console.log(`   Summary: ${JSON.stringify(data.summary)}`);
    }
    if (data.error) {
      console.log(`   Error: ${data.error}`);
      console.log(`   Message: ${data.message || data.details || 'N/A'}`);
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
  console.log('');
  
  console.log('✅ Test complete!');
}

testManualRefresh().catch(console.error);

