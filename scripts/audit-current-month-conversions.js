const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditCurrentMonthConversions() {
  console.log('🔍 Auditing Current Month Conversion Tracking (August 2025)\n');

  try {
    // Get both clients
    const { data: belmonteClient } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'belmonte@hotel.com')
      .single();

    const { data: havetClient } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    if (!belmonteClient || !havetClient) {
      console.error('❌ One or both clients not found');
      return;
    }

    console.log('📋 Client Information:');
    console.log(`🏨 Belmonte Hotel: ${belmonteClient.ad_account_id}`);
    console.log(`🏨 Havet: ${havetClient.ad_account_id}`);

    // Current month date range (August 2025)
    const currentMonthRange = {
      start: '2025-08-01',
      end: '2025-08-31'
    };

    console.log(`\n📅 Testing date range: ${currentMonthRange.start} to ${currentMonthRange.end}`);

    // Test both clients
    const clients = [
      { name: 'Belmonte Hotel', client: belmonteClient },
      { name: 'Havet', client: havetClient }
    ];

    for (const { name, client } of clients) {
      console.log(`\n🏨 Testing ${name}...`);
      
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
      ].join(',');

      const params = new URLSearchParams({
        access_token: client.meta_access_token,
        fields: fields,
        time_range: JSON.stringify({
          since: currentMonthRange.start,
          until: currentMonthRange.end,
        }),
        level: 'campaign',
        limit: '20', // Get more campaigns for current month
      });

      const accountIdWithPrefix = client.ad_account_id.startsWith('act_') 
        ? client.ad_account_id 
        : `act_${client.ad_account_id}`;
      
      const url = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?${params.toString()}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.log(`   ❌ Meta API Error: ${data.error.message}`);
        continue;
      }

      if (!data.data || data.data.length === 0) {
        console.log(`   ❌ No campaign data returned for ${name}`);
        continue;
      }

      console.log(`   📊 Found ${data.data.length} campaigns`);

      // Process each campaign
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
        };
      });

      // Calculate totals
      const totals = processedCampaigns.reduce((acc, campaign) => ({
        spend: acc.spend + campaign.spend,
        impressions: acc.impressions + campaign.impressions,
        clicks: acc.clicks + campaign.clicks,
        conversions: acc.conversions + campaign.conversions,
        click_to_call: acc.click_to_call + campaign.click_to_call,
        lead: acc.lead + campaign.lead,
        purchase: acc.purchase + campaign.purchase,
        purchase_value: acc.purchase_value + campaign.purchase_value,
        booking_step_1: acc.booking_step_1 + campaign.booking_step_1,
        booking_step_2: acc.booking_step_2 + campaign.booking_step_2,
        booking_step_3: acc.booking_step_3 + campaign.booking_step_3,
      }), {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        click_to_call: 0,
        lead: 0,
        purchase: 0,
        purchase_value: 0,
        booking_step_1: 0,
        booking_step_2: 0,
        booking_step_3: 0,
      });

      console.log(`\n📈 ${name} - Current Month Results:`);
      console.log(`   Campaigns: ${processedCampaigns.length}`);
      console.log(`   Total Spend: $${totals.spend.toFixed(2)}`);
      console.log(`   Total Impressions: ${totals.impressions.toLocaleString()}`);
      console.log(`   Total Clicks: ${totals.clicks.toLocaleString()}`);
      console.log(`   Total Conversions: ${totals.conversions}`);
      
      console.log(`\n   📊 Conversion Tracking:`);
      console.log(`   Click to Call: ${totals.click_to_call}`);
      console.log(`   Lead: ${totals.lead}`);
      console.log(`   Purchase: ${totals.purchase}`);
      console.log(`   Purchase Value: $${totals.purchase_value.toFixed(2)}`);
      console.log(`   Booking Step 1: ${totals.booking_step_1}`);
      console.log(`   Booking Step 2: ${totals.booking_step_2}`);
      console.log(`   Booking Step 3: ${totals.booking_step_3}`);

      // Calculate ROAS and cost per reservation
      const roas = totals.purchase_value > 0 && totals.spend > 0 ? totals.purchase_value / totals.spend : 0;
      const costPerReservation = totals.purchase > 0 && totals.spend > 0 ? totals.spend / totals.purchase : 0;

      console.log(`\n   💰 Performance Metrics:`);
      console.log(`   ROAS: ${roas.toFixed(2)}x`);
      console.log(`   Cost Per Reservation: $${costPerReservation.toFixed(2)}`);

      // Show top converting campaigns
      const campaignsWithConversions = processedCampaigns.filter(campaign => 
        campaign.click_to_call > 0 || 
        campaign.lead > 0 || 
        campaign.purchase > 0 || 
        campaign.booking_step_1 > 0 || 
        campaign.booking_step_2 > 0 || 
        campaign.booking_step_3 > 0
      );

      if (campaignsWithConversions.length > 0) {
        console.log(`\n   🎯 Top Converting Campaigns:`);
        campaignsWithConversions
          .sort((a, b) => (b.purchase + b.click_to_call) - (a.purchase + a.click_to_call))
          .slice(0, 5)
          .forEach((campaign, index) => {
            console.log(`   ${index + 1}. ${campaign.campaign_name}`);
            console.log(`      Click to Call: ${campaign.click_to_call}, Purchase: ${campaign.purchase}, Value: $${campaign.purchase_value.toFixed(2)}`);
            console.log(`      Booking Steps: ${campaign.booking_step_1}/${campaign.booking_step_2}/${campaign.booking_step_3}`);
          });
      } else {
        console.log(`\n   ❌ No campaigns with conversion data found`);
      }
    }

    console.log('\n✅ Current month conversion audit completed');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditCurrentMonthConversions(); 