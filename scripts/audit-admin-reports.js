require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditAdminReports() {
  console.log('🔍 Auditing admin reports data...\n');

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

    // Test 1: Check what campaigns are in the database
    console.log('1️⃣ Checking database campaigns...');
    const { data: dbCampaigns, error: dbError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .limit(5);

    if (dbError) {
      console.log(`❌ Database error: ${dbError.message}`);
    } else {
      console.log(`📊 Found ${dbCampaigns?.length || 0} campaigns in database`);
      
      if (dbCampaigns && dbCampaigns.length > 0) {
        const sampleCampaign = dbCampaigns[0];
        console.log('📋 Sample campaign from database:');
        console.log(`   - Name: ${sampleCampaign.campaign_name}`);
        console.log(`   - Spend: ${sampleCampaign.spend}`);
        console.log(`   - Impressions: ${sampleCampaign.impressions}`);
        console.log(`   - Clicks: ${sampleCampaign.clicks}`);
        console.log(`   - Click to Call: ${sampleCampaign.click_to_call || 'NOT SET'}`);
        console.log(`   - Lead: ${sampleCampaign.lead || 'NOT SET'}`);
        console.log(`   - Purchase: ${sampleCampaign.purchase || 'NOT SET'}`);
        console.log(`   - Booking Step 1: ${sampleCampaign.booking_step_1 || 'NOT SET'}`);
      }
    }

    // Test 2: Simulate the reports page data loading
    console.log('\n2️⃣ Simulating reports page data loading...');
    
    const startDate = new Date(2024, 0, 1);
    const endDate = new Date();
    
    const dateRange = {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };

    // Simulate the fetch-live-data API call that the reports page uses
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id;
    const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}&limit=50&access_token=${token}`
    );
    
    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error.message}`);
      return;
    }

    console.log(`📊 Found ${data.data?.length || 0} campaigns from API`);

    // Test 3: Process campaigns like the reports page does
    if (data.data && data.data.length > 0) {
      console.log('\n3️⃣ Processing campaigns like the reports page...');
      
      const campaigns = data.data.map((insight, index) => {
        // Parse conversion tracking data using the fixed logic
        let click_to_call = 0;
        let lead = 0;
        let purchase = 0;
        let purchase_value = 0;
        let booking_step_1 = 0;
        let booking_step_2 = 0;
        let booking_step_3 = 0;

        if (insight.actions && Array.isArray(insight.actions)) {
          insight.actions.forEach((action) => {
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
        if (insight.action_values && Array.isArray(insight.action_values)) {
          insight.action_values.forEach((actionValue) => {
            if (actionValue.action_type === 'purchase') {
              purchase_value = parseFloat(actionValue.value || '0');
            }
          });
        }

        return {
          id: insight.campaign_id || `campaign-${index}`,
          campaign_id: insight.campaign_id || '',
          campaign_name: insight.campaign_name || 'Unknown Campaign',
          spend: parseFloat(insight.spend || '0'),
          impressions: parseInt(insight.impressions || '0'),
          clicks: parseInt(insight.clicks || '0'),
          conversions: parseInt(insight.conversions || '0'),
          ctr: parseFloat(insight.ctr || '0'),
          cpc: parseFloat(insight.cpc || '0'),
          // Conversion tracking data
          click_to_call,
          lead,
          purchase,
          purchase_value,
          booking_step_1,
          booking_step_2,
          booking_step_3
        };
      });

      // Test 4: Simulate WeeklyReportView conversion tracking calculation
      console.log('\n4️⃣ Simulating WeeklyReportView conversion tracking...');
      
      const conversionTotals = campaigns.reduce((acc, campaign) => ({
        click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
        lead: acc.lead + (campaign.lead || 0),
        purchase: acc.purchase + (campaign.purchase || 0),
        purchase_value: acc.purchase_value + (campaign.purchase_value || 0),
        booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
        booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
        booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
      }), { 
        click_to_call: 0, 
        lead: 0, 
        purchase: 0, 
        purchase_value: 0,
        booking_step_1: 0,
        booking_step_2: 0,
        booking_step_3: 0
      });

      const campaignTotals = campaigns.reduce((acc, campaign) => ({
        spend: acc.spend + (campaign.spend || 0),
        impressions: acc.impressions + (campaign.impressions || 0),
        clicks: acc.clicks + (campaign.clicks || 0),
        conversions: acc.conversions + (campaign.conversions || 0)
      }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

      // Calculate conversion metrics like WeeklyReportView does
      const roas = campaignTotals.spend > 0 ? conversionTotals.purchase_value / campaignTotals.spend : 0;
      const costPerReservation = conversionTotals.purchase > 0 ? campaignTotals.spend / conversionTotals.purchase : 0;

      console.log('\n📊 WeeklyReportView Conversion Tracking Results:');
      console.log(`   - Click to Call: ${conversionTotals.click_to_call}`);
      console.log(`   - Lead: ${conversionTotals.lead}`);
      console.log(`   - Purchase: ${conversionTotals.purchase}`);
      console.log(`   - Purchase Value: ${conversionTotals.purchase_value}`);
      console.log(`   - Booking Step 1: ${conversionTotals.booking_step_1}`);
      console.log(`   - Booking Step 2: ${conversionTotals.booking_step_2}`);
      console.log(`   - Booking Step 3: ${conversionTotals.booking_step_3}`);
      console.log(`   - ROAS: ${roas.toFixed(2)}x`);
      console.log(`   - Cost per Reservation: ${costPerReservation.toFixed(2)}`);

      // Check what the UI would show
      console.log('\n🎯 UI Display Analysis:');
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

      console.log('\n🎯 "Nie skonfigurowane" Overlay:');
      console.log(`   - Would show overlay: ${showNieSkonfigurowane ? 'YES' : 'NO'}`);
      
      if (showNieSkonfigurowane) {
        console.log('   - Reason: One or more conversion tracking metrics are 0');
        console.log('   - This triggers the "Nie skonfigurowane" display in WeeklyReportView');
      } else {
        console.log('   - All conversion tracking metrics have data');
        console.log('   - Should show real data instead of "Nie skonfigurowane"');
      }

      console.log('\n📋 Summary:');
      console.log(`   - Total Campaigns: ${campaigns.length}`);
      console.log(`   - Total Spend: ${campaignTotals.spend.toFixed(2)}`);
      console.log(`   - Total Impressions: ${campaignTotals.impressions.toLocaleString()}`);
      console.log(`   - Total Clicks: ${campaignTotals.clicks.toLocaleString()}`);
      console.log(`   - Has Conversion Data: ${Object.values(conversionTotals).some(v => v > 0) ? 'YES' : 'NO'}`);

    } else {
      console.log('❌ No campaign data available');
    }

  } catch (error) {
    console.error('💥 Audit error:', error);
  }
}

auditAdminReports(); 