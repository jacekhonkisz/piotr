require('dotenv').config({ path: '.env.local' });

async function debugDirectDataPath() {
  console.log('🧪 Debugging Direct Data Path for Google Ads Integration...\n');

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    return;
  }

  console.log('✅ Service role key found');
  console.log('📡 Testing direct data path with server logs...\n');

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const dateRange = {
    start: '2025-08-01',
    end: '2025-08-31'
  };

  try {
    // Test with direct data (like frontend button sends)
    console.log('🔍 Testing Direct Data Path (Frontend Button Simulation)');
    console.log('   This should trigger Google Ads fetching in the direct data path');
    
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

    console.log('📤 Sending request with direct data...');
    console.log('   📊 Mock Meta campaigns:', mockMetaCampaigns.length);
    console.log('   💰 Mock total spend:', mockTotals.spend);
    console.log('   🏨 Mock client:', mockClient.name);
    console.log('\n🔍 Check server logs for:');
    console.log('   - "🚀 Using direct data for fast PDF generation"');
    console.log('   - "🔍 Fetching Google Ads data for unified report..."');
    console.log('   - "✅ Fetched X Google Ads campaigns from database"');
    console.log('   - "🧮 Calculating platform totals (ensured calculation)..."');
    console.log('   - "🎯 PDF Generation Data:" with Google Ads counts');

    const response = await fetch('http://localhost:3000/api/generate-pdf', {
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

    console.log('\n📡 Response received:');
    console.log(`   Status: ${response.status}`);
    console.log(`   OK: ${response.ok}`);
    
    if (response.ok) {
      const pdfBlob = await response.blob();
      console.log(`   ✅ PDF generated: ${pdfBlob.size} bytes`);
      
      if (pdfBlob.size > 1000000) {
        console.log('   🎉 Large PDF size suggests Google Ads data is included');
      } else {
        console.log('   ⚠️  Small PDF size suggests only Meta Ads data');
      }
    } else {
      const error = await response.text();
      console.log(`   ❌ Failed: ${error}`);
    }

    console.log('\n📋 Next Steps:');
    console.log('1. Check the server console logs above');
    console.log('2. Look for Google Ads fetching messages');
    console.log('3. Verify platform totals calculation');
    console.log('4. Check if Google Ads data is passed to HTML generation');

  } catch (error) {
    console.error('❌ Error debugging direct data path:', error.message);
  }
}

debugDirectDataPath();
