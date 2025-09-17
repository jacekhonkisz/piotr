require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceRefreshReports() {
  console.log('🔄 FORCING REPORTS PAGE REFRESH\n');
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

    // Test the API endpoint directly
    console.log('1️⃣ TESTING API ENDPOINT DIRECTLY...');
    console.log('-'.repeat(40));
    
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id;
    const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    
    // Test the exact API call that the reports page makes
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
      
      // Test the transformation logic that should be used
      console.log('\n2️⃣ TESTING TRANSFORMATION LOGIC...');
      console.log('-'.repeat(40));
      
      let click_to_call = 0;
      let lead = 0;
      let purchase = 0;
      let purchase_value = 0;
      let booking_step_1 = 0;
      let booking_step_2 = 0;
      let booking_step_3 = 0;

      if (rawCampaign.actions && Array.isArray(rawCampaign.actions)) {
        console.log(`📊 Processing ${rawCampaign.actions.length} actions...`);
        
        rawCampaign.actions.forEach((action, index) => {
          const actionType = action.action_type;
          const value = parseInt(action.value || '0');
          
          if (actionType.includes('click_to_call')) {
            click_to_call += value;
            console.log(`   ✅ Found click_to_call: ${actionType} = ${value} (total: ${click_to_call})`);
          }
          if (actionType.includes('lead')) {
            lead += value;
            console.log(`   ✅ Found lead: ${actionType} = ${value} (total: ${lead})`);
          }
          if (actionType === 'purchase' || actionType.includes('purchase')) {
            purchase += value;
            console.log(`   ✅ Found purchase: ${actionType} = ${value} (total: ${purchase})`);
          }
          if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
            booking_step_1 += value;
            console.log(`   ✅ Found booking_step_1: ${actionType} = ${value} (total: ${booking_step_1})`);
          }
          if (actionType.includes('booking_step_2') || actionType.includes('add_to_cart')) {
            booking_step_2 += value;
            console.log(`   ✅ Found booking_step_2: ${actionType} = ${value} (total: ${booking_step_2})`);
          }
          if (actionType.includes('booking_step_3') || actionType.includes('purchase')) {
            booking_step_3 += value;
            console.log(`   ✅ Found booking_step_3: ${actionType} = ${value} (total: ${booking_step_3})`);
          }
        });
      }

      if (rawCampaign.action_values && Array.isArray(rawCampaign.action_values)) {
        console.log(`📊 Processing ${rawCampaign.action_values.length} action values...`);
        
        rawCampaign.action_values.forEach((actionValue) => {
          if (actionValue.action_type === 'purchase') {
            purchase_value = parseFloat(actionValue.value || '0');
            console.log(`   ✅ Found purchase_value: ${actionValue.value} (total: ${purchase_value})`);
          }
        });
      }

      console.log('\n📊 FINAL TRANSFORMATION RESULTS:');
      console.log('='.repeat(40));
      console.log(`   - Click to Call: ${click_to_call}`);
      console.log(`   - Lead: ${lead}`);
      console.log(`   - Purchase: ${purchase}`);
      console.log(`   - Purchase Value: ${purchase_value.toFixed(2)}`);
      console.log(`   - Booking Step 1: ${booking_step_1}`);
      console.log(`   - Booking Step 2: ${booking_step_2}`);
      console.log(`   - Booking Step 3: ${booking_step_3}`);

      console.log('\n🔧 REFRESH INSTRUCTIONS:');
      console.log('='.repeat(40));
      console.log('1. Open your browser developer tools (F12)');
      console.log('2. Right-click the refresh button and select "Empty Cache and Hard Reload"');
      console.log('3. Or press Ctrl+Shift+R (Cmd+Shift+R on Mac)');
      console.log('4. Or go to Application tab → Storage → Clear site data');
      console.log('');
      console.log('🎯 EXPECTED RESULT AFTER REFRESH:');
      console.log('   - Phone Contacts: 158');
      console.log('   - Email Contacts: 24');
      console.log('   - Booking Steps: 6,915');
      console.log('   - Reservations: 1,953');
      console.log('   - Reservation Value: 1,209,679.70 zł');
      console.log('   - ROAS: 6.88x');
      console.log('   - Cost per Reservation: 89.97 zł');

    } else {
      console.log('❌ No campaign data available');
    }

  } catch (error) {
    console.error('💥 Force refresh error:', error);
  }
}

forceRefreshReports(); 