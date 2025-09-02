require('dotenv').config({ path: '.env.local' });

async function testFrontendPDFRequest() {
  console.log('🧪 Testing Frontend PDF Request Simulation...\n');

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    return;
  }

  console.log('✅ Service role key found');
  console.log('📡 Testing PDF generation with different request types...\n');

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const dateRange = {
    start: '2025-08-01',
    end: '2025-08-31'
  };

  try {
    // Test 1: Request WITHOUT direct data (like fallback path)
    console.log('🔍 Test 1: PDF Request WITHOUT Direct Data (API Fallback Path)');
    console.log('   This simulates when frontend has no cached data');
    
    const response1 = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        clientId,
        dateRange
        // No campaigns, totals, client, or metaTables - forces API calls
      })
    });

    console.log(`   Status: ${response1.status}`);
    if (response1.ok) {
      const pdfBlob1 = await response1.blob();
      console.log(`   ✅ PDF generated: ${pdfBlob1.size} bytes`);
      console.log('   📊 This should include both Meta and Google Ads data');
    } else {
      const error1 = await response1.text();
      console.log(`   ❌ Failed: ${error1}`);
    }

    // Test 2: Request WITH direct data (like frontend button)
    console.log('\n🔍 Test 2: PDF Request WITH Direct Data (Frontend Button Path)');
    console.log('   This simulates when frontend passes cached Meta campaigns');
    
    // Simulate Meta campaigns data that frontend would send
    const mockMetaCampaigns = [
      {
        campaign_id: 'meta_123',
        campaign_name: 'Meta Test Campaign',
        spend: 1000,
        impressions: 50000,
        clicks: 1000,
        conversions: 50
      }
    ];
    
    const mockTotals = {
      spend: 1000,
      impressions: 50000,
      clicks: 1000,
      conversions: 50,
      ctr: 2.0,
      cpc: 1.0,
      cpm: 20.0
    };
    
    const mockClient = {
      id: clientId,
      name: 'Belmonte Hotel',
      email: 'belmonte@hotel.com'
    };

    const response2 = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        clientId,
        dateRange,
        // Direct data like frontend sends
        campaigns: mockMetaCampaigns,
        totals: mockTotals,
        client: mockClient,
        metaTables: null
      })
    });

    console.log(`   Status: ${response2.status}`);
    if (response2.ok) {
      const pdfBlob2 = await response2.blob();
      console.log(`   ✅ PDF generated: ${pdfBlob2.size} bytes`);
      console.log('   📊 This should ALSO include both Meta and Google Ads data');
      console.log('   🎯 If this only shows Meta, then the direct data path is broken');
    } else {
      const error2 = await response2.text();
      console.log(`   ❌ Failed: ${error2}`);
    }

    // Test 3: Compare sizes
    if (response1.ok && response2.ok) {
      const size1 = (await response1.clone().blob()).size;
      const size2 = (await response2.clone().blob()).size;
      
      console.log('\n📊 Size Comparison:');
      console.log(`   Without direct data: ${size1} bytes`);
      console.log(`   With direct data: ${size2} bytes`);
      
      if (Math.abs(size1 - size2) < 1000) {
        console.log('   ✅ Sizes are similar - both likely include Google Ads');
      } else {
        console.log('   ⚠️  Significant size difference - may indicate missing Google Ads in one path');
      }
    }

  } catch (error) {
    console.error('❌ Error testing PDF requests:', error.message);
  }
}

testFrontendPDFRequest();
