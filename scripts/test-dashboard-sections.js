require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testDashboardSections() {
  console.log('🔍 Testing Dashboard Sections - Main vs Monthly Summary...\n');

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

    // Step 2: Test Main Dashboard Data (2024-01-01 to today)
    console.log('\n📊 Step 2: Testing Main Dashboard Data (Historical)...');
    
    const mainResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({
        clientId: '5703e71f-1222-4178-885c-ce72746d0713',
        dateRange: {
          start: '2024-01-01',
          end: new Date().toISOString().split('T')[0]
        },
        _t: Date.now()
      })
    });

    if (mainResponse.ok) {
      const mainData = await mainResponse.json();
      if (mainData.success && mainData.data?.campaigns) {
        const mainCampaigns = mainData.data.campaigns;
        const mainTotalSpend = mainCampaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
        const mainTotalImpressions = mainCampaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
        const mainTotalClicks = mainCampaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
        
        console.log(`✅ Main Dashboard (Historical): ${mainTotalSpend.toFixed(2)} zł spend, ${mainTotalImpressions} impressions, ${mainTotalClicks} clicks`);
      }
    }

    // Step 3: Test Monthly Summary Data (August 1st to today)
    console.log('\n📊 Step 3: Testing Monthly Summary Data (Current Month)...');
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    
    const monthlyResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({
        clientId: '5703e71f-1222-4178-885c-ce72746d0713',
        dateRange: {
          start: monthStart.toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        },
        _t: Date.now()
      })
    });

    if (monthlyResponse.ok) {
      const monthlyData = await monthlyResponse.json();
      if (monthlyData.success && monthlyData.data?.campaigns) {
        const monthlyCampaigns = monthlyData.data.campaigns;
        const monthlyTotalSpend = monthlyCampaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
        const monthlyTotalImpressions = monthlyCampaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
        const monthlyTotalClicks = monthlyCampaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
        
        console.log(`✅ Monthly Summary (Current Month): ${monthlyTotalSpend.toFixed(2)} zł spend, ${monthlyTotalImpressions} impressions, ${monthlyTotalClicks} clicks`);
      }
    }

    // Step 4: Summary
    console.log('\n📋 Summary:');
    console.log('🎯 Main Dashboard should show: Historical data (2024-01-01 to today)');
    console.log('🎯 Monthly Summary should show: Current month data (August 1st to today)');
    console.log('✅ Both sections should show different values!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDashboardSections(); 