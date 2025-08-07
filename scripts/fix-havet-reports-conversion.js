const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixHavetReportsConversion() {
  console.log('🔧 Fixing Havet reports conversion data...\n');
  
  const havetClientId = '93d46876-addc-4b99-b1e1-437428dd54f1';
  
  try {
    // Step 1: Get campaigns with conversion data
    console.log('1️⃣ Getting campaigns with conversion data...');
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClientId);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`📊 Found ${campaigns?.length || 0} campaigns`);
    
    if (!campaigns || campaigns.length === 0) {
      console.log('❌ No campaigns found');
      return;
    }

    // Step 2: Get reports to update
    console.log('\n2️⃣ Getting reports to update...');
    
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', havetClientId);

    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
      return;
    }

    console.log(`📊 Found ${reports?.length || 0} reports to update`);
    
    if (!reports || reports.length === 0) {
      console.log('❌ No reports found');
      return;
    }

    // Step 3: Update each report with conversion data
    console.log('\n3️⃣ Updating reports with conversion data...');
    
    for (const report of reports) {
      console.log(`📝 Updating report: ${report.id}`);
      
      // Map campaigns data with conversion tracking fields
      const updatedCampaignData = campaigns.map(campaign => ({
        id: campaign.campaign_id,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name || 'Unknown Campaign',
        spend: parseFloat(campaign.spend || '0'),
        impressions: parseInt(campaign.impressions || '0'),
        clicks: parseInt(campaign.clicks || '0'),
        conversions: parseInt(campaign.conversions || '0'),
        ctr: parseFloat(campaign.ctr || '0'),
        cpc: parseFloat(campaign.cpc || '0'),
        // Add conversion tracking fields
        click_to_call: campaign.click_to_call || 0,
        lead: campaign.lead || 0,
        purchase: campaign.purchase || 0,
        purchase_value: campaign.purchase_value || 0,
        booking_step_1: campaign.booking_step_1 || 0,
        booking_step_2: campaign.booking_step_2 || 0,
        booking_step_3: campaign.booking_step_3 || 0,
        roas: campaign.roas || 0,
        cost_per_reservation: campaign.cost_per_reservation || 0
      }));

      // Update the report
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          campaign_data: updatedCampaignData,
          updated_at: new Date().toISOString()
        })
        .eq('id', report.id);

      if (updateError) {
        console.error(`❌ Error updating report ${report.id}:`, updateError);
      } else {
        console.log(`✅ Updated report ${report.id}`);
      }
    }

    // Step 4: Verify the update
    console.log('\n4️⃣ Verifying updates...');
    
    const { data: updatedReports, error: verifyError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', havetClientId)
      .order('generated_at', { ascending: false })
      .limit(1);

    if (verifyError) {
      console.error('❌ Error verifying updates:', verifyError);
      return;
    }

    if (updatedReports && updatedReports.length > 0) {
      const latestReport = updatedReports[0];
      
      if (latestReport.campaign_data && latestReport.campaign_data.length > 0) {
        const sampleCampaign = latestReport.campaign_data[0];
        
        console.log('📊 Verification - Sample campaign data:');
        console.log(`   - Campaign Name: ${sampleCampaign.campaign_name}`);
        console.log(`   - Click to Call: ${sampleCampaign.click_to_call || 0}`);
        console.log(`   - Lead: ${sampleCampaign.lead || 0}`);
        console.log(`   - Purchase: ${sampleCampaign.purchase || 0}`);
        console.log(`   - Purchase Value: ${sampleCampaign.purchase_value || 0}`);
        console.log(`   - Booking Step 1: ${sampleCampaign.booking_step_1 || 0}`);
        console.log(`   - ROAS: ${sampleCampaign.roas || 0}`);
        console.log(`   - Cost per Reservation: ${sampleCampaign.cost_per_reservation || 0}`);

        const hasConversionData = sampleCampaign.click_to_call > 0 || 
                                sampleCampaign.lead > 0 || 
                                sampleCampaign.purchase > 0;

        if (hasConversionData) {
          console.log('\n✅ SUCCESS: Reports now have conversion tracking data!');
          console.log('🎯 The reports page should now show real conversion data instead of zeros');
        } else {
          console.log('\n❌ WARNING: Still no conversion data in reports');
        }
      }
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Refresh the reports page in your browser');
    console.log('2. The conversion tracking should now show real data');
    console.log('3. URL: http://localhost:3000/reports?clientId=93d46876-addc-4b99-b1e1-437428dd54f1');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

fixHavetReportsConversion(); 