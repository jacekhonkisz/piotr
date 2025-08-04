// Test script to verify date generation logic
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

function generatePeriodOptions(type) {
  const periods = [];
  // Use current date as reference
  const currentDate = new Date();
  const limit = type === 'monthly' ? 24 : 52; // 2 years for monthly, 1 year for weekly
  
  for (let i = 0; i < limit; i++) {
    let periodDate;
    
    if (type === 'monthly') {
      periodDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    } else {
      periodDate = new Date(currentDate.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
    }
    
    periods.push(generatePeriodId(periodDate, type));
  }
  
  return periods;
}

// Test the date generation
console.log('🧪 Testing Date Generation Logic...');
console.log('');

const currentDate = new Date();
console.log('📅 Current Date:', currentDate.toISOString());
console.log('📅 Current Month:', currentDate.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' }));
console.log('');

// Test monthly periods
console.log('📊 Monthly Periods (first 6):');
const monthlyPeriods = generatePeriodOptions('monthly');
monthlyPeriods.slice(0, 6).forEach((periodId, index) => {
  const [year, month] = periodId.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const formattedDate = date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
  console.log(`  ${index + 1}. ${periodId} -> ${formattedDate}`);
});
console.log('');

// Test weekly periods
console.log('📊 Weekly Periods (first 6):');
const weeklyPeriods = generatePeriodOptions('weekly');
weeklyPeriods.slice(0, 6).forEach((periodId, index) => {
  console.log(`  ${index + 1}. ${periodId}`);
});
console.log('');

// Verify the first period is current
const firstMonthlyPeriod = monthlyPeriods[0];
const [year, month] = firstMonthlyPeriod.split('-').map(Number);
const firstPeriodDate = new Date(year, month - 1, 1);
const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

console.log('✅ Verification:');
console.log(`  First period date: ${firstPeriodDate.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' })}`);
console.log(`  Current month: ${currentMonth.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' })}`);
console.log(`  Match: ${firstPeriodDate.getTime() === currentMonth.getTime() ? '✅ YES' : '❌ NO'}`);

if (firstPeriodDate.getTime() === currentMonth.getTime()) {
  console.log('🎉 Date generation is working correctly!');
} else {
  console.log('⚠️ Date generation needs fixing!');
} 