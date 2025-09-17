const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllClientsConversion() {
  console.log('🔍 Checking all clients for conversion data...\n');

  try {
    // Get all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*');

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.error('❌ No clients found');
      return;
    }

    console.log(`📊 Found ${clients.length} clients\n`);

    for (const client of clients) {
      console.log(`🏨 Client: ${client.name} (${client.email})`);
      
      // Get campaigns for this client
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', client.id);

      if (campaignsError) {
        console.error('   ❌ Error fetching campaigns:', campaignsError);
        continue;
      }

      console.log(`   📊 Campaigns: ${campaigns?.length || 0}`);

      if (!campaigns || campaigns.length === 0) {
        console.log('   ⚠️  No campaigns found');
        console.log('');
        continue;
      }

      // Check for conversion data
      const hasConversionData = campaigns.some(campaign => 
        (campaign.click_to_call && campaign.click_to_call > 0) ||
        (campaign.lead && campaign.lead > 0) ||
        (campaign.purchase && campaign.purchase > 0) ||
        (campaign.booking_step_1 && campaign.booking_step_1 > 0) ||
        (campaign.booking_step_2 && campaign.booking_step_2 > 0) ||
        (campaign.booking_step_3 && campaign.booking_step_3 > 0)
      );

      if (hasConversionData) {
        console.log('   ✅ Has conversion data');
        
        // Show some sample data
        const sampleCampaign = campaigns.find(c => 
          (c.click_to_call && c.click_to_call > 0) ||
          (c.lead && c.lead > 0) ||
          (c.purchase && c.purchase > 0)
        );
        
        if (sampleCampaign) {
          console.log(`   📈 Sample data from campaign: ${sampleCampaign.campaign_name}`);
          console.log(`      - Click to Call: ${sampleCampaign.click_to_call || 0}`);
          console.log(`      - Lead: ${sampleCampaign.lead || 0}`);
          console.log(`      - Purchase: ${sampleCampaign.purchase || 0}`);
          console.log(`      - Booking Step 1: ${sampleCampaign.booking_step_1 || 0}`);
          console.log(`      - Booking Step 2: ${sampleCampaign.booking_step_2 || 0}`);
          console.log(`      - Booking Step 3: ${sampleCampaign.booking_step_3 || 0}`);
        }
      } else {
        console.log('   ❌ No conversion data found');
      }

      console.log('');
    }

    console.log('✅ Check complete!');

  } catch (error) {
    console.error('❌ Check error:', error);
  }
}

checkAllClientsConversion(); 