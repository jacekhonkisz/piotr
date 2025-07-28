const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function clearDashboardCache() {
  console.log('🧹 Clearing dashboard cache for jac.honkisz@gmail.com...\n');

  try {
    // Sign in as jac.honkisz@gmail.com
    console.log('🔐 Signing in as jac.honkisz@gmail.com...');
    const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'v&6uP*1UqTQN'
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }

    if (!session?.access_token) {
      console.error('❌ No access token received');
      return;
    }

    console.log('✅ Signed in successfully');

    // Clear the dashboard cache by calling the API with cache-busting headers
    console.log('\n🔄 Clearing cache and fetching fresh data...');
    
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
        dateRange: {
          start: '2024-01-01',
          end: '2025-01-31'
        }
      })
    });

    console.log('📊 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Fresh data fetched successfully');
    
    console.log('\n📊 Fresh Data Summary:');
    console.log('- Total Spend: $' + result.data.stats.totalSpend.toFixed(2));
    console.log('- Impressions: ' + result.data.stats.totalImpressions.toLocaleString());
    console.log('- Clicks: ' + result.data.stats.totalClicks);
    console.log('- CTR: ' + result.data.stats.averageCtr.toFixed(2) + '%');
    console.log('- Campaigns: ' + result.data.campaigns.length);

    console.log('\n🎯 Instructions:');
    console.log('1. Go to your dashboard in the browser');
    console.log('2. Click the "Refresh Data" button');
    console.log('3. You should now see the real data instead of zeros');
    console.log('4. If you still see zeros, try logging out and back in');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

clearDashboardCache(); 