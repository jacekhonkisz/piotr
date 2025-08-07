console.log('🔍 Debug Date Calculation\n');
console.log('='.repeat(60));

// Check current date
const today = new Date();
console.log('📅 Today:', today.toISOString());
console.log('📅 Today (local):', today.toLocaleDateString());
console.log('📅 Current month:', today.getMonth() + 1); // 0-indexed, so +1
console.log('📅 Current year:', today.getFullYear());

// Calculate start of current month
const startOfMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
console.log('📅 Start of current month (UTC):', startOfMonth.toISOString());
console.log('📅 Start of current month (local):', startOfMonth.toLocaleDateString());

// Format for API
const startDate = startOfMonth.toISOString().split('T')[0];
const endDate = today.toISOString().split('T')[0];

console.log('\n📊 API Date Range:');
console.log('='.repeat(40));
console.log(`Start: ${startDate}`);
console.log(`End: ${endDate}`);

// Check if this is correct for August 2025
console.log('\n🎯 Expected for August 2025:');
console.log('='.repeat(40));
console.log('Start: 2025-08-01');
console.log('End: 2025-08-07 (or current day)');

// Verify the calculation
if (startDate === '2025-08-01') {
  console.log('✅ Start date is correct (August 1, 2025)');
} else {
  console.log('❌ Start date is incorrect. Expected: 2025-08-01, Got:', startDate);
}

if (endDate.startsWith('2025-08-')) {
  console.log('✅ End date is correct (August 2025)');
} else {
  console.log('❌ End date is incorrect. Expected: 2025-08-XX, Got:', endDate);
}

// Test different date calculations
console.log('\n🧪 Alternative Date Calculations:');
console.log('='.repeat(40));

// Method 1: Current approach
const method1 = new Date(today.getFullYear(), today.getMonth(), 1);
console.log('Method 1 (current):', method1.toISOString().split('T')[0]);

// Method 2: Using UTC
const method2 = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
console.log('Method 2 (UTC):', method2.toISOString().split('T')[0]);

// Method 3: Manual string construction
const method3 = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
console.log('Method 3 (manual):', method3);

// Check if we're in the right month
const currentMonth = today.getMonth(); // 0-indexed
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];

console.log('\n📅 Month Verification:');
console.log('='.repeat(40));
console.log(`Current month index: ${currentMonth}`);
console.log(`Current month name: ${monthNames[currentMonth]}`);
console.log(`Expected for August: 7 (index) / August (name)`);

if (currentMonth === 7) { // August is month 7 (0-indexed)
  console.log('✅ We are in August 2025');
} else {
  console.log('❌ We are NOT in August 2025. Current month:', monthNames[currentMonth]);
} 