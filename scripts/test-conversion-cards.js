const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConversionCards() {
  console.log('🧪 Testing Conversion Cards with Real Data...\n');

  try {
    // Get the Havet client specifically
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'havet@magialubczyku.pl')
      .limit(1);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    if (!clients || clients.length === 0) {
      console.error('❌ No clients found');
      return;
    }

    const client = clients[0];
    console.log(`🏨 Testing with client: ${client.name} (${client.email})`);

    // Get campaigns for this client
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`📊 Found ${campaigns?.length || 0} campaigns`);

    if (!campaigns || campaigns.length === 0) {
      console.log('⚠️  No campaigns found for this client');
      return;
    }

    // Process conversion data (same logic as dashboard)
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

    // Calculate total spend
    const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);

    // Calculate ROAS and cost per reservation
    const roas = conversionTotals.purchase_value > 0 && totalSpend > 0 
      ? conversionTotals.purchase_value / totalSpend 
      : 0;
    const cost_per_reservation = conversionTotals.purchase > 0 && totalSpend > 0 
      ? totalSpend / conversionTotals.purchase 
      : 0;

    const conversionData = {
      ...conversionTotals,
      roas,
      cost_per_reservation
    };

    console.log('\n📊 CONVERSION CARDS DATA:');
    console.log('='.repeat(50));
    
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

    console.log('\n🎯 STATUS INDICATOR:');
    console.log('='.repeat(50));
    console.log('   - Title: "Śledzenie Konwersji Aktywne"');
    console.log('   - Description: "Pixel i Lead Ads są skonfigurowane i zbierają dane o konwersjach"');
    console.log('   - Status: ✅ Aktywne (green dot)');

    console.log('\n📋 SUMMARY:');
    console.log('='.repeat(50));
    console.log(`   - Total Campaigns: ${campaigns.length}`);
    console.log(`   - Total Spend: ${totalSpend.toFixed(2)} zł`);
    console.log(`   - Has Conversion Data: ${conversionData.click_to_call > 0 || conversionData.lead > 0 || conversionData.purchase > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`   - Dashboard Should Show: ${conversionData.click_to_call > 0 || conversionData.lead > 0 || conversionData.purchase > 0 ? 'Real Data' : 'Zeros'}`);

    // Check if we have any conversion data
    const hasConversionData = conversionData.click_to_call > 0 || conversionData.lead > 0 || conversionData.purchase > 0;
    
    if (hasConversionData) {
      console.log('\n✅ SUCCESS: Conversion tracking is working!');
      console.log('   The dashboard should now show real data instead of zeros.');
    } else {
      console.log('\n⚠️  WARNING: No conversion data found');
      console.log('   This could mean:');
      console.log('   1. The client has no conversion tracking set up');
      console.log('   2. The campaigns have no conversion data');
      console.log('   3. The data hasn\'t been fetched from Meta API yet');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testConversionCards(); 