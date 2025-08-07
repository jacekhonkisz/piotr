const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditBelmonteConversions() {
  console.log('🔍 Auditing Belmonte Hotel Conversion Tracking\n');

  try {
    // Get Belmonte client
    const { data: belmonteClient } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'belmonte@hotel.com')
      .single();

    if (!belmonteClient) {
      console.error('❌ Belmonte client not found');
      return;
    }

    console.log(`🏨 Testing with Belmonte Hotel: ${belmonteClient.name}`);
    console.log(`   Ad Account: ${belmonteClient.ad_account_id}`);
    console.log(`   Token: ${belmonteClient.meta_access_token.substring(0, 20)}...`);

    // Make direct Meta API call
    const fields = [
      'campaign_id',
      'campaign_name',
      'impressions',
      'clicks',
      'spend',
      'conversions',
      'actions',
      'action_values',
      'cost_per_action_type',
      'cost_per_conversion',
      'conversion_values',
    ].join(',');

    const params = new URLSearchParams({
      access_token: belmonteClient.meta_access_token,
      fields: fields,
      time_range: JSON.stringify({
        since: '2025-08-01',
        until: '2025-08-07',
      }),
      level: 'campaign',
      limit: '10', // Get 10 campaigns for testing
    });

    const accountIdWithPrefix = belmonteClient.ad_account_id.startsWith('act_') 
      ? belmonteClient.ad_account_id 
      : `act_${belmonteClient.ad_account_id}`;
    
    const url = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?${params.toString()}`;
    
    console.log('\n🔗 Meta API URL (without token):', url.replace(belmonteClient.meta_access_token, 'HIDDEN_TOKEN'));

    const response = await fetch(url);
    const data = await response.json();

    console.log('\n📡 Meta API Response Status:', response.status);
    console.log('\n📊 Meta API Response Structure:');
    console.log(`   Has Data: ${!!data.data}`);
    console.log(`   Data Length: ${data.data?.length || 0}`);
    console.log(`   Has Error: ${!!data.error}`);
    console.log(`   Error: ${data.error?.message || 'None'}`);

    if (data.error) {
      console.log('\n❌ Meta API Error Details:');
      console.log(`   Type: ${data.error.type}`);
      console.log(`   Code: ${data.error.code}`);
      console.log(`   Message: ${data.error.message}`);
      return;
    }

    if (!data.data || data.data.length === 0) {
      console.log('\n❌ No campaign data returned from Meta API');
      return;
    }

    console.log(`\n📊 Processing ${data.data.length} campaigns...`);

    // Process each campaign like the Meta API service does
    const processedCampaigns = data.data.map(insight => {
      // Parse conversion tracking data from actions
      let click_to_call = 0;
      let lead = 0;
      let purchase = 0;
      let purchase_value = 0;
      let booking_step_1 = 0;
      let booking_step_2 = 0;
      let booking_step_3 = 0;

      // Extract action data if available
      if (insight.actions && Array.isArray(insight.actions)) {
        insight.actions.forEach((action) => {
          const actionType = action.action_type;
          const value = parseInt(action.value || '0');
          
          // Current parsing logic
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
        campaign_id: insight.campaign_id,
        campaign_name: insight.campaign_name,
        spend: parseFloat(insight.spend || '0'),
        impressions: parseInt(insight.impressions || '0'),
        clicks: parseInt(insight.clicks || '0'),
        conversions: parseInt(insight.conversions?.[0]?.value || '0'),
        // Conversion tracking data
        click_to_call,
        lead,
        purchase,
        purchase_value,
        booking_step_1,
        booking_step_2,
        booking_step_3,
        // Raw actions for debugging
        raw_actions: insight.actions || [],
        raw_action_values: insight.action_values || []
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
      booking_step_3: 0,
    });

    console.log('\n📈 Belmonte Hotel Conversion Tracking Results:');
    console.log(`   Click to Call: ${totals.click_to_call}`);
    console.log(`   Lead: ${totals.lead}`);
    console.log(`   Purchase: ${totals.purchase}`);
    console.log(`   Purchase Value: ${totals.purchase_value}`);
    console.log(`   Booking Step 1: ${totals.booking_step_1}`);
    console.log(`   Booking Step 2: ${totals.booking_step_2}`);
    console.log(`   Booking Step 3: ${totals.booking_step_3}`);

    // Show campaigns with conversion data
    const campaignsWithConversions = processedCampaigns.filter(campaign => 
      campaign.click_to_call > 0 || 
      campaign.lead > 0 || 
      campaign.purchase > 0 || 
      campaign.booking_step_1 > 0 || 
      campaign.booking_step_2 > 0 || 
      campaign.booking_step_3 > 0
    );

    if (campaignsWithConversions.length > 0) {
      console.log('\n🎯 Campaigns with Conversion Data:');
      campaignsWithConversions.forEach((campaign, index) => {
        console.log(`\n   ${index + 1}. ${campaign.campaign_name}`);
        console.log(`      Click to Call: ${campaign.click_to_call}`);
        console.log(`      Lead: ${campaign.lead}`);
        console.log(`      Purchase: ${campaign.purchase}`);
        console.log(`      Purchase Value: ${campaign.purchase_value}`);
        console.log(`      Booking Step 1: ${campaign.booking_step_1}`);
        console.log(`      Booking Step 2: ${campaign.booking_step_2}`);
        console.log(`      Booking Step 3: ${campaign.booking_step_3}`);
        
        // Show raw actions that were parsed
        if (campaign.raw_actions.length > 0) {
          console.log(`      Raw Actions: ${campaign.raw_actions.map(a => `${a.action_type}=${a.value}`).join(', ')}`);
        }
      });
    } else {
      console.log('\n❌ No campaigns with conversion data found');
    }

    // Show first few campaigns for detailed analysis
    console.log('\n🔍 First 3 Campaigns Detailed Analysis:');
    processedCampaigns.slice(0, 3).forEach((campaign, index) => {
      console.log(`\n   ${index + 1}. ${campaign.campaign_name}`);
      console.log(`      Campaign ID: ${campaign.campaign_id}`);
      console.log(`      Spend: ${campaign.spend}`);
      console.log(`      Impressions: ${campaign.impressions}`);
      console.log(`      Clicks: ${campaign.clicks}`);
      console.log(`      Conversions: ${campaign.conversions}`);
      
      if (campaign.raw_actions.length > 0) {
        console.log(`      Actions Count: ${campaign.raw_actions.length}`);
        campaign.raw_actions.forEach((action, actionIndex) => {
          console.log(`         Action ${actionIndex + 1}: ${action.action_type} = ${action.value}`);
        });
      } else {
        console.log(`      ❌ No actions array found`);
      }

      if (campaign.raw_action_values.length > 0) {
        console.log(`      Action Values Count: ${campaign.raw_action_values.length}`);
        campaign.raw_action_values.forEach((actionValue, actionValueIndex) => {
          console.log(`         Action Value ${actionValueIndex + 1}: ${actionValue.action_type} = ${actionValue.value}`);
        });
      } else {
        console.log(`      ❌ No action_values array found`);
      }
    });

    // Show all unique action types for debugging
    const allActions = new Set();
    data.data.forEach(insight => {
      if (insight.actions && Array.isArray(insight.actions)) {
        insight.actions.forEach(action => {
          allActions.add(action.action_type);
        });
      }
    });

    console.log('\n📋 All Unique Action Types Found in Belmonte:');
    if (allActions.size > 0) {
      Array.from(allActions).sort().forEach(actionType => {
        console.log(`   - ${actionType}`);
      });
    } else {
      console.log('   ❌ No action types found');
    }

    // Check if there are any conversion-related actions
    const conversionActions = Array.from(allActions).filter(actionType => 
      actionType.includes('click_to_call') ||
      actionType.includes('lead') ||
      actionType.includes('purchase') ||
      actionType.includes('checkout') ||
      actionType.includes('booking') ||
      actionType.includes('conversion')
    );

    console.log('\n🎯 Conversion-Related Action Types:');
    if (conversionActions.length > 0) {
      conversionActions.forEach(actionType => {
        console.log(`   - ${actionType}`);
      });
    } else {
      console.log('   ❌ No conversion-related action types found');
    }

    console.log('\n✅ Belmonte conversion audit completed');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditBelmonteConversions(); 