const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testClientLogin() {
  console.log('🔐 Testing Client Login for Belmonte and Havet\n');
  console.log('='.repeat(60));

  try {
    // Get client credentials from database
    const { data: belmonteClient, error: belmonteError } = await supabase
      .from('clients')
      .select('generated_password')
      .eq('email', 'belmonte@hotel.com')
      .single();

    const { data: havetClient, error: havetError } = await supabase
      .from('clients')
      .select('generated_password')
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

    console.log('📋 Testing login with generated passwords...');

    // Test Belmonte login
    console.log('\n🏨 Testing Belmonte Hotel login...');
    console.log(`   Email: belmonte@hotel.com`);
    console.log(`   Password: ${belmonteClient.generated_password}`);
    
    const { data: belmonteAuth, error: belmonteLoginError } = await supabase.auth.signInWithPassword({
      email: 'belmonte@hotel.com',
      password: belmonteClient.generated_password
    });

    if (belmonteLoginError) {
      console.error(`❌ Belmonte login failed:`, belmonteLoginError.message);
    } else {
      console.log(`✅ Belmonte login successful!`);
      console.log(`   User ID: ${belmonteAuth.user.id}`);
      console.log(`   Email: ${belmonteAuth.user.email}`);
    }

    // Sign out
    await supabase.auth.signOut();

    // Test Havet login
    console.log('\n🏨 Testing Havet login...');
    console.log(`   Email: havet@magialubczyku.pl`);
    console.log(`   Password: ${havetClient.generated_password}`);
    
    const { data: havetAuth, error: havetLoginError } = await supabase.auth.signInWithPassword({
      email: 'havet@magialubczyku.pl',
      password: havetClient.generated_password
    });

    if (havetLoginError) {
      console.error(`❌ Havet login failed:`, havetLoginError.message);
    } else {
      console.log(`✅ Havet login successful!`);
      console.log(`   User ID: ${havetAuth.user.id}`);
      console.log(`   Email: ${havetAuth.user.email}`);
    }

    // Sign out
    await supabase.auth.signOut();

    // Test with wrong password to verify error handling
    console.log('\n🧪 Testing with wrong password...');
    const { data: wrongAuth, error: wrongLoginError } = await supabase.auth.signInWithPassword({
      email: 'belmonte@hotel.com',
      password: 'wrongpassword'
    });

    if (wrongLoginError) {
      console.log(`✅ Correctly rejected wrong password: ${wrongLoginError.message}`);
    } else {
      console.log(`❌ Unexpectedly accepted wrong password!`);
    }

    console.log('\n✅ Login testing completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testClientLogin(); 