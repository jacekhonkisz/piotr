require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceFreshDashboardData() {
  console.log('🔄 Forcing fresh dashboard data for Havet client...\n');

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

    // Step 1: Clear any existing campaigns from database
    console.log('1️⃣ Clearing existing campaigns from database...');
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .eq('client_id', client.id);

    if (deleteError) {
      console.log(`⚠️ Error clearing campaigns: ${deleteError.message}`);
    } else {
      console.log('✅ Cleared existing campaigns from database');
    }

    // Step 2: Fetch fresh data from Meta API
    console.log('\n2️⃣ Fetching fresh data from Meta API...');
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id;
    
    const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const startDate = new Date(2024, 0, 1).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${startDate}","until":"${endDate}"}&limit=50&access_token=${token}`
    );
    
    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error.message}`);
      return;
    }

    console.log(`📊 Found ${data.data?.length || 0} campaigns from API`);

    // Step 3: Process and save campaigns with conversion tracking data
    console.log('\n3️⃣ Processing and saving campaigns with conversion tracking...');
    
    if (data.data && data.data.length > 0) {
      const campaignsToSave = data.data.map(insight => {
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
          client_id: client.id,
          campaign_id: insight.campaign_id || 'unknown',
          campaign_name: insight.campaign_name || 'Unknown Campaign',
          status: 'ACTIVE',
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          spend: parseFloat(insight.spend || '0'),
          conversions: parseInt(insight.conversions?.[0]?.value || '0'),
          ctr: parseFloat(insight.ctr || '0'),
          cpc: parseFloat(insight.cpc || '0'),
          date_range_start: startDate,
          date_range_end: endDate,
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

      // Save campaigns to database
      const { error: saveError } = await supabase
        .from('campaigns')
        .insert(campaignsToSave);

      if (saveError) {
        console.log(`❌ Error saving campaigns: ${saveError.message}`);
      } else {
        console.log(`✅ Saved ${campaignsToSave.length} campaigns with conversion tracking data`);
        
        // Show summary of conversion data
        const totalConversionData = campaignsToSave.reduce((acc, campaign) => ({
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

        console.log('\n📊 Total conversion tracking data saved:');
        console.log(`   - Click to Call: ${totalConversionData.click_to_call}`);
        console.log(`   - Lead: ${totalConversionData.lead}`);
        console.log(`   - Purchase: ${totalConversionData.purchase}`);
        console.log(`   - Purchase Value: ${totalConversionData.purchase_value}`);
        console.log(`   - Booking Step 1: ${totalConversionData.booking_step_1}`);
        console.log(`   - Booking Step 2: ${totalConversionData.booking_step_2}`);
        console.log(`   - Booking Step 3: ${totalConversionData.booking_step_3}`);
      }
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Refresh the dashboard in your browser');
    console.log('2. The conversion tracking should now show real data instead of "Nie skonfigurowane"');
    console.log('3. If still showing "Nie skonfigurowane", clear browser cache and reload');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

forceFreshDashboardData(); 