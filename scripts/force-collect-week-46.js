/**
 * FORCE COLLECT WEEK 46 DATA
 * 
 * Direct script to collect Week 46 (Nov 10-16, 2025) for Belmonte Hotel
 * Bypasses all collection logic and directly inserts into database
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
  console.log('🚀 Force collecting Week 46 data for Belmonte Hotel...');
  console.log('📅 Period: Nov 10-16, 2025\n');

  try {
    // Step 1: Get client data
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
    console.log(`   Ad Account: ${client.ad_account_id}`);

    // Step 2: Fetch data from Meta API
    console.log('\n2️⃣ Fetching data from Meta API...');
    
    const accessToken = client.meta_access_token;
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    const startDate = '2025-11-10';
    const endDate = '2025-11-16';

    // Meta API request
    const url = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights`;
    const params = new URLSearchParams({
      access_token: accessToken,
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,frequency,reach,objective,actions',
      limit: '500'
    });

    const response = await fetch(`${url}?${params}`);
    const result = await response.json();

    if (result.error) {
      throw new Error(`Meta API error: ${result.error.message}`);
    }

    const campaigns = result.data || [];
    console.log(`✅ Fetched ${campaigns.length} campaigns from Meta API`);

    if (campaigns.length === 0) {
      console.log('⚠️  No campaign data returned from Meta API');
      console.log('   This could mean:');
      console.log('   - No ads ran during Week 46');
      console.log('   - API credentials are incorrect');
      console.log('   - Date range has no data');
      return;
    }

    // Step 3: Calculate totals
    console.log('\n3️⃣ Calculating totals...');
    
    const campaignData = campaigns.map(c => {
      // Parse actions for conversion metrics
      const actions = c.actions || [];
      const getActionValue = (actionType) => {
        const action = actions.find(a => a.action_type === actionType);
        return action ? parseFloat(action.value) : 0;
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
        // Conversion actions
        reservations: getActionValue('offsite_conversion.fb_pixel_custom'),
        booking_step_1: getActionValue('offsite_conversion.fb_pixel_lead'),
        booking_step_2: getActionValue('offsite_conversion.fb_pixel_add_to_cart'),
        booking_step_3: getActionValue('offsite_conversion.fb_pixel_purchase')
      };
    });

    const totalSpend = campaignData.reduce((sum, c) => sum + c.spend, 0);
    const totalImpressions = campaignData.reduce((sum, c) => sum + c.impressions, 0);
    const totalClicks = campaignData.reduce((sum, c) => sum + c.clicks, 0);
    const totalReservations = campaignData.reduce((sum, c) => sum + (c.reservations || 0), 0);

    console.log(`   Total Spend: ${totalSpend.toFixed(2)} PLN`);
    console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`   Total Clicks: ${totalClicks.toLocaleString()}`);
    console.log(`   Total Reservations: ${totalReservations}`);

    // Step 4: Insert into database
    console.log('\n4️⃣ Inserting into campaign_summaries...');

    const { error: insertError } = await supabase
      .from('campaign_summaries')
      .upsert({
        client_id: BELMONTE_CLIENT_ID,
        summary_type: 'weekly',
        summary_date: startDate,
        platform: 'meta',
        campaign_data: campaignData,
        total_spend: totalSpend,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_conversions: totalReservations,
        average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        average_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
        reservations: totalReservations,
        booking_step_1: campaignData.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0),
        booking_step_2: campaignData.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0),
        booking_step_3: campaignData.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      });

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    console.log('✅ Week 46 data inserted successfully!\n');
    
    console.log('🎯 Next steps:');
    console.log('   1. Go to: https://piotr-gamma.vercel.app/reports');
    console.log('   2. Select: Tygodniowy (Weekly)');
    console.log('   3. Select: Week 46 (10.11 - 16.11.2025)');
    console.log('   4. Hard refresh: Ctrl+Shift+R');
    console.log(`\n✨ You should now see ${campaigns.length} campaigns with ${totalSpend.toFixed(2)} PLN spend!`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Check SUPABASE_SERVICE_ROLE_KEY is set');
    console.error('   2. Verify Meta API credentials are valid');
    console.error('   3. Check internet connection');
    process.exit(1);
  }
}

main();

