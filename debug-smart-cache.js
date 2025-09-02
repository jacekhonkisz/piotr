require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugSmartCache() {
  console.log('🔍 Debugging smart cache integration...');
  
  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
  const periodId = '2025-08';
  
  // 1. Check if daily_kpi_data exists
  console.log('\n1️⃣ Checking daily_kpi_data...');
  const { data: dailyData, error: dailyError } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', '2025-08-01')
    .lte('date', '2025-08-31');
    
  if (dailyError) {
    console.error('❌ Daily KPI error:', dailyError);
  } else {
    console.log(`✅ Daily KPI data: ${dailyData?.length || 0} records`);
    if (dailyData && dailyData.length > 0) {
      const totalReservations = dailyData.reduce((sum, record) => sum + (record.reservations || 0), 0);
      const totalValue = dailyData.reduce((sum, record) => sum + (record.reservation_value || 0), 0);
      console.log('   Total reservations:', totalReservations);
      console.log('   Total value:', totalValue, 'zł');
    }
  }
  
  // 2. Check current_month_cache
  console.log('\n2️⃣ Checking current_month_cache...');
  const { data: cacheData, error: cacheError } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', clientId)
    .eq('period_id', periodId);
    
  if (cacheError) {
    console.error('❌ Cache error:', cacheError);
  } else {
    console.log(`✅ Cache data: ${cacheData?.length || 0} records`);
    if (cacheData && cacheData.length > 0) {
      console.log('   Cache structure:', Object.keys(cacheData[0]));
      if (cacheData[0].cache_data) {
        const data = cacheData[0].cache_data;
        console.log('   Has conversionMetrics:', !!data.conversionMetrics);
        console.log('   Total conversions:', data.stats?.totalConversions);
        console.log('   Reservations:', data.conversionMetrics?.reservations);
      }
    }
  }
  
  // 3. Test the smart cache helper directly
  console.log('\n3️⃣ Testing smart cache helper logic...');
  console.log('   The issue might be in the fetchFreshCurrentMonthData function');
  console.log('   or the daily_kpi_data integration not being called properly');
}

debugSmartCache().catch(console.error); 