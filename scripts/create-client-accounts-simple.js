require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createClientAccountsSimple() {
  console.log('🔧 CREATING CLIENT USER ACCOUNTS (SIMPLE)\n');
  console.log('='.repeat(50));

  try {
    // 1. Get the admin user
    const { data: adminUser, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', 'admin@example.com')
      .single();

    if (adminError || !adminUser) {
      console.error('❌ Admin user not found:', adminError);
      return;
    }

    console.log('✅ Admin user found:', adminUser.email, `(ID: ${adminUser.id})`);

    // 2. Create user accounts for Havet and Belmonte
    const clientsToCreate = [
      {
        email: 'havet@magialubczyku.pl',
        password: 'Havet2025!',
        name: 'Havet',
        company: 'Magia Lubczyku',
        ad_account_id: '659510566204299',
        meta_access_token: 'EAAKZBRTlpNXsBPMg0chlsVDyDiPuQcOZAYaKYtz2rQKW93ZBGuH0VJzj2eFWv8WNVrus3mBbm8RnpG5JVFjOA7813ZCRy8zZBH0qTLNK9QZCrhO8ZAITtIkeGohn1DfRyouTDIoASdBNJzbPUphAEZAX2TmFMRmXrcySZA5ZBqiL8Oz7n6KquIBL92EaZAwk6UzOZCurpQZDZD'
      },
      {
        email: 'belmonte@hotel.com',
        password: 'Belmonte2025!',
        name: 'Belmonte Hotel',
        company: 'Belmonte Hotel',
        ad_account_id: '438600948208231',
        meta_access_token: 'EAAR4iSxFE60BPKn1vqWoG2s4IBUwZClFod0RBKZAnxnlVZARorkcV92wZCPeJokx8LjRXhG7cke7ZCvFrhyykEQhEZBQG42HFwZCr73LZAjwTZCPppJnI3GHjXtNBWBJenQb3duwdw63iAwTfU2pKkgJAEZBZCGpM1ZAVw05ChBcY98VLA6gJ8nVqwC2q23pdS2xkVQCSQZDZD'
      }
    ];

    for (const clientData of clientsToCreate) {
      console.log(`\n🔧 Creating account for ${clientData.name}...`);
      
      // Check if user already exists by checking profiles table
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', clientData.email)
        .single();
      
      if (existingProfile && !checkError) {
        console.log(`⚠️  User ${clientData.email} already exists, skipping...`);
        continue;
      }

      // Generate a UUID for the user
      const userId = require('crypto').randomUUID();

      // Create profile first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: clientData.email,
          role: 'client',
          full_name: clientData.name
        })
        .select()
        .single();

      if (profileError) {
        console.error(`❌ Error creating profile for ${clientData.name}:`, profileError);
        continue;
      }

      console.log(`✅ Profile created for ${clientData.name}:`, userId);

      // Update or create client record
      const { data: clientRecord, error: clientError } = await supabase
        .from('clients')
        .upsert({
          admin_id: adminUser.id,
          name: clientData.name,
          email: clientData.email,
          company: clientData.company,
          ad_account_id: clientData.ad_account_id,
          meta_access_token: clientData.meta_access_token,
          api_status: 'valid',
          reporting_frequency: 'monthly',
          notes: `${clientData.name} - Client account with full access to dashboard and reports.`
        })
        .select()
        .single();

      if (clientError) {
        console.error(`❌ Error updating client record for ${clientData.name}:`, clientError);
        continue;
      }

      console.log(`✅ Client record updated for ${clientData.name}`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Client ID: ${clientRecord.id}`);
      console.log(`   Login: ${clientData.email}`);
      console.log(`   Password: ${clientData.password}`);
    }

    // 3. Show all users and their roles
    console.log('\n📊 All users in the system:');
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role, full_name')
      .order('role', { ascending: false });

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }

    allProfiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.full_name || profile.email} (${profile.email})`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   ID: ${profile.id}`);
      console.log('');
    });

    // 4. Show all clients
    console.log('📊 All clients in the system:');
    const { data: allClients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, company, admin_id, api_status')
      .order('name');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    allClients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.email})`);
      console.log(`   Company: ${client.company || 'N/A'}`);
      console.log(`   API Status: ${client.api_status}`);
      console.log(`   Admin ID: ${client.admin_id}`);
      console.log('');
    });

    console.log('✅ Client accounts creation completed!');
    console.log('\n🔑 Login Credentials:');
    console.log('   Havet:');
    console.log('     Email: havet@magialubczyku.pl');
    console.log('     Password: Havet2025!');
    console.log('   Belmonte Hotel:');
    console.log('     Email: belmonte@hotel.com');
    console.log('     Password: Belmonte2025!');
    console.log('\n💡 Note: These are client accounts that can log in to their own dashboard.');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
createClientAccountsSimple().catch(console.error); 