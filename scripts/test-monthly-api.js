require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testMonthlyAPI() {
  console.log('🧪 Testing Updated API with Monthly Data\n');

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

    // Test different months
    const testMonths = [
      { name: 'April 2024', start: '2024-04-01', end: '2024-04-30' },
      { name: 'March 2024', start: '2024-03-01', end: '2024-03-31' },
      { name: 'July 2025', start: '2025-07-01', end: '2025-07-31' },
      { name: 'January 2024', start: '2024-01-01', end: '2024-01-31' },
    ];

    for (const testMonth of testMonths) {
      console.log(`\n📅 Testing ${testMonth.name}...`);
      
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          dateRange: {
            start: testMonth.start,
            end: testMonth.end
          }
        })
      });

      console.log('📊 Response status:', response.status);
      
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
          
          console.log(`\n📊 ${testMonth.name} Totals:`);
          console.log(`   - Total Spend: $${totalSpend.toFixed(2)}`);
          console.log(`   - Total Impressions: ${totalImpressions.toLocaleString()}`);
          console.log(`   - Total Clicks: ${totalClicks.toLocaleString()}`);
          console.log(`   - Average CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%`);
        } else {
          console.log('⚠️ No campaigns found for this month');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testMonthlyAPI(); 