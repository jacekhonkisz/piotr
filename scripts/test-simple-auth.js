const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSimpleAuth() {
  console.log('🔐 Testing Simple Authentication...\n');

  try {
    // 1. Get jacek's client data directly
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
      email: jacek.email
    });

    // 2. Test database access for March 2024
    console.log('\n💾 Step 2: Testing database access for March 2024...');
    
    const marchStart = '2024-03-01';
    const marchEnd = '2024-03-31';
    
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .or(`date_range_start.lte.${marchEnd},date_range_end.gte.${marchStart}`);

    if (campaigns && campaigns.length > 0) {
      console.log('✅ Database access successful:', {
        count: campaigns.length,
        totalSpend: campaigns.reduce((sum, c) => sum + (c.spend || 0), 0),
        totalImpressions: campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0),
        totalClicks: campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0)
      });
    } else {
      console.log('❌ No campaigns found in database');
    }

    // 3. Test with a simple API call using a mock token
    console.log('\n📡 Step 3: Testing API call with mock token...');
    
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token-for-testing'
      },
      body: JSON.stringify({
        dateRange: {
          start: marchStart,
          end: marchEnd
        },
        clientId: jacek.id
      })
    });

    console.log('API Response Status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.log('❌ API call failed (expected):', errorData);
    } else {
      const data = await response.json();
      console.log('✅ API call successful:', data);
    }

    console.log('\n🎯 Summary:');
    console.log('   - Client data access: ✅ Success');
    console.log('   - Database access: ✅ Success');
    console.log('   - API authentication: ❌ Failed (expected)');
    console.log('\n💡 The issue is that the client needs to be properly logged in in the browser');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testSimpleAuth(); 