const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testReportsCurrentDisplay() {
  console.log('🧪 Testing Current Reports Page Display\n');
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
    
    // Test 1: Check what data sources are available
    console.log('\n1️⃣ DATA SOURCES ANALYSIS:');
    console.log('='.repeat(50));
    
    // Check database campaigns
    const { data: dbCampaigns, error: dbError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .order('date_range_start', { ascending: false })
      .limit(100);
    
    if (dbError) {
      console.error('❌ Database Error:', dbError);
    } else {
      console.log(`📊 Database Campaigns: ${dbCampaigns?.length || 0}`);
      
      if (dbCampaigns && dbCampaigns.length > 0) {
        // Group by date range
        const campaignsByDate = {};
        dbCampaigns.forEach(campaign => {
          const dateKey = `${campaign.date_range_start} to ${campaign.date_range_end}`;
          if (!campaignsByDate[dateKey]) {
            campaignsByDate[dateKey] = [];
          }
          campaignsByDate[dateKey].push(campaign);
        });
        
        console.log('📅 Database campaigns by date range:');
        Object.keys(campaignsByDate).slice(0, 5).forEach(dateKey => {
          const campaigns = campaignsByDate[dateKey];
          const totalSpend = campaigns.reduce((sum, c) => sum + parseFloat(c.spend || 0), 0);
          console.log(`   ${dateKey}: ${campaigns.length} campaigns, ${totalSpend.toFixed(2)} zł`);
        });
      }
    }
    
    // Test 2: Simulate Reports page current month logic
    console.log('\n2️⃣ REPORTS PAGE CURRENT MONTH SIMULATION:');
    console.log('='.repeat(50));
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const periodId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    
    console.log(`📅 Current period ID: ${periodId}`);
    
    // Check if this is current month (same logic as Reports page)
    const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === (today.getMonth() + 1);
    console.log(`🎯 Is current month: ${isCurrentMonth}`);
    
    // Calculate date range (same logic as Reports page)
    const startDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const endDate = new Date(); // Today
    
    const dateRange = {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
    
    console.log(`📅 Reports date range: ${dateRange.start} to ${dateRange.end}`);
    
    // Test 3: Check what the Reports page would display
    console.log('\n3️⃣ REPORTS PAGE DISPLAY ANALYSIS:');
    console.log('='.repeat(50));
    
    // Check if there's cached data for current month
    const { data: cachedCampaigns, error: cachedError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .gte('date_range_start', dateRange.start)
      .lte('date_range_end', dateRange.end);
    
    if (cachedError) {
      console.error('❌ Cached data error:', cachedError);
    } else {
      console.log(`📊 Cached campaigns for current month: ${cachedCampaigns?.length || 0}`);
      
      if (cachedCampaigns && cachedCampaigns.length > 0) {
        const totalSpend = cachedCampaigns.reduce((sum, campaign) => sum + parseFloat(campaign.spend || 0), 0);
        const totalImpressions = cachedCampaigns.reduce((sum, campaign) => sum + parseInt(campaign.impressions || 0), 0);
        const totalClicks = cachedCampaigns.reduce((sum, campaign) => sum + parseInt(campaign.clicks || 0), 0);
        
        console.log(`💰 Cached Total Spend: ${totalSpend.toFixed(2)} zł`);
        console.log(`👁️ Cached Total Impressions: ${totalImpressions.toLocaleString()}`);
        console.log(`🖱️ Cached Total Clicks: ${totalClicks.toLocaleString()}`);
      }
    }
    
    // Test 4: Simulate live API call (what Reports page should do)
    console.log('\n4️⃣ LIVE API CALL SIMULATION:');
    console.log('='.repeat(50));
    
    // Simulate the Meta API call directly
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    const accountIdWithPrefix = `act_${adAccountId}`;
    
    const campaignsUrl = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}&level=campaign&access_token=${token}`;
    
    try {
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();
      
      console.log(`📊 Live API Response: ${campaignsResponse.status}`);
      console.log(`📊 Live API Campaigns Found: ${campaignsData.data?.length || 0}`);
      
      if (campaignsData.data && campaignsData.data.length > 0) {
        // Process campaigns like the Reports page does
        const campaigns = campaignsData.data.map((insight) => {
          // Parse conversion tracking data from actions (same as MetaAPIService)
          let click_to_call = 0;
          let lead = 0;
          let purchase = 0;
          let purchase_value = 0;
          let booking_step_1 = 0;
          let booking_step_2 = 0;
          let booking_step_3 = 0;

          // Extract action data if available (same as MetaAPIService)
          if (insight.actions && Array.isArray(insight.actions)) {
            insight.actions.forEach((action) => {
              const actionType = action.action_type;
              const value = parseInt(action.value || '0');
              
              // Same parsing logic as MetaAPIService
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

          // Extract purchase value from action_values (same as MetaAPIService)
          if (insight.action_values && Array.isArray(insight.action_values)) {
            insight.action_values.forEach((actionValue) => {
              if (actionValue.action_type === 'purchase') {
                purchase_value = parseFloat(actionValue.value || '0');
              }
            });
          }

          return {
            id: insight.campaign_id,
            campaign_name: insight.campaign_name,
            campaign_id: insight.campaign_id,
            spend: parseFloat(insight.spend || '0'),
            impressions: parseInt(insight.impressions || '0'),
            clicks: parseInt(insight.clicks || '0'),
            conversions: parseInt(insight.conversions?.[0]?.value || '0'),
            ctr: parseFloat(insight.ctr || '0'),
            cpc: parseFloat(insight.cpc || '0'),
            date_range_start: dateRange.start,
            date_range_end: dateRange.end,
            // Conversion tracking data (parsed from actions)
            click_to_call,
            lead,
            purchase,
            purchase_value,
            booking_step_1,
            booking_step_2,
            booking_step_3
          };
        });

        // Calculate totals like Reports page does
        const totalSpend = campaigns.reduce((sum, campaign) => sum + parseFloat(campaign.spend || 0), 0);
        const totalImpressions = campaigns.reduce((sum, campaign) => sum + parseInt(campaign.impressions || 0), 0);
        const totalClicks = campaigns.reduce((sum, campaign) => sum + parseInt(campaign.clicks || 0), 0);
        
        // Calculate conversion tracking totals
        const totalClickToCall = campaigns.reduce((sum, campaign) => sum + (campaign.click_to_call || 0), 0);
        const totalLead = campaigns.reduce((sum, campaign) => sum + (campaign.lead || 0), 0);
        const totalPurchase = campaigns.reduce((sum, campaign) => sum + (campaign.purchase || 0), 0);
        const totalPurchaseValue = campaigns.reduce((sum, campaign) => sum + (campaign.purchase_value || 0), 0);
        const totalBookingStep1 = campaigns.reduce((sum, campaign) => sum + (campaign.booking_step_1 || 0), 0);
        
        const roas = totalPurchaseValue > 0 && totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
        const costPerReservation = totalPurchase > 0 && totalSpend > 0 ? totalSpend / totalPurchase : 0;
        
        console.log('\n📊 REPORTS PAGE SHOULD DISPLAY (Live API):');
        console.log('='.repeat(50));
        console.log(`💰 Total Spend: ${totalSpend.toFixed(2)} zł`);
        console.log(`👁️ Total Impressions: ${totalImpressions.toLocaleString()}`);
        console.log(`🖱️ Total Clicks: ${totalClicks.toLocaleString()}`);
        
        console.log('\n📊 REPORTS PAGE CONVERSION TRACKING (Live API):');
        console.log('='.repeat(50));
        console.log(`📞 Phone Contacts: ${totalClickToCall}`);
        console.log(`📧 Email Contacts: ${totalLead}`);
        console.log(`📋 Reservation Steps: ${totalBookingStep1}`);
        console.log(`🛒 Reservations: ${totalPurchase}`);
        console.log(`💰 Reservation Value: ${totalPurchaseValue.toFixed(2)} zł`);
        console.log(`📈 ROAS: ${roas.toFixed(2)}x`);
        console.log(`💵 Cost per Reservation: ${costPerReservation.toFixed(2)} zł`);
        
      } else {
        console.log('❌ No campaigns found in live API');
      }
    } catch (error) {
      console.log(`❌ Live API Error: ${error.message}`);
    }
    
    // Test 5: Summary and comparison
    console.log('\n5️⃣ SUMMARY AND COMPARISON:');
    console.log('='.repeat(50));
    
    console.log('🎯 WHAT REPORTS PAGE SHOULD SHOW:');
    console.log('   - Current month (2025-08): LIVE API data');
    console.log('   - Previous months: Database data');
    console.log('   - API failures: Empty state for current month');
    
    console.log('\n📊 EXPECTED VALUES FOR AUGUST 2025:');
    console.log('   - Phone Contacts: 52 (not 0)');
    console.log('   - Reservation Steps: 108 (not 228)');
    console.log('   - Reservations: 70 (not 245)');
    console.log('   - Reservation Value: 55,490 zł (not 135,894 zł)');
    console.log('   - ROAS: 16.12x (not 38.34x)');
    console.log('   - Cost per Reservation: 49.16 zł (not 14.47 zł)');
    
    console.log('\n🚀 VERIFICATION STEPS:');
    console.log('   1. Open /reports in browser');
    console.log('   2. Check browser console for "LIVE API DATA" message');
    console.log('   3. Verify current month shows live API values');
    console.log('   4. Compare with expected values above');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testReportsCurrentDisplay(); 