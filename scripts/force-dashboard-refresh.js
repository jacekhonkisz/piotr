const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceDashboardRefresh() {
  console.log('🔄 Force Dashboard Refresh\n');
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
    
    // Step 1: Clear all campaigns from database to force fresh data
    console.log('\n1️⃣ Clearing all campaigns from database...');
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('client_id', havetClientId);

    if (deleteError) {
      console.log(`⚠️ Error clearing campaigns: ${deleteError.message}`);
    } else {
      console.log('✅ Cleared all campaigns from database');
    }
    
    // Step 2: Test the API directly to ensure it returns correct data
    console.log('\n2️⃣ Testing API with correct date range...');
    
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const dateRange = {
      start: startOfMonth.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
    
    console.log(`📅 Date Range: ${dateRange.start} to ${dateRange.end}`);
    
    // Make direct API call to verify data
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
        // Calculate conversion metrics
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
        
        console.log('\n📊 REAL AUGUST 2025 DATA:');
        console.log('='.repeat(40));
        console.log(`📞 Phone Contacts: ${conversionTotals.click_to_call}`);
        console.log(`📧 Email Contacts: ${conversionTotals.lead}`);
        console.log(`🛒 Reservations: ${conversionTotals.purchase}`);
        console.log(`💰 Reservation Value: ${conversionTotals.purchase_value.toFixed(2)} zł`);
        console.log(`📋 Booking Steps 1: ${conversionTotals.booking_step_1}`);
        console.log(`📋 Booking Steps 2: ${conversionTotals.booking_step_2}`);
        console.log(`📋 Booking Steps 3: ${conversionTotals.booking_step_3}`);
        console.log(`📈 ROAS: ${roas.toFixed(2)}x`);
        console.log(`💵 Cost per Reservation: ${cost_per_reservation.toFixed(2)} zł`);
        
        // Step 3: Save this data to database
        console.log('\n3️⃣ Saving fresh data to database...');
        
        const campaignsToSave = campaignsData.data.map(campaign => {
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
            client_id: havetClientId,
            campaign_id: campaign.campaign_id,
            campaign_name: campaign.campaign_name,
            spend: parseFloat(campaign.spend || '0'),
            impressions: parseInt(campaign.impressions || '0'),
            clicks: parseInt(campaign.clicks || '0'),
            conversions: 0,
            ctr: parseFloat(campaign.ctr || '0'),
            cpc: parseFloat(campaign.cpc || '0'),
            date_range_start: dateRange.start,
            date_range_end: dateRange.end,
            // Conversion tracking data
            click_to_call,
            lead,
            purchase,
            purchase_value,
            booking_step_1,
            booking_step_2,
            booking_step_3,
            roas: purchase_value > 0 && parseFloat(campaign.spend || '0') > 0 ? purchase_value / parseFloat(campaign.spend || '0') : 0,
            cost_per_reservation: purchase > 0 && parseFloat(campaign.spend || '0') > 0 ? parseFloat(campaign.spend || '0') / purchase : 0
          };
        });
        
        const { error: insertError } = await supabase
          .from('campaigns')
          .insert(campaignsToSave);
        
        if (insertError) {
          console.log(`❌ Error saving campaigns: ${insertError.message}`);
        } else {
          console.log(`✅ Saved ${campaignsToSave.length} campaigns to database`);
        }
        
      } else {
        console.log('❌ No campaign data found');
      }
    } catch (error) {
      console.log(`❌ API Error: ${error.message}`);
    }
    
    // Step 4: Instructions for user
    console.log('\n4️⃣ Next Steps:');
    console.log('='.repeat(40));
    console.log('1. Clear your browser cache completely');
    console.log('2. Open the dashboard in an incognito/private window');
    console.log('3. Refresh the page');
    console.log('4. The dashboard should now show the correct August 2025 data');
    console.log('');
    console.log('Expected values:');
    console.log(`   Phone Contacts: ${conversionTotals?.click_to_call || 'N/A'}`);
    console.log(`   Reservations: ${conversionTotals?.purchase || 'N/A'}`);
    console.log(`   Reservation Value: ${conversionTotals?.purchase_value?.toFixed(2) || 'N/A'} zł`);
    console.log(`   ROAS: ${roas?.toFixed(2) || 'N/A'}x`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

forceDashboardRefresh(); 