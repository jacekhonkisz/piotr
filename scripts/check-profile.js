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

async function checkProfile() {
  console.log('🔍 Checking admin user profile...\n');

  try {
    // Get admin user
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('Error listing users:', usersError);
      return;
    }

    const adminUser = users.users.find(u => u.email === 'admin@example.com');
    
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log('✅ Admin user found:', {
      id: adminUser.id,
      email: adminUser.email,
      created_at: adminUser.created_at
    });

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUser.id)
      .single();

    if (profileError) {
      console.log('❌ Profile not found or error:', profileError.message);
      
      // Try to create the profile
      console.log('\n🛠️  Attempting to create profile...');
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .upsert({
          id: adminUser.id,
          email: adminUser.email,
          role: 'admin',
          full_name: 'Admin User'
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating profile:', createError);
      } else {
        console.log('✅ Profile created successfully:', newProfile);
      }
    } else {
      console.log('✅ Profile found:', profile);
    }

    // Test RLS policies
    console.log('\n🔒 Testing RLS policies...');
    
    // Test as admin user
    const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (signInError) {
      console.error('❌ Error signing in:', signInError);
      return;
    }

    console.log('✅ Signed in as admin');

    // Try to fetch profile as authenticated user
    const { data: authProfile, error: authError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', adminUser.id)
      .single();

    if (authError) {
      console.error('❌ Error fetching profile as authenticated user:', authError);
    } else {
      console.log('✅ Profile fetched successfully as authenticated user:', authProfile);
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkProfile(); 