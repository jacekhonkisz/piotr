/**
 * AUDIT SCRIPT: Check weekly data in database
 * Run with: npx tsx scripts/audit-weekly-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function auditWeeklyData() {
  console.log('🔍 AUDITING WEEKLY DATA IN DATABASE...\n');
  
  // Get all clients
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('api_status', 'valid');
  
  if (clientError || !clients) {
    console.error('❌ Failed to get clients:', clientError);
    return;
  }
  
  for (const client of clients) {
    console.log(`\n📊 CLIENT: ${client.name} (${client.id.substring(0, 8)}...)`);
    console.log('=' .repeat(60));
    
    // Check Meta weekly summaries
    const { data: metaWeekly, error: metaError } = await supabase
      .from('campaign_summaries')
      .select('summary_date, total_spend, total_impressions, total_clicks, reservations, platform')
      .eq('client_id', client.id)
      .eq('summary_type', 'weekly')
      .eq('platform', 'meta')
      .order('summary_date', { ascending: false })
      .limit(10);
    
    console.log('\n🔵 META WEEKLY SUMMARIES (last 10 weeks):');
    if (metaWeekly && metaWeekly.length > 0) {
      metaWeekly.forEach(week => {
        const isMockup = week.total_spend === 1000 && week.total_impressions === 50000 && week.total_clicks === 1000;
        const flag = isMockup ? '⚠️ MOCKUP!' : '✅';
        console.log(`  ${flag} ${week.summary_date}: ${week.total_spend?.toFixed(2)} PLN, ${week.total_impressions} imp, ${week.total_clicks} clicks, ${week.reservations || 0} res`);
      });
    } else {
      console.log('  ❌ No Meta weekly data found');
    }
    
    // Check Google weekly summaries
    const { data: googleWeekly, error: googleError } = await supabase
      .from('campaign_summaries')
      .select('summary_date, total_spend, total_impressions, total_clicks, reservations, platform')
      .eq('client_id', client.id)
      .eq('summary_type', 'weekly')
      .eq('platform', 'google')
      .order('summary_date', { ascending: false })
      .limit(10);
    
    console.log('\n🔴 GOOGLE WEEKLY SUMMARIES (last 10 weeks):');
    if (googleWeekly && googleWeekly.length > 0) {
      googleWeekly.forEach(week => {
        const isMockup = week.total_spend === 1566 || (week.total_spend === 1000 && week.total_impressions === 50000);
        const flag = isMockup ? '⚠️ MOCKUP!' : '✅';
        console.log(`  ${flag} ${week.summary_date}: ${week.total_spend?.toFixed(2)} PLN, ${week.total_impressions} imp, ${week.total_clicks} clicks, ${week.reservations || 0} res`);
      });
    } else {
      console.log('  ❌ No Google weekly data found');
    }
    
    // Check current_week_cache
    const { data: weekCache, error: cacheError } = await supabase
      .from('current_week_cache')
      .select('period_id, last_updated, cache_data')
      .eq('client_id', client.id)
      .order('last_updated', { ascending: false })
      .limit(5);
    
    console.log('\n📦 CURRENT_WEEK_CACHE ENTRIES:');
    if (weekCache && weekCache.length > 0) {
      weekCache.forEach(cache => {
        const cacheData = cache.cache_data as any;
        const spend = cacheData?.stats?.totalSpend || 0;
        const impressions = cacheData?.stats?.totalImpressions || 0;
        const clicks = cacheData?.stats?.totalClicks || 0;
        const isMockup = spend === 1000 && impressions === 50000 && clicks === 1000;
        const flag = isMockup ? '⚠️ MOCKUP!' : '✅';
        console.log(`  ${flag} ${cache.period_id}: ${spend?.toFixed(2)} PLN, ${impressions} imp, ${clicks} clicks (updated: ${cache.last_updated})`);
      });
    } else {
      console.log('  ❌ No cache entries found');
    }
  }
  
  console.log('\n\n🔍 SUMMARY:');
  console.log('If you see ⚠️ MOCKUP! flags, that data needs to be refreshed.');
  console.log('Run: npx tsx scripts/refresh-weekly-data.ts to fix.');
}

auditWeeklyData().catch(console.error);

