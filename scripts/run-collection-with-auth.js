// Script to run collection with proper authentication
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runCollectionWithAuth() {
  console.log('🔐 Running Collection with Authentication\n');

  try {
    // First, let's check if we can authenticate
    console.log('🔑 Attempting to authenticate...');
    
    // You'll need to provide admin credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'your-admin-password';
    
    console.log(`📧 Using email: ${adminEmail}`);
    console.log('⚠️ Make sure ADMIN_EMAIL and ADMIN_PASSWORD are set in .env.local\n');

    // Sign in as admin
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });

    if (authError) {
      console.error('❌ Authentication failed:', authError.message);
      console.log('\n💡 To fix this:');
      console.log('   1. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local');
      console.log('   2. Or use the admin monitoring page at /admin/monitoring');
      console.log('   3. Or run the collection manually through the UI');
      return;
    }

    if (!authData.user) {
      console.error('❌ No user returned from authentication');
      return;
    }

    console.log('✅ Authentication successful!');
    console.log(`👤 User: ${authData.user.email}`);
    console.log(`🆔 ID: ${authData.user.id}`);

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ Error getting user profile:', profileError?.message);
      return;
    }

    console.log(`👑 Role: ${profile.role}`);

    if (profile.role !== 'admin') {
      console.error('❌ Access denied - admin role required');
      return;
    }

    console.log('✅ Admin access confirmed!\n');

    // Now we can trigger the collection
    console.log('🚀 Starting monthly collection...');
    
    const response = await fetch('http://localhost:3000/api/background/collect-monthly', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authData.session.access_token}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Monthly collection started successfully!');
      console.log('📊 Response:', result);
      
      console.log('\n⏳ Collection is running in the background...');
      console.log('💡 You can monitor progress in the admin panel.');
      console.log('💡 Run the verification script again to check data completeness.');
      
    } else {
      console.error('❌ Failed to start monthly collection');
      console.error('Status:', response.status);
      const errorText = await response.text();
      console.error('Error:', errorText);
    }

    // Sign out
    await supabase.auth.signOut();
    console.log('\n🔒 Signed out successfully');

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    console.log('\n💡 Alternative approaches:');
    console.log('   1. Use the admin monitoring page at /admin/monitoring');
    console.log('   2. Set up proper environment variables');
    console.log('   3. Run collection manually through the UI');
  }
}

// Run the collection
runCollectionWithAuth(); 