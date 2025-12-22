#!/usr/bin/env npx tsx

/**
 * 🧪 TEST SCRIPT: Collect 1 Week Only
 * 
 * Purpose: Test if Meta API rate limit has reset
 * 
 * ⚠️ IMPORTANT: Run with environment variables exported:
 *    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs) && npx tsx scripts/test-collection-1week.ts
 * 
 * This will collect ONLY the last completed week for Belmonte
 * Expected time: ~30 seconds if rate limit is reset, ~2 minutes if still rate limited
 */

// ✅ Load environment variables FIRST before importing anything
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local from project root
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { BackgroundDataCollector } from '../src/lib/background-data-collector';
import { createClient } from '@supabase/supabase-js';

const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN] ${msg}`, ...args)
};

async function testSingleWeekCollection() {
  const startTime = Date.now();
  
  logger.info('🧪 Starting 1-week test collection for Belmonte...');
  logger.info('⏱️ This will help us verify if the Meta API rate limit has reset');
  logger.info('');
  
  try {
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials. Make sure to export env vars before running.');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
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
    logger.info(`✅ Found client: ${belmonte.name} (ID: ${belmonte.id})`);
    logger.info('');
    
    // Create collector
    const collector = new BackgroundDataCollector();
    
    logger.info('📊 Collecting LAST 1 COMPLETED WEEK ONLY...');
    logger.info('   (Current week excluded to avoid partial data)');
    logger.info('');
    
    // Collect only week 1 (last completed week, not current week)
    // startWeek=1 means "1 week ago" (excludes current week)
    // weeksToCollect=1 means "collect 1 week only"
    await collector.collectWeeklySummaries(
      belmonte.name,
      1,    // startWeek: Start from 1 week ago (skip current week)
      1     // weeksToCollect: Collect only 1 week
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info('');
    logger.info(`✅ TEST COMPLETED in ${duration} seconds`);
    logger.info('');
    
    // Interpret results
    if (parseFloat(duration) > 90) {
      logger.warn('⚠️ Collection took >90s - Meta API may still be rate limited');
      logger.warn('   Recommendation: Wait another 30-60 minutes before full collection');
    } else {
      logger.info('✅ Collection completed quickly - Rate limit appears to be reset!');
      logger.info('   Safe to proceed with full 53-week collection');
    }
    
    logger.info('');
    logger.info('📋 Next steps:');
    logger.info('   1. Run verify-deletion-complete.sql to check the new data');
    logger.info('   2. If data looks good, run: npx tsx scripts/recollect-weeks-direct.ts --weeks=53 --client=belmonte');
    
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.error('');
    logger.error(`❌ TEST FAILED after ${duration} seconds`);
    logger.error('Error:', error.message);
    logger.error('');
    
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      logger.error('🛑 Meta API is still rate limited');
      logger.error('   Wait another 30-60 minutes before trying again');
    } else {
      logger.error('Stack:', error.stack);
    }
    
    process.exit(1);
  }
}

// Run the test
testSingleWeekCollection();

