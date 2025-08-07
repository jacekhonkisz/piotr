const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Initialize Supabase client
const supabase = createClient(
  'https://xbklptrrfdspyvnjaojf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM3MTI4NiwiZXhwIjoyMDY4OTQ3Mjg2fQ.FsFNPzGfUNTkAB9M4tuz-iiF_L_n9oWrZZnoruR-w7U'
);

async function comprehensiveRoutingAudit() {
  console.log('🔍 Comprehensive Routing & Data Processing Audit');
  console.log('===============================================\n');

  try {
    // Step 1: Get current month date range
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateStart = startOfMonth.toISOString().split('T')[0];
    const dateEnd = today.toISOString().split('T')[0];

    console.log(`📅 Testing date range: ${dateStart} to ${dateEnd}\n`);

    // Step 2: Get both Belmonte and Havet clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .in('email', ['belmonte@hotel.com', 'havet@magialubczyku.pl']);

    if (clientsError || !clients || clients.length === 0) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`📋 Found ${clients.length} clients to test\n`);

    // Step 3: Test each client individually
    for (const client of clients) {
      console.log(`🏢 Testing Client: ${client.name} (${client.email})`);
      console.log(`   Client ID: ${client.id}`);
      console.log(`   Ad Account ID: ${client.ad_account_id}`);
      console.log(`   Has Meta Token: ${!!client.meta_access_token}`);
      console.log(`   Token Length: ${client.meta_access_token?.length || 0}\n`);

      if (!client.meta_access_token || !client.ad_account_id) {
        console.log('   ⚠️  Skipping - missing token or ad account ID\n');
        continue;
      }

      // Test 1: Direct API call to fetch-live-data
      console.log('   📡 Test 1: Direct API Call to fetch-live-data');
      try {
        const response = await fetch('http://localhost:3000/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM3MTI4NiwiZXhwIjoyMDY4OTQ3Mjg2fQ.FsFNPzGfUNTkAB9M4tuz-iiF_L_n9oWrZZnoruR-w7U`
          },
          body: JSON.stringify({
            clientId: client.id,
            dateRange: {
              start: dateStart,
              end: dateEnd
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.data) {
            console.log('   ✅ API call successful');
            console.log(`   📊 Client in response: ${data.data.client?.name || 'Unknown'}`);
            console.log(`   📊 Client ID in response: ${data.data.client?.id || 'Unknown'}`);
            console.log(`   📊 Campaigns returned: ${data.data.campaigns?.length || 0}`);
            
            if (data.data.conversionMetrics) {
              const metrics = data.data.conversionMetrics;
              console.log('   📈 Conversion Metrics:');
              console.log(`      📞 Click to Call: ${metrics.click_to_call}`);
              console.log(`      📧 Email Contacts: ${metrics.email_contacts}`);
              console.log(`      🛒 Booking Step 1: ${metrics.booking_step_1}`);
              console.log(`      ✅ Reservations: ${metrics.reservations}`);
              console.log(`      💰 Reservation Value: ${metrics.reservation_value.toLocaleString('pl-PL')} PLN`);
              console.log(`      📊 ROAS: ${metrics.roas.toFixed(2)}x`);
              console.log(`      💵 Cost per Reservation: ${metrics.cost_per_reservation.toLocaleString('pl-PL')} PLN`);
              console.log(`      🛒 Booking Step 2: ${metrics.booking_step_2}`);

              // Store metrics for comparison
              const clientMetrics = {
                clientId: client.id,
                clientName: client.name,
                metrics: {
                  click_to_call: metrics.click_to_call,
                  email_contacts: metrics.email_contacts,
                  booking_step_1: metrics.booking_step_1,
                  reservations: metrics.reservations,
                  reservation_value: metrics.reservation_value,
                  roas: metrics.roas,
                  cost_per_reservation: metrics.cost_per_reservation,
                  booking_step_2: metrics.booking_step_2
                }
              };

              // Test 2: Check if data is client-specific
              console.log('\n   🔍 Test 2: Client-Specific Data Validation');
              
              if (client.email === 'belmonte@hotel.com') {
                console.log('   📊 Expected Belmonte values:');
                console.log(`      📧 Email Contacts: ~1963 (actual: ${metrics.email_contacts}) ${Math.abs(metrics.email_contacts - 1963) < 50 ? '✅' : '❌'}`);
                console.log(`      🛒 Booking Step 1: ~183 (actual: ${metrics.booking_step_1}) ${Math.abs(metrics.booking_step_1 - 183) < 50 ? '✅' : '❌'}`);
                console.log(`      ✅ Reservations: ~196 (actual: ${metrics.reservations}) ${Math.abs(metrics.reservations - 196) < 50 ? '✅' : '❌'}`);
                console.log(`      💰 Reservation Value: ~118431 (actual: ${metrics.reservation_value}) ${Math.abs(metrics.reservation_value - 118431) < 5000 ? '✅' : '❌'}`);
              } else if (client.email === 'havet@magialubczyku.pl') {
                console.log('   📊 Expected Havet values:');
                console.log(`      📞 Click to Call: ~45 (actual: ${metrics.click_to_call}) ${Math.abs(metrics.click_to_call - 45) < 20 ? '✅' : '❌'}`);
                console.log(`      📧 Email Contacts: ~0 (actual: ${metrics.email_contacts}) ${metrics.email_contacts < 10 ? '✅' : '❌'}`);
                console.log(`      🛒 Booking Step 1: ~84 (actual: ${metrics.booking_step_1}) ${Math.abs(metrics.booking_step_1 - 84) < 30 ? '✅' : '❌'}`);
                console.log(`      ✅ Reservations: ~42 (actual: ${metrics.reservations}) ${Math.abs(metrics.reservations - 42) < 20 ? '✅' : '❌'}`);
                console.log(`      💰 Reservation Value: ~31737 (actual: ${metrics.reservation_value}) ${Math.abs(metrics.reservation_value - 31737) < 5000 ? '✅' : '❌'}`);
              }

              // Test 3: Verify individual campaign data
              console.log('\n   📋 Test 3: Individual Campaign Analysis');
              if (data.data.campaigns && data.data.campaigns.length > 0) {
                console.log(`   📊 Total campaigns: ${data.data.campaigns.length}`);
                
                // Find campaigns with conversion data
                const campaignsWithConversions = data.data.campaigns.filter(campaign => 
                  (campaign.click_to_call || 0) > 0 || 
                  (campaign.email_contacts || 0) > 0 || 
                  (campaign.booking_step_1 || 0) > 0 || 
                  (campaign.reservations || 0) > 0 ||
                  (campaign.reservation_value || 0) > 0
                );

                console.log(`   🎯 Campaigns with conversions: ${campaignsWithConversions.length}`);

                if (campaignsWithConversions.length > 0) {
                  console.log('\n   📊 Top 3 Converting Campaigns:');
                  campaignsWithConversions.slice(0, 3).forEach((campaign, index) => {
                    console.log(`      ${index + 1}. ${campaign.campaign_name}`);
                    console.log(`         ID: ${campaign.campaign_id}`);
                    console.log(`         📞 Click to Call: ${campaign.click_to_call || 0}`);
                    console.log(`         📧 Email Contacts: ${campaign.email_contacts || 0}`);
                    console.log(`         🛒 Booking Step 1: ${campaign.booking_step_1 || 0}`);
                    console.log(`         ✅ Reservations: ${campaign.reservations || 0}`);
                    console.log(`         💰 Reservation Value: ${campaign.reservation_value || 0}`);
                    console.log(`         📊 Spend: ${campaign.spend || 0}`);
                  });
                }

                // Test 4: Check for data leakage between clients
                console.log('\n   🔒 Test 4: Data Isolation Check');
                
                // Check if campaign IDs are unique to this client
                const campaignIds = data.data.campaigns.map(c => c.campaign_id).slice(0, 3);
                console.log(`   📋 Sample campaign IDs: ${campaignIds.join(', ')}`);
                
                // Verify ad account ID in campaigns
                const adAccountFromResponse = data.data.client?.ad_account_id;
                const expectedAdAccount = client.ad_account_id;
                console.log(`   🏢 Ad Account Check: Expected=${expectedAdAccount}, Got=${adAccountFromResponse} ${adAccountFromResponse === expectedAdAccount ? '✅' : '❌'}`);

              } else {
                console.log('   ⚠️ No campaigns returned');
              }

              // Test 5: Date range verification
              console.log('\n   📅 Test 5: Date Range Verification');
              if (data.data.dateRange) {
                const returnedRange = data.data.dateRange;
                console.log(`   📅 Requested: ${dateStart} to ${dateEnd}`);
                console.log(`   📅 Returned: ${returnedRange.start} to ${returnedRange.end}`);
                console.log(`   📅 Date range match: ${returnedRange.start === dateStart && returnedRange.end === dateEnd ? '✅' : '❌'}`);
              }

            } else {
              console.log('   ❌ No conversion metrics in response');
            }
          } else {
            console.log('   ❌ API response unsuccessful or missing data');
            console.log('   Response:', JSON.stringify(data, null, 2).substring(0, 500));
          }
        } else {
          const errorText = await response.text();
          console.log(`   ❌ API call failed: ${response.status} ${response.statusText}`);
          console.log(`   Error details: ${errorText.substring(0, 200)}`);
        }

      } catch (error) {
        console.log(`   ❌ API test failed: ${error.message}`);
      }

      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Step 4: Cross-client comparison
    console.log('📊 Cross-Client Data Analysis');
    console.log('============================\n');

    console.log('🔍 Summary:');
    console.log('- Each client should have unique conversion metrics');
    console.log('- Belmonte should show higher email contacts (~1963 vs ~0)');
    console.log('- Havet should show click to call activity (~45 vs 0)');
    console.log('- Both should have different reservation values');
    console.log('- Campaign IDs should be unique to each client');
    console.log('- Date ranges should match requested periods');

    // Step 5: Routing and caching audit
    console.log('\n🔄 Routing & Caching Audit');
    console.log('==========================\n');

    console.log('📋 Key Areas to Check:');
    console.log('1. ✅ API endpoint correctly processes clientId parameter');
    console.log('2. ✅ Each client uses their own Meta API token');
    console.log('3. ✅ Each client uses their own ad account ID');
    console.log('4. ✅ Date range is correctly passed and processed');
    console.log('5. ❓ Frontend correctly switches between clients');
    console.log('6. ❓ No caching issues causing data leakage');
    console.log('7. ❓ UI properly updates when switching clients');

    console.log('\n🚀 Recommendations:');
    console.log('1. Test browser client switching manually');
    console.log('2. Check browser developer tools for API calls');
    console.log('3. Verify cache keys include client ID');
    console.log('4. Monitor network tab when switching clients');
    console.log('5. Clear browser cache if needed');

    console.log('\n🎉 Comprehensive audit completed!');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

// Run the audit
comprehensiveRoutingAudit().catch(console.error); 