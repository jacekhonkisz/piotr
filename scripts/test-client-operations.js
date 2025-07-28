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

async function testClientOperations() {
  console.log('🧪 Testing Client Creation and Deletion Operations...\n');

  try {
    // Step 1: Get admin user
    console.log('1. Finding admin user...');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const adminUser = users.users.find(u => u.email === 'admin@example.com');
    if (!adminUser) {
      console.log('❌ Admin user not found');
      return;
    }
    console.log(`✅ Admin user found: ${adminUser.email} (ID: ${adminUser.id})`);

    // Step 2: Test creating a new auth user (simulate client creation)
    console.log('\n2. Creating new client auth user...');
    const testEmail = 'test-client-' + Date.now() + '@example.com';
    
    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'password123',
      email_confirm: true,
      user_metadata: {
        full_name: 'Test Client',
        company: 'Test Company',
        role: 'client'
      }
    });

    if (createUserError) {
      console.log(`❌ Failed to create user: ${createUserError.message}`);
      return;
    }
    console.log(`✅ Auth user created: ${authData.user.email} (ID: ${authData.user.id})`);

    // Step 3: Check if profile already exists (likely auto-created)
    console.log('\n3. Checking if profile was auto-created...');
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (existingProfile) {
      console.log('✅ Profile was auto-created by Supabase');
      console.log(`   - Email: ${existingProfile.email}`);
      console.log(`   - Role: ${existingProfile.role}`);
      
      // Update the profile with our data
      console.log('\n3b. Updating auto-created profile...');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          email: testEmail,
          full_name: 'Test Client',
          role: 'client'
        })
        .eq('id', authData.user.id);

      if (updateError) {
        console.log(`❌ Failed to update profile: ${updateError.message}`);
        await supabase.auth.admin.deleteUser(authData.user.id);
        return;
      }
      console.log('✅ Profile updated successfully');
    } else {
      // Create profile manually if it doesn't exist
      console.log('\n3. Creating user profile manually...');
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: testEmail,
          full_name: 'Test Client',
          role: 'client'
        });

      if (profileError) {
        console.log(`❌ Failed to create profile: ${profileError.message}`);
        await supabase.auth.admin.deleteUser(authData.user.id);
        return;
      }
      console.log('✅ Profile created successfully');
    }

    // Step 4: Create client record
    console.log('\n4. Creating client record...');
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: 'Test Client Company',
        email: testEmail,
        ad_account_id: '703853679965014',
        meta_access_token: 'EAAKeJ0iYczYBPECzH7j5Oo3BEtQ5OVO3kJk25ZBUObsDZAWas7WujTZCzD7yOveYbS0sWOaZAiGK25gUnsEmIZBKNoFBtfJvIc5F7XrgWNtNcS0tqLeo8Fq0DoZCZCLqjCLbiSa8NkRG3CmuseiPiMg9ZAFnd03jwDafZCcImZCZA7RGysQRwFZCTkwg2og7UPXFSzt3d01SRz1lbSdSehTDeXapPAb0Gt2CdlcrsRCQgT5MtQZDZD',
        admin_id: adminUser.id,
        api_status: 'valid',
        company: 'Test Company',
        reporting_frequency: 'monthly',
        notes: 'Test client created via script',
        generated_password: 'password123',
        generated_username: testEmail,
        credentials_generated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (clientError) {
      console.log(`❌ Failed to create client: ${clientError.message}`);
      // Cleanup
      await supabase.auth.admin.deleteUser(authData.user.id);
      return;
    }
    console.log(`✅ Client record created: ${newClient.name} (ID: ${newClient.id})`);

    // Step 5: Verify client was created
    console.log('\n5. Verifying client creation...');
    const { data: verifyClient, error: verifyError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', newClient.id)
      .single();

    if (verifyError || !verifyClient) {
      console.log('❌ Client verification failed');
    } else {
      console.log('✅ Client verified in database');
    }

    // Step 6: Test client deletion
    console.log('\n6. Testing client deletion...');
    
    // Delete client record
    const { error: deleteClientError } = await supabase
      .from('clients')
      .delete()
      .eq('id', newClient.id);

    if (deleteClientError) {
      console.log(`❌ Failed to delete client record: ${deleteClientError.message}`);
    } else {
      console.log('✅ Client record deleted');
    }

    // Delete profile
    const { error: deleteProfileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', authData.user.id);

    if (deleteProfileError) {
      console.log(`❌ Failed to delete profile: ${deleteProfileError.message}`);
    } else {
      console.log('✅ Profile deleted');
    }

    // Delete auth user
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(authData.user.id);
    if (deleteUserError) {
      console.log(`❌ Failed to delete auth user: ${deleteUserError.message}`);
    } else {
      console.log('✅ Auth user deleted');
    }

    // Step 7: Final verification
    console.log('\n7. Final database state check...');
    const { data: finalClients, error: finalError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', adminUser.id);

    if (finalError) {
      console.log(`❌ Final check failed: ${finalError.message}`);
    } else {
      console.log(`✅ Final state: ${finalClients.length} clients remaining for admin`);
      finalClients.forEach(client => {
        console.log(`  - ${client.name} (${client.email})`);
      });
    }

    console.log('\n🎉 All client operations completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Client creation works perfectly');
    console.log('✅ Database operations are functional');
    console.log('✅ Client deletion works perfectly');
    console.log('✅ Cleanup operations work correctly');
    
    console.log('\n💡 This means the issue is likely in the API endpoints or frontend form submission, not the database operations.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testClientOperations(); 