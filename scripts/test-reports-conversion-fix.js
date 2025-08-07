const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testReportsConversionFix() {
  console.log('🧪 Testing Reports Page Conversion Fix...\n');

  try {
    // Get Havet client
    const { data: havetClient, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    if (clientError) {
      console.error('❌ Error fetching Havet client:', clientError);
      return;
    }

    console.log(`🏨 Client: ${havetClient.name} (${havetClient.email})`);
    console.log(`📊 Client ID: ${havetClient.id}`);

    // Get campaigns with conversion data (this simulates what the API returns)
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClient.id);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`📊 Found ${campaigns?.length || 0} campaigns with conversion data`);

    if (campaigns && campaigns.length > 0) {
      // Simulate how the reports page now processes campaigns
      // This matches the fixed logic in reports page
      const processedCampaigns = campaigns.map((campaign, index) => {
        // Use already-parsed conversion tracking data (FIXED LOGIC)
        const click_to_call = campaign.click_to_call || 0;
        const lead = campaign.lead || 0;
        const purchase = campaign.purchase || 0;
        const purchase_value = campaign.purchase_value || 0;
        const booking_step_1 = campaign.booking_step_1 || 0;
        const booking_step_2 = campaign.booking_step_2 || 0;
        const booking_step_3 = campaign.booking_step_3 || 0;

        return {
          id: campaign.campaign_id || `campaign-${index}`,
          campaign_id: campaign.campaign_id || '',
          campaign_name: campaign.campaign_name || 'Unknown Campaign',
          spend: parseFloat(campaign.spend || '0'),
          impressions: parseInt(campaign.impressions || '0'),
          clicks: parseInt(campaign.clicks || '0'),
          conversions: parseInt(campaign.conversions || '0'),
          ctr: parseFloat(campaign.ctr || '0'),
          cpc: parseFloat(campaign.cpc || '0'),
          // Conversion tracking fields (now correctly using parsed data)
          click_to_call,
          lead,
          purchase,
          purchase_value,
          booking_step_1,
          booking_step_2,
          booking_step_3
        };
      });

      console.log('\n📊 Processed Campaign Data (Reports Page Logic):');
      console.log('='.repeat(50));

      const sampleCampaign = processedCampaigns[0];
      console.log(`📈 Sample campaign: ${sampleCampaign.campaign_name}`);
      console.log(`   - Campaign ID: ${sampleCampaign.campaign_id}`);
      console.log(`   - Spend: ${sampleCampaign.spend} zł`);
      console.log(`   - Impressions: ${sampleCampaign.impressions.toLocaleString()}`);
      console.log(`   - Clicks: ${sampleCampaign.clicks.toLocaleString()}`);
      
      console.log('\n📊 Conversion Tracking Fields:');
      console.log(`   - Click to Call: ${sampleCampaign.click_to_call}`);
      console.log(`   - Lead: ${sampleCampaign.lead}`);
      console.log(`   - Purchase: ${sampleCampaign.purchase}`);
      console.log(`   - Purchase Value: ${sampleCampaign.purchase_value} zł`);
      console.log(`   - Booking Step 1: ${sampleCampaign.booking_step_1}`);
      console.log(`   - Booking Step 2: ${sampleCampaign.booking_step_2}`);
      console.log(`   - Booking Step 3: ${sampleCampaign.booking_step_3}`);

      // Calculate totals (same as WeeklyReportView component)
      const conversionTotals = processedCampaigns.reduce((acc, campaign) => ({
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

      console.log('\n📊 Expected Reports Page Display:');
      console.log('='.repeat(50));
      console.log('📱 Conversion Tracking Cards:');
      console.log(`   - Potencjalne Kontakty Telefoniczne: ${conversionTotals.click_to_call.toLocaleString()}`);
      console.log(`   - Potencjalne Kontakty Email: ${conversionTotals.lead.toLocaleString()}`);
      console.log(`   - Kroki Rezerwacji: ${conversionTotals.booking_step_1.toLocaleString()}`);
      console.log(`   - Rezerwacje: ${conversionTotals.purchase.toLocaleString()}`);
      console.log(`   - Wartość Rezerwacji: ${conversionTotals.purchase_value.toFixed(2)} zł`);
      console.log(`   - Etap 2 Rezerwacji: ${conversionTotals.booking_step_2.toLocaleString()}`);

      const hasConversionData = conversionTotals.click_to_call > 0 || 
                              conversionTotals.lead > 0 || 
                              conversionTotals.purchase > 0;

      console.log('\n🎯 Test Result:');
      if (hasConversionData) {
        console.log('✅ SUCCESS: Reports page should now show REAL conversion data');
        console.log('✅ Status should be "Śledzenie Konwersji Aktywne"');
        console.log('✅ All conversion cards should show non-zero values');
      } else {
        console.log('❌ FAILURE: Still no conversion data processed');
        console.log('❌ Reports page will still show zeros');
      }

      console.log('\n🔗 URL to test:');
      console.log(`http://localhost:3000/reports?clientId=${havetClient.id}`);

    } else {
      console.log('❌ No campaigns found for Havet client');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testReportsConversionFix(); 