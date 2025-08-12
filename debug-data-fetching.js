const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function debugDataFetching() {
  console.log('🔍 Debugging Data Fetching Issues');
  console.log('='.repeat(50));

  try {
    // 1. Check if we have any cached data
    console.log('\n📊 Checking current month cache...');
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('period_id', '2025-08');

    if (cacheError) {
      console.log('❌ Cache query error:', cacheError);
    } else {
      console.log('✅ Cache query successful');
      console.log('📊 Cache entries found:', cacheData?.length || 0);
      
      if (cacheData && cacheData.length > 0) {
        cacheData.forEach(entry => {
          console.log(`   - Client: ${entry.client_id}`);
          console.log(`   - Period: ${entry.period_id}`);
          console.log(`   - Last Updated: ${entry.last_updated}`);
          console.log(`   - Campaigns: ${entry.cache_data?.campaigns?.length || 0}`);
        });
      }
    }

    // 2. Check client data
    console.log('\n👤 Checking client data...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .limit(5);

    if (clientError) {
      console.log('❌ Client query error:', clientError);
    } else {
      console.log('✅ Client query successful');
      console.log('📊 Clients found:', clients?.length || 0);
      
      if (clients && clients.length > 0) {
        clients.forEach(client => {
          console.log(`   - ID: ${client.id}`);
          console.log(`   - Name: ${client.name}`);
          console.log(`   - Email: ${client.email}`);
          console.log(`   - Has Meta Token: ${!!client.meta_access_token}`);
          console.log(`   - Has Ad Account: ${!!client.ad_account_id}`);
        });
      }
    }

    // 3. Check campaign summaries
    console.log('\n📈 Checking campaign summaries...');
    const { data: summaries, error: summaryError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('period_id', '2025-08')
      .limit(5);

    if (summaryError) {
      console.log('❌ Summary query error:', summaryError);
    } else {
      console.log('✅ Summary query successful');
      console.log('📊 Summaries found:', summaries?.length || 0);
      
      if (summaries && summaries.length > 0) {
        summaries.forEach(summary => {
          console.log(`   - Client: ${summary.client_id}`);
          console.log(`   - Period: ${summary.period_id}`);
          console.log(`   - Campaigns: ${summary.campaigns?.length || 0}`);
          console.log(`   - Total Spend: ${summary.total_spend || 0}`);
        });
      }
    }

    // 4. Check if there are any campaigns for August
    console.log('\n🎯 Checking for August campaigns...');
    const { data: augustCampaigns, error: campaignError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .like('period_id', '2025-08%');

    if (campaignError) {
      console.log('❌ Campaign query error:', campaignError);
    } else {
      console.log('✅ Campaign query successful');
      console.log('📊 August campaigns found:', augustCampaigns?.length || 0);
      
      if (augustCampaigns && augustCampaigns.length > 0) {
        augustCampaigns.forEach(campaign => {
          console.log(`   - Client: ${campaign.client_id}`);
          console.log(`   - Period: ${campaign.period_id}`);
          console.log(`   - Campaigns: ${campaign.campaigns?.length || 0}`);
        });
      }
    }

    console.log('\n🔍 Analysis:');
    console.log('='.repeat(30));
    
    if (!cacheData || cacheData.length === 0) {
      console.log('❌ No cached data found for August 2025');
      console.log('💡 This means the smart cache has not been populated yet');
    }
    
    if (!clients || clients.length === 0) {
      console.log('❌ No clients found in database');
    } else {
      const clientsWithMeta = clients.filter(c => c.meta_access_token && c.ad_account_id);
      console.log(`✅ Found ${clientsWithMeta.length} clients with Meta credentials`);
    }
    
    if (!augustCampaigns || augustCampaigns.length === 0) {
      console.log('❌ No August campaign data found');
      console.log('💡 This suggests the Meta API is not returning data for August 2025');
    }

    console.log('\n🎯 Recommendations:');
    console.log('1. Check if Meta API is returning data for August 2025');
    console.log('2. Verify client Meta credentials are valid');
    console.log('3. Check if campaigns are active in August 2025');
    console.log('4. Manually trigger a cache refresh for current month');

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugDataFetching(); 