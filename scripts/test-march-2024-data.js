const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMarch2024Data() {
  console.log('🔍 Testing March 2024 Data for Jacek...\n');

  try {
    // 1. Get jacek's client data
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com');

    if (!clients || clients.length === 0) {
      console.error('❌ No client found for jacek');
      return;
    }

    const jacek = clients[0];
    console.log('✅ Jacek client:', {
      id: jacek.id,
      name: jacek.name,
      ad_account_id: jacek.ad_account_id
    });

    // 2. Check database for March 2024 campaigns
    const marchStart = '2024-03-01';
    const marchEnd = '2024-03-31';

    console.log('\n💾 Checking database for March 2024 campaigns...');
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .eq('date_range_start', marchStart)
      .eq('date_range_end', marchEnd);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
    } else {
      console.log('✅ Database campaigns found:', {
        count: campaigns?.length || 0,
        campaigns: campaigns?.map(c => ({
          campaign_name: c.campaign_name,
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks,
          conversions: c.conversions
        })) || []
      });
    }

    // 3. Check all campaigns for jacek
    console.log('\n📊 All campaigns for jacek:');
    
    const { data: allCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .order('date_range_start', { ascending: false })
      .limit(10);

    if (allCampaigns && allCampaigns.length > 0) {
      console.log('✅ Recent campaigns:', allCampaigns.map(c => ({
        date_range: `${c.date_range_start} to ${c.date_range_end}`,
        campaign_name: c.campaign_name,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks
      })));
    } else {
      console.log('❌ No campaigns found in database');
    }

    // 4. Check if there are any campaigns with 0 values
    console.log('\n🔍 Checking for campaigns with 0 values...');
    
    const { data: zeroCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .eq('spend', 0)
      .eq('impressions', 0)
      .eq('clicks', 0);

    if (zeroCampaigns && zeroCampaigns.length > 0) {
      console.log('⚠️ Found campaigns with 0 values:', zeroCampaigns.map(c => ({
        date_range: `${c.date_range_start} to ${c.date_range_end}`,
        campaign_name: c.campaign_name
      })));
    } else {
      console.log('✅ No campaigns with all 0 values found');
    }

    console.log('\n🎯 Summary:');
    console.log(`   - March 2024 campaigns in DB: ${campaigns?.length || 0}`);
    console.log(`   - Total campaigns for jacek: ${allCampaigns?.length || 0}`);
    console.log(`   - Campaigns with 0 values: ${zeroCampaigns?.length || 0}`);

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testMarch2024Data(); 