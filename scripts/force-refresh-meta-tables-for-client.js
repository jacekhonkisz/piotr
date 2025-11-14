/**
 * Force refresh meta tables for a specific client
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceRefreshMetaTables() {
  const clientId = 'f0cf586c-402a-4466-9722-d8fd62f22dcb'; // Apartamenty Lambert
  
  console.log('🔄 Force refreshing meta tables for client:', clientId);
  
  // Get client
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  if (!client) {
    console.error('❌ Client not found');
    return;
  }
  
  console.log('Client:', client.name);
  console.log('Has Meta token:', !!client.meta_access_token);
  console.log('Has Ad Account:', !!client.ad_account_id);
  
  if (!client.meta_access_token || !client.ad_account_id) {
    console.error('❌ Client missing Meta credentials');
    return;
  }
  
  // Import Meta API service
  const { MetaAPIService } = require('../src/lib/meta-api-optimized.ts');
  const metaService = new MetaAPIService(client.meta_access_token);
  
  const adAccountId = client.ad_account_id.startsWith('act_') 
    ? client.ad_account_id.substring(4)
    : client.ad_account_id;
  
  const dateStart = '2025-11-01';
  const dateEnd = '2025-11-30';
  
  console.log('\n📊 Fetching meta tables from Meta API...');
  
  try {
    const [placementData, demographicData, adRelevanceData] = await Promise.all([
      metaService.getPlacementPerformance(adAccountId, dateStart, dateEnd),
      metaService.getDemographicPerformance(adAccountId, dateStart, dateEnd),
      metaService.getAdRelevanceResults(adAccountId, dateStart, dateEnd)
    ]);
    
    console.log('\n✅ Meta API returned:');
    console.log('  Demographics:', demographicData.length);
    console.log('  Placement:', placementData.length);
    console.log('  Ad Relevance:', adRelevanceData.length);
    
    if (demographicData.length === 0) {
      console.log('\n⚠️ Meta API returned ZERO demographics!');
      console.log('This means there is no demographic data available from Meta for this period.');
      console.log('Possible reasons:');
      console.log('1. No active campaigns in November 2025');
      console.log('2. Campaigns don\'t have demographic breakdown enabled');
      console.log('3. Meta API token doesn\'t have permissions');
    } else {
      console.log('\n✅ Meta API HAS demographics! Now updating cache...');
      
      // Get current cache
      const { data: cacheData } = await supabase
        .from('current_month_cache')
        .select('*')
        .eq('client_id', clientId)
        .eq('period_id', '2025-11')
        .single();
      
      if (cacheData) {
        // Update cache with metaTables
        const updatedCacheData = {
          ...cacheData.cache_data,
          metaTables: {
            placementPerformance: placementData,
            demographicPerformance: demographicData,
            adRelevanceResults: adRelevanceData
          }
        };
        
        const { error: updateError } = await supabase
          .from('current_month_cache')
          .update({
            cache_data: updatedCacheData,
            last_updated: new Date().toISOString()
          })
          .eq('client_id', clientId)
          .eq('period_id', '2025-11');
        
        if (updateError) {
          console.error('❌ Failed to update cache:', updateError);
        } else {
          console.log('✅ Cache updated successfully!');
          console.log('Now reload the page and demographics should appear.');
        }
      } else {
        console.log('⚠️ No cache found to update. Cache will be created on next dashboard load.');
      }
    }
    
  } catch (error) {
    console.error('❌ Meta API error:', error.message);
  }
}

forceRefreshMetaTables();

