const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugDashboardRealTime() {
  console.log('🔍 Real-Time Dashboard Debug\n');
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
    
    // Step 1: Check what's in the database
    console.log('\n1️⃣ Checking database campaigns...');
    const { data: dbCampaigns, error: dbError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClientId)
      .order('date_range_start', { ascending: false })
      .limit(5);

    if (dbError) {
      console.log(`❌ Database error: ${dbError.message}`);
    } else {
      console.log(`📊 Database campaigns found: ${dbCampaigns?.length || 0}`);
      if (dbCampaigns && dbCampaigns.length > 0) {
        console.log('📅 Most recent campaign date range:', {
          start: dbCampaigns[0].date_range_start,
          end: dbCampaigns[0].date_range_end
        });
        
        // Calculate totals from database
        const dbTotals = dbCampaigns.reduce((acc, campaign) => ({
          click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
          lead: acc.lead + (campaign.lead || 0),
          purchase: acc.purchase + (campaign.purchase || 0),
          purchase_value: acc.purchase_value + (campaign.purchase_value || 0),
          booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
          booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
          booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
          spend: acc.spend + (campaign.spend || 0)
        }), {
          click_to_call: 0,
          lead: 0,
          purchase: 0,
          purchase_value: 0,
          booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0,
          spend: 0
        });
        
        const dbRoas = dbTotals.purchase_value > 0 && dbTotals.spend > 0 ? dbTotals.purchase_value / dbTotals.spend : 0;
        const dbCostPerReservation = dbTotals.purchase > 0 && dbTotals.spend > 0 ? dbTotals.spend / dbTotals.purchase : 0;
        
        console.log('\n📊 DATABASE TOTALS:');
        console.log('='.repeat(40));
        console.log(`📞 Phone Contacts: ${dbTotals.click_to_call}`);
        console.log(`📧 Email Contacts: ${dbTotals.lead}`);
        console.log(`📋 Reservation Steps: ${dbTotals.booking_step_1}`);
        console.log(`🛒 Reservations: ${dbTotals.purchase}`);
        console.log(`💰 Reservation Value: ${dbTotals.purchase_value.toFixed(2)} zł`);
        console.log(`📈 ROAS: ${dbRoas.toFixed(2)}x`);
        console.log(`💵 Cost per Reservation: ${dbCostPerReservation.toFixed(2)} zł`);
      }
    }
    
    // Step 2: Test the API directly
    console.log('\n2️⃣ Testing API directly...');
    
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const dateRange = {
      start: startOfMonth.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
    
    console.log(`📅 API Date Range: ${dateRange.start} to ${dateRange.end}`);
    
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
      console.log(`📊 API Campaigns Found: ${campaignsData.data?.length || 0}`);
      
      if (campaignsData.data && campaignsData.data.length > 0) {
        // Calculate conversion metrics from API
        const apiTotals = campaignsData.data.reduce((acc, campaign) => {
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
        const apiRoas = apiTotals.purchase_value > 0 && totalSpend > 0 ? apiTotals.purchase_value / totalSpend : 0;
        const apiCostPerReservation = apiTotals.purchase > 0 && totalSpend > 0 ? totalSpend / apiTotals.purchase : 0;
        
        console.log('\n📊 API TOTALS:');
        console.log('='.repeat(40));
        console.log(`📞 Phone Contacts: ${apiTotals.click_to_call}`);
        console.log(`📧 Email Contacts: ${apiTotals.lead}`);
        console.log(`📋 Reservation Steps: ${apiTotals.booking_step_1}`);
        console.log(`🛒 Reservations: ${apiTotals.purchase}`);
        console.log(`💰 Reservation Value: ${apiTotals.purchase_value.toFixed(2)} zł`);
        console.log(`📈 ROAS: ${apiRoas.toFixed(2)}x`);
        console.log(`💵 Cost per Reservation: ${apiCostPerReservation.toFixed(2)} zł`);
        
        // Step 3: Compare with what dashboard should show
        console.log('\n3️⃣ DASHBOARD SHOULD SHOW:');
        console.log('='.repeat(40));
        console.log(`📞 Phone Contacts: ${apiTotals.click_to_call} (not 0)`);
        console.log(`📧 Email Contacts: ${apiTotals.lead} (not 0)`);
        console.log(`📋 Reservation Steps: ${apiTotals.booking_step_1} (not 228)`);
        console.log(`🛒 Reservations: ${apiTotals.purchase} (not 245)`);
        console.log(`💰 Reservation Value: ${apiTotals.purchase_value.toFixed(2)} zł (not 135,894 zł)`);
        console.log(`📈 ROAS: ${apiRoas.toFixed(2)}x (not 38.38x)`);
        console.log(`💵 Cost per Reservation: ${apiCostPerReservation.toFixed(2)} zł (not 14.45 zł)`);
        
        // Step 4: Check if there's a mismatch
        if (dbTotals && dbTotals.click_to_call !== apiTotals.click_to_call) {
          console.log('\n⚠️ MISMATCH DETECTED:');
          console.log('='.repeat(40));
          console.log('Database and API data are different!');
          console.log('This suggests the dashboard might be using cached database data instead of fresh API data.');
        }
        
      } else {
        console.log('❌ No campaign data found in API');
      }
    } catch (error) {
      console.log(`❌ API Error: ${error.message}`);
    }
    
    // Step 5: Instructions
    console.log('\n4️⃣ NEXT STEPS:');
    console.log('='.repeat(40));
    console.log('1. Check if the dashboard is using cached database data');
    console.log('2. Verify the processVisualizationData function is being called');
    console.log('3. Check browser console for any errors');
    console.log('4. Clear all browser cache and localStorage');
    console.log('5. Restart the development server');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugDashboardRealTime(); 