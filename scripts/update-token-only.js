const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function updateTokenOnly() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Usage: node scripts/update-token-only.js <token>');
    console.log('   Example: node scripts/update-token-only.js "EAABwzLixnjYBO..."');
    return;
  }

  const token = args[0];
  console.log('🔄 Updating token only (no conversion)...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Missing environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.log(`❌ Error fetching clients: ${clientsError.message}`);
      return;
    }

    console.log(`📋 Found ${clients.length} client(s) to update.\n`);

    for (const client of clients) {
      console.log(`📝 Updating ${client.name} (${client.email})...`);
      
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          meta_access_token: token,
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (updateError) {
        console.log(`❌ Error updating ${client.name}: ${updateError.message}`);
      } else {
        console.log(`✅ Successfully updated ${client.name}`);
      }
    }

    console.log('\n🎉 Token update completed!');
    console.log('🌐 Your clients can now use the application with the working token.');

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

updateTokenOnly(); 