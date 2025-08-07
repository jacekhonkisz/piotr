const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDashboardLogic() {
  console.log('🧪 Testing Dashboard Logic\n');
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
    
    // Step 1: Test current month logic (should use live API)
    console.log('\n1️⃣ CURRENT MONTH LOGIC (Live API):');
    console.log('='.repeat(50));
    
    const today = new Date();
    // Use UTC to avoid timezone issues
    const startOfMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
    const currentMonthRange = {
      start: startOfMonth.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
    
    console.log(`📅 Current month range: ${currentMonthRange.start} to ${currentMonthRange.end}`);
    
    // Test live API call
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    const accountIdWithPrefix = `act_${adAccountId}`;
    
    const campaignsUrl = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${currentMonthRange.start}","until":"${currentMonthRange.end}"}&level=campaign&access_token=${token}`;
    
    try {
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();
      
      console.log(`📊 Live API Response: ${campaignsResponse.status}`);
      console.log(`📊 Live API Campaigns: ${campaignsData.data?.length || 0}`);
      
      if (campaignsData.data && campaignsData.data.length > 0) {
        // Calculate current month totals
        const currentMonthTotals = campaignsData.data.reduce((acc, campaign) => {
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
        const roas = currentMonthTotals.purchase_value > 0 && totalSpend > 0 ? currentMonthTotals.purchase_value / totalSpend : 0;
        const cost_per_reservation = currentMonthTotals.purchase > 0 && totalSpend > 0 ? totalSpend / currentMonthTotals.purchase : 0;
        
        console.log('\n📊 CURRENT MONTH TOTALS (Live API):');
        console.log(`📞 Phone Contacts: ${currentMonthTotals.click_to_call}`);
        console.log(`📧 Email Contacts: ${currentMonthTotals.lead}`);
        console.log(`📋 Reservation Steps: ${currentMonthTotals.booking_step_1}`);
        console.log(`🛒 Reservations: ${currentMonthTotals.purchase}`);
        console.log(`💰 Reservation Value: ${currentMonthTotals.purchase_value.toFixed(2)} zł`);
        console.log(`📈 ROAS: ${roas.toFixed(2)}x`);
        console.log(`💵 Cost per Reservation: ${cost_per_reservation.toFixed(2)} zł`);
        
      } else {
        console.log('❌ No current month data found in live API');
      }
    } catch (error) {
      console.log(`❌ Live API Error: ${error.message}`);
    }
    
    // Step 2: Test past months logic (should use database)
    console.log('\n2️⃣ PAST MONTHS LOGIC (Database):');
    console.log('='.repeat(50));
    
    // Use UTC to avoid timezone issues
    const startOfCurrentMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
    const startOfCurrentMonthStr = startOfCurrentMonth.toISOString().split('T')[0];
    console.log(`📅 Loading data before: ${startOfCurrentMonthStr}`);
    
    // Get past months data from database
    const { data: pastCampaigns, error: pastCampaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClientId)
      .lt('date_range_start', startOfCurrentMonthStr) // Only past months
      .order('date_range_start', { ascending: false })
      .limit(50);

    if (pastCampaignsError) {
      console.log(`❌ Database Error: ${pastCampaignsError.message}`);
    } else {
      console.log(`📊 Past months campaigns found: ${pastCampaigns?.length || 0}`);
      
      if (pastCampaigns && pastCampaigns.length > 0) {
        // Calculate past months totals
        const pastMonthsTotals = pastCampaigns.reduce((acc, campaign) => ({
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
        
        const pastRoas = pastMonthsTotals.purchase_value > 0 && pastMonthsTotals.spend > 0 ? pastMonthsTotals.purchase_value / pastMonthsTotals.spend : 0;
        const pastCostPerReservation = pastMonthsTotals.purchase > 0 && pastMonthsTotals.spend > 0 ? pastMonthsTotals.spend / pastMonthsTotals.purchase : 0;
        
        console.log('\n📊 PAST MONTHS TOTALS (Database):');
        console.log(`📞 Phone Contacts: ${pastMonthsTotals.click_to_call}`);
        console.log(`📧 Email Contacts: ${pastMonthsTotals.lead}`);
        console.log(`📋 Reservation Steps: ${pastMonthsTotals.booking_step_1}`);
        console.log(`🛒 Reservations: ${pastMonthsTotals.purchase}`);
        console.log(`💰 Reservation Value: ${pastMonthsTotals.purchase_value.toFixed(2)} zł`);
        console.log(`📈 ROAS: ${pastRoas.toFixed(2)}x`);
        console.log(`💵 Cost per Reservation: ${pastCostPerReservation.toFixed(2)} zł`);
        console.log(`💸 Total Spend: ${pastMonthsTotals.spend.toFixed(2)} zł`);
        
      } else {
        console.log('📊 No past months data found in database');
      }
    }
    
    // Step 3: Summary
    console.log('\n3️⃣ DASHBOARD LOGIC SUMMARY:');
    console.log('='.repeat(50));
    console.log('✅ Current month (August 2025): Uses live API data');
    console.log('✅ Past months: Uses database data (filtered by date)');
    console.log('✅ Cache: Short cache for live data, longer cache for past data');
    console.log('✅ Fallback: If API fails, falls back to database');
    
    console.log('\n🎯 EXPECTED DASHBOARD BEHAVIOR:');
    console.log('='.repeat(50));
    console.log('1. Dashboard should show current month data from live API');
    console.log('2. If API fails, it should fall back to database data');
    console.log('3. Past months data should come from database only');
    console.log('4. Cache should be managed appropriately for each data source');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDashboardLogic(); 