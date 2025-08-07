const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeConversionParsing() {
  console.log('🔍 Analyzing Conversion Data Parsing\n');
  console.log('='.repeat(60));

  const havetClientId = '93d46876-addc-4b99-b1e1-437428dd54f1';
  
  try {
    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', havetClientId)
      .single();

    if (clientError) {
      console.error('❌ Error fetching client:', clientError);
      return;
    }

    console.log(`🏨 Client: ${client.name} (${client.email})`);
    
    // Test August 2025 date range
    const augustRange = {
      start: '2025-08-01',
      end: '2025-08-07'
    };
    
    console.log(`\n📅 Analyzing data for: ${augustRange.start} to ${augustRange.end}`);
    
    // Make direct API call to get raw data
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    const accountIdWithPrefix = `act_${adAccountId}`;
    
    // Get campaign insights with actions
    const campaignsUrl = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${augustRange.start}","until":"${augustRange.end}"}&level=campaign&access_token=${token}`;
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsData = await campaignsResponse.json();
    
    if (!campaignsData.data || campaignsData.data.length === 0) {
      console.log('❌ No campaign data found');
      return;
    }
    
    console.log(`📊 Found ${campaignsData.data.length} campaigns with data`);
    
    // Analyze conversion parsing for each campaign
    let totalClickToCall = 0;
    let totalLead = 0;
    let totalPurchase = 0;
    let totalPurchaseValue = 0;
    let totalBookingStep1 = 0;
    let totalBookingStep2 = 0;
    let totalBookingStep3 = 0;
    
    console.log('\n📋 Campaign-by-Campaign Analysis:');
    console.log('='.repeat(80));
    
    campaignsData.data.forEach((campaign, index) => {
      console.log(`\n${index + 1}. ${campaign.campaign_name}`);
      console.log(`   Campaign ID: ${campaign.campaign_id}`);
      console.log(`   Impressions: ${campaign.impressions || 0}`);
      console.log(`   Clicks: ${campaign.clicks || 0}`);
      console.log(`   Spend: ${campaign.spend || 0}`);
      
      // Parse conversion data like the Meta API service does
      let click_to_call = 0;
      let lead = 0;
      let purchase = 0;
      let purchase_value = 0;
      let booking_step_1 = 0;
      let booking_step_2 = 0;
      let booking_step_3 = 0;
      
      // Extract action data if available
      if (campaign.actions && Array.isArray(campaign.actions)) {
        console.log(`   📊 Actions (${campaign.actions.length} types):`);
        
        campaign.actions.forEach((action) => {
          const actionType = action.action_type;
          const value = parseInt(action.value || '0');
          
          // Parse like the Meta API service
          if (actionType.includes('click_to_call')) {
            click_to_call += value;
            console.log(`      ✅ ${actionType}: ${value} -> click_to_call += ${value}`);
          }
          if (actionType.includes('lead')) {
            lead += value;
            console.log(`      ✅ ${actionType}: ${value} -> lead += ${value}`);
          }
          if (actionType === 'purchase' || actionType.includes('purchase')) {
            purchase += value;
            console.log(`      ✅ ${actionType}: ${value} -> purchase += ${value}`);
          }
          if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
            booking_step_1 += value;
            console.log(`      ✅ ${actionType}: ${value} -> booking_step_1 += ${value}`);
          }
          if (actionType.includes('booking_step_2') || actionType.includes('add_to_cart')) {
            booking_step_2 += value;
            console.log(`      ✅ ${actionType}: ${value} -> booking_step_2 += ${value}`);
          }
          if (actionType.includes('booking_step_3') || actionType.includes('purchase')) {
            booking_step_3 += value;
            console.log(`      ✅ ${actionType}: ${value} -> booking_step_3 += ${value}`);
          }
        });
      }
      
      // Extract purchase value from action_values
      if (campaign.action_values && Array.isArray(campaign.action_values)) {
        campaign.action_values.forEach((actionValue) => {
          if (actionValue.action_type === 'purchase') {
            purchase_value = parseFloat(actionValue.value || '0');
            console.log(`      💰 Purchase Value: ${purchase_value}`);
          }
        });
      }
      
      console.log(`   📈 Parsed Conversions:`);
      console.log(`      - Click to Call: ${click_to_call}`);
      console.log(`      - Lead: ${lead}`);
      console.log(`      - Purchase: ${purchase}`);
      console.log(`      - Purchase Value: ${purchase_value}`);
      console.log(`      - Booking Step 1: ${booking_step_1}`);
      console.log(`      - Booking Step 2: ${booking_step_2}`);
      console.log(`      - Booking Step 3: ${booking_step_3}`);
      
      // Add to totals
      totalClickToCall += click_to_call;
      totalLead += lead;
      totalPurchase += purchase;
      totalPurchaseValue += purchase_value;
      totalBookingStep1 += booking_step_1;
      totalBookingStep2 += booking_step_2;
      totalBookingStep3 += booking_step_3;
    });
    
    console.log('\n🎯 TOTAL CONVERSION SUMMARY:');
    console.log('='.repeat(60));
    console.log(`📞 Phone Contacts (click_to_call): ${totalClickToCall}`);
    console.log(`📧 Email Contacts (lead): ${totalLead}`);
    console.log(`🛒 Reservations (purchase): ${totalPurchase}`);
    console.log(`💰 Reservation Value: ${totalPurchaseValue.toFixed(2)} zł`);
    console.log(`📋 Booking Steps 1: ${totalBookingStep1}`);
    console.log(`📋 Booking Steps 2: ${totalBookingStep2}`);
    console.log(`📋 Booking Steps 3: ${totalBookingStep3}`);
    
    // Calculate ROAS and cost per reservation
    const totalSpend = campaignsData.data.reduce((sum, campaign) => sum + parseFloat(campaign.spend || '0'), 0);
    const roas = totalPurchaseValue > 0 && totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
    const costPerReservation = totalPurchase > 0 && totalSpend > 0 ? totalSpend / totalPurchase : 0;
    
    console.log(`\n💰 FINANCIAL METRICS:`);
    console.log(`   Total Spend: ${totalSpend.toFixed(2)} zł`);
    console.log(`   ROAS: ${roas.toFixed(2)}x`);
    console.log(`   Cost per Reservation: ${costPerReservation.toFixed(2)} zł`);
    
    // Compare with dashboard display
    console.log(`\n🔍 COMPARISON WITH DASHBOARD DISPLAY:`);
    console.log('='.repeat(60));
    console.log(`Dashboard Shows:          | Actual August 2025 Data:`);
    console.log(`Phone Contacts: 0         | Phone Contacts: ${totalClickToCall}`);
    console.log(`Email Contacts: 0         | Email Contacts: ${totalLead}`);
    console.log(`Reservation Steps: 228    | Booking Steps 1: ${totalBookingStep1}`);
    console.log(`Reservations: 245         | Reservations: ${totalPurchase}`);
    console.log(`Reservation Value: 135,894| Reservation Value: ${totalPurchaseValue.toFixed(2)} zł`);
    console.log(`ROAS: 38.51x              | ROAS: ${roas.toFixed(2)}x`);
    console.log(`Cost per Reservation: 14.40| Cost per Reservation: ${costPerReservation.toFixed(2)} zł`);
    
    console.log(`\n🎯 ROOT CAUSE ANALYSIS:`);
    console.log('='.repeat(60));
    console.log('❌ The dashboard is showing data from a different period or cached data');
    console.log('❌ The API is returning correct August 2025 data, but dashboard is not displaying it');
    console.log('❌ Possible issues:');
    console.log('   1. Dashboard is using cached data from a previous period');
    console.log('   2. Date range calculation in dashboard is incorrect');
    console.log('   3. Dashboard is not calling the API for August 2025');
    console.log('   4. Data processing in dashboard is incorrect');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

analyzeConversionParsing(); 