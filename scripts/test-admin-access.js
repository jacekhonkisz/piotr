require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAdminAccess() {
  console.log('🔍 Testing Admin Access to Clients...\n');

  try {
    // Get admin user profile
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'admin@example.com')
      .single();

    if (profileError || !adminProfile) {
      console.error('❌ Admin profile not found:', profileError);
      return;
    }

    console.log('👤 Admin Profile:');
    console.log(`   ID: ${adminProfile.id}`);
    console.log(`   Email: ${adminProfile.email}`);
    console.log(`   Role: ${adminProfile.role}`);
    console.log(`   Created: ${adminProfile.created_at}`);

    // Get all clients for this admin
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', adminProfile.id);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`\n📋 Found ${clients.length} clients for admin:`);
    clients.forEach((client, index) => {
      console.log(`   ${index + 1}. ${client.name} (${client.email})`);
      console.log(`      ID: ${client.id}`);
      console.log(`      Ad Account: ${client.ad_account_id}`);
    });

    // Test authentication with admin credentials
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get admin session:', sessionError);
      return;
    }

    console.log('\n🔐 Admin session obtained successfully');
    console.log(`   Access Token: ${session.access_token ? 'Present' : 'Missing'}`);

    // Test access to each client
    for (const client of clients) {
      console.log(`\n🧪 Testing access to ${client.name}...`);
      
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId: client.id,
          dateRange: {
            start: '2025-08-01',
            end: '2025-08-07'
          }
        })
      });

      console.log(`   Response Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Success - Campaigns: ${data.data?.campaigns?.length || 0}`);
        console.log(`   ✅ Total Spend: ${data.data?.stats?.totalSpend || 0}`);
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Error: ${errorText}`);
      }
    }

    console.log('\n✅ Admin access test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAdminAccess(); 