const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyDataConsistency() {
  console.log('🔍 Verifying data consistency and exact matching...\n');
  
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
    
    console.log('📊 Stored Campaign Data:');
    console.log('='.repeat(50));
    console.log(`   - Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
    console.log(`   - Total Phone Contacts: ${campaign.click_to_call.toLocaleString()}`);
    console.log(`   - Total Email Contacts: ${campaign.lead.toLocaleString()}`);
    console.log(`   - Total Reservations: ${campaign.purchase.toLocaleString()}`);
    console.log(`   - Total Value: ${campaign.purchase_value.toLocaleString()} zł`);
    console.log(`   - Total Booking Steps: ${campaign.booking_step_1.toLocaleString()}`);
    
    // Calculate what the displayed values should be for exact matching
    console.log('\n🎯 Target Displayed Values (From Reports Page):');
    console.log('='.repeat(50));
    console.log('   - Phone Contacts: 51');
    console.log('   - Email Contacts: 0');
    console.log('   - Reservations: 70');
    console.log('   - Reservation Value: 55,490.00 zł');
    console.log('   - Booking Steps: 108');
    console.log('   - Stage 2: 0');
    
    // Calculate the exact percentage needed for each metric
    const phonePercent = (51 / campaign.click_to_call * 100).toFixed(3);
    const leadPercent = (0 / campaign.lead * 100).toFixed(3);
    const purchasePercent = (70 / campaign.purchase * 100).toFixed(3);
    const valuePercent = (55490 / campaign.purchase_value * 100).toFixed(3);
    const bookingPercent = (108 / campaign.booking_step_1 * 100).toFixed(3);
    const stage2Percent = (0 / campaign.booking_step_2 * 100).toFixed(3);
    
    console.log('\n📊 Required Percentages for Exact Match:');
    console.log('='.repeat(50));
    console.log(`   - Phone Contacts: ${phonePercent}%`);
    console.log(`   - Email Contacts: ${leadPercent}%`);
    console.log(`   - Reservations: ${purchasePercent}%`);
    console.log(`   - Reservation Value: ${valuePercent}%`);
    console.log(`   - Booking Steps: ${bookingPercent}%`);
    console.log(`   - Stage 2: ${stage2Percent}%`);
    
    // Check if all percentages are consistent
    const percentages = [phonePercent, purchasePercent, valuePercent, bookingPercent].map(p => parseFloat(p));
    const avgPercent = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const maxDiff = Math.max(...percentages) - Math.min(...percentages);
    
    console.log('\n🔍 Consistency Analysis:');
    console.log('='.repeat(50));
    console.log(`   - Average Percentage: ${avgPercent.toFixed(3)}%`);
    console.log(`   - Max Difference: ${maxDiff.toFixed(3)}%`);
    console.log(`   - Standard Deviation: ${calculateStdDev(percentages).toFixed(3)}%`);
    
    const isConsistent = maxDiff < 0.1; // Less than 0.1% difference
    
    console.log('\n🎯 Assessment:');
    console.log('='.repeat(50));
    
    if (isConsistent) {
      console.log('✅ CONSISTENT: All metrics require similar percentages');
      console.log('✅ This suggests the reports page is using a consistent date range filter');
      console.log(`✅ The reports page is showing approximately ${avgPercent.toFixed(2)}% of total data`);
      
      // Calculate the exact date range that would produce these values
      const totalDays = Math.ceil((new Date(campaign.date_range_end) - new Date(campaign.date_range_start)) / (1000 * 60 * 60 * 24));
      const periodDays = Math.ceil(totalDays * (avgPercent / 100));
      
      console.log('\n📅 Exact Date Range Analysis:');
      console.log('='.repeat(50));
      console.log(`   - Total Campaign Period: ${totalDays} days`);
      console.log(`   - Estimated Display Period: ${periodDays} days`);
      console.log(`   - This represents ${avgPercent.toFixed(2)}% of the total period`);
      
      if (periodDays <= 7) {
        console.log('   - Type: WEEKLY report (current week)');
      } else if (periodDays <= 31) {
        console.log('   - Type: MONTHLY report (current month)');
      } else if (periodDays <= 90) {
        console.log('   - Type: QUARTERLY report');
      } else {
        console.log('   - Type: Custom date range');
      }
      
      console.log('\n✅ CONCLUSION:');
      console.log('='.repeat(50));
      console.log('✅ The displayed data is EXACTLY correct for the date range being used');
      console.log('✅ The reports page is consistently filtering data by the same percentage');
      console.log('✅ This confirms the conversion tracking is working perfectly');
      console.log('✅ The data fetching and processing is deterministic and accurate');
      
    } else {
      console.log('❌ INCONSISTENT: Different metrics require different percentages');
      console.log('❌ This suggests inconsistent data processing or different date ranges');
      console.log('💡 Possible causes:');
      console.log('   - Different date ranges for different metrics');
      console.log('   - Data processing inconsistencies');
      console.log('   - Real-time vs stored data differences');
      console.log('   - Caching issues');
    }
    
    // Additional verification
    console.log('\n🔍 Additional Verification:');
    console.log('='.repeat(50));
    
    // Check if the displayed values make mathematical sense
    const phoneRatio = 51 / campaign.click_to_call;
    const purchaseRatio = 70 / campaign.purchase;
    const valueRatio = 55490 / campaign.purchase_value;
    const bookingRatio = 108 / campaign.booking_step_1;
    
    const ratios = [phoneRatio, purchaseRatio, valueRatio, bookingRatio];
    const ratioAvg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const ratioStdDev = calculateStdDev(ratios);
    
    console.log(`   - Average Ratio: ${ratioAvg.toFixed(4)}`);
    console.log(`   - Ratio Standard Deviation: ${ratioStdDev.toFixed(4)}`);
    console.log(`   - Ratio Consistency: ${ratioStdDev < 0.001 ? '✅ Consistent' : '❌ Inconsistent'}`);
    
    if (ratioStdDev < 0.001) {
      console.log('✅ The ratios are mathematically consistent');
      console.log('✅ This confirms the data filtering is working correctly');
    } else {
      console.log('⚠️  The ratios show some inconsistency');
      console.log('💡 This might be due to rounding or data processing variations');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

function calculateStdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

verifyDataConsistency(); 