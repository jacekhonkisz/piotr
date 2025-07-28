const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugDashboardFlow() {
  console.log('🔍 Debugging dashboard flow for jac.honkisz@gmail.com...\n');

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

    // Step 3: Get reports from database
    console.log('\n📋 Step 3: Getting reports from database...');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', clientData.id)
      .order('generated_at', { ascending: false })
      .limit(10);

    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
      return;
    }

    console.log(`✅ Found ${reports?.length || 0} reports`);

    // Step 4: Get campaigns from database (this is what the dashboard does)
    console.log('\n📊 Step 4: Getting campaigns from database...');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientData.id)
      .order('date_range_start', { ascending: false })
      .limit(50);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`✅ Found ${campaigns?.length || 0} campaigns`);

    // Step 5: Calculate stats (exactly like the dashboard does)
    console.log('\n🧮 Step 5: Calculating stats...');
    const stats = campaigns.reduce((acc, campaign) => {
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
    });

    const averageCtr = stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions) * 100 : 0;
    const averageCpc = stats.totalClicks > 0 ? stats.totalSpend / stats.totalClicks : 0;

    console.log('📊 Calculated Stats:');
    console.log('- Total Spend:', stats.totalSpend);
    console.log('- Total Impressions:', stats.totalImpressions);
    console.log('- Total Clicks:', stats.totalClicks);
    console.log('- Total Conversions:', stats.totalConversions);
    console.log('- Average CTR:', averageCtr);
    console.log('- Average CPC:', averageCpc);

    // Step 6: Check if campaigns have data
    console.log('\n🔍 Step 6: Checking campaign data...');
    if (campaigns && campaigns.length > 0) {
      console.log('📈 Sample campaigns:');
      campaigns.slice(0, 3).forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.campaign_name || campaign.campaign_id}`);
        console.log(`   - Spend: ${campaign.spend} (type: ${typeof campaign.spend})`);
        console.log(`   - Impressions: ${campaign.impressions} (type: ${typeof campaign.impressions})`);
        console.log(`   - Clicks: ${campaign.clicks} (type: ${typeof campaign.clicks})`);
        console.log(`   - CTR: ${campaign.ctr} (type: ${typeof campaign.ctr})`);
      });
    }

    // Step 7: Check if the issue is with the data types
    console.log('\n🔍 Step 7: Checking data types...');
    const sampleCampaign = campaigns[0];
    if (sampleCampaign) {
      console.log('Sample campaign data types:');
      console.log('- spend:', typeof sampleCampaign.spend, 'value:', sampleCampaign.spend);
      console.log('- impressions:', typeof sampleCampaign.impressions, 'value:', sampleCampaign.impressions);
      console.log('- clicks:', typeof sampleCampaign.clicks, 'value:', sampleCampaign.clicks);
      console.log('- ctr:', typeof sampleCampaign.ctr, 'value:', sampleCampaign.ctr);
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

debugDashboardFlow(); 