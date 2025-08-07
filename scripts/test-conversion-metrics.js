const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConversionMetrics() {
  console.log('🧪 Testing Conversion Metrics Implementation');
  console.log('============================================\n');

  try {
    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .not('meta_access_token', 'is', null);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`📋 Found ${clients.length} clients with Meta API tokens\n`);

    for (const client of clients) {
      console.log(`🏢 Testing client: ${client.name} (${client.email})`);
      console.log(`   Ad Account ID: ${client.ad_account_id}`);
      console.log(`   Token Status: ${client.meta_access_token ? 'Present' : 'Missing'}\n`);

      if (!client.meta_access_token || !client.ad_account_id) {
        console.log('   ⚠️  Skipping - missing token or ad account ID\n');
        continue;
      }

      try {
        // Get current month data
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const dateStart = startOfMonth.toISOString().split('T')[0];
        const dateEnd = endOfMonth.toISOString().split('T')[0];

        console.log(`   📅 Testing API endpoint for: ${dateStart} to ${dateEnd}`);

        // Test the fetch-live-data API endpoint
        const response = await fetch('http://localhost:3000/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            clientId: client.id,
            dateRange: {
              start: dateStart,
              end: dateEnd
            }
          })
        });

        if (!response.ok) {
          console.log(`   ❌ API request failed: ${response.status} ${response.statusText}`);
          continue;
        }

        const data = await response.json();

        if (!data.success) {
          console.log(`   ❌ API returned error: ${data.error}`);
          continue;
        }

        console.log(`   📊 Found ${data.data.campaigns.length} campaigns`);

        // Check if conversion metrics are present
        if (data.data.conversionMetrics) {
          const metrics = data.data.conversionMetrics;
          
          console.log('   📈 Conversion Metrics Summary:');
          console.log(`      📞 Potencjalne kontakty telefoniczne: ${metrics.click_to_call}`);
          console.log(`      📧 Potencjalne kontakty email: ${metrics.email_contacts}`);
          console.log(`      🛒 Kroki rezerwacji – Etap 1: ${metrics.booking_step_1}`);
          console.log(`      ✅ Rezerwacje (zakończone): ${metrics.reservations}`);
          console.log(`      💰 Wartość rezerwacji: ${metrics.reservation_value.toLocaleString('pl-PL')} PLN`);
          console.log(`      📊 ROAS: ${metrics.roas.toFixed(2)}x`);
          console.log(`      💵 Koszt per rezerwacja: ${metrics.cost_per_reservation.toLocaleString('pl-PL')} PLN`);
          console.log(`      🛒 Etap 2 rezerwacji: ${metrics.booking_step_2}`);

          // Check if any conversion data exists
          const hasConversionData = Object.values(metrics).some(value => value > 0);
          
          if (hasConversionData) {
            console.log('   ✅ Conversion metrics are working correctly!');
          } else {
            console.log('   ⚠️  No conversion data found - this is normal if Pixel is not configured');
          }
        } else {
          console.log('   ❌ Conversion metrics not found in API response');
        }

        console.log('');

      } catch (error) {
        console.error(`   ❌ Error testing client ${client.name}:`, error.message);
        console.log('');
      }
    }

    console.log('🎉 Conversion metrics testing completed!');
    console.log('\n📋 Summary:');
    console.log('- Each client fetches data individually from Meta API');
    console.log('- Conversion tracking data is parsed from actions and action_values');
    console.log('- ROAS and cost per reservation are calculated automatically');
    console.log('- All metrics are displayed in Polish with proper formatting');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testConversionMetrics().catch(console.error); 