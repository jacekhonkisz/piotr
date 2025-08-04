const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDashboardFix() {
  console.log('🧪 Testing Dashboard Fix...\n');
  
  try {
    // Test 1: Check if jacek user exists
    console.log('1. Checking jacek user...');
    const { data: jacekUser, error: userError } = await supabase.auth.admin.listUsers();
    const jacekUserData = jacekUser.users.find(user => user.email === 'jac.honkisz@gmail.com');
    
    if (userError || !jacekUserData) {
      console.log('❌ User not found:', userError?.message || 'User not found in list');
      return;
    }
    
    console.log('✅ User found:', {
      id: jacekUserData.id,
      email: jacekUserData.email,
      role: jacekUserData.role
    });
    
    // Test 2: Check jacek's profile
    console.log('\n2. Checking jacek profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', jacekUserData.id)
      .single();
    
    if (profileError) {
      console.log('❌ Profile not found:', profileError.message);
      return;
    }
    
    console.log('✅ Profile found:', {
      role: profile.role,
      email: profile.email
    });
    
    // Test 3: Check if client exists for jacek's email
    console.log('\n3. Checking client data for jacek...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();
    
    if (clientError) {
      console.log('❌ Client not found:', clientError.message);
      return;
    }
    
    console.log('✅ Client found:', {
      id: client.id,
      name: client.name,
      email: client.email,
      ad_account_id: client.ad_account_id
    });
    
    // Test 4: Simulate the dashboard query logic
    console.log('\n4. Testing dashboard query logic...');
    const userRole = profile.role;
    const userEmail = jacekUserData.email;
    const userId = jacekUserData.id;
    
    const queryField = userRole === 'admin' ? 'admin_id' : 'email';
    const queryValue = userRole === 'admin' ? userId : userEmail;
    
    console.log('Query logic:', {
      userRole,
      queryField,
      queryValue
    });
    
    const { data: dashboardClient, error: dashboardError } = await supabase
      .from('clients')
      .select('*')
      .eq(queryField, queryValue)
      .single();
    
    if (dashboardError) {
      console.log('❌ Dashboard query failed:', dashboardError.message);
      return;
    }
    
    console.log('✅ Dashboard query successful:', {
      clientId: dashboardClient.id,
      clientName: dashboardClient.name
    });
    
    console.log('\n🎉 Dashboard fix test completed successfully!');
    console.log('The dashboard should now work for jacek user.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDashboardFix(); 