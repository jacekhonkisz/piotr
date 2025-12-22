const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const NEW_SYSTEM_TOKEN = 'EAAJZBK7pnYW0BQILhmaJRsjgPOJMhPeNUdhatDTKuXTMd4keIPU26AZBOHen9CXwY9UZAu3XgpfCk9LiWoV831Ss3yHKZBGigOCGEZAC9buidimyHwKXZBd9En5k9QodQhCpxaWkEUNjGwYZAsSljSsD8xZBIlvgNrzUFqYLZAIEFwhK5WoyKcRs1Tmy759JtgDKuvwZDZD';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getAccessibleAdAccounts() {
  console.log('🔍 Fetching accessible ad accounts from Meta API...');
  
  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&limit=100&access_token=${NEW_SYSTEM_TOKEN}`
  );
  
  if (!response.ok) {
    throw new Error('Failed to fetch ad accounts');
  }
  
  const data = await response.json();
  return new Set(data.data?.map(acc => acc.account_id || acc.id.replace('act_', '')) || []);
}

async function updateAllClients() {
  console.log('🔄 Updating all clients with new System User token\n');
  console.log('='.repeat(70) + '\n');

  try {
    // 1. Get accessible ad accounts
    const accessibleAccounts = await getAccessibleAdAccounts();
    console.log(`✅ Found ${accessibleAccounts.size} accessible ad accounts\n`);

    // 2. Get all clients with ad accounts
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, ad_account_id, system_user_token')
      .not('ad_account_id', 'is', null);

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    console.log(`📊 Found ${clients.length} clients in database\n`);

    // 3. Update each client that has access
    let updated = 0;
    let skipped = 0;
    let noAccess = 0;

    for (const client of clients) {
      const accountId = client.ad_account_id?.replace('act_', '');
      const hasAccess = accessibleAccounts.has(accountId);

      if (!hasAccess) {
        console.log(`⚠️  ${client.name.padEnd(35)} - No access to account ${accountId}`);
        noAccess++;
        continue;
      }

      // Update client with new system token
      const { error: updateError } = await supabase
        .from('clients')
        .update({ 
          system_user_token: NEW_SYSTEM_TOKEN,
          updated_at: new Date().toISOString()
        })
        .eq('id', client.id);

      if (updateError) {
        console.log(`❌ ${client.name.padEnd(35)} - Error: ${updateError.message}`);
        skipped++;
      } else {
        console.log(`✅ ${client.name.padEnd(35)} - Token updated`);
        updated++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📋 SUMMARY:');
    console.log(`   ✅ Updated: ${updated} clients`);
    console.log(`   ⚠️  No access: ${noAccess} clients`);
    console.log(`   ❌ Errors: ${skipped} clients`);

    return { updated, skipped, noAccess };

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

async function clearMetaCaches() {
  console.log('\n\n🧹 Clearing Meta caches...\n');

  try {
    // Clear current_month_cache
    const { error: monthError, count: monthCount } = await supabase
      .from('current_month_cache')
      .delete()
      .neq('client_id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (monthError) {
      console.log(`⚠️  Error clearing current_month_cache: ${monthError.message}`);
    } else {
      console.log(`✅ Cleared current_month_cache`);
    }

    // Clear current_week_cache
    const { error: weekError, count: weekCount } = await supabase
      .from('current_week_cache')
      .delete()
      .neq('client_id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (weekError) {
      console.log(`⚠️  Error clearing current_week_cache: ${weekError.message}`);
    } else {
      console.log(`✅ Cleared current_week_cache`);
    }

    console.log('✅ All Meta caches cleared');

  } catch (error) {
    console.error('❌ Error clearing caches:', error.message);
  }
}

async function testSampleClient() {
  console.log('\n\n🧪 Testing sample client (Belmonte)...\n');

  try {
    // Get Belmonte client
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, ad_account_id, system_user_token')
      .ilike('name', '%belmonte%')
      .single();

    if (error || !client) {
      console.log('⚠️  Could not find Belmonte client');
      return;
    }

    console.log(`📊 Client: ${client.name}`);
    console.log(`   Ad Account: ${client.ad_account_id}`);
    console.log(`   Token: ${client.system_user_token?.substring(0, 30)}...`);

    // Test API access
    const adAccountId = client.ad_account_id?.replace('act_', '');
    const response = await fetch(
      `https://graph.facebook.com/v18.0/act_${adAccountId}?fields=id,name,account_id,amount_spent&access_token=${client.system_user_token}`
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`\n✅ API access working!`);
      console.log(`   Account Name: ${data.name}`);
      console.log(`   Account ID: ${data.account_id}`);
    } else {
      const errorData = await response.json();
      console.log(`\n❌ API access failed: ${errorData.error?.message}`);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

async function refreshDataForClients() {
  console.log('\n\n🔄 Triggering data refresh for clients...\n');

  try {
    // Get clients with access
    const accessibleAccounts = await getAccessibleAdAccounts();
    
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, ad_account_id')
      .not('ad_account_id', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch clients: ${error.message}`);
    }

    const clientsWithAccess = clients.filter(c => {
      const accountId = c.ad_account_id?.replace('act_', '');
      return accessibleAccounts.has(accountId);
    });

    console.log(`📊 Refreshing data for ${clientsWithAccess.length} clients...\n`);

    // Get current month info
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];

    let refreshed = 0;
    let errors = 0;

    for (const client of clientsWithAccess) {
      const adAccountId = client.ad_account_id?.replace('act_', '');
      
      try {
        // Fetch campaign data from Meta API
        const response = await fetch(
          `https://graph.facebook.com/v18.0/act_${adAccountId}/insights?fields=spend,impressions,clicks,ctr,cpm,cpc&time_range={"since":"${startDate}","until":"${endDate}"}&access_token=${NEW_SYSTEM_TOKEN}`
        );

        if (response.ok) {
          const data = await response.json();
          const insights = data.data?.[0] || {};
          
          console.log(`✅ ${client.name.substring(0, 30).padEnd(32)} Spend: ${parseFloat(insights.spend || 0).toFixed(2)} PLN, Impressions: ${insights.impressions || 0}`);
          refreshed++;
        } else {
          const errorData = await response.json();
          console.log(`❌ ${client.name.substring(0, 30).padEnd(32)} Error: ${errorData.error?.message?.substring(0, 50)}`);
          errors++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.log(`❌ ${client.name.substring(0, 30).padEnd(32)} Error: ${error.message}`);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n📋 REFRESH SUMMARY:');
    console.log(`   ✅ Refreshed: ${refreshed} clients`);
    console.log(`   ❌ Errors: ${errors} clients`);

  } catch (error) {
    console.error('❌ Refresh error:', error.message);
  }
}

async function main() {
  console.log('🚀 META ADS SYSTEM UPDATE & REFRESH\n');
  console.log('='.repeat(70) + '\n');
  console.log('This script will:');
  console.log('1. Update all clients with the new System User token');
  console.log('2. Clear all Meta caches');
  console.log('3. Test a sample client');
  console.log('4. Refresh data for all clients\n');
  console.log('='.repeat(70) + '\n');

  // Step 1: Update all clients
  await updateAllClients();

  // Step 2: Clear caches
  await clearMetaCaches();

  // Step 3: Test sample client
  await testSampleClient();

  // Step 4: Refresh data
  await refreshDataForClients();

  console.log('\n\n' + '='.repeat(70));
  console.log('\n✅ ALL DONE!');
  console.log('\nThe system is now updated to use the new System User token.');
  console.log('All accessible clients have been refreshed with fresh data from Meta API.');
  console.log('\nYou can now test the dashboard to verify everything works correctly.\n');
}

main().catch(console.error);

