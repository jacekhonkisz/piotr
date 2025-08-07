const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConversionsBelmonteHavet() {
  console.log('🔍 Testing Conversion Data for Belmonte and Havet\n');

  try {
    // Get both clients
    const { data: belmonteClient, error: belmonteError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'belmonte@hotel.com')
      .single();

    const { data: havetClient, error: havetError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'havet@magialubczyku.pl')
      .single();

    if (belmonteError || !belmonteClient) {
      console.error('❌ Belmonte client not found:', belmonteError);
      return;
    }

    if (havetError || !havetClient) {
      console.error('❌ Havet client not found:', havetError);
      return;
    }

    console.log('📋 Client Information:');
    console.log('🏨 Belmonte Hotel:');
    console.log(`   ID: ${belmonteClient.id}`);
    console.log(`   Ad Account: ${belmonteClient.ad_account_id}`);
    
    console.log('\n🏨 Havet:');
    console.log(`   ID: ${havetClient.id}`);
    console.log(`   Ad Account: ${havetClient.ad_account_id}`);

    // Get admin session for API testing
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get admin session:', sessionError);
      return;
    }

    console.log('\n🔐 Admin session obtained');

    // Test conversion data for both clients
    const testDateRange = {
      start: '2025-08-01',
      end: '2025-08-07'
    };

    console.log('\n🌐 Testing Conversion Data...');

    // Test Belmonte conversions
    console.log('\n📊 Testing Belmonte Hotel conversions...');
    const belmonteResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: belmonteClient.id,
        dateRange: testDateRange
      })
    });

    console.log(`   Belmonte Response Status: ${belmonteResponse.status}`);
    
    if (belmonteResponse.ok) {
      const belmonteData = await belmonteResponse.json();
      console.log('\n🏨 Belmonte Hotel Conversion Data:');
      console.log(`   Total Campaigns: ${belmonteData.data?.campaigns?.length || 0}`);
      console.log(`   Total Spend: ${belmonteData.data?.stats?.totalSpend || 0}`);
      console.log(`   Total Impressions: ${belmonteData.data?.stats?.totalImpressions || 0}`);
      console.log(`   Total Clicks: ${belmonteData.data?.stats?.totalClicks || 0}`);
      console.log(`   Total Conversions: ${belmonteData.data?.stats?.totalConversions || 0}`);
      
      // Conversion tracking metrics
      console.log('\n   📈 Conversion Tracking Metrics:');
      console.log(`   Click to Call: ${belmonteData.data?.stats?.totalClickToCall || 0}`);
      console.log(`   Lead Forms: ${belmonteData.data?.stats?.totalLead || 0}`);
      console.log(`   Purchases: ${belmonteData.data?.stats?.totalPurchase || 0}`);
      console.log(`   Purchase Value: ${belmonteData.data?.stats?.totalPurchaseValue || 0}`);
      console.log(`   Booking Step 1: ${belmonteData.data?.stats?.totalBookingStep1 || 0}`);
      console.log(`   Booking Step 2: ${belmonteData.data?.stats?.totalBookingStep2 || 0}`);
      console.log(`   Booking Step 3: ${belmonteData.data?.stats?.totalBookingStep3 || 0}`);
      console.log(`   ROAS: ${belmonteData.data?.stats?.roas || 0}`);
      console.log(`   Cost Per Reservation: ${belmonteData.data?.stats?.costPerReservation || 0}`);
    } else {
      const errorText = await belmonteResponse.text();
      console.log(`   ❌ Belmonte Error: ${errorText}`);
    }

    // Test Havet conversions
    console.log('\n📊 Testing Havet conversions...');
    const havetResponse = await fetch('http://localhost:3000/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: havetClient.id,
        dateRange: testDateRange
      })
    });

    console.log(`   Havet Response Status: ${havetResponse.status}`);
    
    if (havetResponse.ok) {
      const havetData = await havetResponse.json();
      console.log('\n🏨 Havet Conversion Data:');
      console.log(`   Total Campaigns: ${havetData.data?.campaigns?.length || 0}`);
      console.log(`   Total Spend: ${havetData.data?.stats?.totalSpend || 0}`);
      console.log(`   Total Impressions: ${havetData.data?.stats?.totalImpressions || 0}`);
      console.log(`   Total Clicks: ${havetData.data?.stats?.totalClicks || 0}`);
      console.log(`   Total Conversions: ${havetData.data?.stats?.totalConversions || 0}`);
      
      // Conversion tracking metrics
      console.log('\n   📈 Conversion Tracking Metrics:');
      console.log(`   Click to Call: ${havetData.data?.stats?.totalClickToCall || 0}`);
      console.log(`   Lead Forms: ${havetData.data?.stats?.totalLead || 0}`);
      console.log(`   Purchases: ${havetData.data?.stats?.totalPurchase || 0}`);
      console.log(`   Purchase Value: ${havetData.data?.stats?.totalPurchaseValue || 0}`);
      console.log(`   Booking Step 1: ${havetData.data?.stats?.totalBookingStep1 || 0}`);
      console.log(`   Booking Step 2: ${havetData.data?.stats?.totalBookingStep2 || 0}`);
      console.log(`   Booking Step 3: ${havetData.data?.stats?.totalBookingStep3 || 0}`);
      console.log(`   ROAS: ${havetData.data?.stats?.roas || 0}`);
      console.log(`   Cost Per Reservation: ${havetData.data?.stats?.costPerReservation || 0}`);
    } else {
      const errorText = await havetResponse.text();
      console.log(`   ❌ Havet Error: ${errorText}`);
    }

    console.log('\n✅ Conversion testing completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConversionsBelmonteHavet(); 