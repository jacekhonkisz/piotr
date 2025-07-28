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

async function testDeleteWithLogs() {
  console.log('🧪 Testing delete API with detailed logs...\n');

  try {
    // First, sign in as admin@example.com
    console.log('1. Signing in as admin@example.com...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      return;
    }

    console.log('✅ Sign in successful:', signInData.user.email);

    // Get the session
    console.log('\n2. Getting session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ Session error:', sessionError?.message || 'No session');
      return;
    }

    console.log('✅ Session found for user:', session.user.email);
    console.log('Session token length:', session.access_token.length);
    console.log('Session token preview:', session.access_token.substring(0, 20) + '...');

    // Get user profile directly
    console.log('\n3. Getting user profile directly...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('❌ Profile error:', profileError.message);
      return;
    }

    console.log('✅ Profile loaded:');
    console.log('  - Email:', profile.email);
    console.log('  - Role:', profile.role);
    console.log('  - ID:', profile.id);

    // Get clients owned by this admin
    console.log('\n4. Getting clients owned by admin...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', session.user.id);

    if (clientsError) {
      console.error('❌ Clients error:', clientsError.message);
      return;
    }

    console.log(`✅ Found ${clients.length} clients:`);
    clients.forEach(client => {
      console.log(`  - ${client.name} (${client.email}) - ID: ${client.id}`);
    });

    if (clients.length === 0) {
      console.log('❌ No clients found to test deletion');
      return;
    }

    // Test the delete API endpoint
    console.log('\n5. Testing delete API endpoint...');
    const testClient = clients[0];
    console.log(`Testing deletion of: ${testClient.name} (${testClient.id})`);

    const response = await fetch(`http://localhost:3001/api/clients/${testClient.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    const responseData = await response.json();
    console.log('Response data:', responseData);

    if (response.ok) {
      console.log('✅ Delete API test successful!');
    } else {
      console.log('❌ Delete API test failed:', responseData.error);
      
      // Additional debugging
      console.log('\n🔍 Additional debugging:');
      console.log('User ID from session:', session.user.id);
      console.log('User email from session:', session.user.email);
      console.log('Profile role:', profile.role);
      console.log('Client admin_id:', testClient.admin_id);
      console.log('Session user ID matches client admin_id:', session.user.id === testClient.admin_id);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

testDeleteWithLogs(); 