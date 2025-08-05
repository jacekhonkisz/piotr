require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testDashboardMetaAPI() {
  console.log('🔍 Testing Dashboard Meta API Data Loading...\n');

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

    // Step 2: Get client data
    console.log('\n🔍 Step 2: Getting client data...');
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', user.email)
      .single();

    if (clientError || !clientData) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', clientData.id);

    // Step 3: Test the exact dashboard Meta API loading logic
    console.log('\n📊 Step 3: Testing dashboard Meta API loading logic...');
    
    // Simulate the exact dashboard logic (updated)
    const startDate = new Date(2024, 0, 1); // January 1, 2024
    const today = new Date();
    
    const dateRange = {
      start: startDate.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
    
    console.log(`📅 Date range: ${dateRange.start} to ${dateRange.end} (historical data from Meta API)`);

    // Fetch data from Meta API (same as dashboard)
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
          clientId: clientData.id,
          dateRange: {
            start: dateRange.start,
            end: dateRange.end
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

      console.log('\n📈 Dashboard Meta API Stats:');
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
      } else {
        console.log('⚠️ WARNING: Meta API shows 0 spend for current period');
        console.log('   This means campaigns are not spending in the current month');
      }

      if (totalImpressions > 0) {
        console.log('✅ SUCCESS: Dashboard should show real Meta API impressions');
      } else {
        console.log('⚠️ WARNING: Meta API shows 0 impressions for current period');
      }

      if (totalClicks > 0) {
        console.log('✅ SUCCESS: Dashboard should show real Meta API clicks');
      } else {
        console.log('⚠️ WARNING: Meta API shows 0 clicks for current period');
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

testDashboardMetaAPI(); 