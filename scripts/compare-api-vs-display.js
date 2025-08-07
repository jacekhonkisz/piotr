const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function compareApiVsDisplay() {
  console.log('🔍 Comparing API data vs displayed data...\n');
  
  const havetClientId = '93d46876-addc-4b99-b1e1-437428dd54f1';
  
  try {
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
    console.log(`📅 Campaign Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
    
    // Calculate what 2.7% of the stored data would be (based on our previous analysis)
    const estimatedPeriodData = {
      click_to_call: Math.round(campaign.click_to_call * 0.027),
      lead: Math.round(campaign.lead * 0.027),
      purchase: Math.round(campaign.purchase * 0.027),
      purchase_value: campaign.purchase_value * 0.027,
      booking_step_1: Math.round(campaign.booking_step_1 * 0.027),
      booking_step_2: Math.round(campaign.booking_step_2 * 0.027),
      booking_step_3: Math.round(campaign.booking_step_3 * 0.027),
    };
    
    console.log('\n📊 Estimated Period Data (2.7% of total):');
    console.log('='.repeat(50));
    console.log(`   - Phone Contacts: ${estimatedPeriodData.click_to_call.toLocaleString()}`);
    console.log(`   - Email Contacts: ${estimatedPeriodData.lead.toLocaleString()}`);
    console.log(`   - Reservations: ${estimatedPeriodData.purchase.toLocaleString()}`);
    console.log(`   - Reservation Value: ${estimatedPeriodData.purchase_value.toFixed(2)} zł`);
    console.log(`   - Booking Steps: ${estimatedPeriodData.booking_step_1.toLocaleString()}`);
    console.log(`   - Stage 2: ${estimatedPeriodData.booking_step_2.toLocaleString()}`);
    
    console.log('\n📊 Displayed Values (From Reports Page):');
    console.log('='.repeat(50));
    console.log('   - Phone Contacts: 51');
    console.log('   - Email Contacts: 0');
    console.log('   - Reservations: 70');
    console.log('   - Reservation Value: 55,490.00 zł');
    console.log('   - Booking Steps: 108');
    console.log('   - Stage 2: 0');
    
    console.log('\n🔍 Comparison:');
    console.log('='.repeat(50));
    
    const phoneDiff = Math.abs(estimatedPeriodData.click_to_call - 51);
    const emailDiff = Math.abs(estimatedPeriodData.lead - 0);
    const purchaseDiff = Math.abs(estimatedPeriodData.purchase - 70);
    const valueDiff = Math.abs(estimatedPeriodData.purchase_value - 55490);
    const bookingDiff = Math.abs(estimatedPeriodData.booking_step_1 - 108);
    const stage2Diff = Math.abs(estimatedPeriodData.booking_step_2 - 0);
    
    console.log(`   - Phone Contacts: ${phoneDiff === 0 ? '✅ Match' : `❌ Diff: ${phoneDiff}`}`);
    console.log(`   - Email Contacts: ${emailDiff === 0 ? '✅ Match' : `❌ Diff: ${emailDiff}`}`);
    console.log(`   - Reservations: ${purchaseDiff === 0 ? '✅ Match' : `❌ Diff: ${purchaseDiff}`}`);
    console.log(`   - Reservation Value: ${valueDiff < 1 ? '✅ Match' : `❌ Diff: ${valueDiff.toFixed(2)} zł`}`);
    console.log(`   - Booking Steps: ${bookingDiff === 0 ? '✅ Match' : `❌ Diff: ${bookingDiff}`}`);
    console.log(`   - Stage 2: ${stage2Diff === 0 ? '✅ Match' : `❌ Diff: ${stage2Diff}`}`);
    
    console.log('\n🎯 Assessment:');
    console.log('='.repeat(50));
    
    if (phoneDiff < 5 && purchaseDiff < 5 && valueDiff < 1000) {
      console.log('✅ CLOSE MATCH: The displayed data closely matches our estimate');
      console.log('✅ This confirms the reports page is correctly filtering by date range');
    } else {
      console.log('⚠️  DIFFERENCES: There are notable differences');
      console.log('💡 This could indicate:');
      console.log('   - Different date range than estimated');
      console.log('   - Real-time data vs stored data');
      console.log('   - Data processing variations');
    }
    
    // Try to determine the actual date range being used
    console.log('\n📅 Date Range Analysis:');
    console.log('='.repeat(50));
    
    const totalDays = Math.ceil((new Date(campaign.date_range_end) - new Date(campaign.date_range_start)) / (1000 * 60 * 60 * 24));
    const estimatedPeriodDays = Math.ceil(totalDays * 0.027);
    
    console.log(`   - Total campaign period: ${totalDays} days`);
    console.log(`   - Estimated current period: ~${estimatedPeriodDays} days`);
    console.log(`   - This suggests the reports page is showing data for a recent ${estimatedPeriodDays}-day period`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

compareApiVsDisplay(); 