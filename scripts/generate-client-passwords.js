const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function generateClientPasswords() {
  console.log('🔧 Generating Passwords for Belmonte and Havet Clients\n');
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

    console.log('📋 Current Client Status:');
    console.log('\n🏨 Belmonte Hotel:');
    console.log(`   Email: ${belmonteClient.email}`);
    console.log(`   Current Username: ${belmonteClient.generated_username || 'NOT SET'}`);
    console.log(`   Current Password: ${belmonteClient.generated_password ? 'SET' : 'NOT SET'}`);
    
    console.log('\n🏨 Havet:');
    console.log(`   Email: ${havetClient.email}`);
    console.log(`   Current Username: ${havetClient.generated_username || 'NOT SET'}`);
    console.log(`   Current Password: ${havetClient.generated_password ? 'SET' : 'NOT SET'}`);

    // Generate passwords and set usernames to emails
    const belmontePassword = generatePassword();
    const havetPassword = generatePassword();

    console.log('\n🔐 Generated Passwords:');
    console.log(`   Belmonte: ${belmontePassword}`);
    console.log(`   Havet: ${havetPassword}`);

    // Update Belmonte client
    console.log('\n📝 Updating Belmonte Hotel credentials...');
    const { error: belmonteUpdateError } = await supabase
      .from('clients')
      .update({
        generated_username: belmonteClient.email,
        generated_password: belmontePassword
      })
      .eq('id', belmonteClient.id);

    if (belmonteUpdateError) {
      console.error('❌ Error updating Belmonte credentials:', belmonteUpdateError);
      return;
    }
    console.log('✅ Belmonte credentials updated successfully');

    // Update Havet client
    console.log('\n📝 Updating Havet credentials...');
    const { error: havetUpdateError } = await supabase
      .from('clients')
      .update({
        generated_username: havetClient.email,
        generated_password: havetPassword
      })
      .eq('id', havetClient.id);

    if (havetUpdateError) {
      console.error('❌ Error updating Havet credentials:', havetUpdateError);
      return;
    }
    console.log('✅ Havet credentials updated successfully');

    // Verify the updates
    console.log('\n🔍 Verifying Updates...');
    
    const { data: updatedBelmonte } = await supabase
      .from('clients')
      .select('generated_username, generated_password')
      .eq('id', belmonteClient.id)
      .single();

    const { data: updatedHavet } = await supabase
      .from('clients')
      .select('generated_username, generated_password')
      .eq('id', havetClient.id)
      .single();

    console.log('\n✅ Final Credentials:');
    console.log('\n🏨 Belmonte Hotel:');
    console.log(`   Username: ${updatedBelmonte.generated_username}`);
    console.log(`   Password: ${updatedBelmonte.generated_password}`);
    console.log(`   Username = Email: ${updatedBelmonte.generated_username === belmonteClient.email ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n🏨 Havet:');
    console.log(`   Username: ${updatedHavet.generated_username}`);
    console.log(`   Password: ${updatedHavet.generated_password}`);
    console.log(`   Username = Email: ${updatedHavet.generated_username === havetClient.email ? '✅ YES' : '❌ NO'}`);

    console.log('\n🎉 Password generation completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Both clients now have generated passwords');
    console.log('   - Usernames are set to match email addresses');
    console.log('   - Credentials are ready for client access');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

generateClientPasswords(); 