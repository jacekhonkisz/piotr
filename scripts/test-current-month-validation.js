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

async function testCurrentMonthAPI() {
  console.log('🧪 Testing Current Month API Call');
  console.log('🎯 Using EXACT same format as /reports page');
  console.log('=' .repeat(60));
  
  try {
    const token = await getSystemUserToken();
    
    // Get Belmonte Hotel client ID
    const belmonteClientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
    
    // Test with current month (August 2025)
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const startDate = new Date(year, month, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
    
    console.log(`📅 Testing current month: ${startDate} to ${endDate}`);
    console.log(`📧 Client: Belmonte Hotel (${belmonteClientId})`);
    
    const requestBody = {
      clientId: belmonteClientId,
      dateRange: {
        start: startDate,
        end: endDate
      }
    };
    
    console.log('📡 Request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(`${BASE_URL}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📊 API Response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      return;
    }

    const data = await response.json();
    
    console.log('📈 API Success Response:');
    console.log(`   Success: ${data.success}`);
    console.log(`   Campaigns found: ${data.campaigns?.length || 0}`);
    console.log(`   Data source: ${data.dataSource || 'unknown'}`);
    console.log(`   Cache used: ${data.fromCache || 'false'}`);
    
    if (data.campaigns && data.campaigns.length > 0) {
      console.log('\n📋 First campaign sample:');
      const campaign = data.campaigns[0];
      console.log(`   Campaign ID: ${campaign.campaign_id}`);
      console.log(`   Campaign Name: ${campaign.campaign_name}`);
      console.log(`   Spend: $${campaign.spend}`);
      console.log(`   Impressions: ${campaign.impressions}`);
      console.log(`   Clicks: ${campaign.clicks}`);
      console.log(`   Conversions: ${campaign.conversions}`);
      console.log(`   Status: ${campaign.effective_status || campaign.status}`);
      
      // Calculate totals
      const totals = data.campaigns.reduce((acc, camp) => {
        acc.spend += parseFloat(camp.spend || 0);
        acc.impressions += parseInt(camp.impressions || 0);
        acc.clicks += parseInt(camp.clicks || 0);
        acc.conversions += parseInt(camp.conversions || 0);
        if (camp.effective_status === 'ACTIVE' || camp.status === 'ACTIVE') {
          acc.activeCampaigns++;
        }
        return acc;
      }, { spend: 0, impressions: 0, clicks: 0, conversions: 0, activeCampaigns: 0 });
      
      console.log('\n📊 Calculated Totals:');
      console.log(`   Total Spend: $${totals.spend.toLocaleString()}`);
      console.log(`   Total Impressions: ${totals.impressions.toLocaleString()}`);
      console.log(`   Total Clicks: ${totals.clicks.toLocaleString()}`);
      console.log(`   Total Conversions: ${totals.conversions.toLocaleString()}`);
      console.log(`   Active Campaigns: ${totals.activeCampaigns}`);
      
      console.log('\n✅ API is working correctly!');
    } else {
      console.log('\n⚠️  No campaigns found for current month');
      console.log('   This could be normal if no ads are running');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCurrentMonthAPI(); 