#!/usr/bin/env node
/**
 * CLEANUP ZERO-DATA ANOMALIES
 * 
 * Purpose: Identify and optionally clean up records with zero spend/impressions
 * These may indicate: paused campaigns, data collection errors, or API issues
 * 
 * Usage: 
 *   npx tsx scripts/cleanup-zero-data-anomalies.ts                 # Analyze only
 *   npx tsx scripts/cleanup-zero-data-anomalies.ts --delete        # Delete zero records
 *   npx tsx scripts/cleanup-zero-data-anomalies.ts --mark-inactive # Mark as inactive
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const args = process.argv.slice(2);
const shouldDelete = args.includes('--delete');
const shouldMark = args.includes('--mark-inactive');

interface ZeroDataRecord {
  id: string;
  client_id: string;
  client_name?: string;
  summary_type: string;
  summary_date: string;
  platform: string;
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
}

async function getZeroDataRecords(): Promise<ZeroDataRecord[]> {
  // Get all records with zero metrics
  const { data, error } = await supabase
    .from('campaign_summaries')
    .select(`
      id,
      client_id,
      summary_type,
      summary_date,
      platform,
      total_spend,
      total_impressions,
      total_clicks,
      clients!inner(name)
    `)
    .eq('total_spend', 0)
    .eq('total_impressions', 0)
    .eq('total_clicks', 0)
    .order('summary_date', { ascending: false });

  if (error) {
    console.error('❌ Error fetching zero-data records:', error);
    return [];
  }

  return (data || []).map(record => ({
    id: record.id,
    client_id: record.client_id,
    client_name: (record.clients as any)?.name,
    summary_type: record.summary_type,
    summary_date: record.summary_date,
    platform: record.platform,
    total_spend: record.total_spend,
    total_impressions: record.total_impressions,
    total_clicks: record.total_clicks
  }));
}

async function analyzeZeroDataRecords(records: ZeroDataRecord[]) {
  console.log('\n📊 ZERO-DATA ANALYSIS\n');
  
  // Group by client
  const byClient = new Map<string, ZeroDataRecord[]>();
  records.forEach(r => {
    const key = r.client_name || r.client_id;
    if (!byClient.has(key)) byClient.set(key, []);
    byClient.get(key)!.push(r);
  });
  
  console.log('📊 By Client:\n');
  const clientStats: Array<{name: string; count: number; meta: number; google: number; monthly: number; weekly: number}> = [];
  
  byClient.forEach((clientRecords, clientName) => {
    const metaCount = clientRecords.filter(r => r.platform === 'meta').length;
    const googleCount = clientRecords.filter(r => r.platform === 'google').length;
    const monthlyCount = clientRecords.filter(r => r.summary_type === 'monthly').length;
    const weeklyCount = clientRecords.filter(r => r.summary_type === 'weekly').length;
    
    clientStats.push({
      name: clientName,
      count: clientRecords.length,
      meta: metaCount,
      google: googleCount,
      monthly: monthlyCount,
      weekly: weeklyCount
    });
  });
  
  // Sort by count descending
  clientStats.sort((a, b) => b.count - a.count);
  
  console.log('   Client                              Total    Meta  Google  Monthly  Weekly');
  console.log('   ─────────────────────────────────  ─────  ─────  ──────  ───────  ──────');
  
  clientStats.forEach(stat => {
    console.log(`   ${stat.name.padEnd(35)} ${String(stat.count).padStart(5)} ${String(stat.meta).padStart(5)} ${String(stat.google).padStart(7)} ${String(stat.monthly).padStart(8)} ${String(stat.weekly).padStart(7)}`);
  });
  
  // Group by platform
  console.log('\n📊 By Platform:\n');
  const metaRecords = records.filter(r => r.platform === 'meta');
  const googleRecords = records.filter(r => r.platform === 'google');
  
  console.log(`   Meta Ads: ${metaRecords.length} zero-data records`);
  console.log(`   Google Ads: ${googleRecords.length} zero-data records`);
  
  // Group by type
  console.log('\n📊 By Summary Type:\n');
  const monthlyRecords = records.filter(r => r.summary_type === 'monthly');
  const weeklyRecords = records.filter(r => r.summary_type === 'weekly');
  
  console.log(`   Monthly: ${monthlyRecords.length} zero-data records`);
  console.log(`   Weekly: ${weeklyRecords.length} zero-data records`);
  
  // Date analysis
  console.log('\n📊 By Time Period:\n');
  
  const dateGroups = new Map<string, number>();
  records.forEach(r => {
    const month = r.summary_date.substring(0, 7);
    dateGroups.set(month, (dateGroups.get(month) || 0) + 1);
  });
  
  const sortedDates = Array.from(dateGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  console.log('   Month       Count');
  console.log('   ──────────  ─────');
  sortedDates.forEach(([month, count]) => {
    console.log(`   ${month}    ${String(count).padStart(5)}`);
  });
  
  // Return summary for potential action
  return {
    total: records.length,
    byPlatform: { meta: metaRecords.length, google: googleRecords.length },
    byType: { monthly: monthlyRecords.length, weekly: weeklyRecords.length },
    byClient: clientStats
  };
}

async function deleteZeroDataRecords(records: ZeroDataRecord[]) {
  console.log('\n🗑️  DELETING ZERO-DATA RECORDS\n');
  
  const ids = records.map(r => r.id);
  
  console.log(`   Deleting ${ids.length} records...`);
  
  // Delete in batches
  const batchSize = 100;
  let deleted = 0;
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('campaign_summaries')
      .delete()
      .in('id', batch);
    
    if (error) {
      console.error(`   ❌ Error deleting batch: ${error.message}`);
    } else {
      deleted += batch.length;
      console.log(`   ✅ Deleted ${deleted}/${ids.length} records`);
    }
  }
  
  console.log(`\n✅ Deleted ${deleted} zero-data records`);
}

async function main() {
  console.log('🔍 ZERO-DATA ANOMALY CLEANUP TOOL');
  console.log('='.repeat(80));
  
  if (shouldDelete) {
    console.log('⚠️  DELETE MODE - Will remove zero-data records');
  } else if (shouldMark) {
    console.log('⚠️  MARK MODE - Will mark records as inactive');
  } else {
    console.log('📊 ANALYSIS MODE - Read only');
  }
  
  console.log('\n📊 Fetching zero-data records...');
  
  const records = await getZeroDataRecords();
  
  console.log(`\n✅ Found ${records.length} zero-data records`);
  
  if (records.length === 0) {
    console.log('\n✅ No zero-data anomalies found!');
    return;
  }
  
  // Analyze
  const analysis = await analyzeZeroDataRecords(records);
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`\nTotal zero-data records: ${analysis.total}`);
  console.log(`\nBreakdown:`);
  console.log(`   Meta Ads: ${analysis.byPlatform.meta} (${((analysis.byPlatform.meta / analysis.total) * 100).toFixed(1)}%)`);
  console.log(`   Google Ads: ${analysis.byPlatform.google} (${((analysis.byPlatform.google / analysis.total) * 100).toFixed(1)}%)`);
  console.log(`   Monthly: ${analysis.byType.monthly}`);
  console.log(`   Weekly: ${analysis.byType.weekly}`);
  
  // Take action if requested
  if (shouldDelete) {
    console.log('\n⚠️  Proceeding with deletion...');
    await deleteZeroDataRecords(records);
  } else {
    console.log('\n💡 RECOMMENDATIONS:\n');
    
    if (analysis.byPlatform.google > analysis.byPlatform.meta) {
      console.log('   🔴 Most zero-data is from Google Ads');
      console.log('      → This indicates Google Ads accounts may have paused campaigns');
      console.log('      → Or conversion tracking is not set up correctly');
      console.log('      → Consider: Verify each client\'s Google Ads account status');
    }
    
    console.log('\n   📊 Options:');
    console.log('      1. DELETE all zero-data records:');
    console.log('         npx tsx scripts/cleanup-zero-data-anomalies.ts --delete');
    console.log('');
    console.log('      2. Keep as audit trail (recommended if campaigns were truly inactive)');
    console.log('         No action needed - records show historical account state');
    console.log('');
    console.log('      3. Investigate specific clients with high zero-data counts');
    console.log('         Focus on top offenders from the analysis above');
  }
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

