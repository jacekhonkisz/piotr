require('dotenv').config({ path: '.env.local' });

async function debugConversionParsing() {
  console.log('🔍 Debugging conversion tracking parsing...\n');

  const token = 'EAAKZBRTlpNXsBPIbjitymINStheW5ZBI6pgqajiCarZBAWzZCDjWPQ0ZBbCSTVenrjbLtZABiIhb1FfqTZBAvLYq2xVeynw18d3d54qlkN0OmcUZCZAZCBQoO56h0TnUU9hxb37T53SDSgdbJUjTf3qveGQ2V4ptP2Cul7avKcZA14Vr1cNZCSE7yDWwQGPV9QyWn9MVIKMNBUL3';
  const adAccountId = '659510566204299';

  try {
    // Fetch campaign insights with actions
    const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&limit=1&access_token=${token}`
    );
    const data = await response.json();

    if (data.error) {
      console.log(`❌ API Error: ${data.error.message}`);
      return;
    }

    if (!data.data || data.data.length === 0) {
      console.log('❌ No campaign data available');
      return;
    }

    const campaign = data.data[0];
    console.log(`📊 Campaign: ${campaign.campaign_name || 'Unknown'}`);
    console.log(`   - Impressions: ${campaign.impressions || 0}`);
    console.log(`   - Clicks: ${campaign.clicks || 0}`);
    console.log(`   - Spend: ${campaign.spend || 0}`);
    console.log('');

    // Show all available actions
    if (campaign.actions && Array.isArray(campaign.actions)) {
      console.log('📋 All available actions:');
      campaign.actions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action.action_type}: ${action.value}`);
      });
      console.log('');

      // Test the current parsing logic
      console.log('🔧 Testing current parsing logic:');
      
      let click_to_call = 0;
      let lead = 0;
      let purchase = 0;
      let purchase_value = 0;
      let booking_step_1 = 0;
      let booking_step_2 = 0;
      let booking_step_3 = 0;

      campaign.actions.forEach((action) => {
        const actionType = action.action_type;
        const value = parseInt(action.value || '0');
        
        console.log(`   Checking: ${actionType} = ${value}`);
        
        switch (actionType) {
          case 'click_to_call':
            click_to_call = value;
            console.log(`     ✅ Matched click_to_call: ${value}`);
            break;
          case 'lead':
            lead = value;
            console.log(`     ✅ Matched lead: ${value}`);
            break;
          case 'purchase':
            purchase = value;
            console.log(`     ✅ Matched purchase: ${value}`);
            break;
          case 'booking_step_1':
            booking_step_1 = value;
            console.log(`     ✅ Matched booking_step_1: ${value}`);
            break;
          case 'booking_step_2':
            booking_step_2 = value;
            console.log(`     ✅ Matched booking_step_2: ${value}`);
            break;
          case 'booking_step_3':
            booking_step_3 = value;
            console.log(`     ✅ Matched booking_step_3: ${value}`);
            break;
          default:
            console.log(`     ❌ No match for: ${actionType}`);
        }
      });

      console.log('\n📊 Current parsing results:');
      console.log(`   - click_to_call: ${click_to_call}`);
      console.log(`   - lead: ${lead}`);
      console.log(`   - purchase: ${purchase}`);
      console.log(`   - booking_step_1: ${booking_step_1}`);
      console.log(`   - booking_step_2: ${booking_step_2}`);
      console.log(`   - booking_step_3: ${booking_step_3}`);

      // Test improved parsing logic
      console.log('\n🔧 Testing improved parsing logic:');
      
      let improved_click_to_call = 0;
      let improved_lead = 0;
      let improved_purchase = 0;
      let improved_booking_step_1 = 0;
      let improved_booking_step_2 = 0;
      let improved_booking_step_3 = 0;

      campaign.actions.forEach((action) => {
        const actionType = action.action_type;
        const value = parseInt(action.value || '0');
        
        // Improved matching logic
        if (actionType.includes('click_to_call')) {
          improved_click_to_call += value;
          console.log(`     ✅ Improved match click_to_call: ${actionType} = ${value}`);
        }
        if (actionType.includes('lead')) {
          improved_lead += value;
          console.log(`     ✅ Improved match lead: ${actionType} = ${value}`);
        }
        if (actionType === 'purchase') {
          improved_purchase += value;
          console.log(`     ✅ Improved match purchase: ${actionType} = ${value}`);
        }
        if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
          improved_booking_step_1 += value;
          console.log(`     ✅ Improved match booking_step_1: ${actionType} = ${value}`);
        }
        if (actionType.includes('booking_step_2') || actionType.includes('add_to_cart')) {
          improved_booking_step_2 += value;
          console.log(`     ✅ Improved match booking_step_2: ${actionType} = ${value}`);
        }
        if (actionType.includes('booking_step_3') || actionType.includes('purchase')) {
          improved_booking_step_3 += value;
          console.log(`     ✅ Improved match booking_step_3: ${actionType} = ${value}`);
        }
      });

      console.log('\n📊 Improved parsing results:');
      console.log(`   - click_to_call: ${improved_click_to_call}`);
      console.log(`   - lead: ${improved_lead}`);
      console.log(`   - purchase: ${improved_purchase}`);
      console.log(`   - booking_step_1: ${improved_booking_step_1}`);
      console.log(`   - booking_step_2: ${improved_booking_step_2}`);
      console.log(`   - booking_step_3: ${improved_booking_step_3}`);

      console.log('\n🎯 Issue identified:');
      console.log('The current parsing logic only looks for exact matches, but Meta API returns:');
      console.log('- click_to_call_native_call_placed (not just click_to_call)');
      console.log('- click_to_call_native_20s_call_connect');
      console.log('- click_to_call_call_confirm');
      console.log('');
      console.log('🔧 Solution: Update the parsing logic to use includes() instead of exact matches');

    } else {
      console.log('❌ No actions data available');
    }

  } catch (error) {
    console.error('💥 Debug error:', error);
  }
}

debugConversionParsing(); 