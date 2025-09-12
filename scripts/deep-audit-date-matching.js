#!/usr/bin/env node

/**
 * Deep Audit: Date Matching Logic Issues
 * 
 * This script investigates why the audit shows over 100% coverage
 * but also shows missing data - indicating date matching problems
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to get week boundaries
function getWeekBoundaries(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
}

// Generate expected weeks for past year
function generateExpectedWeeks() {
  const weeks = [];
  const currentDate = new Date();
  
  // Start from last completed week
  const lastCompletedWeekEnd = new Date(currentDate);
  const dayOfWeek = lastCompletedWeekEnd.getDay();
  const daysToLastSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
  lastCompletedWeekEnd.setDate(lastCompletedWeekEnd.getDate() - daysToLastSunday);
  lastCompletedWeekEnd.setHours(23, 59, 59, 999);
  
  for (let i = 0; i < 52; i++) {
    const weekEndDate = new Date(lastCompletedWeekEnd.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
    const weekStartDate = new Date(weekEndDate.getTime() - (6 * 24 * 60 * 60 * 1000));
    const weekRange = getWeekBoundaries(weekStartDate);
    
    // Only include completed weeks
    if (weekEndDate < currentDate) {
      weeks.push({
        weekNumber: i + 1,
        startDate: weekRange.start,
        endDate: weekRange.end,
        year: weekEndDate.getFullYear(),
        month: weekEndDate.getMonth() + 1
      });
    }
  }
  
  return weeks;
}

async function deepAuditDateMatching() {
  console.log('🔍 DEEP AUDIT: Date Matching Logic Issues\n');
  
  try {
    // Get a specific client for detailed analysis
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('api_status', 'valid')
      .limit(1);
    
    if (!clients || clients.length === 0) {
      console.log('❌ No clients found');
      return;
    }
    
    const client = clients[0];
    console.log(`📊 Analyzing client: ${client.name} (${client.email})\n`);
    
    // Get all weekly data for this client
    const { data: weeklyData } = await supabase
      .from('campaign_summaries')
      .select('summary_date, platform, total_spend, total_impressions, total_clicks, total_conversions')
      .eq('client_id', client.id)
      .eq('summary_type', 'weekly')
      .order('summary_date', { ascending: true });
    
    console.log(`📅 Weekly Data Analysis:`);
    console.log(`   Total records: ${weeklyData.length}`);
    
    // Group by date to see duplicates
    const weeklyByDate = {};
    weeklyData.forEach(record => {
      if (!weeklyByDate[record.summary_date]) {
        weeklyByDate[record.summary_date] = [];
      }
      weeklyByDate[record.summary_date].push({
        platform: record.platform || 'meta',
        spend: record.total_spend,
        impressions: record.total_impressions,
        clicks: record.total_clicks,
        conversions: record.total_conversions
      });
    });
    
    const uniqueWeeklyDates = Object.keys(weeklyByDate).sort();
    console.log(`   Unique dates: ${uniqueWeeklyDates.length}`);
    console.log(`   Records per date: ${(weeklyData.length / uniqueWeeklyDates.length).toFixed(2)}`);
    
    // Show sample data with duplicates
    console.log('\n📅 Sample Weekly Data with Duplicates:');
    uniqueWeeklyDates.slice(0, 10).forEach(date => {
      const records = weeklyByDate[date];
      console.log(`   ${date}: ${records.length} records`);
      records.forEach((record, index) => {
        console.log(`     ${index + 1}. ${record.platform}: $${record.spend} spend, ${record.impressions} impressions`);
      });
    });
    
    // Generate expected weeks
    const expectedWeeks = generateExpectedWeeks();
    console.log(`\n📅 Expected Weeks Analysis:`);
    console.log(`   Total expected weeks: ${expectedWeeks.length}`);
    console.log(`   Date range: ${expectedWeeks[expectedWeeks.length - 1].startDate} to ${expectedWeeks[0].startDate}`);
    
    // Check for date matching issues
    console.log('\n🔍 Date Matching Analysis:');
    const actualWeekDates = new Set(uniqueWeeklyDates);
    let matches = 0;
    let mismatches = 0;
    
    expectedWeeks.forEach(expectedWeek => {
      if (actualWeekDates.has(expectedWeek.startDate)) {
        matches++;
      } else {
        mismatches++;
        if (mismatches <= 5) { // Show first 5 mismatches
          console.log(`   ❌ Missing: ${expectedWeek.startDate} (Week ${expectedWeek.weekNumber})`);
        }
      }
    });
    
    console.log(`   ✅ Matches: ${matches}/${expectedWeeks.length} (${((matches/expectedWeeks.length)*100).toFixed(1)}%)`);
    console.log(`   ❌ Mismatches: ${mismatches}/${expectedWeeks.length} (${((mismatches/expectedWeeks.length)*100).toFixed(1)}%)`);
    
    // Check for extra dates (not in expected range)
    const expectedWeekDates = new Set(expectedWeeks.map(w => w.startDate));
    const extraDates = uniqueWeeklyDates.filter(date => !expectedWeekDates.has(date));
    
    console.log(`\n🔍 Extra Dates Analysis:`);
    console.log(`   Extra dates found: ${extraDates.length}`);
    if (extraDates.length > 0) {
      console.log(`   Sample extra dates:`);
      extraDates.slice(0, 5).forEach(date => {
        const records = weeklyByDate[date];
        console.log(`     ${date}: ${records.length} records (${records.map(r => r.platform).join(', ')})`);
      });
    }
    
    // Check date range of actual data
    const actualEarliest = uniqueWeeklyDates[0];
    const actualLatest = uniqueWeeklyDates[uniqueWeeklyDates.length - 1];
    const expectedEarliest = expectedWeeks[expectedWeeks.length - 1].startDate;
    const expectedLatest = expectedWeeks[0].startDate;
    
    console.log(`\n📊 Date Range Comparison:`);
    console.log(`   Actual data range: ${actualEarliest} to ${actualLatest}`);
    console.log(`   Expected data range: ${expectedEarliest} to ${expectedLatest}`);
    
    // Check if actual data is outside expected range
    const actualEarliestDate = new Date(actualEarliest);
    const actualLatestDate = new Date(actualLatest);
    const expectedEarliestDate = new Date(expectedEarliest);
    const expectedLatestDate = new Date(expectedLatest);
    
    if (actualEarliestDate < expectedEarliestDate) {
      console.log(`   ⚠️  Actual data starts BEFORE expected range`);
    }
    if (actualLatestDate > expectedLatestDate) {
      console.log(`   ⚠️  Actual data ends AFTER expected range`);
    }
    
    // Check for gaps in actual data
    console.log(`\n🔍 Gap Analysis in Actual Data:`);
    const gaps = [];
    for (let i = 1; i < uniqueWeeklyDates.length; i++) {
      const prevDate = new Date(uniqueWeeklyDates[i - 1]);
      const currDate = new Date(uniqueWeeklyDates[i]);
      const daysDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 14) { // More than 2 weeks gap
        gaps.push({
          start: uniqueWeeklyDates[i - 1],
          end: uniqueWeeklyDates[i],
          days: daysDiff
        });
      }
    }
    
    console.log(`   Gaps found: ${gaps.length}`);
    gaps.forEach(gap => {
      console.log(`     ${gap.start} to ${gap.end} (${gap.days.toFixed(0)} days)`);
    });
    
    // Summary of issues
    console.log(`\n📋 SUMMARY OF ISSUES:`);
    console.log(`   1. Date matching: ${matches}/${expectedWeeks.length} matches (${((matches/expectedWeeks.length)*100).toFixed(1)}%)`);
    console.log(`   2. Extra dates: ${extraDates.length} dates outside expected range`);
    console.log(`   3. Data gaps: ${gaps.length} gaps in actual data`);
    console.log(`   4. Duplicate records: ${weeklyData.length - uniqueWeeklyDates.length} duplicate records`);
    
    if (matches < expectedWeeks.length) {
      console.log(`\n🚨 ROOT CAUSE: Date matching logic is incorrect`);
      console.log(`   - Expected weeks don't match actual data dates`);
      console.log(`   - This causes the "over 100% coverage but missing data" issue`);
    }
    
  } catch (error) {
    console.error('❌ Deep audit failed:', error);
  }
}

// Run the deep audit
deepAuditDateMatching();
