const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCurrentMonthDateRange() {
  console.log('🔍 Debugging current month date range...\n');
  
  const havetClientId = '93d46876-addc-4b99-b1e1-437428dd54f1';
  
  try {
    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', havetClientId)
      .single();

    if (clientError) {
      console.error('❌ Error fetching client:', clientError);
      return;
    }

    console.log(`🏨 Client: ${client.name} (${client.email})`);
    
    // Simulate the reports page date range calculation for current month
    console.log('\n📅 Reports Page Date Range Calculation:');
    console.log('='.repeat(50));
    
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // August = 8
    
    console.log(`   - Current Date: ${currentDate.toISOString()}`);
    console.log(`   - Current Year: ${currentYear}`);
    console.log(`   - Current Month: ${currentMonth}`);
    
    // Calculate start date (first day of current month)
    const startDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const endDate = new Date(); // Today
    
    const dateRange = {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
    
    console.log(`   - Start Date: ${dateRange.start}`);
    console.log(`   - End Date: ${dateRange.end}`);
    
    // Calculate the number of days
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    console.log(`   - Days in Range: ${daysDiff} days`);
    
    // Get stored campaign data to see what percentage this represents
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClientId);

    if (error || !campaigns || campaigns.length === 0) {
      console.error('❌ Error or no campaigns found');
      return;
    }

    const campaign = campaigns[0];
    
    console.log('\n📊 Stored Campaign Data:');
    console.log('='.repeat(50));
    console.log(`   - Campaign Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
    console.log(`   - Total Phone Contacts: ${campaign.click_to_call.toLocaleString()}`);
    console.log(`   - Total Reservations: ${campaign.purchase.toLocaleString()}`);
    console.log(`   - Total Value: ${campaign.purchase_value.toLocaleString()} zł`);
    
    // Calculate what percentage the current month represents of the total campaign period
    const campaignStart = new Date(campaign.date_range_start);
    const campaignEnd = new Date(campaign.date_range_end);
    const totalCampaignDays = Math.ceil((campaignEnd - campaignStart) / (1000 * 60 * 60 * 24)) + 1;
    
    const currentMonthPercentage = (daysDiff / totalCampaignDays * 100).toFixed(2);
    
    console.log(`\n📊 Current Month Analysis:`);
    console.log('='.repeat(50));
    console.log(`   - Total Campaign Period: ${totalCampaignDays} days`);
    console.log(`   - Current Month Period: ${daysDiff} days`);
    console.log(`   - Current Month Percentage: ${currentMonthPercentage}%`);
    
    // Calculate expected values for current month
    const expectedPhone = Math.round(campaign.click_to_call * (daysDiff / totalCampaignDays));
    const expectedPurchase = Math.round(campaign.purchase * (daysDiff / totalCampaignDays));
    const expectedValue = campaign.purchase_value * (daysDiff / totalCampaignDays);
    const expectedBooking = Math.round(campaign.booking_step_1 * (daysDiff / totalCampaignDays));
    
    console.log(`\n📊 Expected Values for Current Month (${currentMonthPercentage}%):`);
    console.log('='.repeat(50));
    console.log(`   - Phone Contacts: ${expectedPhone.toLocaleString()}`);
    console.log(`   - Reservations: ${expectedPurchase.toLocaleString()}`);
    console.log(`   - Reservation Value: ${expectedValue.toFixed(2)} zł`);
    console.log(`   - Booking Steps: ${expectedBooking.toLocaleString()}`);
    
    console.log(`\n📊 Actual Displayed Values (From Reports Page):`);
    console.log('='.repeat(50));
    console.log(`   - Phone Contacts: 51`);
    console.log(`   - Reservations: 70`);
    console.log(`   - Reservation Value: 55,490.00 zł`);
    console.log(`   - Booking Steps: 108`);
    
    console.log(`\n🔍 Comparison:`);
    console.log('='.repeat(50));
    
    const phoneDiff = Math.abs(expectedPhone - 51);
    const purchaseDiff = Math.abs(expectedPurchase - 70);
    const valueDiff = Math.abs(expectedValue - 55490);
    const bookingDiff = Math.abs(expectedBooking - 108);
    
    console.log(`   - Phone Contacts: ${phoneDiff === 0 ? '✅ Match' : `❌ Diff: ${phoneDiff}`}`);
    console.log(`   - Reservations: ${purchaseDiff === 0 ? '✅ Match' : `❌ Diff: ${purchaseDiff}`}`);
    console.log(`   - Reservation Value: ${valueDiff < 1 ? '✅ Match' : `❌ Diff: ${valueDiff.toFixed(2)} zł`}`);
    console.log(`   - Booking Steps: ${bookingDiff === 0 ? '✅ Match' : `❌ Diff: ${bookingDiff}`}`);
    
    console.log(`\n🎯 Assessment:`);
    console.log('='.repeat(50));
    
    if (phoneDiff < 10 && purchaseDiff < 10 && valueDiff < 1000) {
      console.log('✅ CLOSE MATCH: Displayed values are close to expected values');
      console.log('✅ This suggests the reports page is working correctly');
      console.log('✅ The small differences might be due to:');
      console.log('   - Real-time data updates');
      console.log('   - Meta API data processing');
      console.log('   - Rounding differences');
    } else {
      console.log('❌ SIGNIFICANT DIFFERENCES: Displayed values differ from expected');
      console.log('❌ This suggests the reports page is NOT fetching real data for the period');
      console.log('💡 Possible causes:');
      console.log('   - API returning all-time data instead of period data');
      console.log('   - Date range calculation error');
      console.log('   - Data processing issue');
      console.log('   - Caching problem');
    }
    
    console.log(`\n💡 Recommendation:`);
    console.log('='.repeat(50));
    console.log('The reports page should fetch REAL data for the exact date range:');
    console.log(`   ${dateRange.start} to ${dateRange.end}`);
    console.log('This should return data that was actually created during this period,');
    console.log('not estimated percentages of all-time data.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugCurrentMonthDateRange(); 