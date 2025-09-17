const fetch = require('node-fetch');

async function testSessionAuth() {
  console.log('🔐 Testing Session Authentication');
  console.log('==============================');

  const baseUrl = 'http://localhost:3000';

  try {
    // Test health endpoint (should not require auth)
    console.log('📊 Testing health endpoint...');
    const healthResponse = await fetch(`${baseUrl}/api/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health endpoint working:', healthData.status);
    } else {
      console.log('❌ Health endpoint failed:', healthResponse.status);
    }

    // Test PDF generation (requires auth)
    console.log('\n📄 Testing PDF generation without auth...');
    const pdfResponse = await fetch(`${baseUrl}/api/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: '5703e71f-1222-4178-885c-ce72746d0713', // Jacek's client ID
        dateRange: {
          start: '2025-07-31',
          end: '2025-08-30'
        }
      })
    });

    console.log('Response status:', pdfResponse.status);
    console.log('Response headers:', Object.fromEntries(pdfResponse.headers));

    if (pdfResponse.ok) {
      const pdfBuffer = await pdfResponse.arrayBuffer();
      console.log('✅ PDF generated successfully (unexpected - should require auth)');
      console.log('   Size:', pdfBuffer.byteLength, 'bytes');
    } else {
      try {
        const errorData = await pdfResponse.json();
        console.log('❌ PDF generation failed (expected):', errorData);
      } catch (parseError) {
        const errorText = await pdfResponse.text();
        console.log('❌ PDF generation failed with HTML response:');
        console.log('   Status:', pdfResponse.status);
        console.log('   Content preview:', errorText.substring(0, 200) + '...');
        
        if (errorText.includes('404')) {
          console.log('   → This suggests the API route might not be found');
        } else if (errorText.includes('This page could not be found')) {
          console.log('   → This suggests Next.js is serving 404 page instead of API');
        }
      }
    }

    console.log('\n🎯 Authentication Status Analysis:');
    console.log('1. If you see "Missing or invalid authorization header" - authentication is working correctly');
    console.log('2. If you see HTML 404 response - there might be a routing issue');
    console.log('3. If you see "PDF generated successfully" - authentication is not properly enforced');
    
    console.log('\n💡 Next Steps:');
    console.log('1. Open browser to http://localhost:3000');
    console.log('2. Login as admin');
    console.log('3. Try the calendar interface again');
    console.log('4. The PDF test should work when properly authenticated');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  testSessionAuth().catch(console.error);
}

module.exports = { testSessionAuth }; 