require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDatabase() {
  console.log('🔍 Testing database state...');
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set');

  try {
    // Check if email_logs table exists
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'email_logs');

    if (tablesError) {
      console.error('Error checking tables:', tablesError);
    } else {
      console.log('📋 email_logs table exists:', tables.length > 0);
    }

    // Check clients table structure
    const { data: clientColumns, error: clientError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'clients')
      .order('ordinal_position');

    if (clientError) {
      console.error('Error checking clients table:', clientError);
    } else {
      console.log('📊 Clients table columns:');
      clientColumns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }

    // Check if we have any clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, token_health_status')
      .limit(5);

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
    } else {
      console.log(`📈 Found ${clients.length} clients:`);
      clients.forEach(client => {
        console.log(`  - ${client.name} (${client.email}) - Status: ${client.token_health_status || 'unknown'}`);
      });
    }

  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

testDatabase()
  .then(() => {
    console.log('✅ Database test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }); 