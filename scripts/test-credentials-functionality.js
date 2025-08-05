require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCredentialsFunctionality() {
  console.log('🧪 Testing Credentials Functionality...\n');

  try {
    // 1. Test admin login
    console.log('1. Testing admin login...');
    // Use environment variable for admin password or prompt user
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: adminPassword
    });

    if (signInError) {
      console.error('❌ Admin login failed:', signInError.message);
      return;
    }

    console.log('✅ Admin login successful');
    console.log('   User ID:', user.id);
    console.log('   Email:', user.email);

    // 2. Get admin session token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error('❌ No session token found');
      return;
    }

    console.log('✅ Session token obtained');

    // 3. Get a test client
    console.log('\n2. Getting test client...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientsError || !clients.length) {
      console.error('❌ No clients found:', clientsError?.message);
      return;
    }

    const testClient = clients[0];
    console.log('✅ Test client found:');
    console.log('   ID:', testClient.id);
    console.log('   Name:', testClient.name);
    console.log('   Email:', testClient.email);

    // 4. Test credentials endpoint
    console.log('\n3. Testing credentials endpoint...');
    const credentialsResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '.supabase.co')}/api/clients/${testClient.id}/credentials`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (credentialsResponse.ok) {
      const credentialsData = await credentialsResponse.json();
      console.log('✅ Credentials endpoint working:');
      console.log('   Username:', credentialsData.username);
      console.log('   Password:', credentialsData.password ? '***' : '(not set)');
    } else {
      console.error('❌ Credentials endpoint failed:', credentialsResponse.status);
    }

    // 5. Test regenerate password endpoint
    console.log('\n4. Testing regenerate password endpoint...');
    const regenerateResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '.supabase.co')}/api/clients/${testClient.id}/regenerate-password`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (regenerateResponse.ok) {
      const regenerateData = await regenerateResponse.json();
      console.log('✅ Regenerate password endpoint working:');
      console.log('   New password:', regenerateData.password);
      console.log('   Username:', regenerateData.username);
    } else {
      console.error('❌ Regenerate password endpoint failed:', regenerateResponse.status);
      const errorData = await regenerateResponse.json();
      console.error('   Error:', errorData.error);
    }

    // 6. Test update email endpoint
    console.log('\n5. Testing update email endpoint...');
    const newEmail = `test-${Date.now()}@example.com`;
    const updateEmailResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL.replace('.supabase.co', '.supabase.co')}/api/clients/${testClient.id}/update-email`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email: newEmail }),
    });

    if (updateEmailResponse.ok) {
      const updateData = await updateEmailResponse.json();
      console.log('✅ Update email endpoint working:');
      console.log('   New email:', updateData.email);
    } else {
      console.error('❌ Update email endpoint failed:', updateEmailResponse.status);
      const errorData = await updateEmailResponse.json();
      console.error('   Error:', errorData.error);
    }

    console.log('\n🎉 Credentials functionality test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCredentialsFunctionality(); 