#!/usr/bin/env node

/**
 * Script to add Meta Ads clients directly to database
 * This script bypasses the API and adds clients directly to the database
 */

require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
// Simple password generator function
function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Client data from spreadsheet
const clientsData = [
  {
    name: 'Arche Nałęczów',
    adAccountId: '1840493736446778',
    businessManagerId: '7255168957851204',
    metaToken: null, // No token provided
    email: 'arche.naleczow@example.com'
  },
  {
    name: 'Arche Dwór Uphagena Gdańsk',
    adAccountId: '591960736420197',
    businessManagerId: '3204315596532824',
    metaToken: 'EAAlDmWD3W2IBPRpaBVJS9ctA1tkp93AQ4dI4Kgfmh72mdSPejk16MZAact3mT1Jv1MnyMwSDVPMRCpFC9ZBxxZBnsXG58TWATuglIrFxML71FTZB0fw3ITZBCZBvTCYsv6ZAs58YKnnIH6tfZAfviFhPfOZBxGwWVIr7F2guVVoCkQZBLeguOdHZBX83oha5s0hGb9xbcXG',
    apiId: '2607600826276706',
    email: 'arche.dwor@example.com'
  },
  {
    name: 'Hotel Artis Loft',
    adAccountId: '773414640638212',
    businessManagerId: '1850587291872554',
    metaToken: 'EAALQxAYFyoEBPbBQbiJZBBGfVxdar8wkHpCvyFErCysxiZB0zG1HZCMYWVLEE7ae1oEtbbV8vWWXJoc1eJq2Uyz9Opo2pWmM6Q6SZCfZAifFuSNk2YfbJEcuVREmhsnOPHMLLKDg4WZCgFXNCRZATO2zAd9PvsrGv19ZCCGUgsOBbplYlbGzZCODh85Dh9dHSt39TuUjv',
    apiId: '792490286631553',
    email: 'hotel.artis@example.com'
  },
  {
    name: 'Blue & Green Baltic Kołobrzeg',
    adAccountId: '3922800024650787',
    businessManagerId: '1443254590049675',
    metaToken: 'EAAJVfSyWo3wBPTNupaBWjrZCAgikvlqYjuvEceK85vus8ATh1ZA3nvYNXJVbqtdY8dx5M6THi6cyHMx030VimMSjfWOOsKnIAtECayMMvZAYBJ9cJd57dkitJtZC2KsnmSORDA2A83fuKKZCQiULGCMtZAuTRwptqxP2Ud1Ltdih219nWqZCQjekVe4PSzBIXZBsGYhi',
    apiId: '656946060764028',
    email: 'blue.green.kolobrzeg@example.com'
  },
  {
    name: 'Blue & Green Mazury',
    adAccountId: '2148885285566409',
    businessManagerId: '566309046451186',
    metaToken: 'EAAJV4fLVff4BPZAwzopW9NF7YXmDI4IFhYj02ZA4bP8f6g7v4xV4M7wnVgVH0Q9amJszG0Lej5XfsPUYPgnBZBOOJO6THMmZBC4ZAYSjsj0tnBopJpZAi5wpzEkgx3F9MJNx4pWOazvLRQVmLR9QeLweGBeDWHY2hY82yupgMu7zLrlqKS55Wd9O3HplfrmJN82UWA',
    apiId: '657378883501566',
    email: 'blue.green.mazury@example.com'
  },
  {
    name: 'Cesarskie Ogrody',
    adAccountId: '959086208720824',
    businessManagerId: '288205745285765',
    metaToken: 'EAAUzTE2H8BEBPZApueo4pxZC7r1H2aABEf68mG85BC4wnx39Q8qgRCUQWJ2dHipQ3mOojqyr4SLtslOybHqsgbgKDZCgTAHI39drRhiEA61kVjddYaZB51wm6cX4MYcJYYhPaCDEUInOgUJdTpU1ZCcuA2ZA8Wn0XHQyhSOBoNZCyDZCfGDvcwndT6Bdkf2F1yV30MFh',
    apiId: '1463777694838801',
    email: 'cesarskie.ogrody@example.com'
  },
  {
    name: 'Hotel Diva SPA Kołobrzeg',
    adAccountId: '294993459550820',
    businessManagerId: '3224677117757529',
    metaToken: 'EAAK1wmII4ZCoBPZAfscUATgb1NZCpNUVRRvA6ZA41bqaZA7gZBm92bygGMtCeEQmkPzrqUoIAybbrWsOT5yKZCrZCVkzSZAeBEvHRv8XQ5quUgqtv08tUZClSRoqTUzf9MuTiQ6uBf1qCCwZALy6g8EW8KpFiR6i8BwcJGDWR1Js0H6OsZAR5rOKa5F8FDaLsOHVRmym5iUk',
    apiId: '762796426454010',
    email: 'hotel.diva@example.com'
  },
  {
    name: 'Hotel Lambert Ustronie Morskie',
    adAccountId: '936330954171046',
    businessManagerId: '391732588048585',
    metaToken: 'EAAOZBvpjNe24BPUo0K0IBB28aGWioZBiFDZBdLO3cL4yT90AoQZAOiIS8tZAvre2QLg9xrxUqvQGwd9HiGIBtLHtBksJVic5KKSS4J5gFsbqQlHXH7VoAmZBjEA5KjGZBGepB6nP3v4ZBXBZB3bpNcrPh1KULFIVdOHq654bK0wPXWyFZCx5zdhYUMDzxGo9MuEEu9OKcO',
    apiId: '1054150746798958',
    email: 'hotel.lambert@example.com'
  },
  {
    name: 'Apartamenty Lambert',
    adAccountId: '3644514789198443',
    businessManagerId: '258733296011586',
    metaToken: 'EAAKUZAXkPT2EBPbAbFZAqdcIC5UdZBuRpy6Hd5AnMBbcuZA7OpGz6VjNZB0eQrw1qhGM1B3KZA0otiw5g1JGrFoJl0TNXyRymGbOeBxH7xxuEo3fnEckcfjfYkTJY5Y2kjmfJyfn7U6ZCWDxWifSquJZCOB5XjQ7d6HbCjp71ZBi2VyxbZAXTBMG9DxUkSrcUfpQNFAcO5',
    apiId: '726113497075553',
    email: 'apartamenty.lambert@example.com'
  },
  {
    name: 'Hotel Tobaco Łódź',
    adAccountId: '659695053552571',
    businessManagerId: '306441621141394',
    metaToken: 'EAARB9rV1B7UBPelEtmZCNyq27g7JxXNx7Va20LEX46NnDANMWiUnpCxeAkPhUNbEdloz4RuEkrrpOHYpODU2DKumo8klw4YMPqSaZACpcTxmeNOtzhgejlih0Rju9DIBJDv5jJ0VvId8a1jEZBszLexdrSE8nmnlt6oO9YoHhT8Gd55hp997qje8BT2rNl05sOL',
    apiId: '1198427768948661',
    email: 'hotel.tobaco@example.com'
  },
  {
    name: 'Hotel Zalewski Mrzeżyno',
    adAccountId: '674006194402750',
    businessManagerId: '2589737934576367',
    metaToken: 'EAAZA13imkEtkBPYmF0fVf7yP8zaxBF90PBHZCVkqRIxKdIaUG08DzWPogftTZBS3NAsYrhKfsZBgCrbv7XjN2UYpH9gWVzSrZAAVRnLMSfaMFY3a88IDaDqSXITJzONWhTFbQKQmNEBliYxn5UInUoF7Emc54HPilySGev6U3CkJDl7dOSIaQBZCG7K14A8aJxvA8L',
    apiId: '1818446902072025',
    email: 'hotel.zalewski@example.com'
  },
  {
    name: 'Młyn Klekotki',
    adAccountId: '1986851554988160',
    businessManagerId: '3195952590697293',
    metaToken: null, // No token provided
    email: 'mlyn.klekotki@example.com'
  },
  {
    name: 'Sandra SPA Karpacz',
    adAccountId: '876383783444749',
    businessManagerId: '232610765847396',
    metaToken: null, // No token provided
    email: 'sandra.spa@example.com'
  },
  {
    name: 'Nickel Resort Grzybowo',
    adAccountId: '4058314751116360',
    businessManagerId: '1852856535343006',
    metaToken: null, // No token provided
    email: 'nickel.resort@example.com'
  }
];

async function getAdminUser() {
  console.log('🔍 Finding admin user...');
  
  // Get the first admin user
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

async function validateMetaToken(token, adAccountId) {
  if (!token) {
    return { valid: false, reason: 'No token provided' };
  }

  try {
    // Test token validity
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/me?access_token=${token}`
    );
    
    if (!tokenResponse.ok) {
      return { valid: false, reason: 'Token validation failed' };
    }

    // Test ad account access
    const adAccountResponse = await fetch(
      `https://graph.facebook.com/v18.0/act_${adAccountId}?fields=id,name,account_status&access_token=${token}`
    );
    
    if (!adAccountResponse.ok) {
      return { valid: false, reason: 'Ad account access failed' };
    }

    const adAccountData = await adAccountResponse.json();
    
    return { 
      valid: true, 
      accountName: adAccountData.name,
      accountStatus: adAccountData.account_status 
    };

  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

async function addClientDirect(clientData, adminUser) {
  console.log(`\n🏨 Adding client: ${clientData.name}`);
  console.log(`   📧 Email: ${clientData.email}`);
  console.log(`   🏢 Ad Account: ${clientData.adAccountId}`);
  console.log(`   🔑 Has Token: ${clientData.metaToken ? 'Yes' : 'No'}`);

  try {
    // Skip clients without tokens for now
    if (!clientData.metaToken) {
      console.log(`   ⚠️  Skipping ${clientData.name} - no Meta token provided`);
      return { success: false, reason: 'No Meta token provided' };
    }

    // Validate Meta token first
    console.log(`   🔍 Validating Meta token...`);
    const validation = await validateMetaToken(clientData.metaToken, clientData.adAccountId);
    
    if (!validation.valid) {
      console.log(`   ❌ Token validation failed: ${validation.reason}`);
      return { success: false, error: `Token validation failed: ${validation.reason}` };
    }

    console.log(`   ✅ Token validated successfully`);
    console.log(`      Account: ${validation.accountName} (${validation.accountStatus})`);

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
      notes: `Added from spreadsheet batch import. Business Manager ID: ${clientData.businessManagerId}${clientData.apiId ? `, API ID: ${clientData.apiId}` : ''}`,
      generated_password: generatedPassword,
      generated_username: generatedUsername,
      credentials_generated_at: new Date().toISOString(),
      contact_emails: [clientData.email],
      last_token_validation: new Date().toISOString(),
      ad_account_id: clientData.adAccountId,
      meta_access_token: clientData.metaToken,
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
    console.log(`   📊 Meta Account: ${validation.accountName} (${validation.accountStatus})`);

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
  console.log('🚀 STARTING META ADS CLIENTS DIRECT DATABASE IMPORT\n');
  console.log(`📊 Total clients to process: ${clientsData.length}\n`);

  try {
    // Get admin user
    const adminUser = await getAdminUser();

    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    // Process each client
    for (const clientData of clientsData) {
      const result = await addClientDirect(clientData, adminUser);
      
      if (result.success) {
        results.successful.push({
          ...clientData,
          credentials: result.credentials,
          validation: result.validation
        });
      } else if (result.reason === 'No Meta token provided') {
        results.skipped.push({
          ...clientData,
          reason: result.reason
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
    console.log('\n' + '='.repeat(60));
    console.log('📋 DIRECT DATABASE IMPORT SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Successfully added: ${results.successful.length}`);
    results.successful.forEach(client => {
      console.log(`   • ${client.name} (${client.email})`);
      console.log(`     Username: ${client.credentials.username}`);
      console.log(`     Password: ${client.credentials.password}`);
      console.log(`     Meta Account: ${client.validation.accountName} (${client.validation.accountStatus})`);
    });

    console.log(`\n⚠️  Skipped (no token): ${results.skipped.length}`);
    results.skipped.forEach(client => {
      console.log(`   • ${client.name} - ${client.reason}`);
    });

    console.log(`\n❌ Failed: ${results.failed.length}`);
    results.failed.forEach(client => {
      console.log(`   • ${client.name} - ${client.error}`);
    });

    console.log('\n🎉 Direct database import completed!');
    
    if (results.successful.length > 0) {
      console.log('\n📝 IMPORTANT: Save these credentials securely!');
      console.log('Each client can now log in with their email and generated password.');
    }

    if (results.skipped.length > 0) {
      console.log('\n💡 Note: Clients without Meta tokens were skipped.');
      console.log('   You can add them later once you obtain their access tokens.');
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

module.exports = { main, addClientDirect, validateMetaToken };
