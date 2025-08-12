require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL = 'http://localhost:3000';

async function getSystemUserToken() {
  console.log('🔐 Getting system user authentication...');
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    if (!data.session?.access_token) {
      throw new Error('No access token received');
    }

    console.log('✅ Authentication successful');
    return data.session.access_token;
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    throw error;
  }
}

function checkIfCurrentMonth(periodId, viewType) {
  if (viewType === 'monthly') {
    const [year, month] = periodId.split('-').map(Number);
    const currentDate = new Date();
    return year === currentDate.getFullYear() && month === (currentDate.getMonth() + 1);
  }
  return false;
}

function generateDateRange(periodId, viewType) {
  if (viewType === 'monthly') {
    const [year, month] = periodId.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  }
  return null;
}

async function testReportsPageLogic() {
  console.log('🧪 Testing EXACT Reports Page Logic for May 2025');
  console.log('🎯 Replicating the exact flow: Previous month detection → API call');
  console.log('=' .repeat(60));
  
  try {
    const token = await getSystemUserToken();
    
    // Belmonte Hotel ID (from previous test)
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    const periodId = '2025-5'; // May 2025
    const viewType = 'monthly';
    
    // Step 1: Check if this is current month (reports page logic)
    const isCurrentMonth = checkIfCurrentMonth(periodId, viewType);
    console.log(`\n📅 Period Analysis:`);
    console.log(`   Period: ${periodId}`);
    console.log(`   Is Current Month: ${isCurrentMonth}`);
    console.log(`   Expected behavior: ${isCurrentMonth ? 'Fetch live data' : 'Use stored data'}`);
    
    // Step 2: Generate exact date range (reports page logic)
    const dateRange = generateDateRange(periodId, viewType);
    console.log(`\n📅 Generated Date Range:`);
    console.log(`   Start: ${dateRange.start}`);
    console.log(`   End: ${dateRange.end}`);
    
    // Step 3: Make exact same API call as reports page
    const requestBody = {
      dateRange: {
        start: dateRange.start,
        end: dateRange.end
      },
      clientId: clientId
    };
    
    console.log(`\n📡 Making API call exactly like reports page:`);
    console.log(`   Endpoint: /api/fetch-live-data`);
    console.log(`   Request body:`, JSON.stringify(requestBody, null, 2));
    
    const startTime = Date.now();
    
    const response = await fetch(`${BASE_URL}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`\n📊 API Response:`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response time: ${responseTime}ms`);
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`\n📈 Response Data:`);
      console.log(`   Success: ${data.success}`);
      console.log(`   Campaigns found: ${data.campaigns?.length || 0}`);
      console.log(`   Data source: ${data.dataSource || 'unknown'}`);
      console.log(`   From cache: ${data.fromCache || false}`);
      console.log(`   From storage: ${data.fromStorage || false}`);
      
      if (data.campaigns && data.campaigns.length > 0) {
        console.log(`\n✅ CAMPAIGNS FOUND! Processing data...`);
        
        // Calculate totals exactly like reports page would
        const totals = data.campaigns.reduce((acc, campaign) => {
          acc.spend += parseFloat(campaign.spend || 0);
          acc.impressions += parseInt(campaign.impressions || 0);
          acc.clicks += parseInt(campaign.clicks || 0);
          acc.conversions += parseInt(campaign.conversions || 0);
          return acc;
        }, { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
        
        console.log(`\n📊 Calculated Totals (like reports page shows):`);
        console.log(`   💰 Spend: $${totals.spend.toFixed(2)} (${totals.spend.toFixed(2)} zł)`);
        console.log(`   👁️ Impressions: ${totals.impressions.toLocaleString()}`);
        console.log(`   🖱️ Clicks: ${totals.clicks.toLocaleString()}`);
        console.log(`   🎯 Conversions: ${totals.conversions.toLocaleString()}`);
        
        console.log(`\n🔍 COMPARISON WITH REPORTS PAGE:`);
        console.log(`   Reports page shows: 5282,26 zł, 540.4K impressions, 7.5K clicks`);
        console.log(`   API returns: ${totals.spend.toFixed(2)} zł, ${(totals.impressions/1000).toFixed(1)}K impressions, ${(totals.clicks/1000).toFixed(1)}K clicks`);
        
        if (Math.abs(totals.spend - 5282.26) < 1) {
          console.log(`   ✅ MATCH! This is the real data source for reports page`);
        } else {
          console.log(`   ❌ Different values - this might not be the same source`);
        }
        
      } else {
        console.log(`\n❌ NO CAMPAIGNS FOUND`);
        
        if (!isCurrentMonth) {
          console.log(`\n💡 ANALYSIS:`);
          console.log(`   🔍 Previous month with no campaigns suggests:`);
          console.log(`   1. Reports page might be using a different endpoint`);
          console.log(`   2. Or using smart-fetch-data that falls back to storage`);
          console.log(`   3. Or the API behavior changed since reports page was loaded`);
        }
      }
      
    } else {
      const errorText = await response.text();
      console.log(`\n❌ API Error:`);
      console.log(`   Error: ${errorText}`);
    }
    
    console.log(`\n🎯 CONCLUSION:`);
    if (isCurrentMonth) {
      console.log(`   📅 Current month: API should return live Meta data`);
    } else {
      console.log(`   📅 Previous month: API should prioritize stored data`);
    }
    console.log(`   ⚡ Response time: ${responseTime}ms ${responseTime < 1000 ? '(Fast - likely cached/stored)' : '(Slow - likely live API)'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testReportsPageLogic(); 