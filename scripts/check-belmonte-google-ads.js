const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBelmonteGoogleAds() {
  console.log('🔍 Checking Belmonte Google Ads configuration...\n');
  
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, email, google_ads_enabled, google_ads_customer_id, google_ads_refresh_token')
    .eq('email', 'belmonte@hotel.com')
    .single();
    
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('📊 Belmonte Client Status:');
  console.log('  Name:', client.name);
  console.log('  Email:', client.email);
  console.log('  Google Ads Enabled:', client.google_ads_enabled);
  console.log('  Has Customer ID:', !!client.google_ads_customer_id);
  console.log('  Customer ID:', client.google_ads_customer_id);
  console.log('  Has Refresh Token:', !!client.google_ads_refresh_token);
  
  if (!client.google_ads_enabled) {
    console.log('\n🔧 ISSUE FOUND: google_ads_enabled is FALSE!');
    console.log('   This is why you\'re getting the "Google Ads not enabled for this client" error.');
    console.log('   We need to set google_ads_enabled = true for Belmonte.');
  } else if (!client.google_ads_customer_id) {
    console.log('\n🔧 ISSUE FOUND: google_ads_customer_id is missing!');
  } else {
    console.log('\n✅ Configuration looks correct');
  }
  
  return client;
}

checkBelmonteGoogleAds().catch(console.error);
