require('dotenv').config({ path: '.env.local' });

async function testServerResponseHeaders() {
  console.log('🧪 Testing Server Response Headers and Timing...\n');

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    return;
  }

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const dateRange = {
    start: '2025-08-01',
    end: '2025-08-31'
  };

  try {
    console.log('🔍 Testing both paths with timing...\n');

    // Test 1: Without direct data (should include Google Ads)
    console.log('📊 Test 1: WITHOUT direct data');
    const start1 = Date.now();
    
    const response1 = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        clientId,
        dateRange
      })
    });

    const end1 = Date.now();
    const blob1 = response1.ok ? await response1.blob() : null;
    
    console.log(`   Time: ${end1 - start1}ms`);
    console.log(`   Size: ${blob1?.size || 0} bytes`);
    console.log(`   Headers:`, Object.fromEntries(response1.headers.entries()));

    // Test 2: With direct data (currently missing Google Ads)
    console.log('\n📊 Test 2: WITH direct data');
    const start2 = Date.now();
    
    const mockData = {
      clientId,
      dateRange,
      campaigns: [{ campaign_id: 'test', campaign_name: 'Test', spend: 1000 }],
      totals: { spend: 1000, impressions: 50000, clicks: 1000, conversions: 50 },
      client: { id: clientId, name: 'Belmonte Hotel', email: 'test@test.com' },
      metaTables: null
    };

    const response2 = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify(mockData)
    });

    const end2 = Date.now();
    const blob2 = response2.ok ? await response2.blob() : null;
    
    console.log(`   Time: ${end2 - start2}ms`);
    console.log(`   Size: ${blob2?.size || 0} bytes`);
    console.log(`   Headers:`, Object.fromEntries(response2.headers.entries()));

    // Analysis
    console.log('\n📋 Analysis:');
    if (blob1 && blob2) {
      const sizeDiff = blob1.size - blob2.size;
      const timeDiff = (end1 - start1) - (end2 - start2);
      
      console.log(`   Size difference: ${sizeDiff} bytes (${sizeDiff > 0 ? 'without' : 'with'} direct data is larger)`);
      console.log(`   Time difference: ${timeDiff}ms (${timeDiff > 0 ? 'without' : 'with'} direct data is faster)`);
      
      if (sizeDiff > 500000) { // 500KB difference
        console.log('   ✅ Large size difference suggests Google Ads is only in path 1');
      } else if (sizeDiff < 100000) { // Less than 100KB difference
        console.log('   ❌ Small size difference suggests Google Ads is missing from both paths');
      }
      
      if (Math.abs(timeDiff) > 2000) { // 2 second difference
        console.log('   ⚡ Significant time difference suggests different processing paths');
      }
    }

    // Test if server is responding with updated code
    console.log('\n🔍 Server status check:');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    if (healthResponse.ok) {
      console.log('   ✅ Server is responding');
    } else {
      console.log('   ❌ Server health check failed');
    }

  } catch (error) {
    console.error('❌ Error testing server response:', error.message);
  }
}

testServerResponseHeaders();
