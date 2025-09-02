#!/usr/bin/env node

/**
 * Script to add the remaining 3 clients using existing system user tokens
 */

require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple password generator function
function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Clients to add with their working tokens
const clientsToAdd = [
  {
    name: 'Młyn Klekotki',
    adAccountId: '1986851554988160',
    businessManagerId: '3195952590697293',
    email: 'mlyn.klekotki@example.com',
    tokenSource: 'Arche Dwór Uphagena Gdańsk',
    expectedAccountName: 'Klekotki Spa & Resort'
  },
  {
    name: 'Sandra SPA Karpacz',
    adAccountId: '876383783444749',
    businessManagerId: '232610765847396',
    email: 'sandra.spa@example.com',
    tokenSource: 'Arche Dwór Uphagena Gdańsk',
    expectedAccountName: 'Sandra Spa Karpacz'
  },
  {
    name: 'Nickel Resort Grzybowo',
    adAccountId: '4058314751116360',
    businessManagerId: '1852856535343006',
    email: 'nickel.resort@example.com',
    tokenSource: 'Arche Dwór Uphagena Gdańsk',
    expectedAccountName: 'nickelresortwellnest'
  }
];

async function getAdminUser() {
  console.log('🔍 Finding admin user...');
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'admin')
    .limit(1);

  if (error || !profiles || profiles.length === 0) {
    throw new Error('No admin user found. Please create an admin user first.');
  }

  console.log(`✅ Found admin user: ${profiles[0].email}`);
  return profiles[0];
}

async function getTokenFromClient(clientName) {
  console.log(`🔍 Getting token from ${clientName}...`);
  
  const { data: client, error } = await supabase
    .from('clients')
    .select('meta_access_token')
    .eq('name', clientName)
    .single();

  if (error || !client) {
    throw new Error(`Failed to get token from ${clientName}: ${error?.message}`);
  }

  return client.meta_access_token;
}

async function validateMetaToken(token, adAccountId) {
  try {
    // Test ad account access
    const response = await fetch(
      `https://graph.facebook.com/v18.0/act_${adAccountId}?fields=id,name,account_status,currency&access_token=${token}`
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        valid: false, 
        error: `HTTP ${response.status}: ${errorData.error?.message || 'Unknown error'}` 
      };
    }

    const accountData = await response.json();
    
    return { 
      valid: true, 
      account: {
        id: accountData.id,
        name: accountData.name,
        status: accountData.account_status,
        currency: accountData.currency
      }
    };

  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function addClientDirect(clientData, adminUser, token) {
  console.log(`\n🏨 Adding client: ${clientData.name}`);
  console.log(`   📧 Email: ${clientData.email}`);
  console.log(`   🏢 Ad Account: ${clientData.adAccountId}`);
  console.log(`   🔑 Using token from: ${clientData.tokenSource}`);

  try {
    // Validate Meta token first
    console.log(`   🔍 Validating Meta token access...`);
    const validation = await validateMetaToken(token, clientData.adAccountId);
    
    if (!validation.valid) {
      console.log(`   ❌ Token validation failed: ${validation.error}`);
      return { success: false, error: `Token validation failed: ${validation.error}` };
    }

    console.log(`   ✅ Token validated successfully`);
    console.log(`      Account: ${validation.account.name} (${validation.account.status})`);

    // Verify it matches expected account name
    if (validation.account.name !== clientData.expectedAccountName) {
      console.log(`   ⚠️  Warning: Account name mismatch!`);
      console.log(`      Expected: ${clientData.expectedAccountName}`);
      console.log(`      Found: ${validation.account.name}`);
    }

    // Generate credentials
    const generatedPassword = generatePassword();
    const generatedUsername = clientData.email;

    // Create user account
    console.log(`   👤 Creating user account...`);
    const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
      email: clientData.email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name: clientData.name,
        company: clientData.name,
        role: 'client'
      }
    });

    if (createUserError || !authData.user) {
      console.log(`   ❌ Failed to create user: ${createUserError?.message}`);
      return { success: false, error: createUserError?.message };
    }

    console.log(`   ✅ User account created`);

    // Check if profile already exists (Supabase might auto-create it)
    console.log(`   📝 Checking/creating profile...`);
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (!existingProfile) {
      // Create profile only if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: clientData.email,
          full_name: clientData.name,
          role: 'client'
        });

      if (profileError) {
        console.log(`   ❌ Failed to create profile: ${profileError.message}`);
        // Clean up user
        await supabase.auth.admin.deleteUser(authData.user.id);
        return { success: false, error: profileError.message };
      }
      console.log(`   ✅ Profile created`);
    } else {
      // Update existing profile with our data
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
          email: clientData.email,
          full_name: clientData.name,
          role: 'client'
        })
        .eq('id', authData.user.id);

      if (updateProfileError) {
        console.log(`   ❌ Failed to update profile: ${updateProfileError.message}`);
        // Clean up user
        await supabase.auth.admin.deleteUser(authData.user.id);
        return { success: false, error: updateProfileError.message };
      }
      console.log(`   ✅ Profile updated`);
    }

    // Create client record
    console.log(`   🏢 Creating client record...`);
    const clientInsertData = {
      name: clientData.name,
      email: clientData.email,
      admin_id: adminUser.id,
      api_status: 'valid',
      company: clientData.name,
      reporting_frequency: 'monthly',
      notes: `Added using shared system user token from ${clientData.tokenSource}. Business Manager ID: ${clientData.businessManagerId}`,
      generated_password: generatedPassword,
      generated_username: generatedUsername,
      credentials_generated_at: new Date().toISOString(),
      contact_emails: [clientData.email],
      last_token_validation: new Date().toISOString(),
      ad_account_id: clientData.adAccountId,
      meta_access_token: token,
      token_health_status: 'valid',
      google_ads_enabled: false
    };

    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert(clientInsertData)
      .select()
      .single();

    if (clientError) {
      console.log(`   ❌ Failed to create client record: ${clientError.message}`);
      // Clean up user and profile
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: clientError.message };
    }

    console.log(`   ✅ Client record created successfully!`);
    console.log(`   🔐 Login credentials:`);
    console.log(`      Username: ${generatedUsername}`);
    console.log(`      Password: ${generatedPassword}`);
    console.log(`   📊 Meta Account: ${validation.account.name} (${validation.account.status})`);
    console.log(`   🔗 Token Source: ${clientData.tokenSource}`);

    return { 
      success: true, 
      client: newClient, 
      credentials: { username: generatedUsername, password: generatedPassword },
      validation: validation
    };

  } catch (error) {
    console.log(`   ❌ Error adding ${clientData.name}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 ADDING REMAINING CLIENTS WITH SHARED TOKENS\n');
  console.log(`📊 Clients to add: ${clientsToAdd.length}\n`);

  try {
    // Get admin user
    const adminUser = await getAdminUser();

    // Get the shared token (we'll use Arche Dwór Uphagena Gdańsk's token for all)
    const sharedToken = await getTokenFromClient('Arche Dwór Uphagena Gdańsk');
    console.log('✅ Retrieved shared token from Arche Dwór Uphagena Gdańsk\n');

    const results = {
      successful: [],
      failed: []
    };

    // Process each client
    for (const clientData of clientsToAdd) {
      const result = await addClientDirect(clientData, adminUser, sharedToken);
      
      if (result.success) {
        results.successful.push({
          ...clientData,
          credentials: result.credentials,
          validation: result.validation
        });
      } else {
        results.failed.push({
          ...clientData,
          error: result.error
        });
      }

      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 REMAINING CLIENTS ADDITION SUMMARY');
    console.log('='.repeat(70));
    
    console.log(`\n✅ Successfully added: ${results.successful.length}`);
    results.successful.forEach(client => {
      console.log(`   • ${client.name} (${client.email})`);
      console.log(`     Username: ${client.credentials.username}`);
      console.log(`     Password: ${client.credentials.password}`);
      console.log(`     Meta Account: ${client.validation.account.name} (${client.validation.account.status})`);
      console.log(`     Token Source: ${client.tokenSource}`);
    });

    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach(client => {
      console.log(`   • ${client.name} - ${client.error}`);
    });

    console.log('\n🎉 Remaining clients addition completed!');
    
    if (results.successful.length > 0) {
      console.log('\n📝 IMPORTANT: Save these credentials securely!');
      console.log('Each client can now log in with their email and generated password.');
      
      console.log('\n📊 FINAL STATUS:');
      console.log(`   • Total clients in spreadsheet: 14`);
      console.log(`   • Successfully added with own tokens: 10`);
      console.log(`   • Successfully added with shared tokens: ${results.successful.length}`);
      console.log(`   • Still need their own tokens: 1 (Arche Nałęczów)`);
      console.log(`   • TOTAL ACTIVE CLIENTS: ${10 + results.successful.length} / 14`);
    }

  } catch (error) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
