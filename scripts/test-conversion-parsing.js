const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConversionParsing() {
  console.log('🔍 Testing Conversion Parsing Logic\n');

  try {
    // Get Havet client
    const { data: havetClient } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    if (!havetClient) {
      console.error('❌ Havet client not found');
      return;
    }

    console.log(`🏨 Testing with Havet client: ${havetClient.name}`);

    // Make direct Meta API call
    const fields = [
      'campaign_id',
      'campaign_name',
      'impressions',
      'clicks',
      'spend',
      'actions',
      'action_values',
    ].join(',');

    const params = new URLSearchParams({
      access_token: havetClient.meta_access_token,
      fields: fields,
      time_range: JSON.stringify({
        since: '2025-08-01',
        until: '2025-08-07',
      }),
      level: 'campaign',
      limit: '10',
    });

    const accountIdWithPrefix = havetClient.ad_account_id.startsWith('act_') 
      ? havetClient.ad_account_id 
      : `act_${havetClient.ad_account_id}`;
    
    const url = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?${params.toString()}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('❌ Meta API Error:', data.error.message);
      return;
    }

    if (!data.data || data.data.length === 0) {
      console.log('❌ No campaign data returned');
      return;
    }

    console.log(`📊 Processing ${data.data.length} campaigns...\n`);

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
        // Conversion tracking data
        click_to_call,
        lead,
        purchase,
        purchase_value,
        booking_step_1,
        booking_step_2,
        booking_step_3,
        // Raw actions for debugging
        raw_actions: insight.actions || []
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

    console.log('📈 Conversion Tracking Results:');
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

    // Show all unique action types for debugging
    const allActions = new Set();
    data.data.forEach(insight => {
      if (insight.actions && Array.isArray(insight.actions)) {
        insight.actions.forEach(action => {
          allActions.add(action.action_type);
        });
      }
    });

    console.log('\n📋 All Unique Action Types Found:');
    Array.from(allActions).sort().forEach(actionType => {
      console.log(`   - ${actionType}`);
    });

    console.log('\n✅ Conversion parsing test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConversionParsing(); 