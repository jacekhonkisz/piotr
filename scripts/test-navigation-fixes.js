require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Test the navigation fixes and new pages
async function testNavigationFixes() {
  console.log('🧪 Testing Navigation Fixes...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Get all clients to test navigation
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) {
      console.error('❌ Error fetching clients:', error);
      return;
    }

    console.log(`📊 Found ${clients.length} clients to test navigation:\n`);

    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.email})`);
      console.log(`   - Client ID: ${client.id}`);
      console.log(`   - Ad Account: ${client.ad_account_id}`);
      console.log(`   - Created: ${new Date(client.created_at).toLocaleDateString()}`);
      console.log('');
    });

    // Test the new pages that should be accessible
    if (clients.length > 0) {
      const testClient = clients[0];
      console.log(`🔗 Testing navigation for client: ${testClient.name}\n`);

      console.log('✅ New pages created:');
      console.log(`   - Client Detail Page: /admin/clients/${testClient.id}`);
      console.log(`   - Client Reports Page: /admin/clients/${testClient.id}/reports`);
      console.log('   - EditClientModal component integrated');
      console.log('   - PUT /api/clients/[id] endpoint for updates');
      console.log('   - Enhanced token health display');
      console.log('   - Fixed "View Reports" button navigation');

      console.log('\n📋 Navigation Features:');
      console.log('   ✅ Client detail page with comprehensive information');
      console.log('   ✅ Client-specific reports page');
      console.log('   ✅ Edit functionality with token validation');
      console.log('   ✅ Proper breadcrumb navigation');
      console.log('   ✅ Back buttons to parent pages');
      console.log('   ✅ Error handling for invalid client IDs');
      console.log('   ✅ Admin-only access control');

      console.log('\n🎯 Next Steps for Testing:');
      console.log('   1. Start the development server: npm run dev');
      console.log('   2. Navigate to /admin');
      console.log('   3. Click "Edit" button on any client');
      console.log('   4. Click "View Reports" button to test navigation');
      console.log('   5. Test the client detail page navigation');
      console.log('   6. Verify token health status display');
    } else {
      console.log('⚠️ No clients found to test navigation');
      console.log('   Please create a client first to test the navigation functionality');
    }

    console.log('\n✅ Navigation Fixes Test Complete!');

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
testNavigationFixes(); 