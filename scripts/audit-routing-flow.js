const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditRoutingFlow() {
  console.log('🔍 Auditing Complete Routing Flow: Meta API → Database → Dashboard\n');

  try {
    // Step 1: Check admin user and client assignment
    console.log('1️⃣ STEP 1: Admin User & Client Assignment');
    console.log('='.repeat(50));
    
    const adminUserId = '585b6abc-05ef-47aa-b289-e47a52ccdc6b'; // admin@example.com
    
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('admin_id', adminUserId);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    console.log(`📊 Admin has ${clients?.length || 0} clients assigned`);
    
    const havetClient = clients?.find(c => c.email === 'havet@magialubczyku.pl');
    if (havetClient) {
      console.log(`✅ Havet client found: ${havetClient.name} (ID: ${havetClient.id})`);
    } else {
      console.log('❌ Havet client not found for admin');
      return;
    }

    // Step 2: Check database campaigns with conversion data
    console.log('\n2️⃣ STEP 2: Database Campaigns with Conversion Data');
    console.log('='.repeat(50));
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', havetClient.id);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`📊 Found ${campaigns?.length || 0} campaigns in database`);
    
    if (campaigns && campaigns.length > 0) {
      const campaign = campaigns[0];
      console.log(`📈 Sample campaign: ${campaign.campaign_name}`);
      console.log(`   - Click to Call: ${campaign.click_to_call || 0}`);
      console.log(`   - Lead: ${campaign.lead || 0}`);
      console.log(`   - Purchase: ${campaign.purchase || 0}`);
      console.log(`   - Purchase Value: ${campaign.purchase_value || 0}`);
      console.log(`   - Booking Step 1: ${campaign.booking_step_1 || 0}`);
      console.log(`   - Booking Step 2: ${campaign.booking_step_2 || 0}`);
      console.log(`   - Booking Step 3: ${campaign.booking_step_3 || 0}`);
    }

    // Step 3: Simulate dashboard client loading logic
    console.log('\n3️⃣ STEP 3: Dashboard Client Loading Logic');
    console.log('='.repeat(50));
    
    // Simulate the fixed dashboard logic
    let selectedClient;
    
    if (clients && clients.length > 0) {
      // Try to find a client with conversion data first
      const clientWithData = clients.find(client => {
        return client.email === 'havet@magialubczyku.pl';
      });
      
      selectedClient = clientWithData || clients[0];
      console.log(`🎯 Selected client: ${selectedClient.name} (${selectedClient.email})`);
    } else {
      console.log('❌ No clients found for admin');
      return;
    }

    // Step 4: Simulate dashboard data processing
    console.log('\n4️⃣ STEP 4: Dashboard Data Processing');
    console.log('='.repeat(50));
    
    if (campaigns && campaigns.length > 0) {
      // Simulate the stats calculation
      const stats = campaigns.reduce((acc, campaign) => {
        acc.totalSpend += campaign.spend || 0;
        acc.totalImpressions += campaign.impressions || 0;
        acc.totalClicks += campaign.clicks || 0;
        acc.totalConversions += campaign.conversions || 0;
        return acc;
      }, {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0
      });

      const averageCtr = stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions) * 100 : 0;
      const averageCpc = stats.totalClicks > 0 ? stats.totalSpend / stats.totalClicks : 0;

      console.log('📊 Dashboard Stats:');
      console.log(`   - Total Spend: ${stats.totalSpend.toFixed(2)} zł`);
      console.log(`   - Total Impressions: ${stats.totalImpressions.toLocaleString()}`);
      console.log(`   - Total Clicks: ${stats.totalClicks.toLocaleString()}`);
      console.log(`   - Total Conversions: ${stats.totalConversions.toLocaleString()}`);
      console.log(`   - Average CTR: ${averageCtr.toFixed(2)}%`);
      console.log(`   - Average CPC: ${averageCpc.toFixed(2)} zł`);

      // Simulate conversion data processing
      const conversionTotals = campaigns.reduce((acc, campaign) => ({
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

      // Calculate ROAS and cost per reservation
      const roas = conversionTotals.purchase_value > 0 && stats.totalSpend > 0 
        ? conversionTotals.purchase_value / stats.totalSpend 
        : 0;
      const cost_per_reservation = conversionTotals.purchase > 0 && stats.totalSpend > 0 
        ? stats.totalSpend / conversionTotals.purchase 
        : 0;

      const conversionData = {
        ...conversionTotals,
        roas,
        cost_per_reservation
      };

      console.log('\n📊 Conversion Data (Dashboard Should Display):');
      console.log('📱 Row 1 - Conversion Tracking Cards:');
      console.log(`   - Potencjalne Kontakty Telefoniczne: ${conversionData.click_to_call.toLocaleString()}`);
      console.log(`   - Potencjalne Kontakty Email: ${conversionData.lead.toLocaleString()}`);
      console.log(`   - Kroki Rezerwacji: ${conversionData.booking_step_1.toLocaleString()}`);
      console.log(`   - Rezerwacje: ${conversionData.purchase.toLocaleString()}`);
      
      console.log('\n📱 Row 2 - Conversion Metrics:');
      console.log(`   - Wartość Rezerwacji: ${conversionData.purchase_value.toFixed(2)} zł`);
      console.log(`   - ROAS: ${conversionData.roas.toFixed(2)}x`);
      console.log(`   - Koszt per Rezerwacja: ${conversionData.cost_per_reservation.toFixed(2)} zł`);
      console.log(`   - Etap 2 Rezerwacji: ${conversionData.booking_step_2.toLocaleString()}`);
    }

    // Step 5: Check if conversion data exists
    console.log('\n5️⃣ STEP 5: Conversion Data Verification');
    console.log('='.repeat(50));
    
    const hasConversionData = campaigns?.some(campaign => 
      (campaign.click_to_call && campaign.click_to_call > 0) ||
      (campaign.lead && campaign.lead > 0) ||
      (campaign.purchase && campaign.purchase > 0)
    );

    if (hasConversionData) {
      console.log('✅ Conversion data exists in database');
      console.log('✅ Dashboard should show real data');
      console.log('✅ Status should be "Śledzenie Konwersji Aktywne"');
    } else {
      console.log('❌ No conversion data found in database');
      console.log('❌ Dashboard will show zeros');
      console.log('❌ Status will be "Nie skonfigurowane"');
    }

    // Step 6: Summary
    console.log('\n6️⃣ STEP 6: Routing Flow Summary');
    console.log('='.repeat(50));
    
    console.log('🔗 Complete Flow:');
    console.log('   1. Meta API → Fetches conversion tracking data');
    console.log('   2. Database → Stores conversion data in campaigns table');
    console.log('   3. Dashboard → Loads client data (admin logic fixed)');
    console.log('   4. Dashboard → Processes conversion data from campaigns');
    console.log('   5. Dashboard → Displays conversion cards with real data');
    
    console.log('\n🎯 Expected Result:');
    if (hasConversionData) {
      console.log('✅ Dashboard should display real conversion data instead of zeros');
    } else {
      console.log('❌ Dashboard will display zeros (no conversion data available)');
    }

  } catch (error) {
    console.error('❌ Audit error:', error);
  }
}

auditRoutingFlow(); 