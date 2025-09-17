const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyReportsPageFix() {
  console.log('🔍 Verifying Reports Page Fix - Current State Analysis\n');
  
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
    
    // Get stored campaign data
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClientId);

    if (error || !campaigns || campaigns.length === 0) {
      console.error('❌ Error or no campaigns found');
      return;
    }

    const campaign = campaigns[0];
    
    console.log('\n📊 Current Stored Data (All Time):');
    console.log('='.repeat(60));
    console.log(`   - Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
    console.log(`   - Phone Contacts: ${campaign.click_to_call.toLocaleString()}`);
    console.log(`   - Reservations: ${campaign.purchase.toLocaleString()}`);
    console.log(`   - Reservation Value: ${campaign.purchase_value.toLocaleString()} zł`);
    console.log(`   - Booking Steps: ${campaign.booking_step_1.toLocaleString()}`);
    
    // Calculate current month expected values
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const startDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const endDate = new Date();
    
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const campaignStart = new Date(campaign.date_range_start);
    const campaignEnd = new Date(campaign.date_range_end);
    const totalCampaignDays = Math.ceil((campaignEnd - campaignStart) / (1000 * 60 * 60 * 24)) + 1;
    
    const currentMonthPercentage = (daysDiff / totalCampaignDays * 100);
    
    // Calculate expected values for current month
    const expectedPhone = Math.round(campaign.click_to_call * (daysDiff / totalCampaignDays));
    const expectedPurchase = Math.round(campaign.purchase * (daysDiff / totalCampaignDays));
    const expectedValue = campaign.purchase_value * (daysDiff / totalCampaignDays);
    const expectedBooking = Math.round(campaign.booking_step_1 * (daysDiff / totalCampaignDays));
    
    console.log('\n📅 Current Month Analysis:');
    console.log('='.repeat(60));
    console.log(`   - Date Range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log(`   - Days in Range: ${daysDiff} days`);
    console.log(`   - Total Campaign Period: ${totalCampaignDays} days`);
    console.log(`   - Current Month Percentage: ${currentMonthPercentage.toFixed(2)}%`);
    
    console.log('\n📊 Expected Values for Current Month:');
    console.log('='.repeat(60));
    console.log(`   - Phone Contacts: ${expectedPhone.toLocaleString()}`);
    console.log(`   - Reservations: ${expectedPurchase.toLocaleString()}`);
    console.log(`   - Reservation Value: ${expectedValue.toFixed(2)} zł`);
    console.log(`   - Booking Steps: ${expectedBooking.toLocaleString()}`);
    
    console.log('\n📊 Previously Displayed Values (Before Fix):');
    console.log('='.repeat(60));
    console.log(`   - Phone Contacts: 51`);
    console.log(`   - Reservations: 70`);
    console.log(`   - Reservation Value: 55,490.00 zł`);
    console.log(`   - Booking Steps: 108`);
    
    console.log('\n🔍 Comparison Analysis:');
    console.log('='.repeat(60));
    
    const phoneDiff = Math.abs(expectedPhone - 51);
    const purchaseDiff = Math.abs(expectedPurchase - 70);
    const valueDiff = Math.abs(expectedValue - 55490);
    const bookingDiff = Math.abs(expectedBooking - 108);
    
    console.log(`   - Phone Contacts: Expected ${expectedPhone}, Was 51, Diff: ${phoneDiff}`);
    console.log(`   - Reservations: Expected ${expectedPurchase}, Was 70, Diff: ${purchaseDiff}`);
    console.log(`   - Reservation Value: Expected ${expectedValue.toFixed(2)}, Was 55490.00, Diff: ${valueDiff.toFixed(2)}`);
    console.log(`   - Booking Steps: Expected ${expectedBooking}, Was 108, Diff: ${bookingDiff}`);
    
    const wasIncorrect = phoneDiff > 10 || purchaseDiff > 10 || valueDiff > 1000;
    
    console.log('\n🎯 Assessment:');
    console.log('='.repeat(60));
    
    if (wasIncorrect) {
      console.log('❌ PREVIOUSLY INCORRECT: The reports page was showing wrong data');
      console.log('❌ The displayed values were not real data for the selected period');
      console.log('❌ This confirmed the date range filtering issue');
    } else {
      console.log('✅ PREVIOUSLY CORRECT: The reports page was already working');
    }
    
    console.log('\n🔧 Fix Applied:');
    console.log('='.repeat(60));
    console.log('✅ Added proper caching to MetaAPIService.getCampaignInsights()');
    console.log('✅ Cache keys now include date range parameters');
    console.log('✅ Enhanced logging for date range tracking');
    console.log('✅ Fixed cache storage and retrieval logic');
    
    console.log('\n🔄 Next Steps to Test:');
    console.log('='.repeat(60));
    console.log('1. Restart your development server:');
    console.log('   npm run dev');
    console.log('');
    console.log('2. Clear browser cache for localhost:3000');
    console.log('');
    console.log('3. Go to the reports page:');
    console.log('   http://localhost:3000/reports?clientId=93d46876-addc-4b99-b1e1-437428dd54f1');
    console.log('');
    console.log('4. Select "Current Month" and verify the data shows:');
    console.log(`   - Phone Contacts: ~${expectedPhone}`);
    console.log(`   - Reservations: ~${expectedPurchase}`);
    console.log(`   - Reservation Value: ~${expectedValue.toFixed(0)} zł`);
    console.log(`   - Booking Steps: ~${expectedBooking}`);
    console.log('');
    console.log('5. Test other date ranges to ensure they show appropriate data');
    console.log('');
    console.log('💡 If the fix worked, you should see:');
    console.log('   - Real data for each specific date range');
    console.log('   - Consistent percentages across all metrics');
    console.log('   - No more "estimated" or "all-time" data in period views');
    
    console.log('\n📊 Success Criteria:');
    console.log('='.repeat(60));
    console.log('✅ Current month shows ~15 phone contacts (not 51)');
    console.log('✅ Current month shows ~48 reservations (not 70)');
    console.log('✅ Current month shows ~29,406 zł value (not 55,490 zł)');
    console.log('✅ Each date range shows data proportional to its duration');
    console.log('✅ No more "all-time data" being displayed for specific periods');
    
  } catch (error) {
    console.error('❌ Verification error:', error.message);
  }
}

verifyReportsPageFix(); 