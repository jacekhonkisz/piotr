require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testSpecificMonths() {
  console.log('🧪 Testing Specific Months with Real Data\n');

  try {
    // Sign in as jac.honkisz@gmail.com
    console.log('🔐 Signing in as jac.honkisz@gmail.com...');
    const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'v&6uP*1UqTQN'
    });

    if (signInError || !session) {
      console.error('❌ Sign in failed:', signInError?.message || 'No session');
      return;
    }

    console.log('✅ Signed in successfully');

    // Test specific months that we know have data
    const testMonths = [
      { name: 'March 2024', id: '2024-03', year: 2024, month: 3 },
      { name: 'April 2024', id: '2024-04', year: 2024, month: 4 },
      { name: 'July 2025', id: '2025-07', year: 2025, month: 7 },
    ];

    for (const month of testMonths) {
      console.log(`\n📅 Testing ${month.name} (${month.id})...`);
      
      const startDate = new Date(month.year, month.month - 1, 1);
      const endDate = new Date(month.year, month.month, 0);
      
      // Format dates in local timezone to avoid UTC conversion issues
      const monthStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const monthEndDate = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      
      console.log(`📅 Date range: ${monthStartDate} to ${monthEndDate}`);
      
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          dateRange: {
            start: startDate,
            end: endDate
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ API Response:');
        console.log('- Success:', result.success);
        console.log('- Campaigns count:', result.data?.campaigns?.length || 0);
        console.log('- Debug info:', result.debug);
        
        if (result.data?.campaigns?.length > 0) {
          console.log('\n📈 Campaigns found:');
          let totalSpend = 0;
          let totalImpressions = 0;
          let totalClicks = 0;
          
          result.data.campaigns.forEach((campaign, index) => {
            const spend = parseFloat(campaign.spend || 0);
            const impressions = parseInt(campaign.impressions || 0);
            const clicks = parseInt(campaign.clicks || 0);
            
            totalSpend += spend;
            totalImpressions += impressions;
            totalClicks += clicks;
            
            console.log(`${index + 1}. ${campaign.campaign_name || campaign.campaign_id}`);
            console.log(`   - Spend: $${spend.toFixed(2)}`);
            console.log(`   - Impressions: ${impressions.toLocaleString()}`);
            console.log(`   - Clicks: ${clicks.toLocaleString()}`);
            console.log(`   - CTR: ${campaign.ctr || 0}%`);
            console.log(`   - CPC: $${campaign.cpc || 0}`);
          });
          
          console.log(`\n📊 ${month.name} Totals:`);
          console.log(`   - Total Spend: $${totalSpend.toFixed(2)}`);
          console.log(`   - Total Impressions: ${totalImpressions.toLocaleString()}`);
          console.log(`   - Total Clicks: ${totalClicks.toLocaleString()}`);
          console.log(`   - Average CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%`);
          
          if (totalSpend > 0) {
            console.log(`✅ ${month.name} has real data!`);
          } else {
            console.log(`⚠️ ${month.name} has campaigns but no spend`);
          }
        } else {
          console.log('⚠️ No campaigns found for this month');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
      }
    }

    console.log('\n🎉 Test Summary:');
    console.log('- March 2024: Should show ~$12-25 spend');
    console.log('- April 2024: Should show ~$234-247 spend');
    console.log('- July 2025: Should show $0 (new campaigns)');
    console.log('- The reports page should display this data correctly');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testSpecificMonths(); 