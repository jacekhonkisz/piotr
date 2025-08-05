require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testMetaAPIRealData() {
  console.log('🔍 Testing Meta API for Real Data...\n');

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

    // Step 3: Test different date ranges to find real data
    console.log('\n📅 Step 3: Testing different date ranges...');
    
    // Calculate dynamic date ranges based on today
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    const dateRanges = [
      { name: 'Last 7 days', start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: todayString },
      { name: 'Last 30 days', start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: todayString },
      { name: 'Last 90 days', start: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: todayString },
      { name: 'Last 6 months', start: new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: todayString },
      { name: 'Last year', start: new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: todayString },
      { name: 'Current month', start: new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0], end: todayString },
      { name: 'Previous month', start: new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0], end: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0] },
      { name: 'Two months ago', start: new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().split('T')[0], end: new Date(today.getFullYear(), today.getMonth() - 1, 0).toISOString().split('T')[0] }
    ];

    for (const range of dateRanges) {
      console.log(`\n📊 Testing: ${range.name} (${range.start} to ${range.end})`);
      
      try {
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
              start: range.start,
              end: range.end
            },
            _t: Date.now()
          })
        });

        if (!response.ok) {
          console.log(`❌ API Error: ${response.status}`);
          continue;
        }

        const apiData = await response.json();
        
        if (apiData.success && apiData.data?.campaigns) {
          const campaigns = apiData.data.campaigns;
          const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
          const totalImpressions = campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
          const totalClicks = campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);

          console.log(`  📈 Results: ${campaigns.length} campaigns`);
          console.log(`  💰 Spend: ${totalSpend.toFixed(2)} zł`);
          console.log(`  👁️ Impressions: ${totalImpressions.toLocaleString()}`);
          console.log(`  🎯 Clicks: ${totalClicks}`);

          if (totalSpend > 0) {
            console.log(`  ✅ FOUND REAL DATA!`);
            break;
          }
        } else {
          console.log(`  ❌ No data returned`);
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    // Step 4: Check campaign status in Meta API
    console.log('\n🔍 Step 4: Checking campaign status...');
    
    try {
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
            start: '2025-08-01',
            end: '2025-08-31'
          },
          _t: Date.now()
        })
      });

      if (response.ok) {
        const apiData = await response.json();
        
        if (apiData.success && apiData.data?.campaigns) {
          console.log('\n📋 Campaign Status in Meta API:');
          apiData.data.campaigns.forEach((campaign, index) => {
            console.log(`  ${index + 1}. ${campaign.campaign_name}`);
            console.log(`     Status: ${campaign.status || 'Unknown'}`);
            console.log(`     Spend: ${campaign.spend || 0} zł`);
            console.log(`     Impressions: ${campaign.impressions || 0}`);
            console.log(`     Clicks: ${campaign.clicks || 0}`);
          });
        }
      }
    } catch (error) {
      console.log(`❌ Error checking campaign status: ${error.message}`);
    }

    console.log('\n🎯 Summary:');
    console.log('- The Meta API is returning real campaign data but with 0 values');
    console.log('- This suggests campaigns are paused or inactive in the current period');
    console.log('- To get real data, campaigns need to be active or we need to look at historical periods');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testMetaAPIRealData(); 