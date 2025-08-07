const fetch = require('node-fetch');

// Test configuration
const config = {
  baseUrl: 'http://localhost:3000',
  testClients: [
    { name: 'Belmonte', id: 'belmonte-hotel' },
    { name: 'Havet', id: 'havet-hotel' }
  ]
};

async function testLiveAPIWithCacheBust() {
  console.log('🧪 Testing Live API with Cache Busting');
  console.log('=====================================\n');

  for (const client of config.testClients) {
    console.log(`\n🏨 Testing ${client.name} (${client.id})`);
    console.log('=' .repeat(50));

    try {
      // Add cache-busting timestamp to force fresh data
      const cacheBust = Date.now();
      const url = `${config.baseUrl}/api/fetch-live-data?clientId=${client.id}&forceFresh=${cacheBust}`;
      
      console.log('🔗 API URL:', url);
      console.log('⏰ Timestamp:', new Date().toISOString());
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        console.log(`❌ API Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log('Error details:', errorText);
        continue;
      }

      const data = await response.json();
      
      if (!data.success) {
        console.log('❌ API returned error:', data.error || 'Unknown error');
        continue;
      }

      console.log('✅ API Response received successfully');
      console.log('\n📊 Conversion Metrics:');
      console.log('=======================');
      
      const metrics = data.data.conversionMetrics;
      
      console.log(`📞 Potencjalne kontakty telefoniczne: ${metrics.click_to_call}`);
      console.log(`📧 Potencjalne kontakty email: ${metrics.email_contacts}`);
      console.log(`🛒 Kroki rezerwacji – Etap 1: ${metrics.booking_step_1}`);
      console.log(`✅ Rezerwacje (zakończone): ${metrics.reservations}`);
      console.log(`💰 Wartość rezerwacji: ${metrics.reservation_value.toFixed(2)} zł`);
      console.log(`📈 ROAS: ${metrics.roas.toFixed(2)}x`);
      console.log(`💵 Koszt per rezerwacja: ${metrics.cost_per_reservation.toFixed(2)} zł`);
      console.log(`🛍️ Etap 2 rezerwacji: ${metrics.booking_step_2}`);

      // Calculate expected changes based on fixes
      console.log('\n🔍 Analysis:');
      console.log('=============');
      
      // Expected changes after parsing fixes:
      // 1. Reservations should be much lower (no duplication)
      // 2. ROAS should be more realistic
      // 3. Cost per reservation should be reasonable
      
      if (metrics.reservations > 150) {
        console.log('⚠️  RESERVATION COUNT STILL HIGH - May indicate cached data or unfixed parsing');
        console.log(`    Expected: <100, Got: ${metrics.reservations}`);
      } else {
        console.log('✅ Reservation count looks realistic after fixes');
      }
      
      if (metrics.roas > 50) {
        console.log('⚠️  ROAS STILL VERY HIGH - May indicate cached data or unfixed parsing');
        console.log(`    Expected: <20x, Got: ${metrics.roas.toFixed(2)}x`);
      } else {
        console.log('✅ ROAS looks more realistic after fixes');
      }
      
      const costPerRes = metrics.cost_per_reservation;
      if (costPerRes < 10 && metrics.reservations > 0) {
        console.log('⚠️  COST PER RESERVATION VERY LOW - May indicate cached data');
        console.log(`    Expected: >50 zł, Got: ${costPerRes.toFixed(2)} zł`);
      } else if (costPerRes > 0) {
        console.log('✅ Cost per reservation looks reasonable after fixes');
      }

      // Show campaign details
      console.log('\n📋 Campaign Details:');
      console.log('====================');
      console.log(`Total Campaigns: ${data.data.campaigns.length}`);
      console.log(`Total Spend: ${data.data.stats.totalSpend.toFixed(2)} zł`);
      console.log(`Date Range: ${data.data.dateRange.start} to ${data.data.dateRange.end}`);
      
      // Show if Meta API error occurred
      if (data.debug.metaApiError) {
        console.log(`⚠️  Meta API Error: ${data.debug.metaApiError}`);
      }

    } catch (error) {
      console.log(`❌ Error testing ${client.name}:`, error.message);
    }
  }

  console.log('\n🎯 Next Steps if Data Still Looks Cached:');
  console.log('==========================================');
  console.log('1. 🔄 Restart development server completely');
  console.log('2. 🗑️ Clear ALL browser cache and cookies');
  console.log('3. 💾 Check if Meta API has its own caching layer');
  console.log('4. 🔍 Check server logs for actual API calls being made');
  console.log('5. 🕒 Wait a few minutes for Meta API cache to expire');
}

// Run the test
testLiveAPIWithCacheBust().catch(console.error); 