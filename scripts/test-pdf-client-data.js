require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPDFClientData() {
  try {
    console.log('🔍 Testing PDF client data retrieval...\n');

    // Get jacek's client data
    const { data: jacek, error: jacekError } = await supabase
      .from('clients')
      .select('*')
      .eq('name', 'jacek')
      .single();

    if (jacekError || !jacek) {
      console.error('❌ jacek not found:', jacekError);
      return;
    }

    console.log('✅ jacek client data:');
    console.log(`   Name: "${jacek.name}"`);
    console.log(`   Email: "${jacek.email}"`);
    console.log(`   ID: "${jacek.id}"`);

    // Simulate the exact query that the PDF generation endpoint would use
    console.log('\n🔍 Simulating PDF generation client query...');
    
    const { data: clientFromPDF, error: pdfClientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', jacek.id)
      .single();

    if (pdfClientError || !clientFromPDF) {
      console.error('❌ Client not found in PDF query:', pdfClientError);
      return;
    }

    console.log('✅ Client data from PDF query:');
    console.log(`   Name: "${clientFromPDF.name}"`);
    console.log(`   Email: "${clientFromPDF.email}"`);
    console.log(`   ID: "${clientFromPDF.id}"`);

    // Check if the data matches
    if (clientFromPDF.name === jacek.name) {
      console.log('✅ Client name matches expected value');
    } else {
      console.error('❌ ISSUE FOUND: Client name mismatch!');
      console.error(`   Expected: "${jacek.name}"`);
      console.error(`   Found: "${clientFromPDF.name}"`);
    }

    // Test with a different client ID to see if there's any issue
    console.log('\n🔍 Testing with TechCorp ID...');
    
    const { data: techcorp, error: techcorpError } = await supabase
      .from('clients')
      .select('*')
      .eq('name', 'TechCorp Solutions')
      .single();

    if (techcorpError || !techcorp) {
      console.error('❌ TechCorp not found:', techcorpError);
      return;
    }

    const { data: techcorpFromPDF, error: techcorpPDFError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', techcorp.id)
      .single();

    if (techcorpPDFError || !techcorpFromPDF) {
      console.error('❌ TechCorp not found in PDF query:', techcorpPDFError);
      return;
    }

    console.log('✅ TechCorp data from PDF query:');
    console.log(`   Name: "${techcorpFromPDF.name}"`);
    console.log(`   Email: "${techcorpFromPDF.email}"`);
    console.log(`   ID: "${techcorpFromPDF.id}"`);

    // Check if there's any issue with the database
    console.log('\n🔍 Database consistency check:');
    console.log(`   jacek ID: "${jacek.id}"`);
    console.log(`   TechCorp ID: "${techcorp.id}"`);
    
    if (jacek.id === techcorp.id) {
      console.error('❌ ISSUE FOUND: Client IDs are the same!');
    } else {
      console.log('✅ Client IDs are different (correct)');
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error testing PDF client data:', error);
  }
}

testPDFClientData(); 