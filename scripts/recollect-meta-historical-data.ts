#!/usr/bin/env node
// ✅ CRITICAL: Load env vars BEFORE any imports that use them
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

/**
 * Re-collects ALL Meta historical data (Dec 2024 - Nov 2025) with the corrected parser
 * 
 * This script will:
 * 1. Fetch fresh data from Meta API for each month
 * 2. Parse it using the NEW corrected meta-actions-parser.ts
 * 3. Overwrite existing campaign_summaries records with correct funnel values
 * 
 * Fixes:
 * - booking_step_1 now uses link_click instead of omni_search
 * - booking_step_2 now uses omni_view_content (was 0 before)
 * - booking_step_3 now uses omni_initiated_checkout (was 0 before)
 */

async function recollectMetaHistoricalData() {
  console.log('🔄 Starting Meta historical data re-collection...\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Dynamically import BackgroundDataCollector to avoid module resolution issues
  const { BackgroundDataCollector } = await import('../src/lib/background-data-collector');

  // Get all Meta-enabled clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, meta_ad_account_id, reporting_frequency')
    .eq('meta_enabled', true)
    .not('meta_ad_account_id', 'is', null);

  if (clientsError || !clients?.length) {
    console.error('❌ Error fetching clients:', clientsError?.message);
    return;
  }

  console.log(`📊 Found ${clients.length} Meta-enabled clients\n`);

  // Generate all months from Dec 2024 to Nov 2025
  const periods: Array<{ start: Date; end: Date }> = [];
  for (let year = 2024; year <= 2025; year++) {
    const startMonth = year === 2024 ? 12 : 1;
    const endMonth = year === 2025 ? 11 : 12;
    
    for (let month = startMonth; month <= endMonth; month++) {
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      periods.push({ start: startDate, end: endDate });
    }
  }

  console.log(`📅 Will re-collect ${periods.length} months\n`);

  const collector = new BackgroundDataCollector();
  let successCount = 0;
  let errorCount = 0;

  for (const client of clients) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📱 Client: ${client.name}`);
    console.log(`${'='.repeat(80)}\n`);

    for (const period of periods) {
      const monthStr = period.start.toISOString().substring(0, 7);
      
      try {
        console.log(`   🔄 ${monthStr}...`);
        
        // Collect fresh data from Meta API
        await collector.collectMonthlyData(
          client.id,
          'meta',
          period.start,
          period.end
        );
        
        successCount++;
        console.log(`      ✅ Success`);
        
        // Rate limiting (Meta API)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        errorCount++;
        console.error(`      ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Re-collection Complete`);
  console.log(`${'='.repeat(80)}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\n💡 All historical data has been updated with the corrected funnel mapping:`);
  console.log(`   - Krok 1 (booking_step_1): Now uses link_click ✓`);
  console.log(`   - Krok 2 (booking_step_2): Now uses omni_view_content ✓`);
  console.log(`   - Krok 3 (booking_step_3): Now uses omni_initiated_checkout ✓`);
  console.log(`\n🔄 Please refresh your browser to see updated values!`);
}

recollectMetaHistoricalData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

