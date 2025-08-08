const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createClientAuthAccounts() {
  console.log('🔧 Creating Supabase Auth Accounts for Belmonte and Havet\n');
  console.log('='.repeat(60));

  try {
    // Get both clients from the database
    const { data: belmonteClient, error: belmonteError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'belmonte@hotel.com')
      .single();

    const { data: havetClient, error: havetError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    if (belmonteError || !belmonteClient) {
      console.error('❌ Belmonte client not found:', belmonteError);
      return;
    }

    if (havetError || !havetClient) {
      console.error('❌ Havet client not found:', havetError);
      return;
    }

    console.log('📋 Found clients in database:');
    console.log(`   Belmonte: ${belmonteClient.name} (${belmonteClient.email})`);
    console.log(`   Havet: ${havetClient.name} (${havetClient.email})`);

    // Check if auth users already exist
    console.log('\n🔍 Checking existing auth users...');
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    const belmonteAuthUser = existingUsers.users.find(u => u.email === belmonteClient.email);
    const havetAuthUser = existingUsers.users.find(u => u.email === havetClient.email);

    console.log(`   Belmonte auth user exists: ${belmonteAuthUser ? '✅ YES' : '❌ NO'}`);
    console.log(`   Havet auth user exists: ${havetAuthUser ? '✅ YES' : '❌ NO'}`);

    // Create auth users if they don't exist
    const clientsToProcess = [];

    if (!belmonteAuthUser) {
      clientsToProcess.push({
        name: 'Belmonte Hotel',
        client: belmonteClient,
        password: belmonteClient.generated_password
      });
    }

    if (!havetAuthUser) {
      clientsToProcess.push({
        name: 'Havet',
        client: havetClient,
        password: havetClient.generated_password
      });
    }

    if (clientsToProcess.length === 0) {
      console.log('\n✅ All auth users already exist!');
      return;
    }

    console.log(`\n🔧 Creating ${clientsToProcess.length} auth user(s)...`);

    for (const { name, client, password } of clientsToProcess) {
      console.log(`\n📝 Creating auth user for ${name}...`);
      
      // Create auth user
      const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
        email: client.email,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: client.name,
          company: client.company,
          role: 'client'
        }
      });

      if (createUserError) {
        console.error(`❌ Error creating auth user for ${name}:`, createUserError);
        continue;
      }

      console.log(`✅ Auth user created for ${name}:`, authData.user.id);

      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authData.user.id)
        .single();

      if (!existingProfile) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: client.email,
            full_name: client.name,
            role: 'client'
          });

        if (profileError) {
          console.error(`❌ Error creating profile for ${name}:`, profileError);
          // Try to clean up the created user
          await supabase.auth.admin.deleteUser(authData.user.id);
          continue;
        }
        console.log(`✅ Profile created for ${name}`);
      } else {
        // Update existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email: client.email,
            full_name: client.name,
            role: 'client'
          })
          .eq('id', authData.user.id);

        if (updateError) {
          console.error(`❌ Error updating profile for ${name}:`, updateError);
          continue;
        }
        console.log(`✅ Profile updated for ${name}`);
      }
    }

    // Verify the results
    console.log('\n🔍 Verifying auth users...');
    const { data: updatedUsers } = await supabase.auth.admin.listUsers();
    
    const finalBelmonteUser = updatedUsers.users.find(u => u.email === belmonteClient.email);
    const finalHavetUser = updatedUsers.users.find(u => u.email === havetClient.email);

    console.log('\n✅ Final Results:');
    console.log(`   Belmonte auth user: ${finalBelmonteUser ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   Havet auth user: ${finalHavetUser ? '✅ EXISTS' : '❌ MISSING'}`);

    if (finalBelmonteUser && finalHavetUser) {
      console.log('\n🎉 SUCCESS: Both clients now have auth accounts!');
      console.log('\n📋 Login Credentials:');
      console.log('\n🏨 Belmonte Hotel:');
      console.log(`   Email: ${belmonteClient.email}`);
      console.log(`   Password: ${belmonteClient.generated_password}`);
      
      console.log('\n🏨 Havet:');
      console.log(`   Email: ${havetClient.email}`);
      console.log(`   Password: ${havetClient.generated_password}`);
      
      console.log('\n💡 Clients can now log in and access their dashboards!');
    } else {
      console.log('\n⚠️  Some auth users are still missing. Please check the errors above.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createClientAuthAccounts(); 