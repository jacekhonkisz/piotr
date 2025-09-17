const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAuthUsers() {
  console.log('🔍 Checking Auth Users\n');
  console.log('='.repeat(60));

  try {
    // List all auth users
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    console.log(`📋 Found ${authUsers.users.length} auth users:\n`);

    authUsers.users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Confirmed: ${user.confirmed_at ? '✅ YES' : '❌ NO'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`);
      console.log(`   Role: ${user.user_metadata?.role || 'Not set'}`);
      console.log('');
    });

    // Check specific clients
    const belmonteAuth = authUsers.users.find(u => u.email === 'belmonte@hotel.com');
    const havetAuth = authUsers.users.find(u => u.email === 'havet@magialubczyku.pl');

    console.log('🎯 Specific Client Auth Status:');
    
    if (belmonteAuth) {
      console.log('\n🏨 Belmonte Hotel Auth User:');
      console.log(`   ID: ${belmonteAuth.id}`);
      console.log(`   Email: ${belmonteAuth.email}`);
      console.log(`   Confirmed: ${belmonteAuth.confirmed_at ? '✅ YES' : '❌ NO'}`);
      console.log(`   Role: ${belmonteAuth.user_metadata?.role || 'Not set'}`);
      console.log(`   Created: ${belmonteAuth.created_at}`);
    } else {
      console.log('\n❌ Belmonte Hotel auth user not found');
    }

    if (havetAuth) {
      console.log('\n🏨 Havet Auth User:');
      console.log(`   ID: ${havetAuth.id}`);
      console.log(`   Email: ${havetAuth.email}`);
      console.log(`   Confirmed: ${havetAuth.confirmed_at ? '✅ YES' : '❌ NO'}`);
      console.log(`   Role: ${havetAuth.user_metadata?.role || 'Not set'}`);
      console.log(`   Created: ${havetAuth.created_at}`);
    } else {
      console.log('\n❌ Havet auth user not found');
    }

    // Check if we need to update passwords
    if (belmonteAuth || havetAuth) {
      console.log('\n🔧 Password Update Check:');
      
      if (belmonteAuth) {
        console.log('   Belmonte auth user exists - may need password update');
      }
      
      if (havetAuth) {
        console.log('   Havet auth user exists - may need password update');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAuthUsers(); 