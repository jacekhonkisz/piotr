const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetAdminPassword() {
  console.log('🔐 Resetting admin passwords...\n');

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      throw usersError;
    }

    // Reset password for admin@example.com
    const adminUser = users.users.find(u => u.email === 'admin@example.com');
    if (adminUser) {
      console.log(`Resetting password for ${adminUser.email}...`);
      
      const { error: resetError } = await supabase.auth.admin.updateUserById(
        adminUser.id,
        { password: 'password123' }
      );

      if (resetError) {
        console.log(`❌ Failed to reset password: ${resetError.message}`);
      } else {
        console.log(`✅ Password reset successfully`);
      }
    }

    // Reset password for jac.honkisz@gmail.com
    const jacUser = users.users.find(u => u.email === 'jac.honkisz@gmail.com');
    if (jacUser) {
      console.log(`Resetting password for ${jacUser.email}...`);
      
      const { error: resetError } = await supabase.auth.admin.updateUserById(
        jacUser.id,
        { password: 'password123' }
      );

      if (resetError) {
        console.log(`❌ Failed to reset password: ${resetError.message}`);
      } else {
        console.log(`✅ Password reset successfully`);
      }
    }

    console.log('\n📋 Admin Credentials:');
    console.log('admin@example.com / password123');
    console.log('jac.honkisz@gmail.com / password123');
    console.log('\n🎉 Both admin users are ready to use!');

  } catch (error) {
    console.error('❌ Error resetting passwords:', error.message);
    process.exit(1);
  }
}

resetAdminPassword(); 