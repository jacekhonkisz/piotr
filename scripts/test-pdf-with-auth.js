require('dotenv').config({ path: '.env.local' });

async function testPDFWithAuth() {
  console.log('🧪 Testing PDF Generation with Authentication...\n');

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    return;
  }

  console.log('✅ Service role key found');
  console.log('📡 Testing PDF generation endpoint...\n');

  try {
    const response = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa', // Use the actual client ID for Belmonte Hotel
        dateRange: {
          start: '2025-08-01',
          end: '2025-08-31'
        }
      })
    });

    console.log('📡 Response received:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Status Text: ${response.statusText}`);
    console.log(`   OK: ${response.ok}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log(`   Content-Length: ${response.headers.get('content-length')}`);

    if (response.ok) {
      const pdfBlob = await response.blob();
      console.log(`\n✅ PDF generated successfully!`);
      console.log(`   Size: ${pdfBlob.size} bytes`);
      console.log(`   Type: ${pdfBlob.type}`);
      
      if (pdfBlob.size > 0) {
        console.log('   🎉 PDF contains data and should show both Meta and Google Ads!');
      } else {
        console.log('   ⚠️  PDF is empty (0 bytes)');
      }
    } else {
      const errorData = await response.text();
      console.log(`\n❌ Request failed:`);
      console.log(`   Error: ${errorData}`);
    }

  } catch (error) {
    console.error('❌ Error testing PDF generation:', error.message);
  }
}

// Run the test
testPDFWithAuth();
