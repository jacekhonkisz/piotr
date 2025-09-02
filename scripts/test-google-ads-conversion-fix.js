#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConversionFix() {
  console.log('🔍 TESTING GOOGLE ADS CONVERSION METRICS FIX\n');
  
  try {
    // Get Belmonte client
    const { data: belmonteClient } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', '%belmonte%')
      .single();
      
    if (!belmonteClient) {
      console.log('❌ Belmonte client not found');
      return;
    }
    
    console.log(`📊 Testing conversion metrics for: ${belmonteClient.name}`);
    
    // Get Belmonte Google Ads campaigns
    const { data: campaigns } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', belmonteClient.id);
      
    if (!campaigns || campaigns.length === 0) {
      console.log('❌ No campaigns found');
      return;
    }
    
    console.log(`\n📈 Found ${campaigns.length} campaigns`);
    
    // Test the conversion function
    try {
      const { convertGoogleCampaignToUnified, calculatePlatformTotals } = require('../src/lib/unified-campaign-types');
      
      const unifiedCampaigns = campaigns.map(convertGoogleCampaignToUnified);
      const platformTotals = calculatePlatformTotals(unifiedCampaigns);
      
      console.log('\n📊 PLATFORM TOTALS CALCULATION:');
      console.log(`   Total Spend: ${platformTotals.totalSpend.toFixed(2)} PLN`);
      console.log(`   Total Impressions: ${platformTotals.totalImpressions.toLocaleString()}`);
      console.log(`   Total Clicks: ${platformTotals.totalClicks.toLocaleString()}`);
      console.log(`   Total Reservations: ${platformTotals.totalReservations}`);
      console.log(`   Total Reservation Value: ${platformTotals.totalReservationValue.toFixed(2)} PLN`);
      console.log(`   Total Phone Calls: ${platformTotals.totalPhoneCalls}`);
      console.log(`   Total Email Contacts: ${platformTotals.totalEmailContacts}`);
      console.log(`   Total Form Submissions: ${platformTotals.totalFormSubmissions}`);
      console.log(`   Total Booking Step 1: ${platformTotals.totalBookingStep1}`);
      console.log(`   Total Booking Step 2: ${platformTotals.totalBookingStep2}`);
      console.log(`   Average ROAS: ${platformTotals.averageRoas.toFixed(2)}`);
      
      console.log('\n🎯 EXPECTED REPORT VALUES AFTER FIX:');
      console.log('   Core metrics (should remain the same):');
      console.log(`      Spend: ${platformTotals.totalSpend.toFixed(2)} PLN`);
      console.log(`      Impressions: ${platformTotals.totalImpressions.toLocaleString()}`);
      console.log(`      Clicks: ${platformTotals.totalClicks.toLocaleString()}`);
      console.log(`      Reservations: ${platformTotals.totalReservations}`);
      
      console.log('\n   Conversion metrics (should now show values instead of dashes):');
      console.log(`      Potencjalne kontakty – telefon: ${platformTotals.totalPhoneCalls} (was: —)`);
      console.log(`      Potencjalne kontakty – e-mail: ${platformTotals.totalEmailContacts} (was: —)`);
      console.log(`      Kroki rezerwacji – Etap 1: ${platformTotals.totalBookingStep1} (was: —)`);
      console.log(`      Wartość rezerwacji: ${platformTotals.totalReservationValue.toFixed(2)} PLN (was: —)`);
      console.log(`      ROAS: ${platformTotals.averageRoas.toFixed(2)}x (was: —)`);
      console.log(`      Etap 2 rezerwacji: ${platformTotals.totalBookingStep2} (was: —)`);
      
      console.log('\n✅ CONVERSION METRICS FIX VERIFICATION:');
      
      const hasPhoneCalls = platformTotals.totalPhoneCalls > 0;
      const hasEmailContacts = platformTotals.totalEmailContacts > 0;
      const hasBookingStep1 = platformTotals.totalBookingStep1 > 0;
      const hasReservationValue = platformTotals.totalReservationValue > 0;
      const hasRoas = platformTotals.averageRoas > 0;
      const hasBookingStep2 = platformTotals.totalBookingStep2 > 0;
      
      console.log(`   Phone calls will show: ${hasPhoneCalls ? '✅ VALUE' : '⚠️ DASH (0 value)'}`);
      console.log(`   Email contacts will show: ${hasEmailContacts ? '✅ VALUE' : '⚠️ DASH (0 value)'}`);
      console.log(`   Booking Step 1 will show: ${hasBookingStep1 ? '✅ VALUE' : '⚠️ DASH (0 value)'}`);
      console.log(`   Reservation value will show: ${hasReservationValue ? '✅ VALUE' : '⚠️ DASH (0 value)'}`);
      console.log(`   ROAS will show: ${hasRoas ? '✅ VALUE' : '⚠️ DASH (0 value)'}`);
      console.log(`   Booking Step 2 will show: ${hasBookingStep2 ? '✅ VALUE' : '⚠️ DASH (0 value)'}`);
      
      if (hasPhoneCalls && hasEmailContacts && hasBookingStep1 && hasReservationValue && hasRoas) {
        console.log('\n🎉 PERFECT! All conversion metrics have values and should display in the report.');
        console.log('   The hardcoded 0 values have been replaced with actual platform totals.');
        console.log('   Generate a new report to see the conversion metrics instead of dashes.');
      } else {
        console.log('\n⚠️ Some conversion metrics are 0, so they will still show dashes.');
        console.log('   This is expected behavior - dashes indicate 0 or missing values.');
      }
      
    } catch (conversionError) {
      console.log('❌ Conversion error:', conversionError.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testConversionFix().catch(console.error);
