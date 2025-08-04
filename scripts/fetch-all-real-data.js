const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchAllRealData() {
  console.log('🔍 FETCHING ALL REAL DATA FOR jac.honkisz@gmail.com...\n');

  try {
    // 1. Get jacek's client data
    console.log('📋 Step 1: Getting jacek client data...');
    
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com');

    if (!clients || clients.length === 0) {
      console.error('❌ No client found for jac.honkisz@gmail.com');
      return;
    }

    const jacek = clients[0];
    console.log('✅ Jacek client found:', {
      id: jacek.id,
      name: jacek.name,
      email: jacek.email,
      ad_account_id: jacek.ad_account_id,
      meta_access_token: jacek.meta_access_token ? 'EXISTS' : 'MISSING'
    });

    // 2. Get ALL campaigns for jacek
    console.log('\n📊 Step 2: Getting ALL campaigns for jacek...');
    
    const { data: allCampaigns, error: allError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .order('date_range_start', { ascending: true });

    if (allError) {
      console.error('❌ Error fetching campaigns:', allError);
      return;
    }

    console.log(`📈 Total campaigns found: ${allCampaigns.length}`);

    if (allCampaigns.length === 0) {
      console.log('⚠️ No campaigns found in database!');
      return;
    }

    // 3. Show ALL campaigns with details
    console.log('\n📋 ALL CAMPAIGNS IN DATABASE:');
    console.log('='.repeat(100));
    
    allCampaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.campaign_name}`);
      console.log(`   ID: ${campaign.campaign_id}`);
      console.log(`   Spend: ${campaign.spend || 0} zł`);
      console.log(`   Impressions: ${campaign.impressions || 0}`);
      console.log(`   Clicks: ${campaign.clicks || 0}`);
      console.log(`   Conversions: ${campaign.conversions || 0}`);
      console.log(`   CTR: ${campaign.ctr || 0}%`);
      console.log(`   CPC: ${campaign.cpc || 0} zł`);
      console.log(`   Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
      console.log(`   Status: ${campaign.status || 'N/A'}`);
      console.log('   ' + '-'.repeat(50));
    });

    // 4. Calculate totals
    console.log('\n📊 DATABASE TOTALS:');
    console.log('='.repeat(50));
    
    const totalSpend = allCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalImpressions = allCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = allCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalConversions = allCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    
    console.log(`Total Spend: ${totalSpend.toFixed(2)} zł`);
    console.log(`Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`Total Clicks: ${totalClicks.toLocaleString()}`);
    console.log(`Total Conversions: ${totalConversions}`);
    console.log(`Average CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%`);
    console.log(`Average CPC: ${totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0} zł`);

    // 5. Group by date ranges
    console.log('\n📅 CAMPAIGNS BY DATE RANGES:');
    console.log('='.repeat(50));
    
    const dateGroups = {};
    allCampaigns.forEach(campaign => {
      const dateKey = `${campaign.date_range_start} to ${campaign.date_range_end}`;
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      dateGroups[dateKey].push(campaign);
    });

    Object.entries(dateGroups).forEach(([dateRange, campaigns]) => {
      const spend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const impressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const clicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      
      console.log(`\n📅 ${dateRange} (${campaigns.length} campaigns):`);
      console.log(`   Spend: ${spend.toFixed(2)} zł`);
      console.log(`   Impressions: ${impressions.toLocaleString()}`);
      console.log(`   Clicks: ${clicks.toLocaleString()}`);
    });

    // 6. Check for March 2024 specifically
    console.log('\n🔍 MARCH 2024 ANALYSIS:');
    console.log('='.repeat(50));
    
    const marchStart = '2024-03-01';
    const marchEnd = '2024-03-31';
    
    // Find campaigns that overlap with March 2024
    const marchCampaigns = allCampaigns.filter(campaign => {
      const campaignStart = new Date(campaign.date_range_start);
      const campaignEnd = new Date(campaign.date_range_end);
      const marchStartDate = new Date(marchStart);
      const marchEndDate = new Date(marchEnd);
      
      return campaignStart <= marchEndDate && campaignEnd >= marchStartDate;
    });

    console.log(`Campaigns overlapping with March 2024: ${marchCampaigns.length}`);
    
    if (marchCampaigns.length > 0) {
      const marchSpend = marchCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const marchImpressions = marchCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const marchClicks = marchCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      
      console.log(`March 2024 Totals:`);
      console.log(`   Spend: ${marchSpend.toFixed(2)} zł`);
      console.log(`   Impressions: ${marchImpressions.toLocaleString()}`);
      console.log(`   Clicks: ${marchClicks.toLocaleString()}`);
    }

    // 7. Summary
    console.log('\n🎯 SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total campaigns in database: ${allCampaigns.length}`);
    console.log(`Total spend across all campaigns: ${totalSpend.toFixed(2)} zł`);
    console.log(`Total impressions across all campaigns: ${totalImpressions.toLocaleString()}`);
    console.log(`Total clicks across all campaigns: ${totalClicks.toLocaleString()}`);
    console.log(`Date ranges found: ${Object.keys(dateGroups).length} different ranges`);

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

fetchAllRealData(); 