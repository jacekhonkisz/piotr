const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDashboardFixVerification() {
  console.log('🔍 Dashboard Fix Verification\n');
  console.log('='.repeat(60));

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
    
    // Test the API directly to get current August 2025 data
    console.log('\n1️⃣ Testing API for August 2025 data...');
    
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const dateRange = {
      start: startOfMonth.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
    
    console.log(`📅 Date Range: ${dateRange.start} to ${dateRange.end}`);
    
    // Make direct API call
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    const accountIdWithPrefix = `act_${adAccountId}`;
    
    const campaignsUrl = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}&level=campaign&access_token=${token}`;
    
    try {
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();
      
      console.log(`📊 API Response: ${campaignsResponse.status}`);
      console.log(`📊 Campaigns Found: ${campaignsData.data?.length || 0}`);
      
      if (campaignsData.data && campaignsData.data.length > 0) {
        // Calculate conversion metrics (same as dashboard)
        const conversionTotals = campaignsData.data.reduce((acc, campaign) => {
          let click_to_call = 0;
          let lead = 0;
          let purchase = 0;
          let purchase_value = 0;
          let booking_step_1 = 0;
          let booking_step_2 = 0;
          let booking_step_3 = 0;
          
          if (campaign.actions && Array.isArray(campaign.actions)) {
            campaign.actions.forEach((action) => {
              const actionType = action.action_type;
              const value = parseInt(action.value || '0');
              
              if (actionType.includes('click_to_call')) {
                click_to_call += value;
              }
              if (actionType.includes('lead')) {
                lead += value;
              }
              if (actionType === 'purchase' || actionType.includes('purchase')) {
                purchase += value;
              }
              if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
                booking_step_1 += value;
              }
              if (actionType.includes('booking_step_2') || actionType.includes('add_to_cart')) {
                booking_step_2 += value;
              }
              if (actionType.includes('booking_step_3') || actionType.includes('purchase')) {
                booking_step_3 += value;
              }
            });
          }
          
          if (campaign.action_values && Array.isArray(campaign.action_values)) {
            campaign.action_values.forEach((actionValue) => {
              if (actionValue.action_type === 'purchase') {
                purchase_value = parseFloat(actionValue.value || '0');
              }
            });
          }
          
          return {
            click_to_call: acc.click_to_call + click_to_call,
            lead: acc.lead + lead,
            purchase: acc.purchase + purchase,
            purchase_value: acc.purchase_value + purchase_value,
            booking_step_1: acc.booking_step_1 + booking_step_1,
            booking_step_2: acc.booking_step_2 + booking_step_2,
            booking_step_3: acc.booking_step_3 + booking_step_3,
          };
        }, {
          click_to_call: 0,
          lead: 0,
          purchase: 0,
          purchase_value: 0,
          booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0
        });
        
        const totalSpend = campaignsData.data.reduce((sum, campaign) => sum + parseFloat(campaign.spend || '0'), 0);
        const roas = conversionTotals.purchase_value > 0 && totalSpend > 0 ? conversionTotals.purchase_value / totalSpend : 0;
        const cost_per_reservation = conversionTotals.purchase > 0 && totalSpend > 0 ? totalSpend / conversionTotals.purchase : 0;
        
        console.log('\n📊 EXPECTED DASHBOARD VALUES:');
        console.log('='.repeat(50));
        console.log(`📞 Phone Contacts: ${conversionTotals.click_to_call}`);
        console.log(`📧 Email Contacts: ${conversionTotals.lead}`);
        console.log(`📋 Reservation Steps: ${conversionTotals.booking_step_1}`);
        console.log(`🛒 Reservations: ${conversionTotals.purchase}`);
        console.log(`💰 Reservation Value: ${conversionTotals.purchase_value.toFixed(2)} zł`);
        console.log(`📈 ROAS: ${roas.toFixed(2)}x`);
        console.log(`💵 Cost per Reservation: ${cost_per_reservation.toFixed(2)} zł`);
        console.log(`📋 Booking Step 2: ${conversionTotals.booking_step_2}`);
        
        // Step 2: Check what the dashboard should be showing
        console.log('\n2️⃣ Dashboard Fix Summary:');
        console.log('='.repeat(50));
        console.log('✅ Fixed processVisualizationData to use stats data');
        console.log('✅ Removed hardcoded default values from conversionData state');
        console.log('✅ Added proper conversion metrics calculation in loadMainDashboardData');
        console.log('✅ Added cache invalidation for current month');
        console.log('✅ Added data validation for date range');
        
        // Step 3: Instructions for user
        console.log('\n3️⃣ Next Steps:');
        console.log('='.repeat(50));
        console.log('1. Clear browser cache completely (Cmd+Shift+Delete)');
        console.log('2. Open dashboard in incognito window');
        console.log('3. Refresh the page');
        console.log('4. Check browser console for "🎯 Updated conversion data from stats" message');
        console.log('5. Verify the dashboard shows the expected values above');
        
        console.log('\n🎯 The dashboard should now show:');
        console.log(`   Phone Contacts: ${conversionTotals.click_to_call} (not 0)`);
        console.log(`   Reservation Steps: ${conversionTotals.booking_step_1} (not 228)`);
        console.log(`   Reservations: ${conversionTotals.purchase} (not 245)`);
        console.log(`   Reservation Value: ${conversionTotals.purchase_value.toFixed(2)} zł (not 135,894 zł)`);
        console.log(`   ROAS: ${roas.toFixed(2)}x (not 38.39x)`);
        console.log(`   Cost per Reservation: ${cost_per_reservation.toFixed(2)} zł (not 14.45 zł)`);
        
      } else {
        console.log('❌ No campaign data found');
      }
    } catch (error) {
      console.log(`❌ API Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDashboardFixVerification(); 