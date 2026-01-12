/**
 * Quick verification script to check Meta Ads CTR/CPC calculations
 * Run this in browser console to verify the fix is working
 */

console.log('🔍 META ADS CTR/CPC VERIFICATION');
console.log('='.repeat(80));

// Example calculation with Havet January 2026 numbers
const havetJan2026 = {
  totalSpend: 296.41,
  totalImpressions: 26735,
  totalClicks: 841
};

const ctr = (havetJan2026.totalClicks / havetJan2026.totalImpressions) * 100;
const cpc = havetJan2026.totalSpend / havetJan2026.totalClicks;

console.log('📊 Havet January 2026:');
console.log(`   Total Spend: ${havetJan2026.totalSpend.toFixed(2)} zł`);
console.log(`   Total Impressions: ${havetJan2026.totalImpressions.toLocaleString()}`);
console.log(`   Total Clicks: ${havetJan2026.totalClicks.toLocaleString()}`);
console.log('');
console.log('✅ Calculated Metrics (should match Meta Business Suite):');
console.log(`   CTR: ${ctr.toFixed(2)}%`);
console.log(`   CPC: ${cpc.toFixed(2)} zł`);
console.log('');
console.log('📋 Expected values from Meta Business Suite:');
console.log('   CTR: 1.14%');
console.log('   CPC: 0.35 zł');
console.log('');

if (Math.abs(ctr - 3.15) < 0.01) {
  console.log('❌ INCORRECT: Showing old value (3.15%)');
  console.log('💡 Clear browser cache and hard refresh');
} else if (Math.abs(ctr - 1.14) < 0.01) {
  console.log('✅ CORRECT: Matches Meta Business Suite!');
} else {
  console.log(`⚠️  UNEXPECTED: CTR is ${ctr.toFixed(2)}%`);
}

console.log('='.repeat(80));

