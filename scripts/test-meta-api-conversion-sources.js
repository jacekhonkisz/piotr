const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  'https://xbklptrrfdspyvnjaojf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM3MTI4NiwiZXhwIjoyMDY4OTQ3Mjg2fQ.FsFNPzGfUNTkAB9M4tuz-iiF_L_n9oWrZZnoruR-w7U'
);

async function testMetaAPIConversionSources() {
  console.log('🔍 Meta API Conversion Sources Verification');
  console.log('==========================================\n');

  try {
    // Get current month date range
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const dateStart = startOfMonth.toISOString().split('T')[0];
    const dateEnd = today.toISOString().split('T')[0];

    console.log(`📅 Testing date range: ${dateStart} to ${dateEnd}\n`);

    // Get both Belmonte and Havet clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .in('email', ['belmonte@hotel.com', 'havet@magialubczyku.pl']);

    if (clientsError || !clients || clients.length === 0) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`📋 Found ${clients.length} clients to test\n`);

    // Test each client
    for (const client of clients) {
      console.log(`🏢 Testing Client: ${client.name} (${client.email})`);
      console.log(`   Client ID: ${client.id}`);
      console.log(`   Ad Account ID: ${client.ad_account_id}`);
      console.log(`   Has Meta Token: ${!!client.meta_access_token}\n`);

      if (!client.meta_access_token || !client.ad_account_id) {
        console.log('   ⚠️  Skipping - missing token or ad account ID\n');
        continue;
      }

      // Test direct Meta API call to see raw actions data
      console.log('   📡 Test 1: Direct Meta API Raw Actions Analysis');
      try {
        const adAccountId = client.ad_account_id.startsWith('act_') 
          ? client.ad_account_id.substring(4)
          : client.ad_account_id;

        // Make direct call to Meta API to get raw campaign insights
        const metaApiUrl = `https://graph.facebook.com/v18.0/act_${adAccountId}/insights`;
        const metaApiParams = new URLSearchParams({
          access_token: client.meta_access_token,
          fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values',
          time_range: JSON.stringify({
            since: dateStart,
            until: dateEnd
          }),
          level: 'campaign'
        });

        const metaResponse = await fetch(`${metaApiUrl}?${metaApiParams}`);
        
        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          
          if (metaData.data && metaData.data.length > 0) {
            console.log(`   ✅ Meta API returned ${metaData.data.length} campaigns\n`);

            // Analyze raw actions data
            console.log('   📊 Raw Actions Analysis by Campaign:');
            let totalActionsFound = 0;
            const actionTypesSummary = {};

            metaData.data.forEach((campaign, index) => {
              console.log(`\n      Campaign ${index + 1}: ${campaign.campaign_name}`);
              console.log(`         Campaign ID: ${campaign.campaign_id}`);
              console.log(`         Spend: ${campaign.spend || 0}`);
              
              if (campaign.actions && campaign.actions.length > 0) {
                console.log(`         📋 Raw Actions (${campaign.actions.length} types):`);
                campaign.actions.forEach(action => {
                  console.log(`            - ${action.action_type}: ${action.value}`);
                  actionTypesSummary[action.action_type] = (actionTypesSummary[action.action_type] || 0) + parseInt(action.value || 0);
                  totalActionsFound++;
                });
              } else {
                console.log('         📋 No actions data');
              }

              if (campaign.action_values && campaign.action_values.length > 0) {
                console.log(`         💰 Raw Action Values (${campaign.action_values.length} types):`);
                campaign.action_values.forEach(actionValue => {
                  console.log(`            - ${actionValue.action_type}: ${actionValue.value}`);
                });
              }
            });

            console.log('\n   📊 Actions Summary Across All Campaigns:');
            console.log('   ========================================');
            Object.entries(actionTypesSummary).forEach(([actionType, total]) => {
              console.log(`      ${actionType}: ${total}`);
            });

            // Test conversion metric mapping
            console.log('\n   🎯 Test 2: Conversion Metric Mapping Verification');
            console.log('   ================================================');

            const conversionMapping = {
              'click_to_call': {
                description: 'Potencjalne kontakty telefoniczne',
                metaSource: 'actions → click_to_call',
                found: Object.keys(actionTypesSummary).filter(type => type.includes('click_to_call')),
                total: 0
              },
              'email_contacts': {
                description: 'Potencjalne kontakty email',
                metaSource: 'actions → link_click (mailto:) or custom events',
                found: Object.keys(actionTypesSummary).filter(type => 
                  type.includes('link_click') || 
                  type.toLowerCase().includes('email') ||
                  type.toLowerCase().includes('contact')
                ),
                total: 0
              },
              'booking_step_1': {
                description: 'Kroki rezerwacji – Etap 1',
                metaSource: 'actions → booking_step_1 (custom event)',
                found: Object.keys(actionTypesSummary).filter(type => 
                  type.includes('booking_step_1') || 
                  type.includes('lead') ||
                  type.includes('submit_application')
                ),
                total: 0
              },
              'reservations': {
                description: 'Rezerwacje (zakończone)',
                metaSource: 'actions → purchase or reservation',
                found: Object.keys(actionTypesSummary).filter(type => 
                  type.includes('purchase') || 
                  type.includes('reservation') ||
                  type.includes('complete_registration')
                ),
                total: 0
              },
              'booking_step_2': {
                description: 'Etap 2 rezerwacji',
                metaSource: 'actions → booking_step_2 (custom event)',
                found: Object.keys(actionTypesSummary).filter(type => 
                  type.includes('booking_step_2')
                ),
                total: 0
              }
            };

            // Calculate totals for each conversion metric
            Object.keys(conversionMapping).forEach(metric => {
              conversionMapping[metric].found.forEach(actionType => {
                conversionMapping[metric].total += actionTypesSummary[actionType] || 0;
              });
            });

            // Display mapping results
            Object.entries(conversionMapping).forEach(([metric, info]) => {
              console.log(`\n      ${metric.toUpperCase()}: ${info.description}`);
              console.log(`         Expected Meta Source: ${info.metaSource}`);
              console.log(`         Found Action Types: ${info.found.length > 0 ? info.found.join(', ') : 'None'}`);
              console.log(`         Total Value: ${info.total}`);
              console.log(`         Status: ${info.found.length > 0 ? '✅ Found' : '❌ Not Found'}`);
            });

            // Test 3: Compare with our API endpoint
            console.log('\n   🔄 Test 3: API Endpoint vs Raw Meta Data Comparison');
            try {
              const apiResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhia2xwdHJyZmRzcHl2bmphb2pmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM3MTI4NiwiZXhwIjoyMDY4OTQ3Mjg2fQ.FsFNPzGfUNTkAB9M4tuz-iiF_L_n9oWrZZnoruR-w7U`
                },
                body: JSON.stringify({
                  clientId: client.id,
                  dateRange: { start: dateStart, end: dateEnd }
                })
              });

              if (apiResponse.ok) {
                const apiData = await apiResponse.json();
                
                if (apiData.success && apiData.data?.conversionMetrics) {
                  const metrics = apiData.data.conversionMetrics;
                  
                  console.log('\n      📊 API Endpoint Results:');
                  console.log(`         Click to Call: ${metrics.click_to_call}`);
                  console.log(`         Email Contacts: ${metrics.email_contacts}`);
                  console.log(`         Booking Step 1: ${metrics.booking_step_1}`);
                  console.log(`         Reservations: ${metrics.reservations}`);
                  console.log(`         Reservation Value: ${metrics.reservation_value}`);
                  console.log(`         Booking Step 2: ${metrics.booking_step_2}`);

                  console.log('\n      🔍 Comparison Analysis:');
                  console.log(`         Click to Call: API=${metrics.click_to_call}, Raw=${conversionMapping.click_to_call.total} ${metrics.click_to_call === conversionMapping.click_to_call.total ? '✅' : '⚠️'}`);
                  console.log(`         Email Contacts: API=${metrics.email_contacts}, Raw=${conversionMapping.email_contacts.total} ${metrics.email_contacts === conversionMapping.email_contacts.total ? '✅' : '⚠️'}`);
                  console.log(`         Booking Step 1: API=${metrics.booking_step_1}, Raw=${conversionMapping.booking_step_1.total} ${metrics.booking_step_1 === conversionMapping.booking_step_1.total ? '✅' : '⚠️'}`);
                  console.log(`         Reservations: API=${metrics.reservations}, Raw=${conversionMapping.reservations.total} ${metrics.reservations === conversionMapping.reservations.total ? '✅' : '⚠️'}`);
                  console.log(`         Booking Step 2: API=${metrics.booking_step_2}, Raw=${conversionMapping.booking_step_2.total} ${metrics.booking_step_2 === conversionMapping.booking_step_2.total ? '✅' : '⚠️'}`);
                }
              } else {
                console.log('      ❌ API endpoint call failed');
              }
            } catch (apiError) {
              console.log(`      ❌ API test failed: ${apiError.message}`);
            }

          } else {
            console.log('   ❌ Meta API returned no campaign data');
          }
        } else {
          const errorText = await metaResponse.text();
          console.log(`   ❌ Meta API call failed: ${metaResponse.status} ${metaResponse.statusText}`);
          console.log(`   Error: ${errorText.substring(0, 200)}`);
        }

      } catch (error) {
        console.log(`   ❌ Meta API test failed: ${error.message}`);
      }

      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Final recommendations
    console.log('🎯 Meta API Conversion Sources Analysis Summary');
    console.log('===============================================\n');

    console.log('📋 Expected Meta API Action Types by Conversion Metric:');
    console.log('1. 📞 Potencjalne kontakty telefoniczne:');
    console.log('   - Primary: click_to_call');
    console.log('   - Variants: click_to_call_native_call_placed, phone_number_clicks');
    console.log('');
    
    console.log('2. 📧 Potencjalne kontakty email:');
    console.log('   - Primary: link_click (for mailto: links)');
    console.log('   - Custom: EmailClick, Contact, email_submit');
    console.log('   - Note: Requires Pixel configuration on website');
    console.log('');
    
    console.log('3. 🛒 Kroki rezerwacji – Etap 1:');
    console.log('   - Primary: booking_step_1 (custom event)');
    console.log('   - Alternatives: lead, submit_application, initiate_checkout');
    console.log('   - Note: Requires custom Pixel events on client website');
    console.log('');
    
    console.log('4. ✅ Rezerwacje (zakończone):');
    console.log('   - Primary: purchase');
    console.log('   - Custom: reservation, complete_registration');
    console.log('   - Note: Main conversion event');
    console.log('');
    
    console.log('5. 💰 Wartość rezerwacji:');
    console.log('   - Source: action_values array with purchase/reservation events');
    console.log('   - Field: value (monetary amount)');
    console.log('');
    
    console.log('6. 📊 ROAS & Cost per Reservation:');
    console.log('   - Calculated: reservation_value / spend (ROAS)');
    console.log('   - Calculated: spend / reservations (Cost per reservation)');
    console.log('');
    
    console.log('7. 🛒 Etap 2 rezerwacji:');
    console.log('   - Primary: booking_step_2 (custom event)');
    console.log('   - Note: Requires custom Pixel events on client website');

    console.log('\n🔍 Key Findings:');
    console.log('- Most conversion tracking requires custom Pixel events');
    console.log('- Standard Meta events (purchase, link_click) may be present');
    console.log('- Custom events depend on client website implementation');
    console.log('- action_values array contains monetary values');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testMetaAPIConversionSources().catch(console.error); 