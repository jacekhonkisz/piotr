require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPDFEndpoint() {
  try {
    console.log('🧪 Testing PDF generation endpoint...\n');

    // Get jacek's client data
    const { data: jacek, error: jacekError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (jacekError || !jacek) {
      console.error('❌ Error fetching jacek:', jacekError);
      return;
    }

    console.log('✅ jacek client data:');
    console.log(`   Name: ${jacek.name}`);
    console.log(`   Email: ${jacek.email}`);
    console.log(`   ID: ${jacek.id}`);

    // Get jacek's latest report
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', jacek.id)
      .order('generated_at', { ascending: false })
      .limit(1);

    if (reportsError || !reports || reports.length === 0) {
      console.error('❌ No reports found for jacek');
      return;
    }

    const latestReport = reports[0];
    const startDate = new Date(latestReport.date_range_start);
    const monthId = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

    console.log(`\n📊 Testing with report: ${latestReport.id}`);
    console.log(`📅 Month ID: ${monthId}`);

    // Test the client retrieval logic that the PDF endpoint uses
    console.log('\n🔍 Testing client retrieval in PDF endpoint...');
    
    // This is the exact logic used in the PDF generation endpoint
    const { data: retrievedClient, error: clientRetrievalError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', jacek.id)
      .single();

    if (clientRetrievalError) {
      console.error('❌ Error retrieving client:', clientRetrievalError);
      return;
    }

    console.log('✅ Client retrieved by PDF endpoint:');
    console.log(`   Name: "${retrievedClient.name}"`);
    console.log(`   Email: "${retrievedClient.email}"`);
    console.log(`   ID: "${retrievedClient.id}"`);

    // Check if the retrieved client is correct
    if (retrievedClient.name !== 'jacek') {
      console.error('❌ ISSUE FOUND: Wrong client retrieved!');
      console.error(`   Expected: "jacek"`);
      console.error(`   Found: "${retrievedClient.name}"`);
    } else {
      console.log('✅ Correct client retrieved: "jacek"');
    }

    // Test with a different client ID to see if there's any issue
    console.log('\n🔍 Testing with TechCorp client ID...');
    
    const { data: techcorp, error: techcorpError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'client@techcorp.com')
      .single();

    if (techcorpError || !techcorp) {
      console.error('❌ Error fetching TechCorp:', techcorpError);
      return;
    }

    console.log('✅ TechCorp client data:');
    console.log(`   Name: "${techcorp.name}"`);
    console.log(`   Email: "${techcorp.email}"`);
    console.log(`   ID: "${techcorp.id}"`);

    // Test retrieving TechCorp by ID
    const { data: retrievedTechcorp, error: techcorpRetrievalError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', techcorp.id)
      .single();

    if (techcorpRetrievalError) {
      console.error('❌ Error retrieving TechCorp:', techcorpRetrievalError);
      return;
    }

    console.log('✅ TechCorp retrieved by ID:');
    console.log(`   Name: "${retrievedTechcorp.name}"`);
    console.log(`   Email: "${retrievedTechcorp.email}"`);
    console.log(`   ID: "${retrievedTechcorp.id}"`);

    // Compare the client IDs to make sure they're different
    console.log('\n🔍 Comparing client IDs:');
    console.log(`   jacek ID: "${jacek.id}"`);
    console.log(`   TechCorp ID: "${techcorp.id}"`);
    
    if (jacek.id === techcorp.id) {
      console.error('❌ ISSUE FOUND: Client IDs are the same!');
    } else {
      console.log('✅ Client IDs are different (correct)');
    }

    // Test the exact request that would be sent to the PDF endpoint
    console.log('\n📤 Simulating PDF endpoint request:');
    const requestData = {
      clientId: jacek.id,
      monthId: monthId,
      includeEmail: false
    };

    console.log('Request data:');
    console.log(JSON.stringify(requestData, null, 2));

    console.log('\n✅ Test completed!');
    console.log('If the client data is correct here but wrong in the actual PDF,');
    console.log('the issue might be in the PDF generation process or caching.');

  } catch (error) {
    console.error('❌ Error testing PDF endpoint:', error);
  }
}

testPDFEndpoint(); 