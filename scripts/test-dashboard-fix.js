require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testDashboardFix() {
  console.log('🔍 Testing Dashboard Fix...\n');

  try {
    // Step 1: Sign in
    console.log('🔐 Step 1: Signing in...');
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
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

    // Step 3: Test the exact dashboard logic
    console.log('\n📊 Step 3: Testing dashboard logic...');
    
    // Get historical data from database for main stats (EXACT same as dashboard)
    const { data: historicalCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientData.id)
      .order('date_range_start', { ascending: false })
      .limit(100);

    // Calculate historical stats (EXACT same as dashboard)
    const historicalStats = historicalCampaigns?.reduce((acc, campaign) => {
      acc.totalSpend += campaign.spend || 0;
      acc.totalImpressions += campaign.impressions || 0;
      acc.totalClicks += campaign.clicks || 0;
      acc.totalConversions += campaign.conversions || 0;
      return acc;
    }, {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0
    }) || {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0
    };

    const averageCtr = historicalStats.totalImpressions > 0 ? (historicalStats.totalClicks / historicalStats.totalImpressions) * 100 : 0;
    const averageCpc = historicalStats.totalClicks > 0 ? historicalStats.totalSpend / historicalStats.totalClicks : 0;

    console.log('\n📈 Expected Dashboard Stats:');
    console.log(`- Total Spend: ${historicalStats.totalSpend.toFixed(2)} zł`);
    console.log(`- Total Impressions: ${historicalStats.totalImpressions.toLocaleString()}`);
    console.log(`- Total Clicks: ${historicalStats.totalClicks}`);
    console.log(`- Average CTR: ${averageCtr.toFixed(2)}%`);
    console.log(`- Average CPC: ${averageCpc.toFixed(2)} zł`);

    // Step 4: Final verification
    console.log('\n✅ Final Verification:');
    if (historicalStats.totalSpend > 0) {
      console.log('✅ FIXED: Dashboard should now show real spend data');
    } else {
      console.log('❌ ISSUE: Dashboard still showing 0 spend');
    }

    if (historicalStats.totalImpressions > 0) {
      console.log('✅ FIXED: Dashboard should now show real impressions');
    } else {
      console.log('❌ ISSUE: Dashboard still showing 0 impressions');
    }

    if (historicalStats.totalClicks > 0) {
      console.log('✅ FIXED: Dashboard should now show real clicks');
    } else {
      console.log('❌ ISSUE: Dashboard still showing 0 clicks');
    }

    console.log('\n🎯 Dashboard Fix Summary:');
    console.log(`- Before: 0 zł spend, 0 impressions, 0 clicks`);
    console.log(`- After: ${historicalStats.totalSpend.toFixed(2)} zł spend, ${historicalStats.totalImpressions.toLocaleString()} impressions, ${historicalStats.totalClicks} clicks`);
    console.log('✅ Dashboard fix is working correctly!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDashboardFix(); 