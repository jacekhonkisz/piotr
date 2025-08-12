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

async function testBothEndpoints() {
  console.log('🧪 Testing Both API Endpoints');
  console.log('🎯 Comparing /api/fetch-live-data vs /api/smart-fetch-data');
  console.log('=' .repeat(60));
  
  try {
    const token = await getSystemUserToken();
    
    // Get Belmonte Hotel client ID  
    const belmonteClientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    
    // Test with a past month that has stored data (August 2025)
    const startDate = '2025-08-01';
    const endDate = '2025-08-31';
    
    console.log(`📅 Testing date range: ${startDate} to ${endDate}`);
    console.log(`📧 Client: Belmonte Hotel (${belmonteClientId})\n`);
    
    // Test 1: /api/fetch-live-data
    console.log('🔍 Testing /api/fetch-live-data:');
    console.log('-'.repeat(40));
    
    const liveDataBody = {
      clientId: belmonteClientId,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };
    
    try {
      const liveResponse = await fetch(`${BASE_URL}/api/fetch-live-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(liveDataBody)
      });
      
      console.log(`   Status: ${liveResponse.status} ${liveResponse.statusText}`);
      
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        console.log(`   ✅ Success: ${liveData.success}`);
        console.log(`   📊 Campaigns: ${liveData.campaigns?.length || 0}`);
        console.log(`   🗄️ Data source: ${liveData.dataSource || 'unknown'}`);
        console.log(`   💾 From cache: ${liveData.fromCache || false}`);
        
        if (liveData.campaigns && liveData.campaigns.length > 0) {
          const totals = liveData.campaigns.reduce((acc, camp) => {
            acc.spend += parseFloat(camp.spend || 0);
            acc.impressions += parseInt(camp.impressions || 0);
            acc.clicks += parseInt(camp.clicks || 0);
            acc.conversions += parseInt(camp.conversions || 0);
            return acc;
          }, { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
          
          console.log(`   💰 Total spend: $${totals.spend.toFixed(2)}`);
          console.log(`   👁️ Total impressions: ${totals.impressions.toLocaleString()}`);
          console.log(`   🖱️ Total clicks: ${totals.clicks.toLocaleString()}`);
          console.log(`   🎯 Total conversions: ${totals.conversions.toLocaleString()}`);
        }
      } else {
        const errorText = await liveResponse.text();
        console.log(`   ❌ Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
    
    console.log('\n');
    
    // Test 2: /api/smart-fetch-data
    console.log('🧠 Testing /api/smart-fetch-data:');
    console.log('-'.repeat(40));
    
    const smartDataBody = {
      clientId: belmonteClientId,
      dateRange: {
        startDate: startDate,
        endDate: endDate
      }
    };
    
    try {
      const smartResponse = await fetch(`${BASE_URL}/api/smart-fetch-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(smartDataBody)
      });
      
      console.log(`   Status: ${smartResponse.status} ${smartResponse.statusText}`);
      
      if (smartResponse.ok) {
        const smartData = await smartResponse.json();
        console.log(`   ✅ Success: ${smartData.success}`);
        console.log(`   📊 Campaigns: ${smartData.campaigns?.length || 0}`);
        console.log(`   🗄️ Data source: ${smartData.dataSource || 'unknown'}`);
        console.log(`   💾 From cache: ${smartData.fromCache || false}`);
        console.log(`   📋 From storage: ${smartData.fromStorage || false}`);
        
        if (smartData.campaigns && smartData.campaigns.length > 0) {
          const totals = smartData.campaigns.reduce((acc, camp) => {
            acc.spend += parseFloat(camp.spend || 0);
            acc.impressions += parseInt(camp.impressions || 0);
            acc.clicks += parseInt(camp.clicks || 0);
            acc.conversions += parseInt(camp.conversions || 0);
            return acc;
          }, { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
          
          console.log(`   💰 Total spend: $${totals.spend.toFixed(2)}`);
          console.log(`   👁️ Total impressions: ${totals.impressions.toLocaleString()}`);
          console.log(`   🖱️ Total clicks: ${totals.clicks.toLocaleString()}`);
          console.log(`   🎯 Total conversions: ${totals.conversions.toLocaleString()}`);
        }
      } else {
        const errorText = await smartResponse.text();
        console.log(`   ❌ Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 CONCLUSION:');
    console.log('   The reports page likely uses /api/smart-fetch-data');
    console.log('   This endpoint combines stored data + live API intelligently');
    console.log('   We should use this endpoint for proper comparison testing');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testBothEndpoints(); 