const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetJacekPassword() {
  console.log('🔐 Resetting jac.honkisz@gmail.com password...\n');

  try {
    // Reset password for jac.honkisz@gmail.com
    console.log('Resetting password for jac.honkisz@gmail.com...');
    const { data, error } = await supabase.auth.admin.updateUserById(
      '410483f9-cd02-432f-8e0b-7e8a8cd33a54', // jac.honkisz@gmail.com user ID
      { password: 'v&6uP*1UqTQN' }
    );

    if (error) {
      console.error('❌ Password reset failed:', error.message);
      return;
    }

    console.log('✅ Password reset successfully');

    console.log('\n📋 Updated Credentials:');
    console.log('jac.honkisz@gmail.com / v&6uP*1UqTQN');

    console.log('\n🎉 Password updated! You can now log in with the correct password.');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

resetJacekPassword(); 