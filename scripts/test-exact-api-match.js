const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testExactApiMatch() {
  console.log('🧪 Testing exact API match for same date ranges...\n');
  
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
    
    // Test with a specific date range that should match the displayed data
    // Based on our analysis, this should be around 2% of the total period
    const testDateRange = {
      start: '2025-07-26', // Recent date
      end: '2025-08-07'    // Current date
    };
    
    console.log(`📅 Testing with date range: ${testDateRange.start} to ${testDateRange.end}`);
    
    // Make multiple API calls to the same endpoint
    const results = [];
    const numTests = 3;
    
    for (let i = 1; i <= numTests; i++) {
      console.log(`\n🔄 Test ${i}/${numTests} - Making API call...`);
      
      try {
        const response = await fetch('http://localhost:3000/api/fetch-live-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify({
            dateRange: testDateRange,
            clientId: havetClientId
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.data?.campaigns) {
            // Process campaigns the same way the reports page does
            const processedCampaigns = data.data.campaigns.map((campaign, index) => {
              const click_to_call = campaign.click_to_call || 0;
              const lead = campaign.lead || 0;
              const purchase = campaign.purchase || 0;
              const purchase_value = campaign.purchase_value || 0;
              const booking_step_1 = campaign.booking_step_1 || 0;
              const booking_step_2 = campaign.booking_step_2 || 0;
              const booking_step_3 = campaign.booking_step_3 || 0;

              return {
                click_to_call,
                lead,
                purchase,
                purchase_value,
                booking_step_1,
                booking_step_2,
                booking_step_3
              };
            });
            
            // Calculate totals
            const totals = processedCampaigns.reduce((acc, campaign) => ({
              click_to_call: acc.click_to_call + campaign.click_to_call,
              lead: acc.lead + campaign.lead,
              purchase: acc.purchase + campaign.purchase,
              purchase_value: acc.purchase_value + campaign.purchase_value,
              booking_step_1: acc.booking_step_1 + campaign.booking_step_1,
              booking_step_2: acc.booking_step_2 + campaign.booking_step_2,
              booking_step_3: acc.booking_step_3 + campaign.booking_step_3,
            }), {
              click_to_call: 0,
              lead: 0,
              purchase: 0,
              purchase_value: 0,
              booking_step_1: 0,
              booking_step_2: 0,
              booking_step_3: 0
            });
            
            results.push({
              test: i,
              success: true,
              totals,
              campaignCount: processedCampaigns.length
            });
            
            console.log(`✅ Test ${i} successful - Campaigns: ${processedCampaigns.length}`);
            console.log(`   - Phone: ${totals.click_to_call}, Lead: ${totals.lead}, Purchase: ${totals.purchase}`);
            
          } else {
            results.push({
              test: i,
              success: false,
              error: 'No campaign data in response'
            });
            console.log(`❌ Test ${i} failed - No campaign data`);
          }
        } else {
          results.push({
            test: i,
            success: false,
            error: `HTTP ${response.status}`
          });
          console.log(`❌ Test ${i} failed - HTTP ${response.status}`);
        }
      } catch (error) {
        results.push({
          test: i,
          success: false,
          error: error.message
        });
        console.log(`❌ Test ${i} failed - ${error.message}`);
      }
      
      // Wait a bit between calls
      if (i < numTests) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Analyze results
    console.log('\n📊 API Consistency Analysis:');
    console.log('='.repeat(50));
    
    const successfulTests = results.filter(r => r.success);
    
    if (successfulTests.length === 0) {
      console.log('❌ No successful API calls - cannot test consistency');
      return;
    }
    
    if (successfulTests.length === 1) {
      console.log('⚠️  Only one successful test - cannot compare consistency');
      console.log('💡 This might be due to authentication issues');
      return;
    }
    
    // Compare results
    const firstResult = successfulTests[0].totals;
    let allMatch = true;
    
    console.log('🔍 Comparing results across tests:');
    console.log('='.repeat(50));
    
    successfulTests.forEach((test, index) => {
      console.log(`\n📊 Test ${test.test} Results:`);
      console.log(`   - Phone Contacts: ${test.totals.click_to_call}`);
      console.log(`   - Email Contacts: ${test.totals.lead}`);
      console.log(`   - Reservations: ${test.totals.purchase}`);
      console.log(`   - Reservation Value: ${test.totals.purchase_value.toFixed(2)} zł`);
      console.log(`   - Booking Steps: ${test.totals.booking_step_1}`);
      console.log(`   - Stage 2: ${test.totals.booking_step_2}`);
      
      if (index > 0) {
        const phoneDiff = Math.abs(test.totals.click_to_call - firstResult.click_to_call);
        const leadDiff = Math.abs(test.totals.lead - firstResult.lead);
        const purchaseDiff = Math.abs(test.totals.purchase - firstResult.purchase);
        const valueDiff = Math.abs(test.totals.purchase_value - firstResult.purchase_value);
        const bookingDiff = Math.abs(test.totals.booking_step_1 - firstResult.booking_step_1);
        const stage2Diff = Math.abs(test.totals.booking_step_2 - firstResult.booking_step_2);
        
        console.log(`\n🔍 Differences from Test 1:`);
        console.log(`   - Phone: ${phoneDiff === 0 ? '✅ Match' : `❌ Diff: ${phoneDiff}`}`);
        console.log(`   - Lead: ${leadDiff === 0 ? '✅ Match' : `❌ Diff: ${leadDiff}`}`);
        console.log(`   - Purchase: ${purchaseDiff === 0 ? '✅ Match' : `❌ Diff: ${purchaseDiff}`}`);
        console.log(`   - Value: ${valueDiff < 0.01 ? '✅ Match' : `❌ Diff: ${valueDiff.toFixed(2)} zł`}`);
        console.log(`   - Booking: ${bookingDiff === 0 ? '✅ Match' : `❌ Diff: ${bookingDiff}`}`);
        console.log(`   - Stage 2: ${stage2Diff === 0 ? '✅ Match' : `❌ Diff: ${stage2Diff}`}`);
        
        if (phoneDiff > 0 || leadDiff > 0 || purchaseDiff > 0 || valueDiff > 0.01 || bookingDiff > 0 || stage2Diff > 0) {
          allMatch = false;
        }
      }
    });
    
    console.log('\n🎯 Consistency Assessment:');
    console.log('='.repeat(50));
    
    if (allMatch) {
      console.log('✅ PERFECT: All API calls returned identical results');
      console.log('✅ The API is consistent for the same date range');
      console.log('✅ This confirms the data fetching is deterministic');
    } else {
      console.log('❌ INCONSISTENT: API calls returned different results');
      console.log('❌ This indicates non-deterministic data fetching');
      console.log('💡 Possible causes:');
      console.log('   - Real-time data updates between calls');
      console.log('   - Caching issues');
      console.log('   - Meta API returning different data');
    }
    
    // Compare with displayed values
    console.log('\n📊 Comparison with Displayed Values:');
    console.log('='.repeat(50));
    console.log('Displayed (Reports Page):');
    console.log('   - Phone Contacts: 51');
    console.log('   - Email Contacts: 0');
    console.log('   - Reservations: 70');
    console.log('   - Reservation Value: 55,490.00 zł');
    console.log('   - Booking Steps: 108');
    console.log('   - Stage 2: 0');
    
    if (successfulTests.length > 0) {
      const apiResult = successfulTests[0].totals;
      console.log('\nAPI Result (Test 1):');
      console.log(`   - Phone Contacts: ${apiResult.click_to_call}`);
      console.log(`   - Email Contacts: ${apiResult.lead}`);
      console.log(`   - Reservations: ${apiResult.purchase}`);
      console.log(`   - Reservation Value: ${apiResult.purchase_value.toFixed(2)} zł`);
      console.log(`   - Booking Steps: ${apiResult.booking_step_1}`);
      console.log(`   - Stage 2: ${apiResult.booking_step_2}`);
      
      const phoneMatch = apiResult.click_to_call === 51;
      const leadMatch = apiResult.lead === 0;
      const purchaseMatch = apiResult.purchase === 70;
      const valueMatch = Math.abs(apiResult.purchase_value - 55490) < 1;
      const bookingMatch = apiResult.booking_step_1 === 108;
      const stage2Match = apiResult.booking_step_2 === 0;
      
      console.log('\n🔍 API vs Display Match:');
      console.log(`   - Phone: ${phoneMatch ? '✅ Match' : '❌ Mismatch'}`);
      console.log(`   - Lead: ${leadMatch ? '✅ Match' : '❌ Mismatch'}`);
      console.log(`   - Purchase: ${purchaseMatch ? '✅ Match' : '❌ Mismatch'}`);
      console.log(`   - Value: ${valueMatch ? '✅ Match' : '❌ Mismatch'}`);
      console.log(`   - Booking: ${bookingMatch ? '✅ Match' : '❌ Mismatch'}`);
      console.log(`   - Stage 2: ${stage2Match ? '✅ Match' : '❌ Mismatch'}`);
      
      const allFieldsMatch = phoneMatch && leadMatch && purchaseMatch && valueMatch && bookingMatch && stage2Match;
      
      if (allFieldsMatch) {
        console.log('\n✅ PERFECT MATCH: API data matches displayed data exactly!');
      } else {
        console.log('\n⚠️  MISMATCH: API data differs from displayed data');
        console.log('💡 This suggests the reports page might be using:');
        console.log('   - Different date range than tested');
        console.log('   - Cached data from a different time');
        console.log('   - Different data processing logic');
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testExactApiMatch(); 