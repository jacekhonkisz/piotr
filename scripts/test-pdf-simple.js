const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});

// Simple test for PDF generation with Meta API
async function testPDFSimple() {
  console.log('🧪 Simple PDF Generation Test with Meta API...\n');

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Get a client with Meta API token
    console.log('1. Getting client with Meta API token...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, ad_account_id')
      .not('meta_access_token', 'is', null)
      .limit(1);

    if (clientError) {
      console.error('❌ Error fetching clients:', clientError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('❌ No clients with Meta API tokens found');
      return;
    }

    const client = clients[0];
    console.log(`✅ Using client: ${client.name}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Ad Account: ${client.ad_account_id}`);
    console.log(`   Has Meta Token: ✅`);

    // 2. Test PDF generation endpoint
    console.log('\n2. Testing PDF generation...');
    
    // Get current month
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    console.log(`   Testing month: ${currentMonth}`);
    console.log(`   Report ID: ${client.id}-${currentMonth}`);

    // Use curl to test the endpoint (since fetch has issues in Node.js script)
    const { exec } = require('child_process');
    const curlCommand = `curl -X GET "http://localhost:3000/api/download-pdf?reportId=${client.id}-${currentMonth}" \
      -H "Authorization: Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}" \
      -H "Content-Type: application/json" \
      --output test-pdf-${client.name}-${currentMonth}.pdf \
      --silent \
      --write-out "HTTP Status: %{http_code}\\nResponse Size: %{size_download} bytes\\n"`;

    console.log('   Making request to PDF generation endpoint...');
    
    exec(curlCommand, (error, stdout, stderr) => {
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return;
      }
      
      console.log(`   ${stdout}`);
      
      // Check if PDF was created
      const fs = require('fs');
      const pdfPath = `test-pdf-${client.name}-${currentMonth}.pdf`;
      
      if (fs.existsSync(pdfPath)) {
        const stats = fs.statSync(pdfPath);
        console.log(`   ✅ PDF file created: ${pdfPath}`);
        console.log(`   📄 File size: ${stats.size} bytes`);
        
        if (stats.size > 1000) {
          console.log('   ✅ PDF appears to be valid (size > 1KB)');
          
          // Try to read first few bytes to check content
          const buffer = fs.readFileSync(pdfPath);
          const header = buffer.toString('ascii', 0, 10);
          
          if (header.startsWith('%PDF')) {
            console.log('   ✅ Valid PDF header detected');
          } else {
            console.log('   ⚠️  File may not be a valid PDF');
          }
        } else {
          console.log('   ⚠️  PDF file is very small, may contain error message');
        }
      } else {
        console.log('   ❌ PDF file was not created');
      }
      
      console.log('\n🎉 Test completed!');
      console.log('\n📋 Next steps:');
      console.log('1. Open the generated PDF file to verify content');
      console.log('2. Check if it contains real Meta API data or demo data');
      console.log('3. Compare with what you see on the /reports page');
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the test
testPDFSimple().catch(console.error); 