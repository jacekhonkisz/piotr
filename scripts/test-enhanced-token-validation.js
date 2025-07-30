require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Test the enhanced token validation functionality
async function testEnhancedTokenValidation() {
  console.log('🧪 Testing Enhanced Token Validation...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Get all clients to check their token health status
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching clients:', error);
      return;
    }

    console.log(`📊 Found ${clients.length} clients to check:\n`);

    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.email})`);
      console.log(`   - API Status: ${client.api_status}`);
      console.log(`   - Token Health: ${client.token_health_status || 'unknown'}`);
      console.log(`   - Token Expires: ${client.token_expires_at ? new Date(client.token_expires_at).toLocaleString() : 'Never (long-lived)'}`);
      console.log(`   - Last Validation: ${client.last_token_validation ? new Date(client.last_token_validation).toLocaleString() : 'Never'}`);
      console.log(`   - Refresh Count: ${client.token_refresh_count || 0}`);
      console.log('');
    });

    // Test the token health overview view
    console.log('🔍 Testing Token Health Overview View...\n');
    
    const { data: tokenHealth, error: healthError } = await supabase
      .from('token_health_overview')
      .select('*')
      .order('token_health_status', { ascending: true });

    if (healthError) {
      console.error('❌ Error fetching token health overview:', healthError);
    } else {
      console.log(`📈 Token Health Overview (${tokenHealth.length} clients):\n`);
      
      const statusCounts = {};
      tokenHealth.forEach(client => {
        const status = client.token_health_status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        console.log(`- ${client.name}: ${client.token_health_status} (${client.expiration_status})`);
      });
      
      console.log('\n📊 Status Summary:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} clients`);
      });
    }

    console.log('\n✅ Enhanced Token Validation Test Complete!');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testEnhancedTokenValidation(); 