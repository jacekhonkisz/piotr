const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMarch2024Simple() {
  console.log('🔍 Simple March 2024 Test for Jacek...\n');

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

    // 2. Check what campaigns exist for March 2024 (any part of March)
    console.log('\n📊 Checking for any March 2024 campaigns...');
    
    const { data: marchCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .gte('date_range_start', '2024-03-01')
      .lte('date_range_start', '2024-03-31');

    if (marchCampaigns && marchCampaigns.length > 0) {
      console.log('✅ Found March 2024 campaigns:', marchCampaigns.map(c => ({
        date_range: `${c.date_range_start} to ${c.date_range_end}`,
        campaign_name: c.campaign_name,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks
      })));
    } else {
      console.log('❌ No March 2024 campaigns found');
    }

    // 3. Check what campaigns exist for April 2024 (to compare)
    console.log('\n📊 Checking for April 2024 campaigns...');
    
    const { data: aprilCampaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .gte('date_range_start', '2024-04-01')
      .lte('date_range_start', '2024-04-30');

    if (aprilCampaigns && aprilCampaigns.length > 0) {
      console.log('✅ Found April 2024 campaigns:', aprilCampaigns.map(c => ({
        date_range: `${c.date_range_start} to ${c.date_range_end}`,
        campaign_name: c.campaign_name,
        spend: c.spend,
        impressions: c.impressions,
        clicks: c.clicks
      })));
    } else {
      console.log('❌ No April 2024 campaigns found');
    }

    // 4. Check the exact date ranges that exist
    console.log('\n📅 Checking all available date ranges...');
    
    const { data: allRanges } = await supabase
      .from('campaigns')
      .select('date_range_start, date_range_end, campaign_name, spend')
      .eq('client_id', jacek.id)
      .order('date_range_start', { ascending: true });

    if (allRanges && allRanges.length > 0) {
      console.log('✅ Available date ranges:');
      allRanges.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.date_range_start} to ${c.date_range_end} - ${c.campaign_name} (${c.spend} zł)`);
      });
    }

    console.log('\n🎯 Analysis:');
    console.log(`   - March 2024 campaigns: ${marchCampaigns?.length || 0}`);
    console.log(`   - April 2024 campaigns: ${aprilCampaigns?.length || 0}`);
    console.log(`   - Total campaigns: ${allRanges?.length || 0}`);
    
    if (marchCampaigns?.length === 0) {
      console.log('\n⚠️ ISSUE IDENTIFIED:');
      console.log('   - No March 2024 campaigns in database');
      console.log('   - PDF generation will show 0 values');
      console.log('   - Reports page works because it fetches from Meta API');
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testMarch2024Simple(); 