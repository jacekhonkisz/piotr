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

async function getAllClients() {
  console.log('📋 Fetching all clients to see their IDs...');
  
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, email, ad_account_id')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }

  return clients || [];
}

async function testDifferentVariations(token) {
  console.log('🧪 Testing Different API Call Variations for May 2025');
  console.log('=' .repeat(60));
  
  const clients = await getAllClients();
  console.log('\n📋 Available clients:');
  clients.forEach((client, index) => {
    console.log(`   ${index + 1}. ${client.name} (${client.id})`);
    console.log(`      Email: ${client.email}`);
    console.log(`      Ad Account: ${client.ad_account_id || 'Not set'}\n`);
  });
  
  // Find Belmonte Hotel
  const belmonte = clients.find(c => c.name.includes('Belmonte'));
  const havet = clients.find(c => c.name.includes('Havet'));
  
  if (!belmonte) {
    console.log('❌ Belmonte Hotel not found');
    return;
  }
  
  console.log(`🎯 Testing with Belmonte Hotel: ${belmonte.id}`);
  
  // Test 1: Exact same call as my previous test
  console.log('\n🔍 Test 1: My Original Call');
  console.log('-'.repeat(40));
  
  try {
    const response1 = await fetch(`${BASE_URL}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: belmonte.id,
        dateRange: {
          start: '2025-05-01',
          end: '2025-05-31'
        }
      })
    });
    
    console.log(`   Status: ${response1.status} ${response1.statusText}`);
    
    if (response1.ok) {
      const data1 = await response1.json();
      console.log(`   Success: ${data1.success}`);
      console.log(`   Campaigns: ${data1.campaigns?.length || 0}`);
      console.log(`   Data source: ${data1.dataSource || 'unknown'}`);
      console.log(`   From cache: ${data1.fromCache || false}`);
      
      if (data1.campaigns && data1.campaigns.length > 0) {
        console.log(`   ✅ FOUND DATA! First campaign: ${data1.campaigns[0].campaign_name}`);
      } else {
        console.log(`   ❌ No campaigns found`);
      }
    } else {
      const errorText = await response1.text();
      console.log(`   ❌ Error: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
  
  // Test 2: Try with different date format
  console.log('\n🔍 Test 2: Different Date Format');
  console.log('-'.repeat(40));
  
  try {
    const response2 = await fetch(`${BASE_URL}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: belmonte.id,
        dateRange: {
          start: '2025-05-01T00:00:00Z',
          end: '2025-05-31T23:59:59Z'
        }
      })
    });
    
    console.log(`   Status: ${response2.status} ${response2.statusText}`);
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log(`   Success: ${data2.success}`);
      console.log(`   Campaigns: ${data2.campaigns?.length || 0}`);
      
      if (data2.campaigns && data2.campaigns.length > 0) {
        console.log(`   ✅ FOUND DATA! First campaign: ${data2.campaigns[0].campaign_name}`);
      } else {
        console.log(`   ❌ No campaigns found`);
      }
    } else {
      const errorText = await response2.text();
      console.log(`   ❌ Error: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
  
  // Test 3: Try smart-fetch-data endpoint
  console.log('\n🔍 Test 3: Smart Fetch Data Endpoint');
  console.log('-'.repeat(40));
  
  try {
    const response3 = await fetch(`${BASE_URL}/api/smart-fetch-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: belmonte.id,
        dateRange: {
          startDate: '2025-05-01',
          endDate: '2025-05-31'
        }
      })
    });
    
    console.log(`   Status: ${response3.status} ${response3.statusText}`);
    
    if (response3.ok) {
      const data3 = await response3.json();
      console.log(`   Success: ${data3.success}`);
      console.log(`   Campaigns: ${data3.campaigns?.length || 0}`);
      console.log(`   From storage: ${data3.fromStorage || false}`);
      console.log(`   Data source: ${data3.dataSource || 'unknown'}`);
      
      if (data3.campaigns && data3.campaigns.length > 0) {
        console.log(`   ✅ FOUND DATA! First campaign: ${data3.campaigns[0].campaign_name}`);
        
        // Calculate totals
        const totals = data3.campaigns.reduce((acc, camp) => {
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
      } else {
        console.log(`   ❌ No campaigns found`);
      }
    } else {
      const errorText = await response3.text();
      console.log(`   ❌ Error: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
  
  // Test 4: Try with current month for comparison
  console.log('\n🔍 Test 4: Current Month (August 2025) for Comparison');
  console.log('-'.repeat(40));
  
  try {
    const response4 = await fetch(`${BASE_URL}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: belmonte.id,
        dateRange: {
          start: '2025-08-01',
          end: '2025-08-31'
        }
      })
    });
    
    console.log(`   Status: ${response4.status} ${response4.statusText}`);
    
    if (response4.ok) {
      const data4 = await response4.json();
      console.log(`   Success: ${data4.success}`);
      console.log(`   Campaigns: ${data4.campaigns?.length || 0}`);
      console.log(`   Data source: ${data4.dataSource || 'unknown'}`);
      
      if (data4.campaigns && data4.campaigns.length > 0) {
        console.log(`   ✅ FOUND DATA! August has campaigns`);
      } else {
        console.log(`   ❌ No campaigns found in August either`);
      }
    } else {
      const errorText = await response4.text();
      console.log(`   ❌ Error: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}`);
  }
}

async function runDebugTest() {
  try {
    const token = await getSystemUserToken();
    await testDifferentVariations(token);
    
    console.log('\n' + '='.repeat(60));
    console.log('💡 NEXT STEPS:');
    console.log('   1. Check which test found data (if any)');
    console.log('   2. Compare with what you see in the reports page');
    console.log('   3. If smart-fetch-data worked, use that endpoint');
    console.log('   4. If none worked, there might be a client ID mismatch');
    
  } catch (error) {
    console.error('❌ Debug test failed:', error.message);
  }
}

runDebugTest(); 