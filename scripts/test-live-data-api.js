const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testLiveDataAPI() {
  console.log('🧪 Testing Live Data API for jac.honkisz@gmail.com...\n');

  try {
    // Sign in as jac.honkisz@gmail.com
    console.log('🔐 Signing in as jac.honkisz@gmail.com...');
    const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'v&6uP*1UqTQN' // Using the correct password
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }

    if (!session?.access_token) {
      console.error('❌ No access token received');
      return;
    }

    console.log('✅ Signed in successfully');
    console.log('🔑 Access token:', session.access_token.substring(0, 20) + '...');

    // Test the live data API
    console.log('\n📡 Testing /api/fetch-live-data...');
    
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        dateRange: {
          start: '2024-01-01',
          end: '2025-01-31'
        }
      })
    });

    console.log('📊 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ API Response received');
    
    console.log('\n📋 Response Summary:');
    console.log('- Success:', result.success);
    console.log('- Client:', result.data?.client?.name);
    console.log('- Campaigns count:', result.data?.campaigns?.length || 0);
    console.log('- Stats:', result.data?.stats);
    
    if (result.debug) {
      console.log('\n🔍 Debug Info:');
      console.log('- Token valid:', result.debug.tokenValid);
      console.log('- Campaign insights count:', result.debug.campaignInsightsCount);
      console.log('- Meta API error:', result.debug.metaApiError);
      console.log('- Has Meta API error:', result.debug.hasMetaApiError);
    }

    if (result.data?.campaigns?.length > 0) {
      console.log('\n📈 Campaigns found:');
      result.data.campaigns.forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.campaign_name || campaign.campaign_id}`);
        console.log(`   - Spend: $${campaign.spend}`);
        console.log(`   - Impressions: ${campaign.impressions}`);
        console.log(`   - Clicks: ${campaign.clicks}`);
        console.log(`   - CTR: ${campaign.ctr}%`);
      });
    } else {
      console.log('\n⚠️ No campaigns found - this might explain the zeros in the dashboard');
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testLiveDataAPI(); 