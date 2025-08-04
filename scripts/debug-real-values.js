const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugRealValues() {
  console.log('🔍 DEBUGGING REAL VALUES MISMATCH...\n');

  try {
    // 1. Get jacek's client data
    console.log('📋 Step 1: Getting jacek client data...');
    
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com');

    if (!clients || clients.length === 0) {
      console.error('❌ No client found for jacek');
      return;
    }

    const jacek = clients[0];
    console.log('✅ Jacek client found:', {
      id: jacek.id,
      name: jacek.name,
      email: jacek.email,
      ad_account_id: jacek.ad_account_id
    });

    // 2. Check ALL campaigns for jacek (not just March)
    console.log('\n📊 Step 2: Checking ALL campaigns for jacek...');
    
    const { data: allCampaigns, error: allError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id);

    if (allError) {
      console.error('❌ Error fetching all campaigns:', allError);
      return;
    }

    console.log(`📈 Total campaigns in database: ${allCampaigns.length}`);
    
    if (allCampaigns.length > 0) {
      // Calculate overall totals
      const totalSpend = allCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const totalImpressions = allCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const totalClicks = allCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      
      console.log('\n📊 OVERALL DATABASE TOTALS (all campaigns):');
      console.log(`   Total Spend: ${totalSpend.toFixed(2)} zł`);
      console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`   Total Clicks: ${totalClicks.toLocaleString()}`);
    }

    // 3. Check March 2024 specifically with different date ranges
    console.log('\n📅 Step 3: Checking March 2024 with different date range logic...');
    
    const marchStart = '2024-03-01';
    const marchEnd = '2024-03-31';
    
    // Method 1: Exact date range match
    console.log('\n🔍 Method 1: Exact date range match (2024-03-01 to 2024-03-31)');
    const { data: exactMatch, error: exactError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .eq('date_range_start', marchStart)
      .eq('date_range_end', marchEnd);

    if (exactError) {
      console.error('❌ Error with exact match:', exactError);
    } else {
      console.log(`📊 Exact match campaigns: ${exactMatch.length}`);
      if (exactMatch.length > 0) {
        const spend = exactMatch.reduce((sum, c) => sum + (c.spend || 0), 0);
        const impressions = exactMatch.reduce((sum, c) => sum + (c.impressions || 0), 0);
        const clicks = exactMatch.reduce((sum, c) => sum + (c.clicks || 0), 0);
        console.log(`   Spend: ${spend.toFixed(2)} zł, Impressions: ${impressions}, Clicks: ${clicks}`);
      }
    }

    // Method 2: Overlapping date ranges (current logic)
    console.log('\n🔍 Method 2: Overlapping date ranges (current logic)');
    const { data: overlapping, error: overlapError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .or(`date_range_start.lte.${marchEnd},date_range_end.gte.${marchStart}`);

    if (overlapError) {
      console.error('❌ Error with overlapping:', overlapError);
    } else {
      console.log(`📊 Overlapping campaigns: ${overlapping.length}`);
      if (overlapping.length > 0) {
        const spend = overlapping.reduce((sum, c) => sum + (c.spend || 0), 0);
        const impressions = overlapping.reduce((sum, c) => sum + (c.impressions || 0), 0);
        const clicks = overlapping.reduce((sum, c) => sum + (c.clicks || 0), 0);
        console.log(`   Spend: ${spend.toFixed(2)} zł, Impressions: ${impressions}, Clicks: ${clicks}`);
      }
    }

    // Method 3: Campaigns that START in March
    console.log('\n🔍 Method 3: Campaigns that START in March');
    const { data: startInMarch, error: startError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .gte('date_range_start', marchStart)
      .lte('date_range_start', marchEnd);

    if (startError) {
      console.error('❌ Error with start in March:', startError);
    } else {
      console.log(`📊 Start in March campaigns: ${startInMarch.length}`);
      if (startInMarch.length > 0) {
        const spend = startInMarch.reduce((sum, c) => sum + (c.spend || 0), 0);
        const impressions = startInMarch.reduce((sum, c) => sum + (c.impressions || 0), 0);
        const clicks = startInMarch.reduce((sum, c) => sum + (c.clicks || 0), 0);
        console.log(`   Spend: ${spend.toFixed(2)} zł, Impressions: ${impressions}, Clicks: ${clicks}`);
      }
    }

    // 4. Check what the reports page actually calls
    console.log('\n📡 Step 4: Testing what the reports page actually calls...');
    
    try {
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-for-pdf-generation'
        },
        body: JSON.stringify({
          dateRange: {
            start: marchStart,
            end: marchEnd
          },
          clientId: jacek.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ fetch-live-data API response:');
        console.log(`   Success: ${data.success}`);
        console.log(`   Campaigns: ${data.data?.campaigns?.length || 0}`);
        console.log(`   Total Spend: ${data.data?.stats?.totalSpend || 0} zł`);
        console.log(`   Total Impressions: ${data.data?.stats?.totalImpressions || 0}`);
        console.log(`   Total Clicks: ${data.data?.stats?.totalClicks || 0}`);
        
        if (data.data?.campaigns?.length > 0) {
          console.log('📋 First campaign from API:');
          const first = data.data.campaigns[0];
          console.log(`   Name: ${first.campaign_name}`);
          console.log(`   Spend: ${first.spend} zł`);
          console.log(`   Impressions: ${first.impressions}`);
          console.log(`   Clicks: ${first.clicks}`);
        }
      } else {
        console.log('❌ fetch-live-data API failed:', response.status);
      }
    } catch (error) {
      console.log('❌ API call failed:', error.message);
    }

    // 5. Summary
    console.log('\n🎯 SUMMARY:');
    console.log('   Dashboard shows: 12.45 zł spend, 450 impressions, 9 clicks');
    console.log('   Database shows: 7,225.75 zł spend, 237,863 impressions, 4,224 clicks');
    console.log('   This is a MAJOR mismatch that needs investigation!');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

debugRealValues(); 