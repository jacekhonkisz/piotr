const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});

// Test PDF generation with proper authentication
async function testPDFWithAuth() {
  console.log('🧪 Testing PDF Generation with Proper Authentication...\n');

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // First, sign in as an admin user to get a proper JWT token
    console.log('🔐 Signing in as admin user...');
    
    const { data: { user, session }, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (signInError || !session) {
      console.error('❌ Sign in failed:', signInError?.message);
      console.log('\n💡 Try updating the email and password in this script to match your admin credentials');
      return;
    }

    console.log('✅ Signed in successfully as:', user.email);
    console.log('🔑 JWT Token obtained');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    console.log(`\n🔗 Testing against: ${baseUrl}`);
    console.log(`📄 Testing PDF generation for latest report...\n`);

    // Test the PDF endpoint with proper JWT token
    const { exec } = require('child_process');
    const curlCommand = `curl -X GET "${baseUrl}/api/download-pdf?reportId=latest" -H "Content-Type: application/json" -H "Authorization: Bearer ${session.access_token}" --output test-report-auth.pdf --silent --show-error`;

    console.log(`📡 Executing: ${curlCommand.replace(session.access_token, '***JWT_TOKEN***')}\n`);

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
      if (fs.existsSync('test-report-auth.pdf')) {
        const stats = fs.statSync('test-report-auth.pdf');
        console.log(`✅ PDF generated successfully!`);
        console.log(`   File: test-report-auth.pdf`);
        console.log(`   Size: ${stats.size} bytes`);
        console.log(`   Created: ${stats.mtime}`);
        
        if (stats.size > 1000) {
          console.log(`   ✅ PDF appears to have content (not empty)`);
          
          // Check if it's a JSON error response
          const content = fs.readFileSync('test-report-auth.pdf', 'utf8');
          if (content.startsWith('{')) {
            console.log(`   ⚠️  PDF contains JSON response (likely an error):`);
            console.log(`   ${content.substring(0, 200)}...`);
          } else {
            console.log(`   ✅ PDF appears to be actual PDF content`);
          }
        } else {
          console.log(`   ⚠️  PDF might be empty or have issues`);
        }
      } else {
        console.log(`❌ PDF file was not created`);
      }

      console.log(`\n🎉 Test completed!`);
      console.log(`\n📋 Next steps:`);
      console.log(`   1. Open test-report-auth.pdf to verify content`);
      console.log(`   2. Check if it shows real data or demo data`);
      console.log(`   3. If demo data, check server logs for Meta API issues`);
    });

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run the test
testPDFWithAuth().catch(console.error); 