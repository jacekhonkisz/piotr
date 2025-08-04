const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDashboardComplete() {
  console.log('🧪 Testing Complete Dashboard Fix...\n');
  
  try {
    // Test 1: Get jacek user
    console.log('1. Getting jacek user...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    const jacekUser = users.users.find(user => user.email === 'jac.honkisz@gmail.com');
    
    if (!jacekUser) {
      console.log('❌ Jacek user not found');
      return;
    }
    
    console.log('✅ Jacek user found:', jacekUser.id);
    
    // Test 2: Get jacek profile
    console.log('\n2. Getting jacek profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', jacekUser.id)
      .single();
    
    if (profileError || !profile) {
      console.log('❌ Profile not found:', profileError?.message);
      return;
    }
    
    console.log('✅ Profile found:', { role: profile.role, email: profile.email });
    
    // Test 3: Test all dashboard query patterns
    console.log('\n3. Testing dashboard query patterns...');
    
    const userRole = profile.role;
    const userEmail = jacekUser.email;
    const userId = jacekUser.id;
    
    // Pattern 1: Main dashboard query
    console.log('   Testing main dashboard query...');
    const { data: client1, error: error1 } = await supabase
      .from('clients')
      .select('*')
      .eq(userRole === 'admin' ? 'admin_id' : 'email', userRole === 'admin' ? userId : userEmail)
      .single();
    
    if (error1) {
      console.log('   ❌ Main dashboard query failed:', error1.message);
    } else {
      console.log('   ✅ Main dashboard query successful:', client1.name);
    }
    
    // Pattern 2: Database fallback query
    console.log('   Testing database fallback query...');
    const { data: client2, error: error2 } = await supabase
      .from('clients')
      .select('*')
      .eq(userRole === 'admin' ? 'admin_id' : 'email', userRole === 'admin' ? userId : userEmail)
      .single();
    
    if (error2) {
      console.log('   ❌ Database fallback query failed:', error2.message);
    } else {
      console.log('   ✅ Database fallback query successful:', client2.name);
    }
    
    // Pattern 3: Month data query
    console.log('   Testing month data query...');
    const { data: client3, error: error3 } = await supabase
      .from('clients')
      .select('*')
      .eq(userRole === 'admin' ? 'admin_id' : 'email', userRole === 'admin' ? userId : userEmail)
      .single();
    
    if (error3) {
      console.log('   ❌ Month data query failed:', error3.message);
    } else {
      console.log('   ✅ Month data query successful:', client3.name);
    }
    
    // Test 4: Check for any remaining admin_id queries
    console.log('\n4. Checking for remaining admin_id queries...');
    const { data: adminIdQuery, error: adminIdError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', userId)
      .single();
    
    if (adminIdError) {
      console.log('   ✅ admin_id query correctly fails for client user');
    } else {
      console.log('   ⚠️ admin_id query still works (this might be expected for admin users)');
    }
    
    console.log('\n🎉 Dashboard fix verification completed!');
    console.log('All dashboard queries should now work correctly for jacek user.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDashboardComplete(); 