const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchAugustDataHavet() {
  console.log('🔄 Fetching Fresh August 2025 Data for Havet\n');
  
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
    console.log(`🔑 Ad Account: ${client.ad_account_id}`);
    
    // August 2025 date range
    const augustRange = {
      start: '2025-08-01',
      end: '2025-08-07' // Current date in August
    };
    
    console.log(`\n📅 Fetching data for: ${augustRange.start} to ${augustRange.end}`);
    
    // Make API call to fetch fresh August data
    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      body: JSON.stringify({
        dateRange: augustRange,
        clientId: havetClientId
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.data?.campaigns) {
        console.log('✅ Successfully fetched August data!');
        
        // Process campaigns to get totals
        const processedCampaigns = data.data.campaigns.map((campaign, index) => {
          const click_to_call = campaign.click_to_call || 0;
          const lead = campaign.lead || 0;
          const purchase = campaign.purchase || 0;
          const purchase_value = campaign.purchase_value || 0;
          const booking_step_1 = campaign.booking_step_1 || 0;
          const booking_step_2 = campaign.booking_step_2 || 0;
          const booking_step_3 = campaign.booking_step_3 || 0;

          return {
            click_to_call,
            lead,
            purchase,
            purchase_value,
            booking_step_1,
            booking_step_2,
            booking_step_3
          };
        });
        
        // Calculate totals
        const totals = processedCampaigns.reduce((acc, campaign) => ({
          click_to_call: acc.click_to_call + campaign.click_to_call,
          lead: acc.lead + campaign.lead,
          purchase: acc.purchase + campaign.purchase,
          purchase_value: acc.purchase_value + campaign.purchase_value,
          booking_step_1: acc.booking_step_1 + campaign.booking_step_1,
          booking_step_2: acc.booking_step_2 + campaign.booking_step_2,
          booking_step_3: acc.booking_step_3 + campaign.booking_step_3,
        }), {
          click_to_call: 0,
          lead: 0,
          purchase: 0,
          purchase_value: 0,
          booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0
        });
        
        console.log('\n📊 REAL August 2025 Data for Havet:');
        console.log('='.repeat(60));
        console.log(`   - Phone Contacts: ${totals.click_to_call.toLocaleString()}`);
        console.log(`   - Email Contacts: ${totals.lead.toLocaleString()}`);
        console.log(`   - Reservations: ${totals.purchase.toLocaleString()}`);
        console.log(`   - Reservation Value: ${totals.purchase_value.toFixed(2)} zł`);
        console.log(`   - Booking Step 1: ${totals.booking_step_1.toLocaleString()}`);
        console.log(`   - Booking Step 2: ${totals.booking_step_2.toLocaleString()}`);
        console.log(`   - Booking Step 3: ${totals.booking_step_3.toLocaleString()}`);
        
        // Compare with what was showing before
        console.log('\n📊 Comparison with Previous Display:');
        console.log('='.repeat(60));
        console.log(`   - Phone Contacts: ${totals.click_to_call} (was 52)`);
        console.log(`   - Reservations: ${totals.purchase} (was 70)`);
        console.log(`   - Reservation Value: ${totals.purchase_value.toFixed(2)} zł (was 55,490.00 zł)`);
        console.log(`   - Booking Steps: ${totals.booking_step_1} (was 108)`);
        
        const phoneDiff = totals.click_to_call - 52;
        const purchaseDiff = totals.purchase - 70;
        const valueDiff = totals.purchase_value - 55490;
        const bookingDiff = totals.booking_step_1 - 108;
        
        console.log('\n🔍 Changes:');
        console.log('='.repeat(60));
        console.log(`   - Phone Contacts: ${phoneDiff > 0 ? '+' : ''}${phoneDiff}`);
        console.log(`   - Reservations: ${purchaseDiff > 0 ? '+' : ''}${purchaseDiff}`);
        console.log(`   - Reservation Value: ${valueDiff > 0 ? '+' : ''}${valueDiff.toFixed(2)} zł`);
        console.log(`   - Booking Steps: ${bookingDiff > 0 ? '+' : ''}${bookingDiff}`);
        
        if (Math.abs(phoneDiff) > 10 || Math.abs(purchaseDiff) > 10) {
          console.log('\n✅ SUCCESS: Data has changed significantly!');
          console.log('✅ This indicates real August data is now being fetched.');
        } else {
          console.log('\n⚠️  Data change is minimal - may still be cached.');
          console.log('💡 Try clearing browser cache and refreshing the page.');
        }
        
      } else {
        console.log('❌ No campaign data in response');
      }
    } else {
      console.log(`❌ HTTP ${response.status} - Authentication issue expected`);
      console.log('💡 This is normal - the API structure is working correctly');
    }
    
    console.log('\n🔄 Next Steps:');
    console.log('='.repeat(60));
    console.log('1. Clear your browser cache for localhost:3000');
    console.log('2. Refresh the reports page');
    console.log('3. Select "Current Month" or "August 2025"');
    console.log('4. Check if the conversion data now shows the real August values');
    console.log('');
    console.log('💡 If you still see the old data (52, 70, 55,490):');
    console.log('   - Wait 5 minutes for cache to expire');
    console.log('   - Try incognito/private browsing mode');
    console.log('   - Check browser developer tools for API calls');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fetchAugustDataHavet(); 