#!/usr/bin/env node

/**
 * Clear Belmonte cache for both Meta and Google Ads
 * This will force fresh fetch with the NEW parsers
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearBelmonteCache() {
  console.log('🧹 CLEARING BELMONTE CACHE (BOTH PLATFORMS)');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // Get Belmonte client
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%belmonte%')
      .limit(1);
    
    if (!clients || clients.length === 0) {
      console.error('❌ Belmonte client not found');
      return;
    }
    
    const client = clients[0];
    console.log(`✅ Client: ${client.name} (${client.id})\n`);
    
    const currentPeriod = new Date().toISOString().substring(0, 7);
    
    // Clear current month cache
    console.log('📋 Step 1: Clearing current_month_cache...');
    const { error: monthError, count: monthCount } = await supabase
      .from('current_month_cache')
      .delete({ count: 'exact' })
      .eq('client_id', client.id)
      .eq('period_id', currentPeriod);
    
    if (monthError) {
      console.error('❌ Error clearing month cache:', monthError.message);
    } else {
      console.log(`✅ Cleared ${monthCount || 0} current month cache entries\n`);
    }
    
    // Clear current week cache
    console.log('📋 Step 2: Clearing current_week_cache...');
    const { error: weekError, count: weekCount } = await supabase
      .from('current_week_cache')
      .delete({ count: 'exact' })
      .eq('client_id', client.id);
    
    if (weekError) {
      console.error('❌ Error clearing week cache:', weekError.message);
    } else {
      console.log(`✅ Cleared ${weekCount || 0} current week cache entries\n`);
    }
    
    // Verify cache is empty
    console.log('📋 Step 3: Verifying cache is empty...');
    const { data: verifyMonth } = await supabase
      .from('current_month_cache')
      .select('id')
      .eq('client_id', client.id)
      .eq('period_id', currentPeriod);
    
    const { data: verifyWeek } = await supabase
      .from('current_week_cache')
      .select('id')
      .eq('client_id', client.id);
    
    console.log(`Month cache entries: ${verifyMonth?.length || 0}`);
    console.log(`Week cache entries: ${verifyWeek?.length || 0}\n`);
    
    if ((verifyMonth?.length || 0) === 0 && (verifyWeek?.length || 0) === 0) {
      console.log('✅ Cache successfully cleared!\n');
    } else {
      console.log('⚠️  Some cache entries remain\n');
    }
    
    console.log('═══════════════════════════════════════════════════');
    console.log('✅ CACHE CLEAR COMPLETE');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log('🚀 NEXT STEPS:');
    console.log('1. Load Belmonte dashboard in browser');
    console.log('2. Switch to Meta Ads tab - verify funnel metrics appear');
    console.log('3. Switch to Google Ads tab - verify funnel metrics appear');
    console.log('4. Check that campaigns have DIFFERENT values (not all identical)');
    console.log('5. Run verification script: node scripts/diagnose-cache-structure.js');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

clearBelmonteCache();


