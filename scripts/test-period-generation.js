// Test script to understand period generation and date ranges
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testing Period Generation Logic...\n');

// Simulate the generatePeriodOptions function from reports page
function generatePeriodOptions(type) {
  const periods = [];
  // Use current date as reference, but ensure we don't generate future periods
  const currentDate = new Date();
  const limit = type === 'monthly' ? 24 : 52; // 2 years for monthly, 1 year for weekly
  
  console.log(`📅 Current system date: ${currentDate.toISOString().split('T')[0]}`);
  console.log(`📅 Generating ${limit} periods for ${type} view...\n`);
  
  for (let i = 0; i < limit; i++) {
    let periodDate;
    
    if (type === 'monthly') {
      // For monthly, go back from current month
      periodDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    } else {
      // For weekly, go back from current week
      periodDate = new Date(currentDate.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
    }
    
    // Validate that the period is not in the future
    if (periodDate > currentDate) {
      console.log(`⚠️ Skipping future period: ${generatePeriodId(periodDate, type)}`);
      continue;
    }
    
    const periodId = generatePeriodId(periodDate, type);
    periods.push(periodId);
  }
  
  return periods;
}

function generatePeriodId(date, type) {
  if (type === 'monthly') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  } else {
    // For weekly, use ISO week format
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Test monthly periods
console.log('📊 Testing Monthly Period Generation:');
console.log('=====================================');
const monthlyPeriods = generatePeriodOptions('monthly');

console.log(`✅ Generated ${monthlyPeriods.length} monthly periods:`);
monthlyPeriods.slice(0, 12).forEach((periodId, index) => {
  const [year, month] = periodId.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const formattedDate = date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
  console.log(`  ${index + 1}. ${periodId} -> ${formattedDate}`);
});

console.log('\n📊 Testing Weekly Period Generation:');
console.log('=====================================');
const weeklyPeriods = generatePeriodOptions('weekly');

console.log(`✅ Generated ${weeklyPeriods.length} weekly periods:`);
weeklyPeriods.slice(0, 12).forEach((periodId, index) => {
  console.log(`  ${index + 1}. ${periodId}`);
});

// Test what happens when we try to fetch data for these periods
console.log('\n🔍 Testing Campaign Data for Generated Periods:');
console.log('===============================================');

// Simulate the campaign creation dates we found
const campaignDates = [
  '2024-04-06', // Reklama reels Kampania
  '2024-04-03', // Reklama karuzela Kampania  
  '2024-04-03', // Polski 1 – kopia
  '2024-03-29'  // Polski 1
];

console.log('📋 Campaign creation dates:');
campaignDates.forEach((date, index) => {
  console.log(`  ${index + 1}. ${date}`);
});

// Check if any of the generated periods overlap with campaign dates
console.log('\n🔍 Checking period overlap with campaign dates:');
monthlyPeriods.slice(0, 6).forEach((periodId) => {
  const [year, month] = periodId.split('-').map(Number);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  
  const hasOverlap = campaignDates.some(campaignDate => {
    const campaign = new Date(campaignDate);
    return campaign >= periodStart && campaign <= periodEnd;
  });
  
  console.log(`  ${periodId}: ${hasOverlap ? '✅ Has campaigns' : '❌ No campaigns'}`);
});

// Test the actual API call that would be made
console.log('\n🔍 Simulating API calls for first 3 periods:');
monthlyPeriods.slice(0, 3).forEach((periodId) => {
  const [year, month] = periodId.split('-').map(Number);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  
  console.log(`\n  📅 Period: ${periodId}`);
  console.log(`     Start: ${periodStart.toISOString().split('T')[0]}`);
  console.log(`     End: ${periodEnd.toISOString().split('T')[0]}`);
  
  // Check if any campaigns were created in this period
  const campaignsInPeriod = campaignDates.filter(campaignDate => {
    const campaign = new Date(campaignDate);
    return campaign >= periodStart && campaign <= periodEnd;
  });
  
  if (campaignsInPeriod.length > 0) {
    console.log(`     ✅ Found ${campaignsInPeriod.length} campaigns in this period`);
    campaignsInPeriod.forEach(date => console.log(`        - ${date}`));
  } else {
    console.log(`     ❌ No campaigns in this period`);
  }
});

console.log('\n📊 SUMMARY:');
console.log('===========');
console.log('The issue is clear now:');
console.log('1. System date is August 2025');
console.log('2. Generated periods start from August 2025 and go back');
console.log('3. Campaigns were created in March-April 2024');
console.log('4. No overlap between generated periods and campaign dates');
console.log('\n💡 SOLUTION:');
console.log('============');
console.log('The reports page should either:');
console.log('1. Use a realistic current date (e.g., December 2024)');
console.log('2. Generate periods that include the campaign creation dates');
console.log('3. Use the "all-time" view which should fetch from earliest campaign date'); 