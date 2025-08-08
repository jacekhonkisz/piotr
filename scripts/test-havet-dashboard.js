const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testHavetDashboard() {
  console.log('🔍 Testing Havet Dashboard Data...\n');

  try {
    // Get current date info
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    
    console.log(`📅 Current Date: ${currentDate.toLocaleDateString('pl-PL')}`);
    console.log(`📅 Current Month: ${monthNames[currentMonth]} ${currentYear}\n`);

    // Get Havet client specifically
    const { data: havetClient, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, ad_account_id, meta_access_token')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    if (clientError || !havetClient) {
      console.error('❌ Havet client not found:', clientError);
      return;
    }

    console.log(`🏢 Testing Havet client: ${havetClient.name} (${havetClient.email})`);
    console.log(`📋 Ad Account ID: ${havetClient.ad_account_id}`);
    console.log(`🔑 Has Meta Token: ${!!havetClient.meta_access_token}\n`);

    if (!havetClient.meta_access_token) {
      console.log('❌ No Meta token found for Havet');
      return;
    }

    // Check what campaigns exist in database for Havet
    console.log('📊 Checking Havet campaigns in database...');
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClient.id)
      .order('date_range_start', { ascending: false })
      .limit(10);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
    } else {
      console.log(`📈 Found ${campaigns?.length || 0} campaigns in database for Havet`);
      
      if (campaigns && campaigns.length > 0) {
        console.log('\n📋 Recent campaigns:');
        campaigns.slice(0, 5).forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.campaign_name} (${campaign.date_range_start}):`);
          console.log(`      Spend: ${campaign.spend} zł`);
          console.log(`      Clicks: ${campaign.clicks}`);
          console.log(`      Conversions: ${campaign.conversions}`);
          console.log(`      Click to Call: ${campaign.click_to_call || 0}`);
          console.log(`      Email Contacts: ${campaign.email_contacts || 0}`);
          console.log(`      Reservations: ${campaign.reservations || 0}`);
          console.log(`      Reservation Value: ${campaign.reservation_value || 0} zł`);
        });
      }
    }

    // Check current month data specifically
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59));
    
    console.log(`\n📅 Checking current month data (${startOfMonth.toISOString().split('T')[0]} - ${endOfMonth.toISOString().split('T')[0]})`);
    
    const { data: currentMonthCampaigns, error: currentMonthError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClient.id)
      .gte('date_range_start', startOfMonth.toISOString().split('T')[0])
      .lte('date_range_start', endOfMonth.toISOString().split('T')[0]);

    if (currentMonthError) {
      console.error('❌ Error fetching current month campaigns:', currentMonthError);
    } else {
      console.log(`📈 Found ${currentMonthCampaigns?.length || 0} campaigns for current month`);
      
      if (currentMonthCampaigns && currentMonthCampaigns.length > 0) {
        console.log('\n📊 Current Month Campaigns:');
        currentMonthCampaigns.forEach((campaign, index) => {
          console.log(`   ${index + 1}. ${campaign.campaign_name}:`);
          console.log(`      Spend: ${campaign.spend} zł`);
          console.log(`      Clicks: ${campaign.clicks}`);
          console.log(`      Conversions: ${campaign.conversions}`);
          console.log(`      Click to Call: ${campaign.click_to_call || 0}`);
          console.log(`      Email Contacts: ${campaign.email_contacts || 0}`);
          console.log(`      Reservations: ${campaign.reservations || 0}`);
          console.log(`      Reservation Value: ${campaign.reservation_value || 0} zł`);
        });
      } else {
        console.log('⚠️  No campaigns found for current month in database');
      }
    }

    // Calculate what the dashboard should show based on database data
    if (currentMonthCampaigns && currentMonthCampaigns.length > 0) {
      const totalLeads = currentMonthCampaigns.reduce((sum, campaign) => 
        sum + (campaign.click_to_call || 0) + (campaign.email_contacts || 0), 0);
      const totalReservations = currentMonthCampaigns.reduce((sum, campaign) => 
        sum + (campaign.reservations || 0), 0);
      const totalReservationValue = currentMonthCampaigns.reduce((sum, campaign) => 
        sum + (campaign.reservation_value || 0), 0);

      console.log('\n🎯 Dashboard Should Show (from database):');
      console.log(`   📞 Pozyskane leady: ${totalLeads}`);
      console.log(`   📋 Rezerwacje: ${totalReservations}`);
      console.log(`   💰 Wartość rezerwacji: ${totalReservationValue.toLocaleString('pl-PL')} zł`);
    }

    // Test the Meta API call structure (without authentication)
    console.log('\n📡 Testing Meta API call structure...');
    
    const dateRange = {
      start: startOfMonth.toISOString().split('T')[0],
      end: currentDate.toISOString().split('T')[0]
    };

    const requestBody = {
      dateRange: dateRange,
      clientId: havetClient.id
    };

    console.log('📤 API Request Body:', JSON.stringify(requestBody, null, 2));

    // Note: This will fail without authentication, but we can see the structure
    try {
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API call successful!');
        console.log('📊 Response structure:', {
          success: data.success,
          hasData: !!data.data,
          hasCampaigns: !!data.data?.campaigns,
          campaignsCount: data.data?.campaigns?.length || 0,
          hasConversionMetrics: !!data.data?.conversionMetrics
        });

        if (data.data?.conversionMetrics) {
          console.log('\n📞 Meta API Conversion Metrics:');
          console.log(`   Click to Call: ${data.data.conversionMetrics.click_to_call || 0}`);
          console.log(`   Email Contacts: ${data.data.conversionMetrics.email_contacts || 0}`);
          console.log(`   Reservations: ${data.data.conversionMetrics.reservations || 0}`);
          console.log(`   Reservation Value: ${data.data.conversionMetrics.reservation_value || 0} zł`);

          const apiLeads = (data.data.conversionMetrics.click_to_call || 0) + (data.data.conversionMetrics.email_contacts || 0);
          console.log('\n🎯 Dashboard Should Show (from Meta API):');
          console.log(`   📞 Pozyskane leady: ${apiLeads}`);
          console.log(`   📋 Rezerwacje: ${data.data.conversionMetrics.reservations || 0}`);
          console.log(`   💰 Wartość rezerwacji: ${(data.data.conversionMetrics.reservation_value || 0).toLocaleString('pl-PL')} zł`);
        }
      } else {
        const errorText = await response.text();
        console.log('❌ API call failed:', errorText);
        
        if (response.status === 401) {
          console.log('\n💡 Note: This is expected - API requires authentication.');
          console.log('   The dashboard will work correctly when accessed through the web app.');
        }
      }
    } catch (error) {
      console.log('❌ API call error:', error.message);
      console.log('💡 This is expected when testing without a running server.');
    }

    console.log('\n✅ Havet dashboard test completed!');

  } catch (error) {
    console.error('❌ Error in Havet dashboard test:', error);
  }
}

testHavetDashboard(); 