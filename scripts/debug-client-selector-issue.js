const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugClientSelectorIssue() {
  console.log('🔍 Debugging Client Selector Issue\n');

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
      
      console.log(`   📊 API Response Status: ${response.status}`);
      console.log(`   📊 Campaigns Count: ${data.data?.campaigns?.length || 0}`);

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

        // Check if conversion data is present
        const hasConversionData = totalClickToCall > 0 || totalLead > 0 || totalPurchase > 0 || totalBookingStep1 > 0;
        console.log(`   🎯 Has Conversion Data: ${hasConversionData ? '✅ Yes' : '❌ No'}`);

        // Show sample campaign data
        if (campaigns.length > 0) {
          const firstCampaign = campaigns[0];
          console.log(`   🔍 Sample Campaign: ${firstCampaign.campaign_name}`);
          console.log(`      - Campaign ID: ${firstCampaign.campaign_id}`);
          console.log(`      - Click to Call: ${firstCampaign.click_to_call || 0}`);
          console.log(`      - Purchase: ${firstCampaign.purchase || 0}`);
          console.log(`      - Purchase Value: ${firstCampaign.purchase_value || 0}`);
          console.log(`      - Booking Step 1: ${firstCampaign.booking_step_1 || 0}`);
        }

      } else {
        console.log(`   ❌ No campaign data for ${name}`);
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
          console.log(`      ${index + 1}. ${client.name} (${client.email}) - ${client.ad_account_id}`);
        });
      }
    }

    // Check if there are any caching issues
    console.log('\n🔍 Checking for Caching Issues...');
    
    // Test if the dashboard is using cached data
    const cacheKey = `dashboard_cache_admin@example.com_v4`;
    console.log(`   🔍 Cache Key: ${cacheKey}`);
    
    // Check if the ClientSelector component is working
    console.log('\n🔍 Checking ClientSelector Component...');
    
    try {
      const fs = require('fs');
      const componentPath = 'src/components/ClientSelector.tsx';
      
      if (fs.existsSync(componentPath)) {
        const componentContent = fs.readFileSync(componentPath, 'utf8');
        
        // Check if the component has proper client loading
        const hasClientLoading = componentContent.includes('loadClients');
        const hasClientChange = componentContent.includes('onClientChange');
        const hasUserRoleCheck = componentContent.includes('userRole === \'admin\'');
        
        console.log(`   🔍 ClientSelector Features:`);
        console.log(`      - Client loading function: ${hasClientLoading ? '✅ Present' : '❌ Missing'}`);
        console.log(`      - Client change handler: ${hasClientChange ? '✅ Present' : '❌ Missing'}`);
        console.log(`      - User role check: ${hasUserRoleCheck ? '✅ Present' : '❌ Missing'}`);
      }
    } catch (error) {
      console.log('   ❌ Error checking ClientSelector component:', error.message);
    }

    console.log('\n✅ Client selector issue debug completed');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugClientSelectorIssue(); 