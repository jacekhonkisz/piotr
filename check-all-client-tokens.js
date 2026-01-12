/**
 * Check ALL client tokens and authentication status
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkClientTokens() {
  console.log('🔐 CLIENT TOKEN STATUS CHECK');
  console.log('='.repeat(80));

  // Get all clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, meta_access_token, google_ads_customer_id, google_ads_refresh_token, google_ads_enabled')
    .order('name');

  // Get system settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['meta_system_user_token', 'google_ads_manager_refresh_token', 'google_ads_token_preference']);

  const metaSystemToken = settings?.find(s => s.key === 'meta_system_user_token')?.value;
  const googleManagerToken = settings?.find(s => s.key === 'google_ads_manager_refresh_token')?.value;
  const tokenPreference = settings?.find(s => s.key === 'google_ads_token_preference')?.value;

  console.log('\n📋 SYSTEM SETTINGS:');
  console.log(`   Meta System Token: ${metaSystemToken ? '✅ SET (' + metaSystemToken.substring(0, 20) + '...)' : '❌ NOT SET'}`);
  console.log(`   Google Manager Token: ${googleManagerToken ? '✅ SET (' + googleManagerToken.substring(0, 20) + '...)' : '❌ NOT SET'}`);
  console.log(`   Token Preference: ${tokenPreference}`);

  // Analyze which authentication method is being used
  console.log('\n🔐 AUTHENTICATION METHOD:');
  if (tokenPreference === 'system_user') {
    console.log('   Using SYSTEM USER tokens (centralized)');
    console.log('   - Meta: Uses meta_system_user_token for all clients');
    console.log('   - Google: Uses google_ads_manager_refresh_token for all clients');
  } else {
    console.log('   Using INDIVIDUAL client tokens');
  }

  console.log('\n👥 CLIENT STATUS:');
  console.log('='.repeat(80));

  let metaOk = 0;
  let metaIssue = 0;
  let googleOk = 0;
  let googleIssue = 0;

  clients?.forEach(client => {
    const hasMetaToken = !!client.meta_access_token;
    const hasGoogleId = !!client.google_ads_customer_id;
    const hasGoogleToken = !!client.google_ads_refresh_token;
    const googleEnabled = client.google_ads_enabled;

    // Determine effective auth status
    let metaStatus = hasMetaToken || metaSystemToken ? '✅' : '❌';
    let googleStatus = '❌';

    if (hasGoogleId) {
      if (tokenPreference === 'system_user' && googleManagerToken) {
        googleStatus = '✅ (system)';
        googleOk++;
      } else if (hasGoogleToken) {
        googleStatus = '✅ (individual)';
        googleOk++;
      } else {
        googleStatus = '⚠️ (no token)';
        googleIssue++;
      }
    } else {
      googleStatus = '➖ (not configured)';
    }

    if (metaStatus === '✅') metaOk++;
    else metaIssue++;

    console.log(`\n📍 ${client.name}`);
    console.log(`   Meta: ${metaStatus} | Token: ${hasMetaToken ? 'Yes' : 'No (using system)'}`);
    console.log(`   Google: ${googleStatus}`);
    console.log(`     - Customer ID: ${client.google_ads_customer_id || 'N/A'}`);
    console.log(`     - Individual Token: ${hasGoogleToken ? 'Yes' : 'No'}`);
    console.log(`     - Enabled: ${googleEnabled ? 'Yes' : 'No'}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log(`   Meta OK: ${metaOk} | Meta Issues: ${metaIssue}`);
  console.log(`   Google OK: ${googleOk} | Google Issues: ${googleIssue}`);

  // Check current month cache quality
  console.log('\n' + '='.repeat(80));
  console.log('📦 CACHE QUALITY CHECK (Current Month):');

  const currentMonth = new Date().toISOString().slice(0, 7);

  for (const client of clients || []) {
    // Get Meta cache
    const { data: metaCache } = await supabase
      .from('current_month_cache')
      .select('cache_data, last_updated')
      .eq('client_id', client.id)
      .eq('period_id', currentMonth)
      .single();

    // Get Google cache
    const { data: googleCache } = await supabase
      .from('google_ads_current_month_cache')
      .select('cache_data, last_updated')
      .eq('client_id', client.id)
      .eq('period_id', currentMonth)
      .single();

    const metaSpend = metaCache?.cache_data?.stats?.totalSpend || 0;
    const googleSpend = googleCache?.cache_data?.stats?.totalSpend || 0;
    const metaUpdated = metaCache?.last_updated ? new Date(metaCache.last_updated).toLocaleString() : 'Never';
    const googleUpdated = googleCache?.last_updated ? new Date(googleCache.last_updated).toLocaleString() : 'Never';

    const metaStatus = metaSpend > 0 ? '✅' : '⚠️';
    const googleStatus = googleSpend > 0 ? '✅' : (client.google_ads_customer_id ? '⚠️' : '➖');

    console.log(`\n📍 ${client.name}`);
    console.log(`   Meta:   ${metaStatus} Spend: ${metaSpend.toFixed(2)} | Updated: ${metaUpdated}`);
    console.log(`   Google: ${googleStatus} Spend: ${googleSpend.toFixed(2)} | Updated: ${googleUpdated}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Token check complete');
}

checkClientTokens().catch(console.error);

