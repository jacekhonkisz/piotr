require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testAPIFix() {
  console.log('🧪 Testing API Fix with Updated Date Range Logic\n');

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

    // Test 1: Request data for July 2025 (should now use full year range)
    console.log('\n📅 Test 1: Requesting July 2025 data...');
    const response1 = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: {
          start: '2025-07-01',
          end: '2025-07-31'
        }
      })
    });

    console.log('📊 Response status:', response1.status);
    
    if (response1.ok) {
      const result1 = await response1.json();
      console.log('✅ July 2025 API Response:');
      console.log('- Success:', result1.success);
      console.log('- Campaigns count:', result1.data?.campaigns?.length || 0);
      console.log('- Debug info:', result1.debug);
      
      if (result1.data?.campaigns?.length > 0) {
        console.log('\n📈 Campaigns found:');
        result1.data.campaigns.forEach((campaign, index) => {
          console.log(`${index + 1}. ${campaign.campaign_name || campaign.campaign_id}`);
          console.log(`   - Spend: $${campaign.spend}`);
          console.log(`   - Impressions: ${campaign.impressions}`);
          console.log(`   - Clicks: ${campaign.clicks}`);
          console.log(`   - CTR: ${campaign.ctr}%`);
        });
      } else {
        console.log('⚠️ Still no campaigns found');
      }
    } else {
      const errorText = await response1.text();
      console.error('❌ July 2025 API Error:', errorText);
    }

    // Test 2: Request data for 2024 (should work with full year)
    console.log('\n📅 Test 2: Requesting 2024 data...');
    const response2 = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31'
        }
      })
    });

    console.log('📊 Response status:', response2.status);
    
    if (response2.ok) {
      const result2 = await response2.json();
      console.log('✅ 2024 API Response:');
      console.log('- Success:', result2.success);
      console.log('- Campaigns count:', result2.data?.campaigns?.length || 0);
      
      if (result2.data?.campaigns?.length > 0) {
        console.log('\n📈 2024 Campaigns found:');
        result2.data.campaigns.forEach((campaign, index) => {
          console.log(`${index + 1}. ${campaign.campaign_name || campaign.campaign_id}`);
          console.log(`   - Spend: $${campaign.spend}`);
          console.log(`   - Impressions: ${campaign.impressions}`);
          console.log(`   - Clicks: ${campaign.clicks}`);
          console.log(`   - CTR: ${campaign.ctr}%`);
        });
      }
    } else {
      const errorText = await response2.text();
      console.error('❌ 2024 API Error:', errorText);
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

testAPIFix(); 