require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMetaApiResponse() {
  console.log('🔍 Debugging Meta API response structure...\n');

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

    // Fetch raw Meta API response
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
      const campaign = data.data[0];
      
      console.log('\n📋 RAW META API RESPONSE STRUCTURE:');
      console.log('='.repeat(50));
      
      // Show all top-level fields
      console.log('🔍 Top-level campaign fields:');
      Object.keys(campaign).forEach(key => {
        const value = campaign[key];
        if (Array.isArray(value)) {
          console.log(`   - ${key}: Array with ${value.length} items`);
        } else if (typeof value === 'object' && value !== null) {
          console.log(`   - ${key}: Object with keys: ${Object.keys(value).join(', ')}`);
        } else {
          console.log(`   - ${key}: ${value}`);
        }
      });

      // Show actions array structure
      if (campaign.actions && Array.isArray(campaign.actions)) {
        console.log('\n🔍 Actions array structure:');
        console.log(`   - Total actions: ${campaign.actions.length}`);
        
        // Show first few actions
        campaign.actions.slice(0, 5).forEach((action, index) => {
          console.log(`   - Action ${index + 1}:`);
          console.log(`     * action_type: ${action.action_type}`);
          console.log(`     * value: ${action.value}`);
        });
        
        // Show all unique action types
        const actionTypes = [...new Set(campaign.actions.map(a => a.action_type))];
        console.log('\n🔍 All unique action types:');
        actionTypes.forEach(type => {
          const count = campaign.actions.filter(a => a.action_type === type).length;
          console.log(`   - ${type}: ${count} occurrences`);
        });
      }

      // Show action_values array structure
      if (campaign.action_values && Array.isArray(campaign.action_values)) {
        console.log('\n🔍 Action values array structure:');
        console.log(`   - Total action values: ${campaign.action_values.length}`);
        
        campaign.action_values.forEach((actionValue, index) => {
          console.log(`   - Action Value ${index + 1}:`);
          console.log(`     * action_type: ${actionValue.action_type}`);
          console.log(`     * value: ${actionValue.value}`);
        });
      }

      // Test parsing logic
      console.log('\n🔍 TESTING PARSING LOGIC:');
      console.log('='.repeat(50));
      
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
            console.log(`   ✅ Found click_to_call: ${actionType} = ${value}`);
          }
          if (actionType.includes('lead')) {
            lead += value;
            console.log(`   ✅ Found lead: ${actionType} = ${value}`);
          }
          if (actionType === 'purchase' || actionType.includes('purchase')) {
            purchase += value;
            console.log(`   ✅ Found purchase: ${actionType} = ${value}`);
          }
          if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
            booking_step_1 += value;
            console.log(`   ✅ Found booking_step_1: ${actionType} = ${value}`);
          }
          if (actionType.includes('booking_step_2') || actionType.includes('add_to_cart')) {
            booking_step_2 += value;
            console.log(`   ✅ Found booking_step_2: ${actionType} = ${value}`);
          }
          if (actionType.includes('booking_step_3') || actionType.includes('purchase')) {
            booking_step_3 += value;
            console.log(`   ✅ Found booking_step_3: ${actionType} = ${value}`);
          }
        });
      }

      // Extract purchase value from action_values
      if (campaign.action_values && Array.isArray(campaign.action_values)) {
        campaign.action_values.forEach((actionValue) => {
          if (actionValue.action_type === 'purchase') {
            purchase_value = parseFloat(actionValue.value || '0');
            console.log(`   ✅ Found purchase_value: ${actionValue.value}`);
          }
        });
      }

      console.log('\n📊 PARSED CONVERSION DATA:');
      console.log(`   - Click to Call: ${click_to_call}`);
      console.log(`   - Lead: ${lead}`);
      console.log(`   - Purchase: ${purchase}`);
      console.log(`   - Purchase Value: ${purchase_value}`);
      console.log(`   - Booking Step 1: ${booking_step_1}`);
      console.log(`   - Booking Step 2: ${booking_step_2}`);
      console.log(`   - Booking Step 3: ${booking_step_3}`);

      // Show what the campaign object should look like after parsing
      console.log('\n🔍 EXPECTED CAMPAIGN OBJECT AFTER PARSING:');
      const parsedCampaign = {
        id: campaign.campaign_id || 'unknown',
        campaign_id: campaign.campaign_id || '',
        campaign_name: campaign.campaign_name || 'Unknown Campaign',
        spend: parseFloat(campaign.spend || '0'),
        impressions: parseInt(campaign.impressions || '0'),
        clicks: parseInt(campaign.clicks || '0'),
        conversions: parseInt(campaign.conversions || '0'),
        ctr: parseFloat(campaign.ctr || '0'),
        cpc: parseFloat(campaign.cpc || '0'),
        // Conversion tracking fields (parsed from actions)
        click_to_call,
        lead,
        purchase,
        purchase_value,
        booking_step_1,
        booking_step_2,
        booking_step_3
      };

      console.log('   Parsed campaign object:');
      Object.entries(parsedCampaign).forEach(([key, value]) => {
        console.log(`     - ${key}: ${value}`);
      });

    } else {
      console.log('❌ No campaign data available');
    }

  } catch (error) {
    console.error('💥 Debug error:', error);
  }
}

debugMetaApiResponse(); 