const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugConversionData() {
  console.log('🔍 Debugging Conversion Data Structure\n');

  try {
    // Get admin session
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get admin session:', sessionError);
      return;
    }

    console.log('🔐 Admin session obtained');

    // Test with Havet client (which should have conversion data)
    const { data: havetClient } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    if (!havetClient) {
      console.error('❌ Havet client not found');
      return;
    }

    console.log(`\n🏨 Testing with Havet client: ${havetClient.name}`);

    const response = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: havetClient.id,
        dateRange: {
          start: '2025-08-01',
          end: '2025-08-07'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${errorText}`);
      return;
    }

    const data = await response.json();
    
    console.log('\n📊 API Response Structure:');
    console.log(`   Success: ${data.success}`);
    console.log(`   Campaigns Count: ${data.data?.campaigns?.length || 0}`);
    console.log(`   Stats Available: ${!!data.data?.stats}`);

    // Check first campaign structure
    if (data.data?.campaigns?.length > 0) {
      const firstCampaign = data.data.campaigns[0];
      console.log('\n🔍 First Campaign Structure:');
      console.log(`   Campaign ID: ${firstCampaign.campaign_id}`);
      console.log(`   Campaign Name: ${firstCampaign.campaign_name}`);
      console.log(`   Spend: ${firstCampaign.spend}`);
      console.log(`   Impressions: ${firstCampaign.impressions}`);
      console.log(`   Clicks: ${firstCampaign.clicks}`);
      console.log(`   Conversions: ${firstCampaign.conversions}`);
      
      // Check for conversion tracking fields
      console.log('\n📈 Conversion Tracking Fields:');
      console.log(`   click_to_call: ${firstCampaign.click_to_call || 'NOT FOUND'}`);
      console.log(`   lead: ${firstCampaign.lead || 'NOT FOUND'}`);
      console.log(`   purchase: ${firstCampaign.purchase || 'NOT FOUND'}`);
      console.log(`   purchase_value: ${firstCampaign.purchase_value || 'NOT FOUND'}`);
      console.log(`   booking_step_1: ${firstCampaign.booking_step_1 || 'NOT FOUND'}`);
      console.log(`   booking_step_2: ${firstCampaign.booking_step_2 || 'NOT FOUND'}`);
      console.log(`   booking_step_3: ${firstCampaign.booking_step_3 || 'NOT FOUND'}`);

      // Check for actions array (raw Meta API data)
      if (firstCampaign.actions) {
        console.log('\n🎯 Actions Array (Raw Meta API Data):');
        console.log(`   Actions Count: ${firstCampaign.actions.length}`);
        firstCampaign.actions.forEach((action, index) => {
          console.log(`   Action ${index + 1}: ${action.action_type} = ${action.value}`);
        });
      } else {
        console.log('\n❌ No actions array found in campaign data');
      }

      // Check for action_values array
      if (firstCampaign.action_values) {
        console.log('\n💰 Action Values Array:');
        console.log(`   Action Values Count: ${firstCampaign.action_values.length}`);
        firstCampaign.action_values.forEach((actionValue, index) => {
          console.log(`   Action Value ${index + 1}: ${actionValue.action_type} = ${actionValue.value}`);
        });
      } else {
        console.log('\n❌ No action_values array found in campaign data');
      }
    }

    // Check stats structure
    if (data.data?.stats) {
      console.log('\n📊 Stats Structure:');
      const stats = data.data.stats;
      console.log(`   Total Spend: ${stats.totalSpend}`);
      console.log(`   Total Impressions: ${stats.totalImpressions}`);
      console.log(`   Total Clicks: ${stats.totalClicks}`);
      console.log(`   Total Conversions: ${stats.totalConversions}`);
      
      console.log('\n📈 Stats Conversion Tracking:');
      console.log(`   totalClickToCall: ${stats.totalClickToCall || 'NOT FOUND'}`);
      console.log(`   totalLead: ${stats.totalLead || 'NOT FOUND'}`);
      console.log(`   totalPurchase: ${stats.totalPurchase || 'NOT FOUND'}`);
      console.log(`   totalPurchaseValue: ${stats.totalPurchaseValue || 'NOT FOUND'}`);
      console.log(`   totalBookingStep1: ${stats.totalBookingStep1 || 'NOT FOUND'}`);
      console.log(`   totalBookingStep2: ${stats.totalBookingStep2 || 'NOT FOUND'}`);
      console.log(`   totalBookingStep3: ${stats.totalBookingStep3 || 'NOT FOUND'}`);
      console.log(`   roas: ${stats.roas || 'NOT FOUND'}`);
      console.log(`   costPerReservation: ${stats.costPerReservation || 'NOT FOUND'}`);
    }

    console.log('\n✅ Debug completed');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugConversionData(); 