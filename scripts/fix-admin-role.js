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

async function fixAdminRole() {
  console.log('🔧 Fixing admin user role...\n');

  try {
    // Get all users
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      throw listError;
    }

    // Find admin user
    const adminUser = users.users.find(u => u.email === 'admin@example.com');
    if (!adminUser) {
      console.log('❌ Admin user not found. Please run setup-users.js first.');
      return;
    }

    console.log(`Found admin user: ${adminUser.email} (ID: ${adminUser.id})`);

    // Check current profile
    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUser.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    if (currentProfile) {
      console.log(`Current role: ${currentProfile.role}`);
      
      if (currentProfile.role === 'admin') {
        console.log('✅ Admin user already has correct role');
        return;
      }
    }

    // Update or create profile with admin role
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({
        id: adminUser.id,
        email: adminUser.email,
        role: 'admin',
        full_name: 'Admin User'
      });

    if (upsertError) {
      throw upsertError;
    }

    console.log('✅ Admin user role updated successfully');
    console.log('\n📋 Admin credentials:');
    console.log('Email: admin@example.com');
    console.log('Password: password123');
    console.log('Role: admin');

  } catch (error) {
    console.error('❌ Failed to fix admin role:', error.message);
    process.exit(1);
  }
}

fixAdminRole(); 