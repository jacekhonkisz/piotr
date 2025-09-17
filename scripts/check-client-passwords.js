const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkClientPasswords() {
  console.log('🔍 Checking Client Passwords\n');
  console.log('='.repeat(60));

  try {
    // Get all clients with their generated passwords
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, generated_username, generated_password')
      .order('name');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`📋 Found ${clients.length} clients:\n`);

    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.email})`);
      console.log(`   ID: ${client.id}`);
      console.log(`   Generated Username: ${client.generated_username || 'NOT SET'}`);
      console.log(`   Generated Password: ${client.generated_password ? '✅ SET' : '❌ NOT SET'}`);
      if (client.generated_password) {
        console.log(`   Password: ${client.generated_password}`);
      }
      console.log('');
    });

    // Check specific clients
    const belmonte = clients.find(c => c.email === 'belmonte@hotel.com');
    const havet = clients.find(c => c.email === 'havet@magialubczyku.pl');

    console.log('🎯 Specific Client Check:');
    
    if (belmonte) {
      console.log('\n🏨 Belmonte Hotel:');
      console.log(`   Username: ${belmonte.generated_username}`);
      console.log(`   Password: ${belmonte.generated_password || 'NOT SET'}`);
    } else {
      console.log('\n❌ Belmonte Hotel not found');
    }

    if (havet) {
      console.log('\n🏨 Havet:');
      console.log(`   Username: ${havet.generated_username}`);
      console.log(`   Password: ${havet.generated_password || 'NOT SET'}`);
    } else {
      console.log('\n❌ Havet not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkClientPasswords(); 