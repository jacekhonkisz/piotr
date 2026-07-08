const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client from environment (never hardcode keys)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function compareConversionData() {
  console.log('🔍 Comparing Conversion Data: UI vs Meta API');
  console.log('============================================\n');

  try {
    // Get current month date range
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateStart = startOfMonth.toISOString().split('T')[0];
    const dateEnd = today.toISOString().split('T')[0];

    console.log(`📅 Date Range: ${dateStart} to ${dateEnd}\n`);

    // Get Belmonte and Havet clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .in('email', ['belmonte@hotel.com', 'havet@magialubczyku.pl']);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    for (const client of clients) {
      console.log(`🏢 Testing ${client.name} (${client.email})`);
      console.log(`   Ad Account ID: ${client.ad_account_id}\n`);

      if (!client.meta_access_token || !client.ad_account_id) {
        console.log('   ⚠️  Skipping - missing token or ad account ID\n');
        continue;
      }

      try {
        // Test API endpoint call
        console.log('   📡 Testing API Endpoint Call');
        const response = await fetch('http://localhost:3000/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM3MTI4NiwiZXhwIjoyMDY4OTQ3Mjg2fQ.FsFNPzGfUNTkAB9M4tuz-iiF_L_n9oWrZZnoruR-w7U`
          },
          body: JSON.stringify({
            clientId: client.id,
            dateRange: {
              start: dateStart,
              end: dateEnd
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.data.conversionMetrics) {
            const apiMetrics = data.data.conversionMetrics;
            
            console.log('   📊 API Endpoint Results:');
            console.log(`      📞 Click to Call: ${apiMetrics.click_to_call}`);
            console.log(`      📧 Email Contacts: ${apiMetrics.email_contacts}`);
            console.log(`      🛒 Booking Step 1: ${apiMetrics.booking_step_1}`);
            console.log(`      ✅ Reservations: ${apiMetrics.reservations}`);
            console.log(`      💰 Reservation Value: ${apiMetrics.reservation_value.toLocaleString('pl-PL')} PLN`);
            console.log(`      📊 ROAS: ${apiMetrics.roas.toFixed(2)}x`);
            console.log(`      💵 Cost per Reservation: ${apiMetrics.cost_per_reservation.toLocaleString('pl-PL')} PLN`);
            console.log(`      🛒 Booking Step 2: ${apiMetrics.booking_step_2}`);

            // Show campaign data
            if (data.data.campaigns && data.data.campaigns.length > 0) {
              console.log('\n   📋 Campaign Data Summary:');
              console.log(`      Total Campaigns: ${data.data.campaigns.length}`);
              
              // Find campaigns with conversion data
              const campaignsWithConversions = data.data.campaigns.filter(campaign => 
                (campaign.click_to_call || 0) > 0 || 
                (campaign.email_contacts || 0) > 0 || 
                (campaign.booking_step_1 || 0) > 0 || 
                (campaign.reservations || 0) > 0
              );

              console.log(`      Campaigns with Conversions: ${campaignsWithConversions.length}`);

              if (campaignsWithConversions.length > 0) {
                console.log('\n   🎯 Top Converting Campaigns:');
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
            }

            // Compare with expected values based on previous audit
            console.log('\n   🔍 Expected vs Actual Comparison:');
            
            if (client.email === 'belmonte@hotel.com') {
              // Based on Belmonte audit results
              console.log('   📊 Expected Values (from Belmonte audit):');
              console.log(`      📞 Click to Call: 0 (expected) vs ${apiMetrics.click_to_call} (actual) ${apiMetrics.click_to_call === 0 ? '✅' : '❌'}`);
              console.log(`      📧 Email Contacts: ~1963 (expected) vs ${apiMetrics.email_contacts} (actual) ${Math.abs(apiMetrics.email_contacts - 1963) < 10 ? '✅' : '❌'}`);
              console.log(`      🛒 Booking Step 1: ~183 (expected) vs ${apiMetrics.booking_step_1} (actual) ${Math.abs(apiMetrics.booking_step_1 - 183) < 10 ? '✅' : '❌'}`);
              console.log(`      ✅ Reservations: ~196 (expected) vs ${apiMetrics.reservations} (actual) ${Math.abs(apiMetrics.reservations - 196) < 10 ? '✅' : '❌'}`);
              console.log(`      💰 Reservation Value: ~118431 (expected) vs ${apiMetrics.reservation_value} (actual) ${Math.abs(apiMetrics.reservation_value - 118431) < 1000 ? '✅' : '❌'}`);
            } else if (client.email === 'havet@magialubczyku.pl') {
              // Based on Havet audit results
              console.log('   📊 Expected Values (from Havet audit):');
              console.log(`      📞 Click to Call: ~45 (expected) vs ${apiMetrics.click_to_call} (actual) ${Math.abs(apiMetrics.click_to_call - 45) < 10 ? '✅' : '❌'}`);
              console.log(`      📧 Email Contacts: ~0 (expected) vs ${apiMetrics.email_contacts} (actual) ${apiMetrics.email_contacts === 0 ? '✅' : '❌'}`);
              console.log(`      🛒 Booking Step 1: ~84 (expected) vs ${apiMetrics.booking_step_1} (actual) ${Math.abs(apiMetrics.booking_step_1 - 84) < 10 ? '✅' : '❌'}`);
              console.log(`      ✅ Reservations: ~42 (expected) vs ${apiMetrics.reservations} (actual) ${Math.abs(apiMetrics.reservations - 42) < 10 ? '✅' : '❌'}`);
              console.log(`      💰 Reservation Value: ~31737 (expected) vs ${apiMetrics.reservation_value} (actual) ${Math.abs(apiMetrics.reservation_value - 31737) < 1000 ? '✅' : '❌'}`);
            }
          } else {
            console.log('   ❌ API endpoint did not return conversion metrics');
          }
        } else {
          console.log(`   ❌ API endpoint failed: ${response.status} ${response.statusText}`);
        }

        console.log('\n' + '='.repeat(60) + '\n');

      } catch (error) {
        console.error(`   ❌ Error testing ${client.name}:`, error.message);
        console.log('\n' + '='.repeat(60) + '\n');
      }
    }

    console.log('🎉 Conversion data comparison completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the comparison
compareConversionData().catch(console.error); 