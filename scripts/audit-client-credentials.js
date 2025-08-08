const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditClientCredentials() {
  console.log('🔍 Auditing Client Credentials for Belmonte and Havet\n');
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

    console.log('📋 Client Credentials Audit:');
    console.log('\n🏨 Belmonte Hotel:');
    console.log(`   ID: ${belmonteClient.id}`);
    console.log(`   Email: ${belmonteClient.email}`);
    console.log(`   Generated Username: ${belmonteClient.generated_username || 'NOT SET'}`);
    console.log(`   Generated Password: ${belmonteClient.generated_password ? '✅ SET' : '❌ NOT SET'}`);
    if (belmonteClient.generated_password) {
      console.log(`   Password Preview: ${belmonteClient.generated_password.substring(0, 8)}...`);
    }
    
    console.log('\n🏨 Havet:');
    console.log(`   ID: ${havetClient.id}`);
    console.log(`   Email: ${havetClient.email}`);
    console.log(`   Generated Username: ${havetClient.generated_username || 'NOT SET'}`);
    console.log(`   Generated Password: ${havetClient.generated_password ? '✅ SET' : '❌ NOT SET'}`);
    if (havetClient.generated_password) {
      console.log(`   Password Preview: ${havetClient.generated_password.substring(0, 8)}...`);
    }

    // Check if passwords need to be generated
    const needsPasswordGeneration = [];
    
    if (!belmonteClient.generated_password) {
      needsPasswordGeneration.push({
        name: 'Belmonte Hotel',
        client: belmonteClient,
        email: belmonteClient.email
      });
    }
    
    if (!havetClient.generated_password) {
      needsPasswordGeneration.push({
        name: 'Havet',
        client: havetClient,
        email: havetClient.email
      });
    }

    if (needsPasswordGeneration.length > 0) {
      console.log('\n⚠️  CLIENTS NEEDING PASSWORD GENERATION:');
      needsPasswordGeneration.forEach(client => {
        console.log(`   - ${client.name} (${client.email})`);
      });
      
      console.log('\n💡 Action Required: Generate passwords for these clients');
      console.log('   Use the admin panel or API to generate credentials');
    } else {
      console.log('\n✅ All clients have passwords generated!');
    }

    // Test credentials API endpoint
    console.log('\n🔐 Testing Credentials API Endpoint...');
    
    // Get admin session
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get admin session:', sessionError);
      return;
    }

    console.log('✅ Admin session obtained');

    // Test credentials endpoint for both clients
    for (const client of [belmonteClient, havetClient]) {
      console.log(`\n📊 Testing credentials for ${client.name}...`);
      
      const response = await fetch(`http://localhost:3000/api/clients/${client.id}/credentials`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      console.log(`   Response Status: ${response.status}`);
      
      if (response.ok) {
        const credentials = await response.json();
        console.log(`   Username: ${credentials.username}`);
        console.log(`   Password: ${credentials.password ? '✅ SET' : '❌ NOT SET'}`);
        if (credentials.password) {
          console.log(`   Password Preview: ${credentials.password.substring(0, 8)}...`);
        }
      } else {
        const errorText = await response.text();
        console.log(`   Error: ${errorText}`);
      }
    }

    console.log('\n✅ Credentials audit completed!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

auditClientCredentials(); 