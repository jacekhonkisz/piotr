const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditConversionDashboardFlow() {
  console.log('🔍 Auditing Conversion Dashboard Flow\n');

  try {
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

    // Get admin session
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get admin session:', sessionError);
      return;
    }

    console.log('\n🔐 Admin session obtained');

    // Use a valid date range (August 2025 - current month)
    const dateRange = {
      start: '2025-08-01',
      end: '2025-08-07' // Use a past date
    };

    console.log(`\n📅 Testing date range: ${dateRange.start} to ${dateRange.end}`);

    // Test dashboard API flow for both clients
    const clients = [
      { name: 'Belmonte Hotel', client: belmonteClient },
      { name: 'Havet', client: havetClient }
    ];

    for (const { name, client } of clients) {
      console.log(`\n🏨 Testing ${name} Dashboard Flow...`);
      
      // Simulate the dashboard API call
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
      
      console.log(`   📊 API Response Status: ${response.status}`);
      console.log(`   📊 Campaigns Count: ${data.data?.campaigns?.length || 0}`);

      if (data.data?.campaigns && data.data.campaigns.length > 0) {
        // Process campaigns like the dashboard does
        const campaigns = data.data.campaigns;
        
        // Calculate conversion tracking totals (like dashboard does)
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

        console.log(`\n   📈 ${name} - Dashboard Conversion Data:`);
        console.log(`   📱 Row 1 - Conversion Tracking Cards:`);
        console.log(`      - Potencjalne Kontakty Telefoniczne: ${totalClickToCall.toLocaleString()}`);
        console.log(`      - Potencjalne Kontakty Email: ${totalLead.toLocaleString()}`);
        console.log(`      - Kroki Rezerwacji: ${totalBookingStep1.toLocaleString()}`);
        console.log(`      - Rezerwacje: ${totalPurchase.toLocaleString()}`);
        
        console.log(`\n   📱 Row 2 - Conversion Metrics:`);
        console.log(`      - Wartość Rezerwacji: ${totalPurchaseValue.toFixed(2)} zł`);
        console.log(`      - ROAS: ${roas.toFixed(2)}x`);
        console.log(`      - Koszt per Rezerwacja: ${costPerReservation.toFixed(2)} zł`);
        console.log(`      - Etap 2 Rezerwacji: ${totalBookingStep2.toLocaleString()}`);

        // Check if conversion data is present in campaigns
        const campaignsWithConversions = campaigns.filter(campaign => 
          (campaign.click_to_call && campaign.click_to_call > 0) ||
          (campaign.lead && campaign.lead > 0) ||
          (campaign.purchase && campaign.purchase > 0) ||
          (campaign.booking_step_1 && campaign.booking_step_1 > 0)
        );

        console.log(`\n   🎯 Campaigns with Conversion Data: ${campaignsWithConversions.length}/${campaigns.length}`);

        if (campaignsWithConversions.length > 0) {
          console.log(`   ✅ ${name} has conversion tracking data`);
        } else {
          console.log(`   ❌ ${name} has no conversion tracking data in API response`);
        }

        // Check if conversion fields are present in campaign objects
        const firstCampaign = campaigns[0];
        const hasConversionFields = firstCampaign && (
          'click_to_call' in firstCampaign ||
          'lead' in firstCampaign ||
          'purchase' in firstCampaign ||
          'booking_step_1' in firstCampaign
        );

        console.log(`   🔍 Conversion fields in campaign objects: ${hasConversionFields ? '✅ Present' : '❌ Missing'}`);

        // Show sample campaign data
        if (firstCampaign) {
          console.log(`\n   🔍 Sample Campaign Data (${firstCampaign.campaign_name}):`);
          console.log(`      - Click to Call: ${firstCampaign.click_to_call || 0}`);
          console.log(`      - Lead: ${firstCampaign.lead || 0}`);
          console.log(`      - Purchase: ${firstCampaign.purchase || 0}`);
          console.log(`      - Purchase Value: ${firstCampaign.purchase_value || 0}`);
          console.log(`      - Booking Step 1: ${firstCampaign.booking_step_1 || 0}`);
          console.log(`      - Booking Step 2: ${firstCampaign.booking_step_2 || 0}`);
          console.log(`      - Booking Step 3: ${firstCampaign.booking_step_3 || 0}`);
        }

      } else {
        console.log(`   ❌ No campaign data returned for ${name}`);
      }
    }

    // Test the dashboard client selection logic
    console.log('\n🔍 Testing Dashboard Client Selection Logic...');
    
    // Get admin user
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'admin@example.com')
      .single();

    if (adminUser) {
      console.log(`   👤 Admin User: ${adminUser.email} (${adminUser.role})`);
      
      // Get all clients for this admin
      const { data: adminClients } = await supabase
        .from('clients')
        .select('*')
        .eq('admin_id', adminUser.id);

      if (adminClients && adminClients.length > 0) {
        console.log(`   📋 Admin has ${adminClients.length} clients:`);
        adminClients.forEach((client, index) => {
          console.log(`      ${index + 1}. ${client.name} (${client.email})`);
        });

        // Check the hardcoded preference logic
        const clientWithData = adminClients.find(client => {
          return client.email === 'havet@magialubczyku.pl';
        });

        if (clientWithData) {
          console.log(`   🎯 Dashboard will prefer: ${clientWithData.name} (hardcoded preference)`);
        } else {
          console.log(`   🎯 Dashboard will use: ${adminClients[0].name} (first client)`);
        }
      }
    }

    console.log('\n✅ Conversion dashboard flow audit completed');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditConversionDashboardFlow(); 