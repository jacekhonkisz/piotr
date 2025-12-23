#!/usr/bin/env node
/**
 * Debug current period data for Havet - what the Reports page sees
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugHavetCurrent() {
  console.log('\n🔍 Debugging Havet Current Month Data...\n');
  
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%havet%')
    .single();
    
  if (!clients) {
    console.error('❌ Havet not found');
    return;
  }
  
  console.log(`✅ Client: ${clients.name} (${clients.id})\n`);
  
  // Check current_month_cache - this is what Smart Cache uses
  const { data: monthCache } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', clients.id)
    .single();
    
  if (monthCache?.cache_data) {
    const data = monthCache.cache_data as any;
    console.log('📦 CURRENT_MONTH_CACHE:');
    console.log(`   Period: ${monthCache.period_id}`);
    console.log(`   Platform: ${monthCache.platform || 'unknown'}`);
    console.log(`\n   Stats:`);
    console.log(`     totalSpend: ${data.stats?.totalSpend?.toFixed(2)} zł`);
    console.log(`     totalImpressions: ${data.stats?.totalImpressions}`);
    console.log(`     totalClicks: ${data.stats?.totalClicks}`);
    console.log(`\n   Conversion Metrics:`);
    console.log(`     booking_step_1: ${data.conversionMetrics?.booking_step_1 ?? 'MISSING'}`);
    console.log(`     booking_step_2: ${data.conversionMetrics?.booking_step_2 ?? 'MISSING'}`);
    console.log(`     booking_step_3: ${data.conversionMetrics?.booking_step_3 ?? 'MISSING'}`);
    console.log(`     reservations: ${data.conversionMetrics?.reservations ?? 'MISSING'}`);
    console.log(`     reservation_value: ${data.conversionMetrics?.reservation_value ?? 'MISSING'}`);
    console.log(`     click_to_call: ${data.conversionMetrics?.click_to_call ?? 'MISSING'}`);
    console.log(`     email_contacts: ${data.conversionMetrics?.email_contacts ?? 'MISSING'}`);
    
    // Check individual campaigns
    const campaigns = data.campaigns || [];
    console.log(`\n   Campaigns (${campaigns.length}):`);
    
    let totalBooking1 = 0, totalBooking2 = 0, totalBooking3 = 0, totalRes = 0, totalResValue = 0;
    
    campaigns.forEach((c: any, i: number) => {
      totalBooking1 += c.booking_step_1 || 0;
      totalBooking2 += c.booking_step_2 || 0;
      totalBooking3 += c.booking_step_3 || 0;
      totalRes += c.reservations || 0;
      totalResValue += c.reservation_value || 0;
      
      if (c.booking_step_1 > 0 || c.reservations > 0) {
        console.log(`\n     Campaign #${i+1}: ${c.campaign_name || c.name}`);
        console.log(`       booking_step_1: ${c.booking_step_1}`);
        console.log(`       booking_step_2: ${c.booking_step_2}`);
        console.log(`       booking_step_3: ${c.booking_step_3}`);
        console.log(`       reservations: ${c.reservations}`);
        console.log(`       reservation_value: ${c.reservation_value}`);
      }
    });
    
    console.log(`\n   📊 Aggregated from campaigns:`);
    console.log(`     SUM booking_step_1: ${totalBooking1}`);
    console.log(`     SUM booking_step_2: ${totalBooking2}`);
    console.log(`     SUM booking_step_3: ${totalBooking3}`);
    console.log(`     SUM reservations: ${totalRes}`);
    console.log(`     SUM reservation_value: ${totalResValue}`);
  } else {
    console.log('❌ No current_month_cache found');
  }
  
  // Also check what's in campaign_summaries for December 2025
  console.log('\n\n📊 CAMPAIGN_SUMMARIES for December 2025:');
  
  const { data: summaries } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clients.id)
    .eq('platform', 'meta')
    .gte('summary_date', '2025-12-01')
    .lte('summary_date', '2025-12-31');
    
  if (summaries && summaries.length > 0) {
    summaries.forEach(s => {
      console.log(`\n   ${s.summary_type} - ${s.summary_date}:`);
      console.log(`     total_spend: ${s.total_spend?.toFixed(2)} zł`);
      console.log(`     booking_step_1: ${s.booking_step_1}`);
      console.log(`     booking_step_2: ${s.booking_step_2}`);
      console.log(`     booking_step_3: ${s.booking_step_3}`);
      console.log(`     reservations: ${s.reservations}`);
      console.log(`     reservation_value: ${s.reservation_value}`);
    });
  } else {
    console.log('   No December 2025 summaries found');
  }
}

debugHavetCurrent().catch(console.error);
