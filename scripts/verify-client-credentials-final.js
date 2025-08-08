const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyClientCredentialsFinal() {
  console.log('🔍 Final Verification of Client Credentials\n');
  console.log('='.repeat(60));

  try {
    // Get both clients
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

    console.log('📋 Final Credentials Status:');
    console.log('\n🏨 Belmonte Hotel:');
    console.log(`   ID: ${belmonteClient.id}`);
    console.log(`   Email: ${belmonteClient.email}`);
    console.log(`   Username: ${belmonteClient.generated_username}`);
    console.log(`   Password: ${belmonteClient.generated_password ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   Username = Email: ${belmonteClient.generated_username === belmonteClient.email ? '✅ YES' : '❌ NO'}`);
    if (belmonteClient.generated_password) {
      console.log(`   Password: ${belmonteClient.generated_password}`);
    }
    
    console.log('\n🏨 Havet:');
    console.log(`   ID: ${havetClient.id}`);
    console.log(`   Email: ${havetClient.email}`);
    console.log(`   Username: ${havetClient.generated_username}`);
    console.log(`   Password: ${havetClient.generated_password ? '✅ SET' : '❌ NOT SET'}`);
    console.log(`   Username = Email: ${havetClient.generated_username === havetClient.email ? '✅ YES' : '❌ NO'}`);
    if (havetClient.generated_password) {
      console.log(`   Password: ${havetClient.generated_password}`);
    }

    // Check if both clients have proper credentials
    const belmonteHasCredentials = belmonteClient.generated_username && belmonteClient.generated_password;
    const havetHasCredentials = havetClient.generated_username && havetClient.generated_password;
    const belmonteUsernameMatches = belmonteClient.generated_username === belmonteClient.email;
    const havetUsernameMatches = havetClient.generated_username === havetClient.email;

    console.log('\n🎯 Verification Results:');
    console.log(`   Belmonte has credentials: ${belmonteHasCredentials ? '✅ YES' : '❌ NO'}`);
    console.log(`   Havet has credentials: ${havetHasCredentials ? '✅ YES' : '❌ NO'}`);
    console.log(`   Belmonte username = email: ${belmonteUsernameMatches ? '✅ YES' : '❌ NO'}`);
    console.log(`   Havet username = email: ${havetUsernameMatches ? '✅ YES' : '❌ NO'}`);

    if (belmonteHasCredentials && havetHasCredentials && belmonteUsernameMatches && havetUsernameMatches) {
      console.log('\n🎉 SUCCESS: All requirements met!');
      console.log('   - Both clients have generated passwords');
      console.log('   - Usernames match email addresses');
      console.log('   - Credentials are ready for client access');
    } else {
      console.log('\n⚠️  ISSUES FOUND:');
      if (!belmonteHasCredentials) console.log('   - Belmonte missing credentials');
      if (!havetHasCredentials) console.log('   - Havet missing credentials');
      if (!belmonteUsernameMatches) console.log('   - Belmonte username ≠ email');
      if (!havetUsernameMatches) console.log('   - Havet username ≠ email');
    }

    console.log('\n📋 Login Credentials Summary:');
    console.log('\n🏨 Belmonte Hotel:');
    console.log(`   Email/Username: ${belmonteClient.email}`);
    console.log(`   Password: ${belmonteClient.generated_password}`);
    
    console.log('\n🏨 Havet:');
    console.log(`   Email/Username: ${havetClient.email}`);
    console.log(`   Password: ${havetClient.generated_password}`);

    console.log('\n✅ Verification completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyClientCredentialsFinal(); 