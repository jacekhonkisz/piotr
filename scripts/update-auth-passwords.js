const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateAuthPasswords() {
  console.log('🔧 Updating Auth User Passwords\n');
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

    console.log('📋 Updating auth user passwords to match database...');

    // Update Belmonte auth user password
    console.log('\n🏨 Updating Belmonte Hotel auth password...');
    console.log(`   Email: belmonte@hotel.com`);
    console.log(`   New Password: ${belmonteClient.generated_password}`);
    
    const { data: belmonteUpdate, error: belmonteUpdateError } = await supabase.auth.admin.updateUserById(
      '0f2ff3cb-896c-4688-841a-1a9851ec1746', // Belmonte's auth user ID
      {
        password: belmonteClient.generated_password,
        user_metadata: {
          full_name: 'Belmonte Hotel',
          role: 'client'
        }
      }
    );

    if (belmonteUpdateError) {
      console.error(`❌ Belmonte password update failed:`, belmonteUpdateError.message);
    } else {
      console.log(`✅ Belmonte password updated successfully!`);
      console.log(`   User ID: ${belmonteUpdate.user.id}`);
    }

    // Update Havet auth user password
    console.log('\n🏨 Updating Havet auth password...');
    console.log(`   Email: havet@magialubczyku.pl`);
    console.log(`   New Password: ${havetClient.generated_password}`);
    
    const { data: havetUpdate, error: havetUpdateError } = await supabase.auth.admin.updateUserById(
      '8f82a09f-cf25-407d-8f77-500928133281', // Havet's auth user ID
      {
        password: havetClient.generated_password,
        user_metadata: {
          full_name: 'Havet',
          role: 'client'
        }
      }
    );

    if (havetUpdateError) {
      console.error(`❌ Havet password update failed:`, havetUpdateError.message);
    } else {
      console.log(`✅ Havet password updated successfully!`);
      console.log(`   User ID: ${havetUpdate.user.id}`);
    }

    // Test the updated passwords
    console.log('\n🧪 Testing updated passwords...');

    // Test Belmonte login
    console.log('\n🏨 Testing Belmonte login with updated password...');
    const { data: belmonteAuth, error: belmonteAuthError } = await supabase.auth.signInWithPassword({
      email: 'belmonte@hotel.com',
      password: belmonteClient.generated_password
    });

    if (belmonteAuthError) {
      console.error(`❌ Belmonte login still failing:`, belmonteAuthError.message);
    } else {
      console.log(`✅ Belmonte login successful!`);
      console.log(`   User ID: ${belmonteAuth.user.id}`);
    }

    // Sign out
    await supabase.auth.signOut();

    // Test Havet login
    console.log('\n🏨 Testing Havet login with updated password...');
    const { data: havetAuth, error: havetAuthError } = await supabase.auth.signInWithPassword({
      email: 'havet@magialubczyku.pl',
      password: havetClient.generated_password
    });

    if (havetAuthError) {
      console.error(`❌ Havet login still failing:`, havetAuthError.message);
    } else {
      console.log(`✅ Havet login successful!`);
      console.log(`   User ID: ${havetAuth.user.id}`);
    }

    // Sign out
    await supabase.auth.signOut();

    console.log('\n🎉 Password update and testing completed!');
    console.log('\n📋 Final Login Credentials:');
    console.log('\n🏨 Belmonte Hotel:');
    console.log(`   Email: belmonte@hotel.com`);
    console.log(`   Password: ${belmonteClient.generated_password}`);
    
    console.log('\n🏨 Havet:');
    console.log(`   Email: havet@magialubczyku.pl`);
    console.log(`   Password: ${havetClient.generated_password}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateAuthPasswords(); 