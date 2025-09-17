#!/usr/bin/env node

/**
 * Test PDF Endpoint Directly
 * This script tests the PDF generation endpoint to see what's happening
 */

require('dotenv').config({ path: '.env.local' });

async function testPDFEndpoint() {
  console.log('🧪 Testing PDF Generation Endpoint Directly...\n');

  try {
    // Test 1: Check if endpoint is accessible
    console.log('📡 Test 1: Endpoint Accessibility');
    console.log('-'.repeat(40));
    
    const response = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
        dateRange: {
          start: '2025-08-01',
          end: '2025-08-31'
        }
      })
    });

    console.log(`Response status: ${response.status}`);
    console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));

    if (response.ok) {
      const data = await response.text();
      console.log(`✅ PDF generated successfully!`);
      console.log(`Response length: ${data.length} characters`);
      console.log(`First 200 chars: ${data.substring(0, 200)}...`);
    } else {
      const errorText = await response.text();
      console.log(`❌ PDF generation failed with status ${response.status}`);
      console.log(`Error response: ${errorText}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 The server might not be running. Make sure to run:');
      console.log('   npm run dev');
    }
  }
}

// Run the test
if (require.main === module) {
  testPDFEndpoint().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { testPDFEndpoint };
