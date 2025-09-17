require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateHavetToken() {
  console.log('🔧 Updating Havet client with new working token...\n');

  const newToken = 'EAAKZBRTlpNXsBPIbjitymINStheW5ZBI6pgqajiCarZBAWzZCDjWPQ0ZBbCSTVenrjbLtZABiIhb1FfqTZBAvLYq2xVeynw18d3d54qlkN0OmcUZCZAZCBQoO56h0TnUU9hxb37T53SDSgdbJUjTf3qveGQ2V4ptP2Cul7avKcZA14Vr1cNZCSE7yDWwQGPV9QyWn9MVIKMNBUL3';

  console.log('🔑 New Token Preview:', newToken.substring(0, 20) + '...');
  console.log('🏨 Client: Havet');
  console.log('📧 Email: havet@magialubczyku.pl');
  console.log('🏢 Ad Account: 659510566204299');
  console.log('');

  try {
    // Update the Havet client token
    const { error } = await supabase
      .from('clients')
      .update({ 
        meta_access_token: newToken,
        updated_at: new Date().toISOString(),
        api_status: 'valid'
      })
      .eq('name', 'Havet');

    if (error) {
      console.log(`❌ Database update failed: ${error.message}`);
      return;
    }

    console.log('✅ Successfully updated Havet token in database');
    
    // Verify the update
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('*')
      .eq('name', 'Havet')
      .single();

    if (fetchError) {
      console.log(`❌ Error fetching updated client: ${fetchError.message}`);
    } else {
      console.log('✅ Client updated successfully:');
      console.log(`   - Name: ${client.name}`);
      console.log(`   - Email: ${client.email}`);
      console.log(`   - Ad Account: ${client.ad_account_id}`);
      console.log(`   - API Status: ${client.api_status}`);
      console.log(`   - Updated At: ${client.updated_at}`);
    }

    console.log('\n🎯 Token Update Complete!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Check the Havet dashboard to see if conversion tracking now works');
    console.log('2. Verify that "Nie skonfigurowane" is replaced with real data');
    console.log('3. Test the conversion tracking metrics');
    console.log('');
    console.log('🔍 Expected conversion tracking data:');
    console.log('   - Purchase events: 25');
    console.log('   - Click to call: Available');
    console.log('   - Landing page views: 2,817');
    console.log('   - Initiate checkout: 128');

  } catch (error) {
    console.error('💥 Update error:', error);
  }
}

updateHavetToken(); 