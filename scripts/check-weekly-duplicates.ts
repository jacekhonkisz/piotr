#!/usr/bin/env tsx

/**
 * Weekly Reports Duplicate Checker
 * 
 * This script checks for duplicate weekly records and data quality issues
 * Run: npx tsx scripts/check-weekly-duplicates.ts
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface WeeklySummary {
  id: string;
  client_id: string;
  summary_date: string;
  platform: string;
  total_spend: number;
  reservations: number;
  booking_step_1: number;
  campaign_data: any;
  created_at: string;
}

async function checkDuplicates() {
  console.log('🔍 Weekly Reports System - Duplicate & Quality Audit\n');
  console.log('=' .repeat(70));
  
  // 1. Get Belmonte client
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%belmonte%');
  
  if (clientError) {
    console.error('❌ Error fetching client:', clientError);
    return;
  }
  
  if (!clients || clients.length === 0) {
    console.error('❌ Belmonte client not found');
    return;
  }
  
  const client = clients[0];
  console.log(`\n✅ Found client: ${client.name} (ID: ${client.id})`);
  console.log('=' .repeat(70));
  
  // 2. Get all weekly summaries
  const { data: weeklySummaries, error: summariesError } = await supabase
    .from('campaign_summaries')
    .select('id, client_id, summary_date, platform, total_spend, reservations, booking_step_1, campaign_data, created_at')
    .eq('client_id', client.id)
    .eq('summary_type', 'weekly')
    .order('summary_date', { ascending: false });
  
  if (summariesError) {
    console.error('❌ Error fetching summaries:', summariesError);
    return;
  }
  
  if (!weeklySummaries || weeklySummaries.length === 0) {
    console.log('\n⚠️  No weekly summaries found');
    return;
  }
  
  console.log(`\n📊 Total weekly records: ${weeklySummaries.length}`);
  
  // 3. Check for duplicates
  console.log('\n' + '='.repeat(70));
  console.log('🔍 CHECKING FOR DUPLICATES');
  console.log('='.repeat(70));
  
  const dateGroups = new Map<string, WeeklySummary[]>();
  
  weeklySummaries.forEach((summary: WeeklySummary) => {
    const key = `${summary.summary_date}-${summary.platform}`;
    if (!dateGroups.has(key)) {
      dateGroups.set(key, []);
    }
    dateGroups.get(key)!.push(summary);
  });
  
  let duplicateCount = 0;
  const duplicates: Array<{date: string, platform: string, count: number, records: WeeklySummary[]}> = [];
  
  dateGroups.forEach((records, key) => {
    if (records.length > 1) {
      duplicateCount += records.length - 1;
      const [date, platform] = key.split('-');
      duplicates.push({
        date,
        platform,
        count: records.length,
        records
      });
    }
  });
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicates found!');
  } else {
    console.log(`❌ Found ${duplicates.length} weeks with duplicates (${duplicateCount} extra records)\n`);
    
    duplicates.slice(0, 10).forEach(dup => {
      console.log(`\n📅 Week: ${dup.date} (${dup.platform})`);
      console.log(`   Duplicate count: ${dup.count} records`);
      dup.records.forEach((record, idx) => {
        console.log(`   ${idx + 1}. ID: ${record.id.substring(0, 8)}... | Spend: $${record.total_spend} | Reservations: ${record.reservations} | Created: ${new Date(record.created_at).toLocaleString()}`);
      });
    });
    
    if (duplicates.length > 10) {
      console.log(`\n   ... and ${duplicates.length - 10} more duplicates`);
    }
  }
  
  // 4. Check for non-Monday weeks
  console.log('\n' + '='.repeat(70));
  console.log('📅 CHECKING FOR NON-MONDAY WEEK STARTS');
  console.log('='.repeat(70));
  
  const nonMondayWeeks = weeklySummaries.filter((summary: WeeklySummary) => {
    const date = new Date(summary.summary_date);
    return date.getDay() !== 1; // 1 = Monday
  });
  
  if (nonMondayWeeks.length === 0) {
    console.log('✅ All weeks start on Monday!');
  } else {
    console.log(`❌ Found ${nonMondayWeeks.length} weeks that DON'T start on Monday:\n`);
    
    nonMondayWeeks.slice(0, 10).forEach((summary: WeeklySummary) => {
      const date = new Date(summary.summary_date);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      console.log(`   - ${summary.summary_date} (${dayNames[date.getDay()]}) | Platform: ${summary.platform} | ID: ${summary.id.substring(0, 8)}...`);
    });
    
    if (nonMondayWeeks.length > 10) {
      console.log(`\n   ... and ${nonMondayWeeks.length - 10} more`);
    }
  }
  
  // 5. Check for empty or missing data
  console.log('\n' + '='.repeat(70));
  console.log('📦 CHECKING FOR EMPTY OR INCOMPLETE DATA');
  console.log('='.repeat(70));
  
  const emptyData = weeklySummaries.filter((summary: WeeklySummary) => {
    const noCampaignData = !summary.campaign_data || 
                          (Array.isArray(summary.campaign_data) && summary.campaign_data.length === 0);
    const noMetrics = summary.total_spend === 0 && summary.booking_step_1 === 0 && summary.reservations === 0;
    return noCampaignData || noMetrics;
  });
  
  if (emptyData.length === 0) {
    console.log('✅ All weekly records have complete data!');
  } else {
    console.log(`⚠️  Found ${emptyData.length} weeks with missing/empty data:\n`);
    
    emptyData.slice(0, 10).forEach((summary: WeeklySummary) => {
      const issues: string[] = [];
      if (!summary.campaign_data || (Array.isArray(summary.campaign_data) && summary.campaign_data.length === 0)) {
        issues.push('No campaign_data');
      }
      if (summary.total_spend === 0) {
        issues.push('$0 spend');
      }
      if (summary.booking_step_1 === 0 && summary.reservations === 0) {
        issues.push('No conversions');
      }
      console.log(`   - ${summary.summary_date} | Platform: ${summary.platform} | Issues: ${issues.join(', ')}`);
    });
    
    if (emptyData.length > 10) {
      console.log(`\n   ... and ${emptyData.length - 10} more`);
    }
  }
  
  // 6. Check recent weeks
  console.log('\n' + '='.repeat(70));
  console.log('📊 RECENT WEEKS SUMMARY');
  console.log('='.repeat(70));
  
  const recentWeeks = weeklySummaries.slice(0, 5);
  console.log('\nLast 5 weeks:\n');
  
  recentWeeks.forEach((summary: WeeklySummary) => {
    const date = new Date(summary.summary_date);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hasData = summary.campaign_data && Array.isArray(summary.campaign_data) && summary.campaign_data.length > 0;
    
    console.log(`   ${summary.summary_date} (${dayNames[date.getDay()]})`);
    console.log(`      Platform: ${summary.platform}`);
    console.log(`      Spend: $${summary.total_spend.toFixed(2)}`);
    console.log(`      Booking Step 1: ${summary.booking_step_1}`);
    console.log(`      Reservations: ${summary.reservations}`);
    console.log(`      Campaign Data: ${hasData ? '✅ Present' : '❌ Missing'}`);
    console.log('');
  });
  
  // 7. Summary
  console.log('='.repeat(70));
  console.log('📋 AUDIT SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n✅ Total weekly records: ${weeklySummaries.length}`);
  console.log(`   Unique weeks: ${dateGroups.size}`);
  console.log(`   Duplicates: ${duplicateCount} extra records in ${duplicates.length} weeks`);
  console.log(`   Non-Monday weeks: ${nonMondayWeeks.length}`);
  console.log(`   Incomplete data: ${emptyData.length}`);
  
  // Recommendations
  console.log('\n' + '='.repeat(70));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(70));
  
  if (duplicates.length > 0) {
    console.log('\n1. ❌ Fix Duplicates:');
    console.log('   Run: scripts/fix-duplicate-weeks.sql in Supabase SQL Editor');
    console.log('   This will keep the latest record and remove older duplicates');
  }
  
  if (nonMondayWeeks.length > 0) {
    console.log('\n2. ❌ Remove Non-Monday Weeks:');
    console.log('   Run: scripts/remove-non-monday-weeks.sql in Supabase SQL Editor');
    console.log('   ISO weeks must start on Monday');
  }
  
  if (emptyData.length > 0) {
    console.log('\n3. ⚠️  Re-collect Incomplete Data:');
    console.log('   Run: curl -X POST https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection');
    console.log('   This will detect and re-fetch weeks with missing data');
  }
  
  if (duplicates.length === 0 && nonMondayWeeks.length === 0 && emptyData.length === 0) {
    console.log('\n✅ No issues found! Your weekly data is clean and complete.');
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('✅ Audit complete!');
  console.log('='.repeat(70));
}

// Run the audit
checkDuplicates().catch(console.error);

