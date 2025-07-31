const { exec } = require('child_process');
require('dotenv').config({path: '.env.local'});

// Test the fixed PDF generation
async function testPDFGeneration() {
  console.log('🧪 Testing Fixed PDF Generation...\n');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  console.log(`🔗 Testing against: ${baseUrl}`);
  console.log(`📄 Testing PDF generation for latest report...\n`);

  // Test the PDF endpoint
  const curlCommand = `curl -X GET "${baseUrl}/api/download-pdf?reportId=latest" -H "Content-Type: application/json" -H "Authorization: Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}" --output test-report.pdf --silent --show-error`;

  console.log(`📡 Executing: ${curlCommand.replace(process.env.SUPABASE_SERVICE_ROLE_KEY, '***HIDDEN***')}\n`);

  exec(curlCommand, (error, stdout, stderr) => {
    if (error) {
      console.log(`❌ Command failed: ${error.message}`);
      return;
    }

    if (stderr) {
      console.log(`⚠️  stderr: ${stderr}`);
    }

    // Check if PDF was created
    const fs = require('fs');
    if (fs.existsSync('test-report.pdf')) {
      const stats = fs.statSync('test-report.pdf');
      console.log(`✅ PDF generated successfully!`);
      console.log(`   File: test-report.pdf`);
      console.log(`   Size: ${stats.size} bytes`);
      console.log(`   Created: ${stats.mtime}`);
      
      if (stats.size > 1000) {
        console.log(`   ✅ PDF appears to have content (not empty)`);
      } else {
        console.log(`   ⚠️  PDF might be empty or have issues`);
      }
    } else {
      console.log(`❌ PDF file was not created`);
    }

    console.log(`\n🎉 Test completed!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Open test-report.pdf to verify content`);
    console.log(`   2. Check if it shows real data or demo data`);
    console.log(`   3. If demo data, check server logs for Meta API issues`);
  });
}

// Run the test
testPDFGeneration().catch(console.error); 