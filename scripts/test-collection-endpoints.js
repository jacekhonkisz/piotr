// Script to test the collection API endpoints
require('dotenv').config({ path: '.env.local' });

async function testCollectionEndpoints() {
  console.log('🧪 Testing Collection API Endpoints\n');

  const baseUrl = 'http://localhost:3000';
  const endpoints = [
    '/api/background/collect-monthly',
    '/api/background/collect-weekly'
  ];

  console.log(`🌐 Testing against: ${baseUrl}`);
  console.log('');

  for (const endpoint of endpoints) {
    console.log(`📡 Testing ${endpoint}...`);
    
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ Success: ${result.message || 'Collection started'}`);
      } else {
        const errorText = await response.text();
        console.log(`   ❌ Error: ${errorText}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Network Error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('💡 If you get network errors, make sure your Next.js server is running:');
  console.log('   npm run dev');
  console.log('');
  console.log('💡 Alternative: Use the admin monitoring page at /admin/monitoring');
}

// Run the test
testCollectionEndpoints(); 