require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugReportsPageData() {
  console.log('🔍 DEBUGGING REPORTS PAGE DATA\n');
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
    console.log(`🏢 Ad Account: ${client.ad_account_id}`);
    console.log('');

    // Test 1: Check what the reports page API call would return
    console.log('1️⃣ TESTING REPORTS PAGE API CALL...');
    console.log('-'.repeat(40));
    
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id;
    const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    
    // Simulate the reports page API call
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"2024-01-01","until":"2024-12-31"}&limit=5&access_token=${token}`
    );
    
    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error.message}`);
      return;
    }

    console.log(`📊 API returned ${data.data?.length || 0} campaigns`);
    
    if (data.data && data.data.length > 0) {
      const rawCampaign = data.data[0];
      console.log('📋 Sample raw campaign from API:');
      console.log(`   - Campaign Name: ${rawCampaign.campaign_name || 'Unknown'}`);
      console.log(`   - Spend: ${rawCampaign.spend || 0}`);
      console.log(`   - Impressions: ${rawCampaign.impressions || 0}`);
      console.log(`   - Clicks: ${rawCampaign.clicks || 0}`);
      console.log(`   - Actions: ${rawCampaign.actions?.length || 0} action types`);
      console.log(`   - Action Values: ${rawCampaign.action_values?.length || 0} value types`);
      
      // Test 2: Check if actions contain conversion data
      if (rawCampaign.actions && Array.isArray(rawCampaign.actions)) {
        console.log('\n2️⃣ CHECKING ACTIONS FOR CONVERSION DATA...');
        console.log('-'.repeat(40));
        
        const conversionActions = rawCampaign.actions.filter(action => 
          action.action_type.includes('click_to_call') ||
          action.action_type.includes('lead') ||
          action.action_type.includes('purchase') ||
          action.action_type.includes('booking_step') ||
          action.action_type.includes('initiate_checkout')
        );
        
        console.log(`📊 Found ${conversionActions.length} conversion-related actions:`);
        conversionActions.forEach(action => {
          console.log(`   - ${action.action_type}: ${action.value}`);
        });
        
        if (conversionActions.length === 0) {
          console.log('❌ No conversion actions found in API response');
        }
      }

      // Test 3: Simulate the OLD transformation (what might be happening)
      console.log('\n3️⃣ SIMULATING OLD TRANSFORMATION (WITHOUT PARSING)...');
      console.log('-'.repeat(40));
      
      const oldTransformedCampaign = {
        id: rawCampaign.campaign_id || 'unknown',
        campaign_id: rawCampaign.campaign_id || '',
        campaign_name: rawCampaign.campaign_name || 'Unknown Campaign',
        spend: parseFloat(rawCampaign.spend || '0'),
        impressions: parseInt(rawCampaign.impressions || '0'),
        clicks: parseInt(rawCampaign.clicks || '0'),
        conversions: parseInt(rawCampaign.conversions || '0'),
        ctr: parseFloat(rawCampaign.ctr || '0'),
        cpc: parseFloat(rawCampaign.cpc || '0'),
        // OLD WAY: Direct field access (these don't exist in API response)
        click_to_call: parseInt(rawCampaign.click_to_call || '0'),
        lead: parseInt(rawCampaign.lead || '0'),
        purchase: parseInt(rawCampaign.purchase || '0'),
        purchase_value: parseFloat(rawCampaign.purchase_value || '0'),
        booking_step_1: parseInt(rawCampaign.booking_step_1 || '0'),
        booking_step_2: parseInt(rawCampaign.booking_step_2 || '0'),
        booking_step_3: parseInt(rawCampaign.booking_step_3 || '0')
      };

      console.log('📋 OLD transformation results:');
      console.log(`   - Click to Call: ${oldTransformedCampaign.click_to_call}`);
      console.log(`   - Lead: ${oldTransformedCampaign.lead}`);
      console.log(`   - Purchase: ${oldTransformedCampaign.purchase}`);
      console.log(`   - Purchase Value: ${oldTransformedCampaign.purchase_value}`);
      console.log(`   - Booking Step 1: ${oldTransformedCampaign.booking_step_1}`);
      console.log(`   - Booking Step 2: ${oldTransformedCampaign.booking_step_2}`);
      console.log(`   - Booking Step 3: ${oldTransformedCampaign.booking_step_3}`);

      // Test 4: Simulate the NEW transformation (what should happen)
      console.log('\n4️⃣ SIMULATING NEW TRANSFORMATION (WITH PARSING)...');
      console.log('-'.repeat(40));
      
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

      if (rawCampaign.action_values && Array.isArray(rawCampaign.action_values)) {
        rawCampaign.action_values.forEach((actionValue) => {
          if (actionValue.action_type === 'purchase') {
            purchase_value = parseFloat(actionValue.value || '0');
          }
        });
      }

      const newTransformedCampaign = {
        id: rawCampaign.campaign_id || 'unknown',
        campaign_id: rawCampaign.campaign_id || '',
        campaign_name: rawCampaign.campaign_name || 'Unknown Campaign',
        spend: parseFloat(rawCampaign.spend || '0'),
        impressions: parseInt(rawCampaign.impressions || '0'),
        clicks: parseInt(rawCampaign.clicks || '0'),
        conversions: parseInt(rawCampaign.conversions || '0'),
        ctr: parseFloat(rawCampaign.ctr || '0'),
        cpc: parseFloat(rawCampaign.cpc || '0'),
        // NEW WAY: Parsed from actions
        click_to_call,
        lead,
        purchase,
        purchase_value,
        booking_step_1,
        booking_step_2,
        booking_step_3
      };

      console.log('📋 NEW transformation results:');
      console.log(`   - Click to Call: ${newTransformedCampaign.click_to_call}`);
      console.log(`   - Lead: ${newTransformedCampaign.lead}`);
      console.log(`   - Purchase: ${newTransformedCampaign.purchase}`);
      console.log(`   - Purchase Value: ${newTransformedCampaign.purchase_value}`);
      console.log(`   - Booking Step 1: ${newTransformedCampaign.booking_step_1}`);
      console.log(`   - Booking Step 2: ${newTransformedCampaign.booking_step_2}`);
      console.log(`   - Booking Step 3: ${newTransformedCampaign.booking_step_3}`);

      // Test 5: Check if the reports page is using the right transformation
      console.log('\n5️⃣ DIAGNOSIS...');
      console.log('-'.repeat(40));
      
      if (oldTransformedCampaign.click_to_call === 0 && newTransformedCampaign.click_to_call > 0) {
        console.log('❌ PROBLEM: Reports page is using OLD transformation (direct field access)');
        console.log('✅ SOLUTION: Reports page should use NEW transformation (parsing from actions)');
        console.log('');
        console.log('🔧 The reports page transformation logic needs to be updated');
        console.log('🔧 Browser cache might need to be cleared');
        console.log('🔧 The page might need to be refreshed');
      } else if (newTransformedCampaign.click_to_call === 0) {
        console.log('❌ PROBLEM: No conversion data found in API response');
        console.log('🔧 This might indicate that conversion tracking is not properly configured');
      } else {
        console.log('✅ Both transformations show the same results');
      }

    } else {
      console.log('❌ No campaign data available');
    }

  } catch (error) {
    console.error('💥 Debug error:', error);
  }
}

debugReportsPageData(); 