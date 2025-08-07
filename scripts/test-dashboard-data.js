require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDashboardData() {
  console.log('🔍 Testing dashboard data for Havet client...\n');

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

    // Test 1: Check database campaigns
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

    // Test 2: Test live API call
    console.log('\n2️⃣ Testing live API call...');
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id;
    
    const accountIdWithPrefix = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const startDate = new Date(2024, 0, 1).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${startDate}","until":"${endDate}"}&limit=5&access_token=${token}`
    );
    
    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ API Error: ${data.error.message}`);
    } else {
      console.log(`📊 Found ${data.data?.length || 0} campaigns from API`);
      
      if (data.data && data.data.length > 0) {
        const sampleCampaign = data.data[0];
        console.log('📋 Sample campaign from API:');
        console.log(`   - Name: ${sampleCampaign.campaign_name}`);
        console.log(`   - Spend: ${sampleCampaign.spend}`);
        console.log(`   - Impressions: ${sampleCampaign.impressions}`);
        console.log(`   - Clicks: ${sampleCampaign.clicks}`);
        
        // Check conversion tracking data
        if (sampleCampaign.actions && sampleCampaign.actions.length > 0) {
          console.log(`   - Actions: ${sampleCampaign.actions.length} action types`);
          
          // Parse conversion data using the fixed logic
          let click_to_call = 0;
          let lead = 0;
          let purchase = 0;
          let booking_step_1 = 0;
          let booking_step_2 = 0;
          let booking_step_3 = 0;

          sampleCampaign.actions.forEach((action) => {
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

          console.log('   📊 Parsed conversion data:');
          console.log(`      - Click to Call: ${click_to_call}`);
          console.log(`      - Lead: ${lead}`);
          console.log(`      - Purchase: ${purchase}`);
          console.log(`      - Booking Step 1: ${booking_step_1}`);
          console.log(`      - Booking Step 2: ${booking_step_2}`);
          console.log(`      - Booking Step 3: ${booking_step_3}`);
        } else {
          console.log('   ❌ No actions data available');
        }
      }
    }

    // Test 3: Check dashboard cache
    console.log('\n3️⃣ Checking dashboard cache...');
    const cacheKey = `dashboard_cache_${client.email}_v4`;
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      console.log('📦 Found cached dashboard data');
      const parsed = JSON.parse(cachedData);
      console.log(`   - Cache timestamp: ${new Date(parsed.timestamp).toLocaleString()}`);
      console.log(`   - Data source: ${parsed.dataSource}`);
      console.log(`   - Campaigns count: ${parsed.data.campaigns?.length || 0}`);
      
      if (parsed.data.campaigns && parsed.data.campaigns.length > 0) {
        const sampleCachedCampaign = parsed.data.campaigns[0];
        console.log('   📋 Sample cached campaign:');
        console.log(`      - Name: ${sampleCachedCampaign.campaign_name}`);
        console.log(`      - Click to Call: ${sampleCachedCampaign.click_to_call || 'NOT SET'}`);
        console.log(`      - Purchase: ${sampleCachedCampaign.purchase || 'NOT SET'}`);
      }
    } else {
      console.log('📦 No cached dashboard data found');
    }

    console.log('\n🎯 Analysis:');
    console.log('The dashboard is showing "Nie skonfigurowane" because:');
    console.log('1. The campaigns in the database might not have conversion tracking fields');
    console.log('2. The dashboard might be using cached data without conversion tracking');
    console.log('3. The live API call might not be processed correctly');
    console.log('');
    console.log('🔧 Solution:');
    console.log('1. Clear the dashboard cache');
    console.log('2. Force a fresh API call');
    console.log('3. Ensure the conversion tracking data is properly saved to database');

  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

testDashboardData(); 