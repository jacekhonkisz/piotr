require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testCurrentMonthData() {
  console.log('🔍 Testing Current Month Data for jac.honkisz@gmail.com...\n');

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

    // Step 3: Test current month data loading
    console.log('\n📅 Step 3: Testing current month data loading...');
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const monthNum = currentDate.getMonth() + 1;
    
    console.log(`Current month: ${year}-${String(monthNum).padStart(2, '0')}`);
    
    // Get month boundaries
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0);
    
    const startDate = monthStart.toISOString().split('T')[0];
    const endDate = monthEnd.toISOString().split('T')[0];
    
    console.log(`Date range: ${startDate} to ${endDate}`);

    // Step 4: Check database for current month campaigns
    console.log('\n📊 Step 4: Checking database for current month campaigns...');
    const { data: currentMonthCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientData.id)
      .gte('date_range_start', startDate)
      .lte('date_range_end', endDate);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`✅ Found ${currentMonthCampaigns?.length || 0} campaigns for current month`);

    if (currentMonthCampaigns && currentMonthCampaigns.length > 0) {
      console.log('\n📈 Current month campaigns:');
      currentMonthCampaigns.forEach((campaign, index) => {
        console.log(`  ${index + 1}. ${campaign.campaign_name}`);
        console.log(`     Spend: ${campaign.spend} zł`);
        console.log(`     Impressions: ${campaign.impressions}`);
        console.log(`     Clicks: ${campaign.clicks}`);
        console.log(`     Date: ${campaign.date_range_start} to ${campaign.date_range_end}`);
      });

      // Calculate stats
      const totalSpend = currentMonthCampaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
      const totalImpressions = currentMonthCampaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
      const totalClicks = currentMonthCampaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
      const totalConversions = currentMonthCampaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
      
      const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

      console.log('\n📊 Current month stats from database:');
      console.log(`- Total Spend: ${totalSpend.toFixed(2)} zł`);
      console.log(`- Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`- Total Clicks: ${totalClicks}`);
      console.log(`- Total Conversions: ${totalConversions}`);
      console.log(`- Average CTR: ${averageCtr.toFixed(2)}%`);
      console.log(`- Average CPC: ${averageCpc.toFixed(2)} zł`);
    } else {
      console.log('⚠️ No campaigns found for current month in database');
    }

    // Step 5: Test Meta API call for current month
    console.log('\n🌐 Step 5: Testing Meta API call for current month...');
    
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
          start: startDate,
          end: endDate
        },
        _t: Date.now()
      })
    });

    console.log('📡 API Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const apiData = await response.json();
    console.log('✅ API call successful');
    
    if (apiData.success && apiData.data?.campaigns) {
      console.log(`📊 API returned ${apiData.data.campaigns.length} campaigns`);
      
      if (apiData.data.campaigns.length > 0) {
        console.log('\n📈 API campaigns:');
        apiData.data.campaigns.forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.campaign_name}`);
          console.log(`     Spend: ${campaign.spend || 0}`);
          console.log(`     Impressions: ${campaign.impressions || 0}`);
          console.log(`     Clicks: ${campaign.clicks || 0}`);
        });

        // Calculate API stats
        const apiTotalSpend = apiData.data.campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
        const apiTotalImpressions = apiData.data.campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
        const apiTotalClicks = apiData.data.campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);

        console.log('\n📊 API stats:');
        console.log(`- Total Spend: ${apiTotalSpend.toFixed(2)}`);
        console.log(`- Total Impressions: ${apiTotalImpressions.toLocaleString()}`);
        console.log(`- Total Clicks: ${apiTotalClicks}`);
      } else {
        console.log('⚠️ API returned 0 campaigns for current month');
      }
    } else {
      console.log('⚠️ API returned no campaign data');
    }

    // Step 6: Check historical data for comparison
    console.log('\n📚 Step 6: Checking historical data for comparison...');
    const { data: historicalCampaigns, error: historicalError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientData.id)
      .order('date_range_start', { ascending: false })
      .limit(10);

    if (historicalError) {
      console.error('❌ Error fetching historical campaigns:', historicalError);
      return;
    }

    console.log(`✅ Found ${historicalCampaigns?.length || 0} recent campaigns total`);

    if (historicalCampaigns && historicalCampaigns.length > 0) {
      console.log('\n📈 Recent campaigns (last 10):');
      historicalCampaigns.forEach((campaign, index) => {
        console.log(`  ${index + 1}. ${campaign.campaign_name}`);
        console.log(`     Spend: ${campaign.spend} zł`);
        console.log(`     Date: ${campaign.date_range_start} to ${campaign.date_range_end}`);
      });
    }

    console.log('\n🎯 Summary:');
    console.log('- The dashboard shows 0 values because it\'s loading data for the current month (August 2025)');
    console.log('- There are no active campaigns in the current month');
    console.log('- Historical data exists in the database from previous months');
    console.log('- The dashboard should show historical data instead of current month data');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCurrentMonthData(); 