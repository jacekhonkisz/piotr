const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCurrentDashboardImplementation() {
  console.log('🔍 Testing Current Dashboard Implementation\n');

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

    // Test the actual dashboard page
    console.log('\n🌐 Testing Dashboard Page Access...');
    
    const dashboardResponse = await fetch('http://localhost:3000/dashboard', {
      headers: {
        'Cookie': `sb-access-token=${session.access_token}; sb-refresh-token=${session.refresh_token}`
      }
    });

    console.log(`   📊 Dashboard Response Status: ${dashboardResponse.status}`);
    
    if (dashboardResponse.ok) {
      console.log('   ✅ Dashboard page accessible');
    } else {
      console.log('   ❌ Dashboard page not accessible');
    }

    // Test both clients individually
    const clients = [
      { name: 'Belmonte Hotel', email: 'belmonte@hotel.com' },
      { name: 'Havet', email: 'havet@magialubczyku.pl' }
    ];

    for (const { name, email } of clients) {
      console.log(`\n🏨 Testing ${name} Dashboard Data...`);
      
      // Get client data
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('email', email)
        .single();

      if (!client) {
        console.log(`   ❌ Client not found: ${email}`);
        continue;
      }

      // Test API call for this specific client
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId: client.id,
          dateRange: {
            start: '2025-08-01',
            end: '2025-08-07'
          }
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

        // Check if conversion fields are present in campaign objects
        const firstCampaign = campaigns[0];
        const hasConversionFields = firstCampaign && (
          'click_to_call' in firstCampaign ||
          'lead' in firstCampaign ||
          'purchase' in firstCampaign ||
          'booking_step_1' in firstCampaign
        );
        console.log(`   🔍 Conversion Fields Present: ${hasConversionFields ? '✅ Yes' : '❌ No'}`);

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
          console.log(`      ${index + 1}. ${client.name} (${client.email})`);
        });

        // Check the hardcoded preference logic
        const clientWithData = adminClients.find(client => {
          return client.email === 'havet@magialubczyku.pl';
        });

        if (clientWithData) {
          console.log(`   🎯 Dashboard will prefer: ${clientWithData.name} (hardcoded preference)`);
          console.log(`   ⚠️  This means admin users will always see Havet's data`);
        } else {
          console.log(`   🎯 Dashboard will use: ${adminClients[0].name} (first client)`);
        }
      }
    }

    // Test if conversion cards component exists
    console.log('\n🔍 Testing Conversion Cards Component...');
    
    try {
      const conversionCardsResponse = await fetch('http://localhost:3000/api/components/DashboardConversionCards', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      console.log(`   📊 Conversion Cards Component Status: ${conversionCardsResponse.status}`);
    } catch (error) {
      console.log('   ℹ️  Conversion Cards Component not accessible via API (expected)');
    }

    console.log('\n✅ Current dashboard implementation test completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCurrentDashboardImplementation(); 