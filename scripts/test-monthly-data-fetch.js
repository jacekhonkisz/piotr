const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMonthlyDataFetch() {
  console.log('🔍 Testing Monthly Data Fetch...\n');

  try {
    // Get current date info
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    
    console.log(`📅 Current Date: ${currentDate.toLocaleDateString('pl-PL')}`);
    console.log(`📅 Current Month: ${monthNames[currentMonth]} ${currentYear}\n`);

    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email')
      .order('name');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`👥 Found ${clients.length} clients\n`);

    for (const client of clients) {
      console.log(`\n🏢 Testing Client: ${client.name} (${client.email})`);
      console.log('─'.repeat(50));

      // Get campaigns for current month (using date_range_start)
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

      console.log(`📊 Fetching campaigns for: ${startOfMonth.toLocaleDateString('pl-PL')} - ${endOfMonth.toLocaleDateString('pl-PL')}`);

      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', client.id)
        .gte('date_range_start', startOfMonth.toISOString().split('T')[0])
        .lte('date_range_start', endOfMonth.toISOString().split('T')[0]);

      if (campaignsError) {
        console.error('❌ Error fetching campaigns:', campaignsError);
        continue;
      }

      console.log(`📈 Found ${campaigns.length} campaigns for current month`);

      if (campaigns.length === 0) {
        console.log('⚠️  No campaigns found for current month');
        
        // Check if there are any campaigns at all for this client
        const { data: allCampaigns, error: allCampaignsError } = await supabase
          .from('campaigns')
          .select('date_range_start, spend, impressions, clicks, conversions, click_to_call, lead, purchase, purchase_value, booking_step_1, booking_step_2')
          .eq('client_id', client.id)
          .order('date_range_start', { ascending: false })
          .limit(5);

        if (!allCampaignsError && allCampaigns.length > 0) {
          console.log('📋 Recent campaigns for this client:');
          allCampaigns.forEach(campaign => {
            console.log(`   ${campaign.date_range_start}: Spend=${campaign.spend}, Clicks=${campaign.clicks}, Conversions=${campaign.conversions}`);
            console.log(`      Click to call: ${campaign.click_to_call}, Lead: ${campaign.lead}, Purchase: ${campaign.purchase}`);
            console.log(`      Booking steps: ${campaign.booking_step_1}/${campaign.booking_step_2}, Purchase value: ${campaign.purchase_value}`);
          });
        }
        continue;
      }

      // Calculate current month totals
      const currentMonthData = campaigns.reduce((acc, campaign) => {
        acc.spend += campaign.spend || 0;
        acc.impressions += campaign.impressions || 0;
        acc.clicks += campaign.clicks || 0;
        acc.conversions += campaign.conversions || 0;
        acc.clickToCall += campaign.click_to_call || 0;
        acc.leads += campaign.lead || 0;
        acc.purchases += campaign.purchase || 0;
        acc.purchaseValue += campaign.purchase_value || 0;
        acc.bookingStep1 += campaign.booking_step_1 || 0;
        acc.bookingStep2 += campaign.booking_step_2 || 0;
        return acc;
      }, { 
        spend: 0, 
        impressions: 0, 
        clicks: 0, 
        conversions: 0,
        clickToCall: 0,
        leads: 0,
        purchases: 0,
        purchaseValue: 0,
        bookingStep1: 0,
        bookingStep2: 0
      });

      console.log('\n📊 Current Month Totals:');
      console.log(`   💰 Spend: ${currentMonthData.spend.toLocaleString('pl-PL')} zł`);
      console.log(`   👁️  Impressions: ${currentMonthData.impressions.toLocaleString('pl-PL')}`);
      console.log(`   🖱️  Clicks: ${currentMonthData.clicks.toLocaleString('pl-PL')}`);
      console.log(`   ✅ Conversions: ${currentMonthData.conversions.toLocaleString('pl-PL')}`);

      console.log('\n📞 Conversion Metrics:');
      console.log(`   📞 Click to Call: ${currentMonthData.clickToCall}`);
      console.log(`   📋 Leads: ${currentMonthData.leads}`);
      console.log(`   🛒 Purchases: ${currentMonthData.purchases}`);
      console.log(`   💰 Purchase Value: ${currentMonthData.purchaseValue.toLocaleString('pl-PL')} zł`);
      console.log(`   📝 Booking Step 1: ${currentMonthData.bookingStep1}`);
      console.log(`   📝 Booking Step 2: ${currentMonthData.bookingStep2}`);

      // Calculate estimated metrics (like in the dashboard)
      const estimatedLeads = currentMonthData.clickToCall + currentMonthData.leads;
      const estimatedReservationValue = currentMonthData.purchaseValue || (currentMonthData.spend * 2.5);

      console.log('\n📈 Estimated Metrics for Dashboard:');
      console.log(`   📞 Leads (click_to_call + lead): ${estimatedLeads}`);
      console.log(`   💰 Reservation Value: ${Math.round(estimatedReservationValue).toLocaleString('pl-PL')} zł`);
      console.log(`   📋 Reservations (conversions): ${currentMonthData.conversions}`);

      // Get previous month data for comparison
      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const startOfPreviousMonth = new Date(previousYear, previousMonth, 1);
      const endOfPreviousMonth = new Date(previousYear, previousMonth + 1, 0, 23, 59, 59);

      console.log(`\n📊 Fetching previous month data: ${startOfPreviousMonth.toLocaleDateString('pl-PL')} - ${endOfPreviousMonth.toLocaleDateString('pl-PL')}`);

      const { data: previousCampaigns, error: previousCampaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', client.id)
        .gte('date_range_start', startOfPreviousMonth.toISOString().split('T')[0])
        .lte('date_range_start', endOfPreviousMonth.toISOString().split('T')[0]);

      if (previousCampaignsError) {
        console.error('❌ Error fetching previous month campaigns:', previousCampaignsError);
        continue;
      }

      console.log(`📈 Found ${previousCampaigns.length} campaigns for previous month`);

      if (previousCampaigns.length > 0) {
        const previousMonthData = previousCampaigns.reduce((acc, campaign) => {
          acc.spend += campaign.spend || 0;
          acc.impressions += campaign.impressions || 0;
          acc.clicks += campaign.clicks || 0;
          acc.conversions += campaign.conversions || 0;
          acc.clickToCall += campaign.click_to_call || 0;
          acc.leads += campaign.lead || 0;
          acc.purchases += campaign.purchase || 0;
          acc.purchaseValue += campaign.purchase_value || 0;
          return acc;
        }, { 
          spend: 0, 
          impressions: 0, 
          clicks: 0, 
          conversions: 0,
          clickToCall: 0,
          leads: 0,
          purchases: 0,
          purchaseValue: 0
        });

        const previousLeads = previousMonthData.clickToCall + previousMonthData.leads;
        const previousReservationValue = previousMonthData.purchaseValue || (previousMonthData.spend * 2.5);

        console.log('\n📊 Previous Month Totals:');
        console.log(`   💰 Spend: ${previousMonthData.spend.toLocaleString('pl-PL')} zł`);
        console.log(`   👁️  Impressions: ${previousMonthData.impressions.toLocaleString('pl-PL')}`);
        console.log(`   🖱️  Clicks: ${previousMonthData.clicks.toLocaleString('pl-PL')}`);
        console.log(`   ✅ Conversions: ${previousMonthData.conversions.toLocaleString('pl-PL')}`);

        console.log('\n📈 Previous Month Estimated Metrics:');
        console.log(`   📞 Leads: ${previousLeads}`);
        console.log(`   💰 Reservation Value: ${Math.round(previousReservationValue).toLocaleString('pl-PL')} zł`);
        console.log(`   📋 Reservations: ${previousMonthData.conversions}`);

        // Calculate changes
        const leadsChange = previousLeads > 0 ? ((estimatedLeads - previousLeads) / previousLeads) * 100 : 0;
        const reservationsChange = previousMonthData.conversions > 0 ? ((currentMonthData.conversions - previousMonthData.conversions) / previousMonthData.conversions) * 100 : 0;
        const reservationValueChange = previousReservationValue > 0 ? ((estimatedReservationValue - previousReservationValue) / previousReservationValue) * 100 : 0;

        console.log('\n📊 Month-over-Month Changes:');
        console.log(`   📞 Leads: ${leadsChange > 0 ? '+' : ''}${leadsChange.toFixed(1)}%`);
        console.log(`   📋 Reservations: ${reservationsChange > 0 ? '+' : ''}${reservationsChange.toFixed(1)}%`);
        console.log(`   💰 Reservation Value: ${reservationValueChange > 0 ? '+' : ''}${reservationValueChange.toFixed(1)}%`);
      } else {
        console.log('⚠️  No previous month data available for comparison');
      }

      console.log('\n' + '─'.repeat(50));
    }

    console.log('\n✅ Monthly data fetch test completed!');

  } catch (error) {
    console.error('❌ Error in monthly data fetch test:', error);
  }
}

testMonthlyDataFetch(); 