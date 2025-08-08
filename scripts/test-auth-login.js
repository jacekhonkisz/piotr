const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAuthLogin() {
  console.log('🔐 Testing Authentication Login\n');
  console.log('='.repeat(60));

  try {
    // Get client passwords from database
    const { data: belmonteClient } = await supabase
      .from('clients')
      .select('generated_password')
      .eq('email', 'belmonte@hotel.com')
      .single();

    const { data: havetClient } = await supabase
      .from('clients')
      .select('generated_password')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    console.log('📋 Testing authentication with service role...');

    // Test Belmonte authentication
    console.log('\n🏨 Testing Belmonte Hotel authentication...');
    console.log(`   Email: belmonte@hotel.com`);
    console.log(`   Password: ${belmonteClient.generated_password}`);
    
    const { data: belmonteAuth, error: belmonteAuthError } = await supabase.auth.signInWithPassword({
      email: 'belmonte@hotel.com',
      password: belmonteClient.generated_password
    });

    if (belmonteAuthError) {
      console.error(`❌ Belmonte authentication failed:`, belmonteAuthError.message);
      
      // Check if user exists in auth
      const { data: belmonteUser } = await supabase.auth.admin.getUserByEmail('belmonte@hotel.com');
      if (belmonteUser.user) {
        console.log(`   ✅ Auth user exists: ${belmonteUser.user.id}`);
        console.log(`   🔄 User status: ${belmonteUser.user.confirmed_at ? 'Confirmed' : 'Not confirmed'}`);
      } else {
        console.log(`   ❌ Auth user does not exist`);
      }
    } else {
      console.log(`✅ Belmonte authentication successful!`);
      console.log(`   User ID: ${belmonteAuth.user.id}`);
      console.log(`   Email: ${belmonteAuth.user.email}`);
    }

    // Sign out
    await supabase.auth.signOut();

    // Test Havet authentication
    console.log('\n🏨 Testing Havet authentication...');
    console.log(`   Email: havet@magialubczyku.pl`);
    console.log(`   Password: ${havetClient.generated_password}`);
    
    const { data: havetAuth, error: havetAuthError } = await supabase.auth.signInWithPassword({
      email: 'havet@magialubczyku.pl',
      password: havetClient.generated_password
    });

    if (havetAuthError) {
      console.error(`❌ Havet authentication failed:`, havetAuthError.message);
      
      // Check if user exists in auth
      const { data: havetUser } = await supabase.auth.admin.getUserByEmail('havet@magialubczyku.pl');
      if (havetUser.user) {
        console.log(`   ✅ Auth user exists: ${havetUser.user.id}`);
        console.log(`   🔄 User status: ${havetUser.user.confirmed_at ? 'Confirmed' : 'Not confirmed'}`);
      } else {
        console.log(`   ❌ Auth user does not exist`);
      }
    } else {
      console.log(`✅ Havet authentication successful!`);
      console.log(`   User ID: ${havetAuth.user.id}`);
      console.log(`   Email: ${havetAuth.user.email}`);
    }

    // Sign out
    await supabase.auth.signOut();

    console.log('\n✅ Authentication testing completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAuthLogin(); 