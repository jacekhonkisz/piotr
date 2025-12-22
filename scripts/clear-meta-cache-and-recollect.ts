#!/usr/bin/env npx tsx

/**
 * Clear Meta API cache and re-collect with fixed date format
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { BackgroundDataCollector } from '../src/lib/background-data-collector';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearCacheAndRecollect() {
  console.log('🧹 Clearing Meta API cache...\n');
  
  // Get Belmonte client
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%belmonte%')
    .limit(1);
  
  if (error || !clients || clients.length === 0) {
    throw new Error('Failed to find Belmonte client');
  }
  
  const belmonte = clients[0];
  
  if (!belmonte.meta_access_token) {
    throw new Error('Belmonte has no Meta access token');
  }
  
  // Clear cache
  const metaService = new MetaAPIServiceOptimized(belmonte.meta_access_token);
  metaService.clearCache();
  console.log('✅ Meta API cache cleared\n');
  
  // Delete all Belmonte weekly data to start fresh
  console.log('🗑️  Deleting all Belmonte weekly data...');
  const { error: deleteError } = await supabase
    .from('campaign_summaries')
    .delete()
    .eq('client_id', belmonte.id)
    .eq('summary_type', 'weekly')
    .eq('platform', 'meta');
  
  if (deleteError) {
    console.error('❌ Error deleting data:', deleteError);
  } else {
    console.log('✅ All Belmonte weekly data deleted\n');
  }
  
  // Re-collect with fixed date format
  console.log('🔄 Starting fresh collection with FIXED date format...\n');
  const collector = new BackgroundDataCollector();
  
  await collector.collectWeeklySummaries(
    belmonte.name,
    1,    // startWeek: Start from 1 week ago (skip current week)
    53    // weeksToCollect: Collect all 53 weeks
  );
  
  console.log('\n✅ Collection complete!');
}

clearCacheAndRecollect().catch(console.error);



