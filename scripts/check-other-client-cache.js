/**
 * Check if the client in the URL has cache data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkClientCache() {
  const clientId = 'f0cf586c-402a-4466-9722-d8fd62f22dcb'; // From URL
  
  console.log('🔍 Checking cache for client:', clientId);
  
  // Get client name
  const { data: client } = await supabase
    .from('clients')
    .select('name')
    .eq('id', clientId)
    .single();
  
  console.log('Client name:', client?.name || 'Unknown');
  
  // Check cache
  const { data: cacheData } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_id', '2025-11')
    .single();
  
  if (!cacheData) {
    console.log('\n❌ NO CACHE FOUND for this client in November 2025');
    console.log('This is why you see "Brak danych"!');
    return;
  }
  
  console.log('\n✅ Cache found');
  console.log('Has metaTables:', !!cacheData.cache_data?.metaTables);
  console.log('Demographics:', cacheData.cache_data?.metaTables?.demographicPerformance?.length || 0);
  console.log('Placement:', cacheData.cache_data?.metaTables?.placementPerformance?.length || 0);
  
  if (!cacheData.cache_data?.metaTables || 
      cacheData.cache_data.metaTables.demographicPerformance?.length === 0) {
    console.log('\n❌ This client has NO demographics in cache!');
    console.log('The cache needs to be populated for this client.');
  }
}

checkClientCache();

