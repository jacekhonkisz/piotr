#!/usr/bin/env tsx

/**
 * AUDIT ALL HISTORICAL MONTHS FOR BELMONTE
 * 
 * Check which months have data and which are missing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function auditAllMonths() {
  console.log('🔍 AUDITING ALL HISTORICAL MONTHS FOR BELMONTE');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Get Belmonte client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .single();

    if (clientError || !client) {
      console.error('❌ Belmonte client not found');
      process.exit(1);
    }

    console.log(`✅ Found: ${client.name}`);
    console.log(`   Client ID: ${client.id}\n`);

    // Generate list of months to check (last 12 months)
    const months = [];
    const now = new Date();
    
    // Go back 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthName = date.toLocaleString('default', { month: 'long' });
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      
      months.push({
        year,
        month,
        monthName,
        startDate
      });
    }

    console.log(`📅 Checking ${months.length} months...\n`);

    // Check each month
    const results = [];
    
    for (const monthData of months) {
      const { data: monthlyData } = await supabase
        .from('campaign_summaries')
        .select('total_spend, total_impressions, total_clicks, total_conversions, data_source, last_updated')
        .eq('client_id', client.id)
        .eq('summary_type', 'monthly')
        .eq('platform', 'google')
        .eq('summary_date', monthData.startDate)
        .maybeSingle();

      const spend = monthlyData ? parseFloat(monthlyData.total_spend) : 0;
      const hasData = monthlyData !== null;
      const isZero = hasData && spend === 0;

      results.push({
        ...monthData,
        hasData,
        isZero,
        spend,
        impressions: monthlyData?.total_impressions || 0,
        clicks: monthlyData?.total_clicks || 0,
        conversions: monthlyData?.total_conversions || 0,
        dataSource: monthlyData?.data_source || 'N/A',
        lastUpdated: monthlyData?.last_updated || 'N/A'
      });
    }

    // Display results
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 AUDIT RESULTS');
    console.log('═══════════════════════════════════════════════════\n');

    console.log('Month          | Status | Spend (PLN) | Impressions | Clicks | Last Updated');
    console.log('────────────────────────────────────────────────────────────────────────────────');

    results.forEach(r => {
      const statusIcon = !r.hasData ? '❌ MISSING' : r.isZero ? '⚠️  ZERO   ' : '✅ OK     ';
      const monthStr = `${r.monthName} ${r.year}`.padEnd(14);
      const spendStr = r.spend.toFixed(2).padStart(11);
      const impStr = r.impressions.toString().padStart(11);
      const clickStr = r.clicks.toString().padStart(6);
      const dateStr = r.lastUpdated !== 'N/A' 
        ? new Date(r.lastUpdated).toISOString().split('T')[0]
        : 'N/A';
      
      console.log(`${monthStr} | ${statusIcon} | ${spendStr} | ${impStr} | ${clickStr} | ${dateStr}`);
    });

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📋 SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');

    const missingMonths = results.filter(r => !r.hasData);
    const zeroMonths = results.filter(r => r.isZero);
    const okMonths = results.filter(r => r.hasData && !r.isZero);

    console.log(`✅ Months with data:  ${okMonths.length}`);
    console.log(`⚠️  Months with zeros: ${zeroMonths.length}`);
    console.log(`❌ Months missing:    ${missingMonths.length}`);

    if (missingMonths.length > 0) {
      console.log('\n❌ MISSING MONTHS:');
      missingMonths.forEach(m => {
        console.log(`   - ${m.monthName} ${m.year} (${m.startDate})`);
      });
    }

    if (zeroMonths.length > 0) {
      console.log('\n⚠️  MONTHS WITH ZERO SPEND:');
      zeroMonths.forEach(m => {
        console.log(`   - ${m.monthName} ${m.year} (${m.startDate})`);
      });
    }

    // Months that need collection
    const needsCollection = [...missingMonths, ...zeroMonths];
    
    if (needsCollection.length > 0) {
      console.log('\n\n═══════════════════════════════════════════════════');
      console.log('🔧 ACTION REQUIRED');
      console.log('═══════════════════════════════════════════════════\n');
      
      console.log(`${needsCollection.length} months need data collection:\n`);
      
      needsCollection.forEach(m => {
        console.log(`npx tsx scripts/collect-month-belmonte.ts ${m.year} ${m.month}`);
      });
      
      console.log('\nOr run batch collection:');
      console.log('npx tsx scripts/backfill-all-months-belmonte.ts');
    } else {
      console.log('\n✅ All months have data! No action required.');
    }

    console.log('\n═══════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error during audit:', error);
    process.exit(1);
  }
}

auditAllMonths();



