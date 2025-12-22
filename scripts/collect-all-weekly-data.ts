/**
 * COLLECT ALL WEEKLY DATA
 * 
 * Runs background data collection for ALL clients to populate historical weekly data.
 * This script collects the last 52 weeks of Meta Ads data for all active clients.
 * 
 * Run with: npx tsx scripts/collect-all-weekly-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Import the BackgroundDataCollector
async function collectAllWeeklyData() {
  console.log('🚀 STARTING WEEKLY DATA COLLECTION FOR ALL CLIENTS');
  console.log('=' .repeat(60));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');
  
  try {
    // Dynamically import the BackgroundDataCollector
    const { BackgroundDataCollector } = await import('../src/lib/background-data-collector');
    
    // Get the singleton instance
    const collector = BackgroundDataCollector.getInstance();
    
    // Get all clients first to show progress
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, meta_access_token, google_ads_customer_id')
      .eq('api_status', 'valid');
    
    if (clientError || !clients) {
      console.error('❌ Failed to get clients:', clientError);
      return;
    }
    
    console.log(`📊 Found ${clients.length} active clients:\n`);
    clients.forEach((client, index) => {
      const hasMeta = !!client.meta_access_token;
      const hasGoogle = !!client.google_ads_customer_id;
      console.log(`  ${index + 1}. ${client.name} (Meta: ${hasMeta ? '✅' : '❌'}, Google: ${hasGoogle ? '✅' : '❌'})`);
    });
    
    console.log('\n' + '=' .repeat(60));
    console.log('📅 Collecting weekly summaries for all clients...');
    console.log('   This will collect 52 weeks of historical data.');
    console.log('   Please be patient, this may take several minutes per client.\n');
    
    // Run the weekly summary collection (no filter = all clients)
    await collector.collectWeeklySummaries();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ WEEKLY DATA COLLECTION COMPLETE!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Refresh the reports page');
    console.log('  2. Navigate to past weeks');
    console.log('  3. Verify real data is shown (not mockup)');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error during weekly data collection:', error);
    throw error;
  }
}

// Run the collection
collectAllWeeklyData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

