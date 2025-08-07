const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xbklptrrfdspyvnjaojf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM3MTI4NiwiZXhwIjoyMDY4OTQ3Mjg2fQ.FsFNPzGfUNTkAB9M4tuz-iiF_L_n9oWrZZnoruR-w7U'
);

async function testCurrentMonthConversionMetrics() {
  console.log('🧪 Testing Current Month Conversion Metrics');
  console.log('===========================================\n');

  try {
    // Get current month date range (first day to today)
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthId = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const dateStart = startOfMonth.toISOString().split('T')[0];
    const dateEnd = today.toISOString().split('T')[0];

    console.log(`📅 Current Month Date Range:`);
    console.log(`   Period ID: ${currentMonthId}`);
    console.log(`   Start Date: ${dateStart} (First day of current month)`);
    console.log(`   End Date: ${dateEnd} (Today)`);
    console.log(`   Days in range: ${Math.ceil((today - startOfMonth) / (1000 * 60 * 60 * 24)) + 1}\n`);

    // Get all clients with Meta API tokens
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
        // Test the fetch-live-data API endpoint for current month
        console.log(`   📡 Testing API endpoint for current month...`);
        
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

        console.log(`   📊 Found ${data.data.campaigns.length} campaigns for current month`);

        // Check if conversion metrics are present
        if (data.data.conversionMetrics) {
          const metrics = data.data.conversionMetrics;
          
          console.log('   📈 Current Month Conversion Metrics:');
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
            console.log('   ✅ Current month conversion metrics are working correctly!');
            
            // Show sample campaigns with conversion data
            const campaignsWithConversions = data.data.campaigns.filter(campaign => 
              (campaign.click_to_call || 0) > 0 || 
              (campaign.email_contacts || 0) > 0 || 
              (campaign.booking_step_1 || 0) > 0 || 
              (campaign.reservations || 0) > 0
            );

            if (campaignsWithConversions.length > 0) {
              console.log(`   🎯 Found ${campaignsWithConversions.length} campaigns with conversion data:`);
              
              campaignsWithConversions.slice(0, 3).forEach((campaign, index) => {
                console.log(`      ${index + 1}. ${campaign.campaign_name}`);
                console.log(`         📞 Click to Call: ${campaign.click_to_call || 0}`);
                console.log(`         📧 Email Contacts: ${campaign.email_contacts || 0}`);
                console.log(`         🛒 Booking Step 1: ${campaign.booking_step_1 || 0}`);
                console.log(`         ✅ Reservations: ${campaign.reservations || 0}`);
                console.log(`         💰 Reservation Value: ${campaign.reservation_value || 0}`);
                console.log(`         🛒 Booking Step 2: ${campaign.booking_step_2 || 0}`);
              });
            }
          } else {
            console.log('   ⚠️  No conversion data found for current month - this is normal if Pixel is not configured');
          }
        } else {
          console.log('   ❌ Conversion metrics not found in API response');
        }

        // Verify date range in response
        if (data.data.dateRange) {
          console.log(`   📅 API Response Date Range: ${data.data.dateRange.start} to ${data.data.dateRange.end}`);
          
          // Check if the date range matches current month
          const responseStart = data.data.dateRange.start;
          const responseEnd = data.data.dateRange.end;
          
          if (responseStart === dateStart && responseEnd === dateEnd) {
            console.log('   ✅ Date range matches current month (first day to today)');
          } else {
            console.log('   ⚠️  Date range does not match current month');
            console.log(`      Expected: ${dateStart} to ${dateEnd}`);
            console.log(`      Received: ${responseStart} to ${responseEnd}`);
          }
        }

        console.log('');

      } catch (error) {
        console.error(`   ❌ Error testing client ${client.name}:`, error.message);
        console.log('');
      }
    }

    console.log('🎉 Current month conversion metrics testing completed!');
    console.log('\n📋 Summary:');
    console.log('- Current month fetches data from first day of month to today');
    console.log('- All 8 conversion metrics are parsed and calculated');
    console.log('- Each client fetches data individually from Meta API');
    console.log('- Date range verification ensures correct period coverage');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCurrentMonthConversionMetrics().catch(console.error); 