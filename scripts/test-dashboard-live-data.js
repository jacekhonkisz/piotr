require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDashboardLiveData() {
  console.log('🧪 Testing dashboard with live data...\n');

  try {
    // Get Havet client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('name', 'Havet')
      .single();

    if (clientError || !client) {
      console.log('❌ Client not found:', clientError?.message);
      return;
    }

    console.log(`🏨 Client: ${client.name} (${client.email})`);
    console.log('');

    // Simulate the dashboard's live data loading process
    console.log('1️⃣ Simulating dashboard live data loading...');
    
    const startDate = new Date(2024, 0, 1);
    const today = new Date();
    
    const dateRange = {
      start: startDate.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };

    // Fetch live data from Meta API
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id;
    const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}&limit=50&access_token=${token}`
    );
    
    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error.message}`);
      return;
    }

    console.log(`📊 Found ${data.data?.length || 0} campaigns from API`);

    // Process campaigns like the dashboard does
    if (data.data && data.data.length > 0) {
      const campaigns = data.data.map(insight => {
        // Parse conversion tracking data using the fixed logic
        let click_to_call = 0;
        let lead = 0;
        let purchase = 0;
        let purchase_value = 0;
        let booking_step_1 = 0;
        let booking_step_2 = 0;
        let booking_step_3 = 0;

        if (insight.actions && Array.isArray(insight.actions)) {
          insight.actions.forEach((action) => {
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

        // Extract purchase value from action_values
        if (insight.action_values && Array.isArray(insight.action_values)) {
          insight.action_values.forEach((actionValue) => {
            if (actionValue.action_type === 'purchase') {
              purchase_value = parseFloat(actionValue.value || '0');
            }
          });
        }

        return {
          id: insight.campaign_id,
          campaign_name: insight.campaign_name,
          campaign_id: insight.campaign_id,
          spend: insight.spend || 0,
          impressions: insight.impressions || 0,
          clicks: insight.clicks || 0,
          conversions: insight.conversions || 0,
          ctr: insight.ctr || 0,
          cpc: insight.cpc || 0,
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          // Conversion tracking data
          click_to_call,
          lead,
          purchase,
          purchase_value,
          booking_step_1,
          booking_step_2,
          booking_step_3
        };
      });

      // Calculate stats like the dashboard does
      const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
      const totalImpressions = campaigns.reduce((sum, campaign) => sum + (campaign.impressions || 0), 0);
      const totalClicks = campaigns.reduce((sum, campaign) => sum + (campaign.clicks || 0), 0);
      const totalConversions = campaigns.reduce((sum, campaign) => sum + (campaign.conversions || 0), 0);
      
      const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

      const stats = {
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        averageCtr,
        averageCpc
      };

      // Process conversion tracking data like the dashboard does
      console.log('\n2️⃣ Processing conversion tracking data...');
      
      const conversionTotals = campaigns.reduce((acc, campaign) => ({
        click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
        lead: acc.lead + (campaign.lead || 0),
        purchase: acc.purchase + (campaign.purchase || 0),
        purchase_value: acc.purchase_value + (campaign.purchase_value || 0),
        booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
        booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
        booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
      }), {
        click_to_call: 0,
        lead: 0,
        purchase: 0,
        purchase_value: 0,
        booking_step_1: 0,
        booking_step_2: 0,
        booking_step_3: 0
      });

      // Calculate ROAS and cost per reservation
      const roas = conversionTotals.purchase_value > 0 && stats.totalSpend > 0 
        ? conversionTotals.purchase_value / stats.totalSpend 
        : 0;
      const cost_per_reservation = conversionTotals.purchase > 0 && stats.totalSpend > 0 
        ? stats.totalSpend / conversionTotals.purchase 
        : 0;

      const conversionData = {
        ...conversionTotals,
        roas,
        cost_per_reservation
      };

      console.log('\n📊 Dashboard Conversion Tracking Results:');
      console.log(`   - Click to Call: ${conversionData.click_to_call}`);
      console.log(`   - Lead: ${conversionData.lead}`);
      console.log(`   - Purchase: ${conversionData.purchase}`);
      console.log(`   - Purchase Value: ${conversionData.purchase_value}`);
      console.log(`   - Booking Step 1: ${conversionData.booking_step_1}`);
      console.log(`   - Booking Step 2: ${conversionData.booking_step_2}`);
      console.log(`   - Booking Step 3: ${conversionData.booking_step_3}`);
      console.log(`   - ROAS: ${conversionData.roas.toFixed(2)}x`);
      console.log(`   - Cost per Reservation: ${conversionData.cost_per_reservation.toFixed(2)}`);

      // Check if conversion tracking is "configured"
      const hasConversionData = conversionData.click_to_call > 0 || 
                               conversionData.lead > 0 || 
                               conversionData.purchase > 0 || 
                               conversionData.booking_step_1 > 0;

      console.log('\n🎯 Dashboard Status:');
      if (hasConversionData) {
        console.log('✅ Conversion tracking is CONFIGURED and working!');
        console.log('🔧 The dashboard should show real data instead of "Nie skonfigurowane"');
      } else {
        console.log('❌ Conversion tracking is NOT CONFIGURED');
        console.log('🔧 The dashboard will show "Nie skonfigurowane"');
      }

      console.log('\n📋 Summary:');
      console.log(`   - Total Campaigns: ${campaigns.length}`);
      console.log(`   - Total Spend: ${stats.totalSpend.toFixed(2)}`);
      console.log(`   - Total Impressions: ${stats.totalImpressions.toLocaleString()}`);
      console.log(`   - Total Clicks: ${stats.totalClicks.toLocaleString()}`);
      console.log(`   - Average CTR: ${stats.averageCtr.toFixed(2)}%`);
      console.log(`   - Average CPC: ${stats.averageCpc.toFixed(2)}`);

    } else {
      console.log('❌ No campaign data available');
    }

  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

testDashboardLiveData(); 