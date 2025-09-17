require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAdminReportsConversion() {
  console.log('🔧 Fixing admin reports to use live data with conversion tracking...\n');

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

    // Step 1: Clear existing reports from database
    console.log('1️⃣ Clearing existing reports from database...');
    const { error: deleteReportsError } = await supabase
      .from('reports')
      .delete()
      .eq('client_id', client.id);

    if (deleteReportsError) {
      console.log(`⚠️ Error clearing reports: ${deleteReportsError.message}`);
    } else {
      console.log('✅ Cleared existing reports from database');
    }

    // Step 2: Fetch live data with conversion tracking
    console.log('\n2️⃣ Fetching live data with conversion tracking...');
    
    const startDate = new Date(2024, 0, 1);
    const endDate = new Date();
    
    const dateRange = {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };

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

    // Step 3: Process campaigns with conversion tracking and save to database
    if (data.data && data.data.length > 0) {
      console.log('\n3️⃣ Processing campaigns with conversion tracking...');
      
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
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          spend: parseFloat(insight.spend || '0'),
          conversions: parseInt(insight.conversions?.[0]?.value || '0'),
          ctr: parseFloat(insight.ctr || '0'),
          cpc: parseFloat(insight.cpc || '0'),
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
      }

      // Step 4: Create a report record
      console.log('\n4️⃣ Creating report record...');
      
      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          client_id: client.id,
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          generated_at: new Date().toISOString(),
          generation_time_ms: 0,
          email_sent: false
        });

      if (reportError) {
        console.log(`❌ Error creating report: ${reportError.message}`);
      } else {
        console.log('✅ Created report record');
      }

      // Step 5: Show summary of conversion data
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

      console.log('\n📊 Conversion Tracking Data Summary:');
      console.log(`   - Click to Call: ${totalConversionData.click_to_call}`);
      console.log(`   - Lead: ${totalConversionData.lead}`);
      console.log(`   - Purchase: ${totalConversionData.purchase}`);
      console.log(`   - Purchase Value: ${totalConversionData.purchase_value}`);
      console.log(`   - Booking Step 1: ${totalConversionData.booking_step_1}`);
      console.log(`   - Booking Step 2: ${totalConversionData.booking_step_2}`);
      console.log(`   - Booking Step 3: ${totalConversionData.booking_step_3}`);

      // Step 6: Test what the admin panel would show
      console.log('\n🎯 Admin Panel Display Analysis:');
      console.log(`   - Phone Contacts: ${totalConversionData.click_to_call > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Email Contacts: ${totalConversionData.lead > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Booking Steps: ${totalConversionData.booking_step_1 > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Reservations: ${totalConversionData.purchase > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Reservation Value: ${totalConversionData.purchase_value > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Booking Step 2: ${totalConversionData.booking_step_2 > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);

      // Check if "Nie skonfigurowane" overlay would show
      const showNieSkonfigurowane = totalConversionData.click_to_call === 0 || 
                                   totalConversionData.lead === 0 || 
                                   totalConversionData.booking_step_1 === 0;

      console.log('\n🎯 "Nie skonfigurowane" Overlay:');
      console.log(`   - Would show overlay: ${showNieSkonfigurowane ? 'YES' : 'NO'}`);
      
      if (showNieSkonfigurowane) {
        console.log('   - Reason: One or more conversion tracking metrics are 0');
      } else {
        console.log('   - All conversion tracking metrics have data');
        console.log('   - Should show real data instead of "Nie skonfigurowane"');
      }
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Go to the admin panel');
    console.log('2. Navigate to the reports section');
    console.log('3. View the Havet client reports');
    console.log('4. The conversion tracking should now show real data instead of "Nie skonfigurowane"');
    console.log('5. If still showing "Nie skonfigurowane", refresh the page and clear browser cache');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

fixAdminReportsConversion(); 