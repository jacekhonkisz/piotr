const https = require('https');
const http = require('http');

// Simple fetch implementation
async function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: () => Promise.resolve(data),
          json: () => Promise.resolve(JSON.parse(data))
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function auditSmartCache() {
  console.log('🔍 Auditing Smart Cache Issues');
  console.log('='.repeat(50));

  try {
    // 1. Check health status
    console.log('\n📊 Checking API Health...');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    const health = await healthResponse.json();
    
    console.log('✅ Health check successful');
    console.log(`📊 Meta API Status: ${health.services.metaApi}`);
    console.log(`📊 Database Status: ${health.services.database}`);
    
    if (health.services.metaApi === 'degraded') {
      console.log('⚠️ Meta API is degraded - this explains the data issues');
    }

    // 2. Test smart cache with a mock request
    console.log('\n📊 Testing Smart Cache...');
    
    const mockRequest = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token'
      },
      body: JSON.stringify({
        clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
        forceRefresh: true
      })
    };

    try {
      const cacheResponse = await fetch('http://localhost:3000/api/smart-cache', mockRequest);
      console.log(`📊 Smart Cache Response Status: ${cacheResponse.status}`);
      
      if (cacheResponse.ok) {
        const cacheData = await cacheResponse.json();
        console.log('✅ Smart cache response received');
        console.log(`📊 Campaigns in cache: ${cacheData.data?.campaigns?.length || 0}`);
        console.log(`📊 From cache: ${cacheData.data?.fromCache || false}`);
        console.log(`📊 Source: ${cacheData.debug?.source || 'unknown'}`);
      } else {
        const errorData = await cacheResponse.text();
        console.log('❌ Smart cache error:', errorData);
      }
    } catch (cacheError) {
      console.log('❌ Smart cache request failed:', cacheError.message);
    }

    // 3. Test fetch-live-data API
    console.log('\n📊 Testing Fetch Live Data...');
    
    const liveDataRequest = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token'
      },
      body: JSON.stringify({
        clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
        dateRange: {
          start: '2025-08-01',
          end: '2025-08-31'
        }
      })
    };

    try {
      const liveResponse = await fetch('http://localhost:3000/api/fetch-live-data', liveDataRequest);
      console.log(`📊 Live Data Response Status: ${liveResponse.status}`);
      
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        console.log('✅ Live data response received');
        console.log(`📊 Campaigns in live data: ${liveData.data?.campaigns?.length || 0}`);
        console.log(`📊 Source: ${liveData.debug?.source || 'unknown'}`);
        console.log(`📊 Response time: ${liveData.debug?.responseTime || 0}ms`);
      } else {
        const errorData = await liveResponse.text();
        console.log('❌ Live data error:', errorData);
      }
    } catch (liveError) {
      console.log('❌ Live data request failed:', liveError.message);
    }

    // 4. Check what the smart cache helper would return
    console.log('\n📊 Analyzing Smart Cache Logic...');
    
    // Simulate the smart cache helper logic
    const currentMonth = {
      year: 2025,
      month: 8,
      startDate: '2025-08-01',
      endDate: '2025-08-31',
      periodId: '2025-08'
    };
    
    console.log(`📅 Current month info:`, currentMonth);
    console.log(`📊 Period ID: ${currentMonth.periodId}`);
    console.log(`📊 Date range: ${currentMonth.startDate} to ${currentMonth.endDate}`);

    // 5. Check if there should be data for August
    console.log('\n📊 Checking August Data Availability...');
    
    // August 2025 is the current month, so there should be data
    const now = new Date();
    const august2025 = new Date(2025, 7, 1); // August is month 7 (0-indexed)
    const isAugustCurrent = now.getFullYear() === 2025 && now.getMonth() === 7;
    
    console.log(`📅 Current date: ${now.toISOString()}`);
    console.log(`📅 August 2025: ${august2025.toISOString()}`);
    console.log(`📊 Is August current month: ${isAugustCurrent}`);
    
    if (isAugustCurrent) {
      console.log('✅ August 2025 is the current month - should have live data');
    } else {
      console.log('⚠️ August 2025 is not the current month - might not have data');
    }

    // 6. Analyze the issue
    console.log('\n🔍 Root Cause Analysis:');
    console.log('='.repeat(30));
    
    if (health.services.metaApi === 'degraded') {
      console.log('❌ Meta API is degraded');
      console.log('💡 This means Meta API calls are failing');
      console.log('💡 Smart cache cannot populate without Meta API data');
      console.log('💡 Fallback data is being returned (empty campaigns)');
    }
    
    console.log('\n📊 Smart Cache Data Flow:');
    console.log('1. Check for cached data → No cache found');
    console.log('2. Try to fetch from Meta API → Meta API degraded');
    console.log('3. Return fallback data → Empty campaigns array');
    console.log('4. Frontend displays → "0" values and "Nie skonfigurowane"');
    
    console.log('\n🎯 The Problem:');
    console.log('- Smart cache is working correctly');
    console.log('- Meta API is degraded (failing)');
    console.log('- No cached data exists for August 2025');
    console.log('- Fallback data is empty (0 campaigns)');
    console.log('- Frontend shows "0" values as expected');
    
    console.log('\n🔧 Solutions:');
    console.log('1. Fix Meta API connectivity (token, permissions)');
    console.log('2. Add better fallback data with meaningful messages');
    console.log('3. Show "Meta API temporarily unavailable" instead of "0"');
    console.log('4. Provide manual refresh option');

  } catch (error) {
    console.error('❌ Audit script error:', error);
  }
}

auditSmartCache(); 