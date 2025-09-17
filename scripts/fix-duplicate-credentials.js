const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDuplicateCredentials() {
  console.log('🔧 Fixing Duplicate API Credentials\n');

  try {
    // Get all clients
    const { data: allClients } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (!allClients) {
      console.log('❌ No clients found');
      return;
    }

    console.log('📋 Current Clients:');
    allClients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.email})`);
      console.log(`   - Ad Account: ${client.ad_account_id}`);
      console.log(`   - Meta Token: ${client.meta_access_token.substring(0, 20)}...`);
      console.log(`   - API Status: ${client.api_status}`);
    });

    // Find duplicates
    const adAccountIds = allClients.map(client => client.ad_account_id);
    const duplicateAdAccounts = adAccountIds.filter((id, index) => adAccountIds.indexOf(id) !== index);
    
    if (duplicateAdAccounts.length === 0) {
      console.log('✅ No duplicate ad account IDs found');
      return;
    }

    console.log('\n❌ Duplicate Ad Account IDs Found:');
    duplicateAdAccounts.forEach(adAccountId => {
      const clientsWithSameAccount = allClients.filter(client => client.ad_account_id === adAccountId);
      console.log(`   Ad Account ${adAccountId}:`);
      clientsWithSameAccount.forEach(client => {
        console.log(`      - ${client.name} (${client.email}) - Status: ${client.api_status}`);
      });
    });

    // Remove duplicate clients (keep the one with 'valid' status, remove 'pending')
    console.log('\n🔧 Fixing Duplicates...');
    
    for (const adAccountId of duplicateAdAccounts) {
      const clientsWithSameAccount = allClients.filter(client => client.ad_account_id === adAccountId);
      
      if (clientsWithSameAccount.length > 1) {
        // Sort by status: 'valid' first, then 'pending'
        const sortedClients = clientsWithSameAccount.sort((a, b) => {
          if (a.api_status === 'valid' && b.api_status !== 'valid') return -1;
          if (a.api_status !== 'valid' && b.api_status === 'valid') return 1;
          return 0;
        });

        // Keep the first one (should be 'valid' if available)
        const keepClient = sortedClients[0];
        const removeClients = sortedClients.slice(1);

        console.log(`\n🏨 Keeping: ${keepClient.name} (${keepClient.email}) - Status: ${keepClient.api_status}`);
        
        // Remove the duplicates
        for (const removeClient of removeClients) {
          console.log(`🗑️ Removing: ${removeClient.name} (${removeClient.email}) - Status: ${removeClient.api_status}`);
          
          const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', removeClient.id);

          if (error) {
            console.log(`   ❌ Error removing ${removeClient.name}:`, error.message);
          } else {
            console.log(`   ✅ Successfully removed ${removeClient.name}`);
          }
        }
      }
    }

    // Verify the fix
    console.log('\n✅ Verifying Fix...');
    
    const { data: updatedClients } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (updatedClients) {
      console.log(`📋 Updated Clients (${updatedClients.length}):`);
      updatedClients.forEach((client, index) => {
        console.log(`${index + 1}. ${client.name} (${client.email})`);
        console.log(`   - Ad Account: ${client.ad_account_id}`);
        console.log(`   - Meta Token: ${client.meta_access_token.substring(0, 20)}...`);
        console.log(`   - API Status: ${client.api_status}`);
      });

      // Check for remaining duplicates
      const updatedAdAccountIds = updatedClients.map(client => client.ad_account_id);
      const remainingDuplicates = updatedAdAccountIds.filter((id, index) => updatedAdAccountIds.indexOf(id) !== index);
      
      if (remainingDuplicates.length === 0) {
        console.log('\n✅ All duplicates have been fixed!');
      } else {
        console.log('\n❌ Some duplicates still remain:', remainingDuplicates);
      }
    }

    console.log('\n✅ Duplicate credentials fix completed');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixDuplicateCredentials(); 