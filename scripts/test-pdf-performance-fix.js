/**
 * Test PDF Generation Performance Fix
 * 
 * This script tests whether the PDF generation is now faster by using direct Meta tables data
 * instead of making API calls during PDF generation.
 */

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPDFPerformanceFix() {
  console.log('🚀 Testing PDF Generation Performance Fix');
  console.log('==========================================');

  try {
    // 1. Get a test client
    console.log('\n1. Getting test client...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .limit(1);

    if (clientError || !clients || clients.length === 0) {
      console.log('❌ No clients found for testing');
      return;
    }

    const client = clients[0];
    console.log(`✅ Using client: ${client.name}`);

    // 2. Test PDF generation without Meta tables data (slow path)
    console.log('\n2. Testing PDF generation WITHOUT Meta tables data (slow path)...');
    const startTimeSlow = Date.now();
    
    try {
      const slowResponse = await fetch('http://localhost:3000/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-for-pdf-generation'
        },
        body: JSON.stringify({
          clientId: client.id,
          dateRange: {
            start: '2024-03-01',
            end: '2024-03-31'
          }
        })
      });

      const slowTime = Date.now() - startTimeSlow;
      console.log(`⏱️  Slow path took: ${slowTime}ms`);
      console.log(`📊 Response status: ${slowResponse.status}`);
      
      if (slowResponse.ok) {
        console.log('✅ Slow path PDF generation successful');
      } else {
        console.log('⚠️  Slow path PDF generation failed');
      }
    } catch (error) {
      console.log('❌ Slow path test failed:', error.message);
    }

    // 3. Test PDF generation with Meta tables data (fast path)
    console.log('\n3. Testing PDF generation WITH Meta tables data (fast path)...');
    
    // First, fetch Meta tables data
    console.log('   Fetching Meta tables data...');
    const metaTablesResponse = await fetch('http://localhost:3000/api/fetch-meta-tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token-for-pdf-generation'
      },
      body: JSON.stringify({
        dateStart: '2024-03-01',
        dateEnd: '2024-03-31',
        clientId: client.id
      })
    });

    let metaTablesData = null;
    if (metaTablesResponse.ok) {
      const metaTablesResult = await metaTablesResponse.json();
      if (metaTablesResult.success) {
        metaTablesData = metaTablesResult.data;
        console.log('✅ Meta tables data fetched successfully');
        console.log(`   Placement: ${metaTablesData.placementPerformance?.length || 0} records`);
        console.log(`   Demographic: ${metaTablesData.demographicPerformance?.length || 0} records`);
        console.log(`   Ad Relevance: ${metaTablesData.adRelevanceResults?.length || 0} records`);
      }
    }

    // Now test fast path
    const startTimeFast = Date.now();
    
    try {
      const fastResponse = await fetch('http://localhost:3000/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-for-pdf-generation'
        },
        body: JSON.stringify({
          clientId: client.id,
          dateRange: {
            start: '2024-03-01',
            end: '2024-03-31'
          },
          campaigns: [], // Mock campaign data
          totals: { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, cpm: 0 },
          client: client,
          metaTables: metaTablesData
        })
      });

      const fastTime = Date.now() - startTimeFast;
      console.log(`⏱️  Fast path took: ${fastTime}ms`);
      console.log(`📊 Response status: ${fastResponse.status}`);
      
      if (fastResponse.ok) {
        console.log('✅ Fast path PDF generation successful');
      } else {
        console.log('⚠️  Fast path PDF generation failed');
      }

      // 4. Performance comparison
      console.log('\n4. Performance Comparison:');
      console.log('==========================');
      console.log(`🐌 Slow path (with API calls): ${slowTime}ms`);
      console.log(`🚀 Fast path (direct data): ${fastTime}ms`);
      
      if (fastTime < slowTime) {
        const improvement = ((slowTime - fastTime) / slowTime * 100).toFixed(1);
        console.log(`📈 Performance improvement: ${improvement}% faster`);
      } else {
        console.log('⚠️  No performance improvement detected');
      }

    } catch (error) {
      console.log('❌ Fast path test failed:', error.message);
    }

    console.log('\n✅ PDF Performance Fix Test Complete');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPDFPerformanceFix(); 