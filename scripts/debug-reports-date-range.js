const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugReportsDateRange() {
  console.log('🔍 Debugging reports page date range...\n');
  
  const havetClientId = '93d46876-addc-4b99-b1e1-437428dd54f1';
  
  try {
    // Get campaign data
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClientId);

    if (error || !campaigns || campaigns.length === 0) {
      console.error('❌ Error or no campaigns found');
      return;
    }

    const campaign = campaigns[0];
    
    console.log('📊 Campaign Data:');
    console.log('='.repeat(40));
    console.log(`   - Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
    console.log(`   - Total Phone Contacts: ${campaign.click_to_call.toLocaleString()}`);
    console.log(`   - Total Reservations: ${campaign.purchase.toLocaleString()}`);
    console.log(`   - Total Value: ${campaign.purchase_value.toLocaleString()} zł`);
    
    // Calculate different possible date ranges
    const totalDays = Math.ceil((new Date(campaign.date_range_end) - new Date(campaign.date_range_start)) / (1000 * 60 * 60 * 24));
    
    console.log('\n📅 Possible Date Ranges:');
    console.log('='.repeat(40));
    
    // Try different percentages to find what matches the displayed data
    const percentages = [0.01, 0.02, 0.025, 0.027, 0.03, 0.04, 0.05, 0.1];
    
    console.log('Percentage | Days | Phone | Reservations | Value');
    console.log('-----------|------|-------|-------------|-------');
    
    percentages.forEach(percent => {
      const days = Math.ceil(totalDays * percent);
      const phone = Math.round(campaign.click_to_call * percent);
      const reservations = Math.round(campaign.purchase * percent);
      const value = campaign.purchase_value * percent;
      
      console.log(`${(percent * 100).toFixed(1)}%      | ${days.toString().padStart(4)} | ${phone.toString().padStart(5)} | ${reservations.toString().padStart(11)} | ${value.toFixed(0).padStart(8)} zł`);
    });
    
    console.log('\n🎯 Target Values (From Reports Page):');
    console.log('='.repeat(40));
    console.log('   - Phone Contacts: 51');
    console.log('   - Reservations: 70');
    console.log('   - Value: 55,490 zł');
    
    console.log('\n🔍 Finding Best Match:');
    console.log('='.repeat(40));
    
    let bestMatch = null;
    let bestScore = Infinity;
    
    percentages.forEach(percent => {
      const phone = Math.round(campaign.click_to_call * percent);
      const reservations = Math.round(campaign.purchase * percent);
      const value = campaign.purchase_value * percent;
      
      const phoneDiff = Math.abs(phone - 51);
      const reservationDiff = Math.abs(reservations - 70);
      const valueDiff = Math.abs(value - 55490);
      
      const totalDiff = phoneDiff + reservationDiff + (valueDiff / 1000); // Weight value difference less
      
      if (totalDiff < bestScore) {
        bestScore = totalDiff;
        bestMatch = {
          percent,
          days: Math.ceil(totalDays * percent),
          phone,
          reservations,
          value: Math.round(value),
          totalDiff
        };
      }
    });
    
    if (bestMatch) {
      console.log(`✅ Best Match: ${(bestMatch.percent * 100).toFixed(1)}% of total data`);
      console.log(`   - Period: ~${bestMatch.days} days`);
      console.log(`   - Phone Contacts: ${bestMatch.phone} (target: 51, diff: ${Math.abs(bestMatch.phone - 51)})`);
      console.log(`   - Reservations: ${bestMatch.reservations} (target: 70, diff: ${Math.abs(bestMatch.reservations - 70)})`);
      console.log(`   - Value: ${bestMatch.value.toLocaleString()} zł (target: 55,490, diff: ${Math.abs(bestMatch.value - 55490)})`);
      
      console.log('\n💡 Interpretation:');
      console.log('='.repeat(40));
      
      if (bestMatch.days <= 7) {
        console.log('📅 This appears to be a WEEKLY report (current week)');
      } else if (bestMatch.days <= 31) {
        console.log('📅 This appears to be a MONTHLY report (current month)');
      } else if (bestMatch.days <= 90) {
        console.log('📅 This appears to be a QUARTERLY report');
      } else {
        console.log('📅 This appears to be a custom date range');
      }
      
      console.log(`📊 The reports page is showing approximately ${(bestMatch.percent * 100).toFixed(1)}% of the total campaign data`);
      console.log(`📊 This represents roughly ${bestMatch.days} days of activity`);
      
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugReportsDateRange(); 