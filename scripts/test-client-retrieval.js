require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testClientRetrieval() {
  try {
    console.log('🧪 Testing client data retrieval logic...\n');

    // Simulate jacek's email
    const jacekEmail = 'jac.honkisz@gmail.com';
    console.log(`🔍 Testing with jacek's email: ${jacekEmail}`);

    // This is the exact logic used in the reports page for client users
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', jacekEmail)
      .single();

    if (clientError) {
      console.error('❌ Error fetching client:', clientError);
      return;
    }

    if (!clientData) {
      console.error('❌ Client not found');
      return;
    }

    console.log('✅ Client data retrieved:');
    console.log(`   Name: "${clientData.name}"`);
    console.log(`   Email: "${clientData.email}"`);
    console.log(`   ID: "${clientData.id}"`);
    console.log(`   Ad Account: "${clientData.ad_account_id}"`);

    // Check if the retrieved client is correct
    if (clientData.name !== 'jacek') {
      console.error('❌ ISSUE FOUND: Wrong client retrieved!');
      console.error(`   Expected: "jacek"`);
      console.error(`   Found: "${clientData.name}"`);
    } else {
      console.log('✅ Correct client retrieved: "jacek"');
    }

    // Test with TechCorp's email to make sure they're different
    console.log('\n🔍 Testing with TechCorp\'s email...');
    
    const techcorpEmail = 'client@techcorp.com';
    const { data: techcorpData, error: techcorpError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', techcorpEmail)
      .single();

    if (techcorpError) {
      console.error('❌ Error fetching TechCorp:', techcorpError);
      return;
    }

    if (!techcorpData) {
      console.error('❌ TechCorp not found');
      return;
    }

    console.log('✅ TechCorp data retrieved:');
    console.log(`   Name: "${techcorpData.name}"`);
    console.log(`   Email: "${techcorpData.email}"`);
    console.log(`   ID: "${techcorpData.id}"`);

    // Compare the clients to make sure they're different
    console.log('\n🔍 Comparing clients:');
    console.log(`   jacek ID: "${clientData.id}"`);
    console.log(`   TechCorp ID: "${techcorpData.id}"`);
    
    if (clientData.id === techcorpData.id) {
      console.error('❌ ISSUE FOUND: Client IDs are the same!');
    } else {
      console.log('✅ Client IDs are different (correct)');
    }

    if (clientData.name === techcorpData.name) {
      console.error('❌ ISSUE FOUND: Client names are the same!');
    } else {
      console.log('✅ Client names are different (correct)');
    }

    // Test the PDF generation request that would be sent
    console.log('\n📤 Simulating PDF generation request:');
    const requestData = {
      clientId: clientData.id,
      monthId: '2024-04',
      includeEmail: false
    };

    console.log('Request data:');
    console.log(JSON.stringify(requestData, null, 2));

    console.log('\n✅ Test completed!');
    console.log('If the client data is correct here but wrong in the PDF,');
    console.log('the issue might be in the PDF generation process.');

  } catch (error) {
    console.error('❌ Error testing client retrieval:', error);
  }
}

testClientRetrieval(); 