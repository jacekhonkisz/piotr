const fetch = require('node-fetch');

console.log('🔍 COMPREHENSIVE FORCE REFRESH AUDIT');
console.log('=====================================\n');

async function auditForceRefreshFlow() {
  const baseUrl = 'http://localhost:3000';
  const clientId = 'belmonte-hotel';

  console.log('📋 AUDIT CHECKLIST:');
  console.log('===================');
  console.log('✅ 1. Check if API endpoint accepts forceFresh parameter');
  console.log('✅ 2. Verify cache clearing is triggered');
  console.log('✅ 3. Compare cached vs fresh data');
  console.log('✅ 4. Validate parsing logic is applied');
  console.log('✅ 5. Check for multiple cache layers');
  console.log('');

  // Test 1: API call WITHOUT cache clearing
  console.log('🧪 TEST 1: API Call WITHOUT Cache Clearing');
  console.log('===========================================');
  
  try {
    console.log('📡 Making API call without forceFresh...');
    const response1 = await fetch(`${baseUrl}/api/fetch-live-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clientId,
        dateRange: {
          start: '2025-01-01',
          end: '2025-01-07'
        }
      })
    });

    if (!response1.ok) {
      console.log('❌ API call failed:', response1.status, response1.statusText);
      return;
    }

    const data1 = await response1.json();
    console.log('📊 Response WITHOUT cache clearing:');
    if (data1.success && data1.data?.conversionMetrics) {
      const metrics1 = data1.data.conversionMetrics;
      console.log(`   ✅ Rezerwacje: ${metrics1.reservations}`);
      console.log(`   📈 ROAS: ${metrics1.roas.toFixed(2)}x`);
      console.log(`   💵 Cost per rezerwacja: ${metrics1.cost_per_reservation.toFixed(2)} zł`);
      console.log(`   📞 Click to call: ${metrics1.click_to_call}`);
      console.log(`   📧 Email contacts: ${metrics1.email_contacts}`);
    } else {
      console.log('❌ No conversion metrics in response');
      console.log('Response:', JSON.stringify(data1, null, 2));
    }
  } catch (error) {
    console.log('❌ API call failed:', error.message);
    console.log('💡 Make sure your development server is running: npm run dev');
    return;
  }

  console.log('\n⏱️ Waiting 2 seconds...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: API call WITH cache clearing
  console.log('🧪 TEST 2: API Call WITH Cache Clearing');
  console.log('=======================================');
  
  try {
    console.log('📡 Making API call WITH forceFresh=true...');
    const response2 = await fetch(`${baseUrl}/api/fetch-live-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: clientId,
        dateRange: {
          start: '2025-01-01',
          end: '2025-01-07'
        },
        forceFresh: true
      })
    });

    if (!response2.ok) {
      console.log('❌ API call with cache clearing failed:', response2.status, response2.statusText);
      return;
    }

    const data2 = await response2.json();
    console.log('📊 Response WITH cache clearing:');
    if (data2.success && data2.data?.conversionMetrics) {
      const metrics2 = data2.data.conversionMetrics;
      console.log(`   ✅ Rezerwacje: ${metrics2.reservations}`);
      console.log(`   📈 ROAS: ${metrics2.roas.toFixed(2)}x`);
      console.log(`   💵 Cost per rezerwacja: ${metrics2.cost_per_reservation.toFixed(2)} zł`);
      console.log(`   📞 Click to call: ${metrics2.click_to_call}`);
      console.log(`   📧 Email contacts: ${metrics2.email_contacts}`);
    } else {
      console.log('❌ No conversion metrics in response');
      console.log('Response:', JSON.stringify(data2, null, 2));
    }

    // Check debug info
    if (data2.debug) {
      console.log('\n🔍 Debug Information:');
      console.log(`   📊 Campaign insights count: ${data2.debug.campaignInsightsCount}`);
      console.log(`   📅 Date range: ${data2.debug.dateRange?.startDate} to ${data2.debug.dateRange?.endDate}`);
      console.log(`   🔐 Token valid: ${data2.debug.tokenValid}`);
      console.log(`   ❌ Meta API error: ${data2.debug.metaApiError || 'None'}`);
    }
  } catch (error) {
    console.log('❌ API call with cache clearing failed:', error.message);
  }

  console.log('\n🔍 AUDIT RESULTS:');
  console.log('=================');
  
  console.log('\n📋 TO CHECK MANUALLY:');
  console.log('1. 🖥️ Check server console for these messages:');
  console.log('   → "🗑️ Cache clearing requested"');
  console.log('   → "🗑️ Meta API cache cleared"');
  console.log('   → "📦 Using cached campaign insights data" (should NOT appear after forceFresh)');
  console.log('');
  console.log('2. 🌐 Check browser network tab:');
  console.log('   → Verify POST to /api/fetch-live-data includes "forceFresh": true');
  console.log('   → Check response time (fresh calls take longer)');
  console.log('');
  console.log('3. 🔄 Check browser console when clicking Force Refresh:');
  console.log('   → "🔄 Force refreshing current month with cache clearing"');
  console.log('   → "🗑️ Loading monthly data for period with cache clearing"');
  console.log('');
  console.log('4. 📊 Expected behavior after cache clear:');
  console.log('   → Reservations should be DIFFERENT (lower if parsing fixed)');
  console.log('   → ROAS should change');
  console.log('   → Response time should be slower (fetching fresh data)');
  
  console.log('\n🚨 IF DATA IS STILL THE SAME:');
  console.log('============================');
  console.log('A. Meta API itself may cache data (external to our app)');
  console.log('B. Multiple cache layers not all being cleared');
  console.log('C. Parsing fixes not actually applied in the API flow');
  console.log('D. Development server not restarted after code changes');
  console.log('E. Browser cache overriding API responses');
}

// Run the audit
auditForceRefreshFlow().catch(console.error); 