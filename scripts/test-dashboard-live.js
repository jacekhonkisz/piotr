require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testDashboardLive() {
  console.log('🔍 Testing Dashboard Live Data Loading...\n');

  try {
    // Step 1: Sign in
    console.log('🔐 Step 1: Signing in...');
    const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'v&6uP*1UqTQN'
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }

    console.log('✅ Signed in successfully');

    // Step 2: Test the dashboard API endpoint directly
    console.log('\n📊 Step 2: Testing dashboard API endpoint...');
    
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({
        clientId: '5703e71f-1222-4178-885c-ce72746d0713', // jac.honkisz@gmail.com client ID
        dateRange: {
          start: '2024-01-01',
          end: new Date().toISOString().split('T')[0]
        },
        _t: Date.now()
      })
    });

    if (!response.ok) {
      console.log(`❌ API Error: ${response.status}`);
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
      return;
    }

    const apiData = await response.json();
    
    if (apiData.success && apiData.data?.campaigns) {
      const campaigns = apiData.data.campaigns;
      console.log(`✅ Found ${campaigns.length} campaigns from Meta API`);
      
      // Calculate stats (same as dashboard)
      const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
      const totalImpressions = campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
      const totalClicks = campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
      const totalConversions = campaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
      
      const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

      console.log('\n📈 Expected Dashboard Stats:');
      console.log(`- Total Spend: ${totalSpend.toFixed(2)} zł`);
      console.log(`- Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`- Total Clicks: ${totalClicks}`);
      console.log(`- Total Conversions: ${totalConversions}`);
      console.log(`- Average CTR: ${averageCtr.toFixed(2)}%`);
      console.log(`- Average CPC: ${averageCpc.toFixed(2)} zł`);

      console.log('\n📋 Campaign Details:');
      campaigns.forEach((campaign, index) => {
        console.log(`  ${index + 1}. ${campaign.campaign_name}`);
        console.log(`     Spend: ${campaign.spend || 0} zł`);
        console.log(`     Impressions: ${campaign.impressions || 0}`);
        console.log(`     Clicks: ${campaign.clicks || 0}`);
        console.log(`     CTR: ${campaign.ctr || 0}%`);
      });

      // Final verification
      console.log('\n✅ Final Verification:');
      if (totalSpend > 0) {
        console.log('✅ SUCCESS: Dashboard should show real Meta API spend data');
        console.log(`   Expected: ${totalSpend.toFixed(2)} zł spend`);
        console.log(`   If you see 0 zł in the dashboard, try refreshing the page or clearing browser cache`);
      } else {
        console.log('⚠️ WARNING: Meta API shows 0 spend');
      }

    } else {
      console.log('❌ No campaign data returned from Meta API');
      if (apiData.error) {
        console.log(`Error: ${apiData.error}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDashboardLive(); 