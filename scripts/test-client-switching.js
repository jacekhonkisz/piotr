const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testClientSwitching() {
  console.log('🔍 Testing Client Switching Functionality\n');

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
    console.log(`🏨 Belmonte Hotel: ${belmonteClient.id} (${belmonteClient.ad_account_id})`);
    console.log(`🏨 Havet: ${havetClient.id} (${havetClient.ad_account_id})`);

    // Test API calls for both clients with the same date range
    const dateRange = {
      start: '2025-08-01',
      end: '2025-08-07'
    };

    console.log(`\n📅 Testing with date range: ${dateRange.start} to ${dateRange.end}`);

    const clients = [
      { name: 'Belmonte Hotel', client: belmonteClient },
      { name: 'Havet', client: havetClient }
    ];

    const results = [];

    for (const { name, client } of clients) {
      console.log(`\n🏨 Testing ${name} API Call...`);
      
      // Test API call for this specific client
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId: client.id,
          dateRange: dateRange
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   ❌ API Error: ${errorText}`);
        continue;
      }

      const data = await response.json();
      
      if (data.data?.campaigns && data.data.campaigns.length > 0) {
        const campaigns = data.data.campaigns;
        
        // Calculate conversion metrics
        const totalClickToCall = campaigns.reduce((sum, campaign) => sum + (campaign.click_to_call || 0), 0);
        const totalLead = campaigns.reduce((sum, campaign) => sum + (campaign.lead || 0), 0);
        const totalPurchase = campaigns.reduce((sum, campaign) => sum + (campaign.purchase || 0), 0);
        const totalPurchaseValue = campaigns.reduce((sum, campaign) => sum + (campaign.purchase_value || 0), 0);
        const totalBookingStep1 = campaigns.reduce((sum, campaign) => sum + (campaign.booking_step_1 || 0), 0);
        const totalBookingStep2 = campaigns.reduce((sum, campaign) => sum + (campaign.booking_step_2 || 0), 0);
        const totalBookingStep3 = campaigns.reduce((sum, campaign) => sum + (campaign.booking_step_3 || 0), 0);
        
        const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
        const roas = totalPurchaseValue > 0 && totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
        const costPerReservation = totalPurchase > 0 && totalSpend > 0 ? totalSpend / totalPurchase : 0;

        const result = {
          name,
          clientId: client.id,
          adAccountId: client.ad_account_id,
          totalClickToCall,
          totalLead,
          totalPurchase,
          totalPurchaseValue,
          totalBookingStep1,
          totalBookingStep2,
          totalBookingStep3,
          totalSpend,
          roas,
          costPerReservation
        };

        results.push(result);

        console.log(`   📈 ${name} Conversion Data:`);
        console.log(`      - Click to Call: ${totalClickToCall}`);
        console.log(`      - Lead: ${totalLead}`);
        console.log(`      - Purchase: ${totalPurchase}`);
        console.log(`      - Purchase Value: ${totalPurchaseValue.toFixed(2)} zł`);
        console.log(`      - Booking Step 1: ${totalBookingStep1}`);
        console.log(`      - Booking Step 2: ${totalBookingStep2}`);
        console.log(`      - Booking Step 3: ${totalBookingStep3}`);
        console.log(`      - ROAS: ${roas.toFixed(2)}x`);
        console.log(`      - Cost per Reservation: ${costPerReservation.toFixed(2)} zł`);

      } else {
        console.log(`   ❌ No campaign data for ${name}`);
      }
    }

    // Compare results
    if (results.length === 2) {
      console.log('\n🔍 Comparing Client Data...');
      
      const [belmonte, havet] = results;
      
      console.log('\n📊 Data Comparison:');
      console.log('| Metric | Belmonte Hotel | Havet | Different? |');
      console.log('|--------|----------------|-------|------------|');
      console.log(`| Click to Call | ${belmonte.totalClickToCall} | ${havet.totalClickToCall} | ${belmonte.totalClickToCall !== havet.totalClickToCall ? '✅ Yes' : '❌ No'}`);
      console.log(`| Lead | ${belmonte.totalLead} | ${havet.totalLead} | ${belmonte.totalLead !== havet.totalLead ? '✅ Yes' : '❌ No'}`);
      console.log(`| Purchase | ${belmonte.totalPurchase} | ${havet.totalPurchase} | ${belmonte.totalPurchase !== havet.totalPurchase ? '✅ Yes' : '❌ No'}`);
      console.log(`| Purchase Value | ${belmonte.totalPurchaseValue.toFixed(2)} zł | ${havet.totalPurchaseValue.toFixed(2)} zł | ${belmonte.totalPurchaseValue !== havet.totalPurchaseValue ? '✅ Yes' : '❌ No'}`);
      console.log(`| Booking Step 1 | ${belmonte.totalBookingStep1} | ${havet.totalBookingStep1} | ${belmonte.totalBookingStep1 !== havet.totalBookingStep1 ? '✅ Yes' : '❌ No'}`);
      console.log(`| ROAS | ${belmonte.roas.toFixed(2)}x | ${havet.roas.toFixed(2)}x | ${Math.abs(belmonte.roas - havet.roas) > 0.01 ? '✅ Yes' : '❌ No'}`);
      console.log(`| Cost per Reservation | ${belmonte.costPerReservation.toFixed(2)} zł | ${havet.costPerReservation.toFixed(2)} zł | ${Math.abs(belmonte.costPerReservation - havet.costPerReservation) > 0.01 ? '✅ Yes' : '❌ No'}`);

      // Check if data is significantly different
      const differentMetrics = [
        belmonte.totalClickToCall !== havet.totalClickToCall,
        belmonte.totalLead !== havet.totalLead,
        belmonte.totalPurchase !== havet.totalPurchase,
        belmonte.totalPurchaseValue !== havet.totalPurchaseValue,
        belmonte.totalBookingStep1 !== havet.totalBookingStep1,
        Math.abs(belmonte.roas - havet.roas) > 0.01,
        Math.abs(belmonte.costPerReservation - havet.costPerReservation) > 0.01
      ].filter(Boolean).length;

      console.log(`\n🎯 Summary:`);
      console.log(`   - Different metrics: ${differentMetrics}/7`);
      console.log(`   - Data uniqueness: ${differentMetrics >= 5 ? '✅ High' : differentMetrics >= 3 ? '⚠️ Medium' : '❌ Low'}`);

      if (differentMetrics >= 5) {
        console.log(`   ✅ Clients have significantly different data - client switching should work properly`);
      } else {
        console.log(`   ⚠️ Clients have similar data - this might cause confusion in the dashboard`);
      }
    }

    console.log('\n✅ Client switching test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testClientSwitching(); 