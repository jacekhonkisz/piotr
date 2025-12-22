const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const NEW_TOKEN = 'EAAJZBK7pnYW0BQILhmaJRsjgPOJMhPeNUdhatDTKuXTMd4keIPU26AZBOHen9CXwY9UZAu3XgpfCk9LiWoV831Ss3yHKZBGigOCGEZAC9buidimyHwKXZBd9En5k9QodQhCpxaWkEUNjGwYZAsSljSsD8xZBIlvgNrzUFqYLZAIEFwhK5WoyKcRs1Tmy759JtgDKuvwZDZD';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateSystemToken() {
  console.log('🔧 Updating System Token in Database\n');

  try {
    // Update in settings table
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .upsert({
        key: 'meta_system_user_token',
        value: NEW_TOKEN,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (settingsError) {
      console.log(`❌ Error updating settings table: ${settingsError.message}`);
      return false;
    }

    console.log('✅ Token updated in settings table');

    // Also check if there's a system_settings table
    const { data: systemSettingsData, error: systemSettingsError } = await supabase
      .from('system_settings')
      .upsert({
        key: 'meta_system_user_token',
        value: NEW_TOKEN,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();

    if (systemSettingsError) {
      // This is OK - system_settings table might not exist
      console.log('ℹ️  system_settings table not found (this is OK)');
    } else {
      console.log('✅ Token updated in system_settings table');
    }

    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('settings')
      .select('key, value, updated_at')
      .eq('key', 'meta_system_user_token')
      .single();

    if (verifyData) {
      console.log('\n✅ Verification:');
      console.log(`   Key: ${verifyData.key}`);
      console.log(`   Token preview: ${verifyData.value.substring(0, 30)}...`);
      console.log(`   Updated at: ${verifyData.updated_at}`);
    }

    return true;

  } catch (error) {
    console.log(`❌ Error updating database: ${error.message}`);
    return false;
  }
}

updateSystemToken()
  .then(success => {
    if (success) {
      console.log('\n✅ Token successfully updated in database!');
      console.log('\n⚠️  IMPORTANT: Ad account 2043974886396316 needs to be assigned to the System User.');
      console.log('   See instructions in the output above.');
    }
  })
  .catch(console.error);

