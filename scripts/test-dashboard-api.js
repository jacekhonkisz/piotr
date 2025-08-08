const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDashboardAPI() {
  console.log('🔍 Testing Dashboard API Data Fetch...\n');

  try {
    // Get current date info
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    
    console.log(`📅 Current Date: ${currentDate.toLocaleDateString('pl-PL')}`);
    console.log(`📅 Current Month: ${monthNames[currentMonth]} ${currentYear}\n`);

    // Get a client to test with
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token')
      .order('name')
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      console.error('❌ No clients found:', clientsError);
      return;
    }

    const client = clients[0];
    console.log(`🏢 Testing with client: ${client.name} (${client.email})`);
    console.log(`📋 Ad Account ID: ${client.ad_account_id}\n`);

    if (!client.meta_access_token) {
      console.log('❌ No Meta token found for this client');
      return;
    }

    // Simulate the exact dashboard API call
    console.log('📡 Testing Dashboard API Call...');
    console.log('====================================');
    
    // Use the same date range as the dashboard
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
    const dateRange = {
      start: startOfMonth.toISOString().split('T')[0],
      end: currentDate.toISOString().split('T')[0]
    };

    const requestBody = {
      dateRange: dateRange,
      clientId: client.id
    };

    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    // Make the API call to our fetch-live-data endpoint
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This will fail without proper authentication, but we can see the structure
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Response data structure:', {
        success: data.success,
        hasData: !!data.data,
        hasCampaigns: !!data.data?.campaigns,
        campaignsCount: data.data?.campaigns?.length || 0,
        hasConversionMetrics: !!data.data?.conversionMetrics,
        conversionMetrics: data.data?.conversionMetrics || 'Not found'
      });

      if (data.data?.campaigns) {
        console.log('\n📈 Campaigns found:');
        data.data.campaigns.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.campaign_name}:`);
          console.log(`      Spend: ${campaign.spend} zł`);
          console.log(`      Clicks: ${campaign.clicks}`);
          console.log(`      Conversions: ${campaign.conversions}`);
          console.log(`      Impressions: ${campaign.impressions}`);
        });
      }

      if (data.data?.conversionMetrics) {
        console.log('\n📞 Conversion Metrics:');
        console.log(`   Click to Call: ${data.data.conversionMetrics.click_to_call || 0}`);
        console.log(`   Email Contacts: ${data.data.conversionMetrics.email_contacts || 0}`);
        console.log(`   Reservations: ${data.data.conversionMetrics.reservations || 0}`);
        console.log(`   Reservation Value: ${data.data.conversionMetrics.reservation_value || 0} zł`);
        console.log(`   Booking Step 1: ${data.data.conversionMetrics.booking_step_1 || 0}`);
        console.log(`   Booking Step 2: ${data.data.conversionMetrics.booking_step_2 || 0}`);
        console.log(`   ROAS: ${data.data.conversionMetrics.roas || 0}`);
        console.log(`   Cost per Reservation: ${data.data.conversionMetrics.cost_per_reservation || 0} zł`);
      }

      // Calculate what the dashboard should show
      const totalLeads = (data.data?.conversionMetrics?.click_to_call || 0) + (data.data?.conversionMetrics?.email_contacts || 0);
      const totalReservations = data.data?.conversionMetrics?.reservations || 0;
      const totalReservationValue = data.data?.conversionMetrics?.reservation_value || 0;

      console.log('\n🎯 Dashboard Should Display:');
      console.log(`   📞 Pozyskane leady: ${totalLeads}`);
      console.log(`   📋 Rezerwacje: ${totalReservations}`);
      console.log(`   💰 Wartość rezerwacji: ${totalReservationValue.toLocaleString('pl-PL')} zł`);

    } else {
      const errorText = await response.text();
      console.log('❌ Response error:', errorText);
      
      if (response.status === 401) {
        console.log('\n💡 Note: This is expected - the API requires authentication.');
        console.log('   The dashboard will work correctly when accessed through the web app.');
      }
    }

  } catch (error) {
    console.error('❌ Error in dashboard API test:', error);
  }
}

testDashboardAPI(); 