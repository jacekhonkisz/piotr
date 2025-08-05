require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testDashboardHistoricalData() {
  console.log('🔍 Testing Dashboard Historical Data Loading...\n');

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

    // Step 3: Test the exact dashboard data loading logic
    console.log('\n📊 Step 3: Testing dashboard data loading logic...');
    
    // Get historical data from database for main stats (same as dashboard)
    const { data: historicalCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientData.id)
      .order('date_range_start', { ascending: false })
      .limit(100);

    console.log(`✅ Found ${historicalCampaigns?.length || 0} historical campaigns`);

    // Calculate historical stats (same as dashboard)
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

    console.log('\n📈 Dashboard Historical Stats:');
    console.log(`- Total Spend: ${historicalStats.totalSpend.toFixed(2)} zł`);
    console.log(`- Total Impressions: ${historicalStats.totalImpressions.toLocaleString()}`);
    console.log(`- Total Clicks: ${historicalStats.totalClicks}`);
    console.log(`- Total Conversions: ${historicalStats.totalConversions}`);
    console.log(`- Average CTR: ${averageCtr.toFixed(2)}%`);
    console.log(`- Average CPC: ${averageCpc.toFixed(2)} zł`);

    // Step 4: Verify the data is correct
    console.log('\n✅ Verification:');
    if (historicalStats.totalSpend > 0) {
      console.log('✅ Historical spend data is present');
    } else {
      console.log('❌ Historical spend data is missing');
    }

    if (historicalStats.totalImpressions > 0) {
      console.log('✅ Historical impressions data is present');
    } else {
      console.log('❌ Historical impressions data is missing');
    }

    if (historicalStats.totalClicks > 0) {
      console.log('✅ Historical clicks data is present');
    } else {
      console.log('❌ Historical clicks data is missing');
    }

    // Step 5: Test current month data (should be 0)
    console.log('\n📅 Step 5: Testing current month data...');
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const monthNum = currentDate.getMonth() + 1;
    
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);
    
    const startDate = monthStart.toISOString().split('T')[0];
    const endDate = monthEnd.toISOString().split('T')[0];

    const { data: currentMonthCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientData.id)
      .gte('date_range_start', startDate)
      .lte('date_range_end', endDate);

    const currentMonthStats = currentMonthCampaigns?.reduce((acc, campaign) => {
      acc.totalSpend += campaign.spend || 0;
      acc.totalImpressions += campaign.impressions || 0;
      acc.totalClicks += campaign.clicks || 0;
      return acc;
    }, {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0
    }) || {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0
    };

    console.log('\n📊 Current Month Stats:');
    console.log(`- Total Spend: ${currentMonthStats.totalSpend.toFixed(2)} zł`);
    console.log(`- Total Impressions: ${currentMonthStats.totalImpressions.toLocaleString()}`);
    console.log(`- Total Clicks: ${currentMonthStats.totalClicks}`);

    // Step 6: Summary
    console.log('\n🎯 Summary:');
    console.log(`- Historical Data: ${historicalStats.totalSpend.toFixed(2)} zł spend, ${historicalStats.totalImpressions.toLocaleString()} impressions`);
    console.log(`- Current Month Data: ${currentMonthStats.totalSpend.toFixed(2)} zł spend, ${currentMonthStats.totalImpressions.toLocaleString()} impressions`);
    
    if (historicalStats.totalSpend > 0 && currentMonthStats.totalSpend === 0) {
      console.log('✅ Dashboard should now show historical data instead of 0 values');
    } else {
      console.log('❌ Dashboard data loading issue persists');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDashboardHistoricalData(); 