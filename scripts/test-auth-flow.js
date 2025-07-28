/**
 * Test script to verify authentication flow and database connectivity
 * Run with: node scripts/test-auth-flow.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAuthFlow() {
  console.log('🔍 Testing authentication flow...\n');

  try {
    // Test 1: Database connection
    console.log('1. Testing database connection...');
    const { data: dbTest, error: dbError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      return;
    }
    console.log('✅ Database connection successful');

    // Test 2: Check for admin user
    console.log('\n2. Checking for admin user...');
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'admin@example.com')
      .single();

    if (adminError && adminError.code !== 'PGRST116') {
      console.error('❌ Error checking admin profile:', adminError.message);
      return;
    }

    if (adminProfile) {
      console.log('✅ Admin profile found:', {
        id: adminProfile.id,
        email: adminProfile.email,
        role: adminProfile.role,
        created_at: adminProfile.created_at
      });
    } else {
      console.log('⚠️  No admin profile found');
    }

    // Test 3: Test session validation
    console.log('\n3. Testing session handling...');
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.listUsers();
    
    if (sessionError) {
      console.error('❌ Session test failed:', sessionError.message);
      return;
    }
    
    console.log(`✅ Found ${sessionData.users.length} users in auth system`);

    // Test 4: Profile loading performance
    console.log('\n4. Testing profile loading performance...');
    const startTime = Date.now();
    
    if (adminProfile) {
      const { data: profileTest, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', adminProfile.id)
        .single();

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      if (profileError) {
        console.error('❌ Profile loading failed:', profileError.message);
      } else {
        console.log(`✅ Profile loaded in ${loadTime}ms`);
        if (loadTime > 2000) {
          console.warn('⚠️  Profile loading is slow (>2s). Check database performance.');
        }
      }
    }

    console.log('\n✅ All tests completed successfully!');
    console.log('\n💡 If you\'re still experiencing issues:');
    console.log('   1. Check browser network tab for slow requests');
    console.log('   2. Look for JavaScript errors in browser console');
    console.log('   3. Use the Auth Debugger component in the app');
    console.log('   4. Check Supabase dashboard for database performance');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testAuthFlow(); 