#!/usr/bin/env node
/**
 * TRIGGER GOOGLE ADS BACKFILL USING EXISTING INFRASTRUCTURE
 * 
 * This script uses the existing BackgroundDataCollector to backfill
 * Google Ads data for all clients.
 * 
 * Usage: npx tsx scripts/trigger-google-ads-backfill.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { BackgroundDataCollector } from '../src/lib/background-data-collector';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🚀 TRIGGERING GOOGLE ADS BACKFILL');
  console.log('='.repeat(80));
  console.log('Using existing BackgroundDataCollector infrastructure\n');
  
  try {
    // Get the collector instance
    const collector = BackgroundDataCollector.getInstance();
    
    // Get all clients with Google Ads
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, google_ads_customer_id, google_ads_enabled')
      .eq('google_ads_enabled', true)
      .not('google_ads_customer_id', 'is', null);
    
    if (error) {
      throw new Error(`Failed to fetch clients: ${error.message}`);
    }
    
    console.log(`✅ Found ${clients?.length || 0} clients with Google Ads enabled\n`);
    
    // Trigger collection for each client
    console.log('📊 Starting full historical collection (13 months)...');
    console.log('⚠️  This may take 30-60 minutes for all clients\n');
    
    // Use the collector's runForAllClients method
    await collector.runForAllClients();
    
    console.log('\n✅ Backfill complete!');
    console.log('Run audit: npx tsx scripts/compare-all-clients-year-data.ts');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

