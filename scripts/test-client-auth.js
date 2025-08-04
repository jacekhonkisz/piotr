const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testClientAuth() {
  console.log('🔐 Testing Client Authentication...\n');

  try {
    // 1. Test jacek login
    console.log('📋 Step 1: Testing jacek login...');
    
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'jac.honkisz@gmail.com',
      password: 'password123'
    });

    if (loginError) {
      console.error('❌ Login failed:', loginError);
      return;
    }

    if (!session) {
      console.error('❌ No session after login');
      return;
    }

    console.log('✅ Login successful:', {
      userId: session.user.id,
      userEmail: session.user.email,
      accessToken: session.access_token ? session.access_token.substring(0, 20) + '...' : 'none'
    });

    // 2. Test getting user profile
    console.log('\n👤 Step 2: Testing user profile...');
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('❌ Get user failed:', userError);
      return;
    }

    console.log('✅ User retrieved:', {
      id: user.id,
      email: user.email,
      role: user.user_metadata?.role || 'unknown'
    });

    // 3. Test getting profile from database
    console.log('\n📊 Step 3: Testing database profile...');
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile fetch failed:', profileError);
      return;
    }

    console.log('✅ Profile retrieved:', {
      role: profile.role
    });

    // 4. Test getting client data
    console.log('\n🏢 Step 4: Testing client data...');
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', user.email)
      .single();

    if (clientError) {
      console.error('❌ Client fetch failed:', clientError);
      return;
    }

    console.log('✅ Client data retrieved:', {
      id: client.id,
      name: client.name,
      email: client.email,
      adAccountId: client.ad_account_id,
      hasMetaToken: !!client.meta_access_token
    });

    // 5. Test API call with authentication
    console.log('\n📡 Step 5: Testing API call...');
    
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: {
          start: '2025-08-01',
          end: '2025-08-31'
        },
        clientId: client.id
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ API call failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
    } else {
      const data = await response.json();
      console.log('✅ API call successful:', {
        success: data.success,
        campaignCount: data.data?.campaigns?.length || 0,
        clientName: data.data?.client?.name
      });
    }

    console.log('\n🎯 Summary:');
    console.log('   - Login: ✅ Success');
    console.log('   - User Profile: ✅ Success');
    console.log('   - Database Profile: ✅ Success');
    console.log('   - Client Data: ✅ Success');
    console.log(`   - API Call: ${response.ok ? '✅ Success' : '❌ Failed'}`);

  } catch (error) {
    console.error('💥 Error in test:', error);
  }
}

testClientAuth(); 