const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});

// Update ad account ID script
async function updateAdAccount() {
  console.log('🔧 Ad Account ID Update Script\n');

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Get all clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, ad_account_id, meta_access_token');

    if (clientError) {
      console.error('❌ Error fetching clients:', clientError);
      return;
    }

    console.log(`📊 Found ${clients.length} clients:\n`);

    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name}`);
      console.log(`   ID: ${client.id}`);
      console.log(`   Current Ad Account: ${client.ad_account_id}`);
      console.log(`   Has Meta Token: ${client.meta_access_token ? '✅' : '❌'}`);
      
      if (client.ad_account_id === '123456789') {
        console.log(`   ⚠️  PLACEHOLDER AD ACCOUNT ID DETECTED!`);
      }
      console.log('');
    });

    console.log('🔧 To fix the PDF generation issues:');
    console.log('');
    console.log('1. **Update Ad Account IDs**:');
    console.log('   - Go to Meta Ads Manager');
    console.log('   - Find your real ad account ID (starts with "act_")');
    console.log('   - Update the clients in your database');
    console.log('');
    console.log('2. **Test with Past Month**:');
    console.log('   - The PDF generation now uses June 2024 instead of July 2025');
    console.log('   - This should show real data if your Meta API is working');
    console.log('');
    console.log('3. **Verify Meta API Permissions**:');
    console.log('   - Ensure your Meta API token has "ads_management" or "ads_read" permissions');
    console.log('   - Check that the token is not expired');
    console.log('');
    console.log('📝 **Manual Update Commands**:');
    console.log('');
    console.log('To update a client\'s ad account ID, run:');
    console.log('```sql');
    console.log('UPDATE clients SET ad_account_id = \'YOUR_REAL_AD_ACCOUNT_ID\' WHERE id = \'CLIENT_ID\';');
    console.log('```');
    console.log('');
    console.log('Example:');
    console.log('```sql');
    console.log('UPDATE clients SET ad_account_id = \'act_703853679965014\' WHERE id = \'da9797b1-4834-4b5b-bea1-033eb897c7a9\';');
    console.log('```');

  } catch (error) {
    console.error('\n❌ Update script failed:', error.message);
  }
}

// Run the update script
updateAdAccount().catch(console.error); 