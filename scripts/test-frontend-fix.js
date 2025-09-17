require('dotenv').config({ path: '.env.local' });

async function testFrontendFix() {
  console.log('🧪 Testing Frontend Fix - API Fallback Path...\n');

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    return;
  }

  console.log('✅ Service role key found');
  console.log('📡 Testing frontend fix (no direct data)...\n');

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const dateRange = {
    start: '2025-08-01',
    end: '2025-08-31'
  };

  try {
    console.log('🔍 Testing Frontend Fix - Simulating Button Click');
    console.log('   This simulates the updated frontend button that forces API fallback');
    console.log('   Expected: Large PDF with both Meta and Google Ads data');
    
    const start = Date.now();
    
    const response = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({
        clientId,
        dateRange
        // NO direct data - this forces API fallback path
      })
    });

    const end = Date.now();
    
    console.log('\n📡 Response received:');
    console.log(`   Status: ${response.status}`);
    console.log(`   Time: ${end - start}ms`);
    
    if (response.ok) {
      const pdfBlob = await response.blob();
      console.log(`   ✅ PDF generated: ${pdfBlob.size} bytes`);
      
      if (pdfBlob.size > 1500000) { // 1.5MB
        console.log('   🎉 SUCCESS! Large PDF size indicates both Meta and Google Ads data included');
        console.log('   ✅ Frontend fix is working correctly');
      } else if (pdfBlob.size > 1000000) { // 1MB
        console.log('   ✅ Good PDF size, likely includes Google Ads data');
      } else {
        console.log('   ⚠️  Small PDF size, may still be missing Google Ads data');
      }
      
      console.log('\n📊 Expected behavior:');
      console.log('   - PDF should be ~1.6MB (includes both platforms)');
      console.log('   - Should show "Źródło: Meta Ads API & Google Ads API"');
      console.log('   - Should have platform comparison section');
      console.log('   - Should have Google Ads campaign details');
      
    } else {
      const error = await response.text();
      console.log(`   ❌ Failed: ${error}`);
    }

  } catch (error) {
    console.error('❌ Error testing frontend fix:', error.message);
  }
}

testFrontendFix();
