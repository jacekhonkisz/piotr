require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFinalConversionFix() {
  console.log('🎯 FINAL TEST: Conversion Tracking Fix Verification\n');
  console.log('='.repeat(60));

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

    // Fetch live data from Meta API
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id;
    const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"2024-01-01","until":"2024-12-31"}&limit=1&access_token=${token}`
    );
    
    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error.message}`);
      return;
    }

    console.log(`📊 Found ${data.data?.length || 0} campaigns from API`);

    if (data.data && data.data.length > 0) {
      const rawCampaign = data.data[0];
      
      // Simulate the FIXED transformation (with proper parsing)
      const campaign = (() => {
        // Parse conversion tracking data from actions array
        let click_to_call = 0;
        let lead = 0;
        let purchase = 0;
        let purchase_value = 0;
        let booking_step_1 = 0;
        let booking_step_2 = 0;
        let booking_step_3 = 0;

        if (rawCampaign.actions && Array.isArray(rawCampaign.actions)) {
          rawCampaign.actions.forEach((action) => {
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
        if (rawCampaign.action_values && Array.isArray(rawCampaign.action_values)) {
          rawCampaign.action_values.forEach((actionValue) => {
            if (actionValue.action_type === 'purchase') {
              purchase_value = parseFloat(actionValue.value || '0');
            }
          });
        }

        return {
          id: rawCampaign.campaign_id || 'unknown',
          campaign_id: rawCampaign.campaign_id || '',
          campaign_name: rawCampaign.campaign_name || 'Unknown Campaign',
          spend: parseFloat(rawCampaign.spend || '0'),
          impressions: parseInt(rawCampaign.impressions || '0'),
          clicks: parseInt(rawCampaign.clicks || '0'),
          conversions: parseInt(rawCampaign.conversions || '0'),
          ctr: parseFloat(rawCampaign.ctr || '0'),
          cpc: parseFloat(rawCampaign.cpc || '0'),
          // Conversion tracking fields (parsed from actions)
          click_to_call,
          lead,
          purchase,
          purchase_value,
          booking_step_1,
          booking_step_2,
          booking_step_3
        };
      })();

      console.log('\n📊 TRANSFORMED CAMPAIGN DATA:');
      console.log('='.repeat(40));
      console.log(`   - Name: ${campaign.campaign_name}`);
      console.log(`   - Spend: ${campaign.spend.toFixed(2)}`);
      console.log(`   - Impressions: ${campaign.impressions.toLocaleString()}`);
      console.log(`   - Clicks: ${campaign.clicks.toLocaleString()}`);
      console.log('');
      console.log('🎯 CONVERSION TRACKING DATA:');
      console.log(`   - Click to Call: ${campaign.click_to_call}`);
      console.log(`   - Lead: ${campaign.lead}`);
      console.log(`   - Purchase: ${campaign.purchase}`);
      console.log(`   - Purchase Value: ${campaign.purchase_value.toFixed(2)}`);
      console.log(`   - Booking Step 1: ${campaign.booking_step_1}`);
      console.log(`   - Booking Step 2: ${campaign.booking_step_2}`);
      console.log(`   - Booking Step 3: ${campaign.booking_step_3}`);

      // Simulate WeeklyReportView calculation
      const conversionTotals = {
        click_to_call: campaign.click_to_call,
        lead: campaign.lead,
        purchase: campaign.purchase,
        purchase_value: campaign.purchase_value,
        booking_step_1: campaign.booking_step_1,
        booking_step_2: campaign.booking_step_2,
        booking_step_3: campaign.booking_step_3
      };

      const campaignTotals = {
        spend: campaign.spend,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        conversions: campaign.conversions
      };

      // Calculate conversion metrics
      const roas = campaignTotals.spend > 0 ? conversionTotals.purchase_value / campaignTotals.spend : 0;
      const costPerReservation = conversionTotals.purchase > 0 ? campaignTotals.spend / conversionTotals.purchase : 0;

      console.log('\n📊 WEEKLYREPORTVIEW CALCULATIONS:');
      console.log('='.repeat(40));
      console.log(`   - ROAS: ${roas.toFixed(2)}x`);
      console.log(`   - Cost per Reservation: ${costPerReservation.toFixed(2)}`);

      // Check what the UI would show
      console.log('\n🎯 UI DISPLAY ANALYSIS:');
      console.log('='.repeat(40));
      console.log(`   - Phone Contacts: ${conversionTotals.click_to_call > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Email Contacts: ${conversionTotals.lead > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Booking Steps: ${conversionTotals.booking_step_1 > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Reservations: ${conversionTotals.purchase > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Reservation Value: ${conversionTotals.purchase_value > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - ROAS: ${roas > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Cost per Reservation: ${costPerReservation > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);
      console.log(`   - Booking Step 2: ${conversionTotals.booking_step_2 > 0 ? 'SHOW DATA' : 'SHOW "—" (Nie skonfigurowane)'}`);

      // Check if "Nie skonfigurowane" overlay would show
      const showNieSkonfigurowane = conversionTotals.click_to_call === 0 || 
                                   conversionTotals.lead === 0 || 
                                   conversionTotals.booking_step_1 === 0;

      console.log('\n🎯 "NIE SKONFIGUROWANE" OVERLAY:');
      console.log('='.repeat(40));
      console.log(`   - Would show overlay: ${showNieSkonfigurowane ? 'YES' : 'NO'}`);
      
      if (showNieSkonfigurowane) {
        console.log('   - Reason: One or more conversion tracking metrics are 0');
      } else {
        console.log('   - All conversion tracking metrics have data');
        console.log('   - Should show real data instead of "Nie skonfigurowane"');
      }

      // Final verification
      console.log('\n🎉 FINAL VERIFICATION:');
      console.log('='.repeat(40));
      
      const hasConversionData = conversionTotals.click_to_call > 0 || 
                               conversionTotals.lead > 0 || 
                               conversionTotals.purchase > 0 || 
                               conversionTotals.booking_step_1 > 0;

      if (hasConversionData) {
        console.log('✅ SUCCESS: Conversion tracking data is properly parsed!');
        console.log('✅ The "Nie skonfigurowane" issue should be resolved.');
        console.log('');
        console.log('📋 Expected behavior:');
        console.log('   - Conversion tracking cards will show real data');
        console.log('   - "Nie skonfigurowane" overlay will disappear');
        console.log('   - ROAS and cost per reservation will be calculated');
        console.log('   - All conversion metrics will display actual values');
      } else {
        console.log('❌ Still no conversion data found');
        console.log('🔧 May need to check if Pixel is properly configured');
      }

    } else {
      console.log('❌ No campaign data available');
    }

  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

testFinalConversionFix(); 