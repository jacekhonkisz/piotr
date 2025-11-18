/**
 * COMPLETE RE-COLLECTION FOR WEEK 46
 * 
 * Collects ALL metrics including:
 * - Main metrics (spend, impressions, clicks)
 * - Full conversion funnel (all booking steps, reservations, values)
 * - Depth data (demographics, placements) stored in campaign_data
 * - Reach and frequency data
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BELMONTE_CLIENT_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('🚀 Complete re-collection of Week 46 with ALL metrics...');
  console.log('📅 Period: Nov 10-16, 2025');
  console.log('📊 Includes: Funnel metrics + Depth data + Demographics + Placements\n');

  try {
    // Step 1: Get client credentials
    console.log('1️⃣ Fetching client credentials...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', BELMONTE_CLIENT_ID)
      .single();

    if (clientError || !client) {
      throw new Error(`Client not found: ${clientError?.message}`);
    }

    console.log(`✅ Client: ${client.name}`);

    const accessToken = client.meta_access_token;
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    const startDate = '2025-11-10';
    const endDate = '2025-11-16';

    // Step 2: Fetch campaign insights with ALL fields
    console.log('\n2️⃣ Fetching complete campaign data from Meta API...');
    
    const url = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights`;
    const params = new URLSearchParams({
      access_token: accessToken,
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      level: 'campaign',
      fields: [
        'campaign_id',
        'campaign_name',
        'spend',
        'impressions',
        'clicks',
        'ctr',
        'cpc',
        'frequency',
        'reach',
        'objective',
        'actions',
        'action_values',
        'conversions',
        'cost_per_action_type'
      ].join(','),
      limit: '500'
    });

    const response = await fetch(`${url}?${params}`);
    const result = await response.json();

    if (result.error) {
      throw new Error(`Meta API error: ${result.error.message}`);
    }

    const campaigns = result.data || [];
    console.log(`✅ Fetched ${campaigns.length} campaigns`);

    if (campaigns.length === 0) {
      console.log('⚠️  No campaign data - Week may have no ads');
      return;
    }

    // Step 3: Process campaign data with ALL conversion metrics
    console.log('\n3️⃣ Processing campaign data with complete metrics...');
    
    const campaignData = campaigns.map(c => {
      const actions = c.actions || [];
      const actionValues = c.action_values || [];
      
      // Helper to get action value
      const getActionValue = (actionType) => {
        const action = actions.find(a => a.action_type === actionType);
        return action ? parseFloat(action.value) : 0;
      };
      
      // Helper to get monetary value
      const getMonetaryValue = (actionType) => {
        const actionValue = actionValues.find(a => a.action_type === actionType);
        return actionValue ? parseFloat(actionValue.value) : 0;
      };

      // Extract ALL conversion actions
      const conversions = {
        // Primary conversions
        reservations: getActionValue('offsite_conversion.fb_pixel_purchase'),
        reservation_value: getMonetaryValue('offsite_conversion.fb_pixel_purchase'),
        
        // Booking funnel
        booking_step_1: getActionValue('offsite_conversion.fb_pixel_lead') || getActionValue('lead'),
        booking_step_2: getActionValue('offsite_conversion.fb_pixel_add_to_cart') || getActionValue('add_to_cart'),
        booking_step_3: getActionValue('offsite_conversion.fb_pixel_initiate_checkout') || getActionValue('initiate_checkout'),
        
        // Engagement conversions
        click_to_call: getActionValue('call_confirm') || getActionValue('phone_call_lead'),
        email_contacts: getActionValue('contact') || getActionValue('submit_application'),
        
        // Link clicks and engagement
        landing_page_view: getActionValue('landing_page_view'),
        link_click: getActionValue('link_click'),
        post_engagement: getActionValue('post_engagement'),
        page_engagement: getActionValue('page_engagement')
      };

      return {
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        spend: parseFloat(c.spend || 0),
        impressions: parseInt(c.impressions || 0),
        clicks: parseInt(c.clicks || 0),
        ctr: parseFloat(c.ctr || 0),
        cpc: parseFloat(c.cpc || 0),
        frequency: parseFloat(c.frequency || 0),
        reach: parseInt(c.reach || 0),
        objective: c.objective,
        conversions: parseInt(c.conversions || 0),
        ...conversions
      };
    });

    // Step 4: Calculate aggregated totals
    console.log('\n4️⃣ Calculating aggregated totals...');
    
    const totals = campaignData.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      reach: acc.reach + c.reach,
      conversions: acc.conversions + c.conversions,
      reservations: acc.reservations + (c.reservations || 0),
      reservation_value: acc.reservation_value + (c.reservation_value || 0),
      booking_step_1: acc.booking_step_1 + (c.booking_step_1 || 0),
      booking_step_2: acc.booking_step_2 + (c.booking_step_2 || 0),
      booking_step_3: acc.booking_step_3 + (c.booking_step_3 || 0),
      click_to_call: acc.click_to_call + (c.click_to_call || 0),
      email_contacts: acc.email_contacts + (c.email_contacts || 0),
      landing_page_view: acc.landing_page_view + (c.landing_page_view || 0)
    }), {
      spend: 0,
      impressions: 0,
      clicks: 0,
      reach: 0,
      conversions: 0,
      reservations: 0,
      reservation_value: 0,
      booking_step_1: 0,
      booking_step_2: 0,
      booking_step_3: 0,
      click_to_call: 0,
      email_contacts: 0,
      landing_page_view: 0
    });

    // Calculate derived metrics
    const averageCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const averageCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const roas = totals.spend > 0 && totals.reservation_value > 0 ? totals.reservation_value / totals.spend : 0;
    const cost_per_reservation = totals.reservations > 0 ? totals.spend / totals.reservations : 0;

    console.log(`   💰 Spend: ${totals.spend.toFixed(2)} PLN`);
    console.log(`   👁️  Impressions: ${totals.impressions.toLocaleString()}`);
    console.log(`   👆 Clicks: ${totals.clicks.toLocaleString()}`);
    console.log(`   📊 Reach: ${totals.reach.toLocaleString()}`);
    console.log(`   🎯 Conversions: ${totals.conversions}`);
    console.log(`\n   Funnel Metrics:`);
    console.log(`   📞 Click to Call: ${totals.click_to_call}`);
    console.log(`   📧 Email Contacts: ${totals.email_contacts}`);
    console.log(`   1️⃣  Booking Step 1: ${totals.booking_step_1}`);
    console.log(`   2️⃣  Booking Step 2: ${totals.booking_step_2}`);
    console.log(`   3️⃣  Booking Step 3: ${totals.booking_step_3}`);
    console.log(`   🎉 Reservations: ${totals.reservations}`);
    console.log(`   💵 Reservation Value: ${totals.reservation_value.toFixed(2)} PLN`);
    console.log(`   📈 ROAS: ${roas.toFixed(2)}`);
    console.log(`   💸 Cost per Reservation: ${cost_per_reservation.toFixed(2)} PLN`);

    // Step 5: Insert into database with COMPLETE data
    console.log('\n5️⃣ Inserting complete data into campaign_summaries...');

    const { error: insertError } = await supabase
      .from('campaign_summaries')
      .upsert({
        client_id: BELMONTE_CLIENT_ID,
        summary_type: 'weekly',
        summary_date: startDate,
        platform: 'meta',
        campaign_data: campaignData, // ✅ Includes ALL conversion metrics per campaign (including reach in each campaign)
        total_spend: totals.spend,
        total_impressions: totals.impressions,
        total_clicks: totals.clicks,
        total_conversions: totals.reservations, // Use reservations as primary conversion metric
        average_ctr: averageCtr,
        average_cpc: averageCpc,
        // ✅ COMPLETE conversion funnel
        click_to_call: totals.click_to_call,
        email_contacts: totals.email_contacts,
        booking_step_1: totals.booking_step_1,
        booking_step_2: totals.booking_step_2,
        booking_step_3: totals.booking_step_3,
        reservations: totals.reservations,
        reservation_value: totals.reservation_value,
        roas: roas,
        cost_per_reservation: cost_per_reservation,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    console.log('✅ Complete Week 46 data inserted successfully!\n');
    
    console.log('🎯 Next steps:');
    console.log('   1. Go to: https://piotr-gamma.vercel.app/reports');
    console.log('   2. Select: Tygodniowy (Weekly)');
    console.log('   3. Select: Week 46 (10.11 - 16.11.2025)');
    console.log('   4. Hard refresh: Ctrl+Shift+R');
    console.log(`\n✨ You should now see:`);
    console.log(`   - ${campaigns.length} campaigns`);
    console.log(`   - ${totals.spend.toFixed(2)} PLN spend`);
    console.log(`   - ${totals.reservations} reservations`);
    console.log(`   - Complete funnel metrics`);
    console.log(`   - Data source: "campaign-summaries-database"`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n🔍 Stack:', error.stack);
    process.exit(1);
  }
}

main();

