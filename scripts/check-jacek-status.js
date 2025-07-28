const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJacekStatus() {
  try {
    console.log('🔍 Checking jacek account status...\n');

    // Get user details using admin API
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error listing users:', usersError);
      return;
    }

    const jacek = users.find(u => u.email === 'jac.honkisz@gmail.com');
    
    if (!jacek) {
      console.log('❌ jacek user not found');
      return;
    }

    console.log('📋 jacek account details:');
    console.log(`   ID: ${jacek.id}`);
    console.log(`   Email: ${jacek.email}`);
    console.log(`   Created: ${jacek.created_at}`);
    console.log(`   Last sign in: ${jacek.last_sign_in_at}`);
    console.log(`   Confirmed: ${jacek.email_confirmed_at ? 'Yes' : 'No'}`);
    console.log(`   Banned: ${jacek.banned_until ? 'Yes' : 'No'}`);
    console.log(`   Role: ${jacek.role}`);

    // Check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', jacek.id)
      .single();

    if (profileError) {
      console.log(`   ❌ Profile error: ${profileError.message}`);
    } else {
      console.log(`   📊 Profile role: ${profile.role}`);
      console.log(`   📊 Profile created: ${profile.created_at}`);
    }

    // Check clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', jacek.id);

    if (clientsError) {
      console.log(`   ❌ Clients error: ${clientsError.message}`);
    } else {
      console.log(`   👥 Clients owned: ${clients.length}`);
      clients.forEach(client => {
        console.log(`      - ${client.name} (${client.email})`);
      });
    }

    // Test both passwords
    console.log('\n🔐 Testing passwords:');
    
    const passwords = [
      { name: 'Original', password: 'v&6uP*1UqTQN' },
      { name: 'Current', password: 'password123' }
    ];

    for (const { name, password } of passwords) {
      console.log(`\n   Testing ${name} password: "${password}"`);
      
      try {
        const { data: { session }, error } = await supabase.auth.signInWithPassword({
          email: 'jac.honkisz@gmail.com',
          password: password
        });

        if (error) {
          console.log(`      ❌ Failed: ${error.message}`);
        } else {
          console.log(`      ✅ SUCCESS! ${name} password works`);
          console.log(`      🔑 Session valid: ${session ? 'Yes' : 'No'}`);
          
          if (session) {
            // Test API call
            const response = await fetch('http://localhost:3000/api/fetch-live-data', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                dateRange: {
                  start: '2024-01-01',
                  end: '2025-12-31'
                }
              })
            });

            console.log(`      📡 API status: ${response.status}`);
            if (response.ok) {
              const data = await response.json();
              console.log(`      ✅ API working! ${data.data?.campaigns?.length || 0} campaigns, $${data.data?.stats?.totalSpend || 0} spend`);
            } else {
              const errorData = await response.text();
              console.log(`      ❌ API failed: ${errorData}`);
            }
          }
        }
      } catch (testError) {
        console.log(`      ❌ Error: ${testError.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking status:', error);
  }
}

checkJacekStatus(); 