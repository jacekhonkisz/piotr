const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://xbklptrrfdspyvnjaojf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM3MTI4NiwiZXhwIjoyMDY4OTQ3Mjg2fQ.FsFNPzGfUNTkAB9M4tuz-iiF_L_n9oWrZZnoruR-w7U'
);

async function testConversionFixes() {
  console.log('🔧 Testing Conversion Metrics Fixes');
  console.log('====================================\n');

  try {
    // Get current month date range
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateStart = startOfMonth.toISOString().split('T')[0];
    const dateEnd = today.toISOString().split('T')[0];

    console.log(`📅 Testing date range: ${dateStart} to ${dateEnd}\n`);

    // Get Belmonte client
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'belmonte@hotel.com')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.error('❌ Error fetching Belmonte client:', clientsError);
      return;
    }

    const client = clients[0];
    console.log(`🏢 Testing ${client.name} (${client.email})`);
    console.log(`   Ad Account ID: ${client.ad_account_id}\n`);

    // Test API endpoint
    console.log('📡 Testing API Endpoint...');
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
        const metrics = data.data.conversionMetrics;
        
        console.log('✅ API Response Success!');
        console.log('📊 Conversion Metrics:');
        console.log(`   📞 Click to Call: ${metrics.click_to_call}`);
        console.log(`   📧 Email Contacts: ${metrics.email_contacts}`);
        console.log(`   🛒 Booking Step 1: ${metrics.booking_step_1}`);
        console.log(`   ✅ Reservations: ${metrics.reservations}`);
        console.log(`   💰 Reservation Value: ${metrics.reservation_value.toLocaleString('pl-PL')} PLN`);
        console.log(`   📊 ROAS: ${metrics.roas.toFixed(2)}x`);
        console.log(`   💵 Cost per Reservation: ${metrics.cost_per_reservation.toLocaleString('pl-PL')} PLN`);
        console.log(`   🛒 Booking Step 2: ${metrics.booking_step_2}`);

        // Check if data matches expected values from audit
        console.log('\n🔍 Data Validation:');
        console.log(`   📧 Email Contacts: ${metrics.email_contacts} (expected ~1963) ${Math.abs(metrics.email_contacts - 1963) < 10 ? '✅' : '❌'}`);
        console.log(`   🛒 Booking Step 1: ${metrics.booking_step_1} (expected ~183) ${Math.abs(metrics.booking_step_1 - 183) < 10 ? '✅' : '❌'}`);
        console.log(`   ✅ Reservations: ${metrics.reservations} (expected ~196) ${Math.abs(metrics.reservations - 196) < 10 ? '✅' : '❌'}`);
        console.log(`   💰 Reservation Value: ${metrics.reservation_value} (expected ~118431) ${Math.abs(metrics.reservation_value - 118431) < 1000 ? '✅' : '❌'}`);

        // Check campaign data
        if (data.data.campaigns && data.data.campaigns.length > 0) {
          console.log(`\n📋 Campaign Data: ${data.data.campaigns.length} campaigns`);
          
          // Find campaigns with conversion data
          const campaignsWithConversions = data.data.campaigns.filter(campaign => 
            (campaign.click_to_call || 0) > 0 || 
            (campaign.email_contacts || 0) > 0 || 
            (campaign.booking_step_1 || 0) > 0 || 
            (campaign.reservations || 0) > 0
          );

          console.log(`   🎯 Campaigns with conversions: ${campaignsWithConversions.length}`);

          if (campaignsWithConversions.length > 0) {
            console.log('\n   📊 Sample Campaign Conversion Data:');
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

      } else {
        console.log('❌ API response missing conversion metrics');
        console.log('Response data:', JSON.stringify(data, null, 2));
      }
    } else {
      console.log(`❌ API request failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testConversionFixes().catch(console.error); 