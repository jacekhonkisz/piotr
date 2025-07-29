require('dotenv').config({ path: '.env.local' });

// Simulate the fixed trend calculation logic
function calculateTrends(totals, selectedMonth, reports) {
  if (!totals || !selectedMonth) return { spend: 0, conversions: 0, ctr: 0 };
  
  // Get all available months for comparison
  const availableMonths = Object.keys(reports).sort();
  const currentMonthIndex = availableMonths.indexOf(selectedMonth);
  
  // If we have a previous month, calculate real trends
  if (currentMonthIndex > 0) {
    const previousMonth = availableMonths[currentMonthIndex - 1];
    const previousReport = reports[previousMonth];
    
    if (previousReport && previousReport.campaigns) {
      const previousTotals = previousReport.campaigns.reduce((acc, campaign) => ({
        spend: acc.spend + campaign.spend,
        impressions: acc.impressions + campaign.impressions,
        clicks: acc.clicks + campaign.clicks,
        conversions: acc.conversions + campaign.conversions
      }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
      
      const previousCtr = previousTotals.impressions > 0 ? (previousTotals.clicks / previousTotals.impressions) * 100 : 0;
      
      // Calculate real percentage changes
      const spendTrend = previousTotals.spend > 0 ? ((totals.spend - previousTotals.spend) / previousTotals.spend) * 100 : 0;
      const conversionsTrend = previousTotals.conversions > 0 ? ((totals.conversions - previousTotals.conversions) / previousTotals.conversions) * 100 : 0;
      const ctrTrend = previousCtr > 0 ? ((totals.ctr - previousCtr) / previousCtr) * 100 : 0;
      
      return {
        spend: spendTrend,
        conversions: conversionsTrend,
        ctr: ctrTrend
      };
    }
  }
  
  // If no previous month data, return 0 trends (no comparison possible)
  return {
    spend: 0,
    conversions: 0,
    ctr: 0
  };
}

function generateTrendLabel(trend) {
  return trend === 0 ? 'Brak danych z poprzedniego miesiąca' : `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}% vs poprzedni miesiąc`;
}

console.log('🧪 Testing Trend Calculation Fix');
console.log('================================\n');

// Test 1: No previous month data (should show "Brak danych z poprzedniego miesiąca")
console.log('Test 1: No previous month data');
const totals1 = { spend: 246.94, conversions: 0, ctr: 1.77 };
const reports1 = { '2025-01': { campaigns: [] } };
const trends1 = calculateTrends(totals1, '2025-01', reports1);

console.log(`Current totals: ${totals1.spend.toFixed(2)} zł, ${totals1.conversions} conversions, ${totals1.ctr.toFixed(2)}% CTR`);
console.log(`Calculated trends: ${trends1.spend.toFixed(1)}%, ${trends1.conversions.toFixed(1)}%, ${trends1.ctr.toFixed(1)}%`);
console.log(`Spend label: ${generateTrendLabel(trends1.spend)}`);
console.log(`Conversions label: ${generateTrendLabel(trends1.conversions)}`);
console.log(`CTR label: ${generateTrendLabel(trends1.ctr)}`);
console.log('✅ Should show "Brak danych z poprzedniego miesiąca" for all metrics\n');

// Test 2: With previous month data (should show real trends)
console.log('Test 2: With previous month data');
const totals2 = { spend: 7854.66, conversions: 137, ctr: 3.08 };
const reports2 = {
  '2025-03': { 
    campaigns: [
      { spend: 6969.33, impressions: 100000, clicks: 3040, conversions: 121 }
    ] 
  },
  '2025-04': { 
    campaigns: [
      { spend: 7854.66, impressions: 110000, clicks: 3388, conversions: 137 }
    ] 
  }
};
const trends2 = calculateTrends(totals2, '2025-04', reports2);

console.log(`Previous month: 6969.33 zł, 121 conversions, 3.04% CTR`);
console.log(`Current month: ${totals2.spend.toFixed(2)} zł, ${totals2.conversions} conversions, ${totals2.ctr.toFixed(2)}% CTR`);
console.log(`Calculated trends: ${trends2.spend.toFixed(1)}%, ${trends2.conversions.toFixed(1)}%, ${trends2.ctr.toFixed(1)}%`);
console.log(`Spend label: ${generateTrendLabel(trends2.spend)}`);
console.log(`Conversions label: ${generateTrendLabel(trends2.conversions)}`);
console.log(`CTR label: ${generateTrendLabel(trends2.ctr)}`);
console.log('✅ Should show real percentage changes\n');

// Test 3: March vs April 2024 scenario (if data existed)
console.log('Test 3: March vs April 2024 scenario (simulated)');
const marchData = { spend: 12.00, conversions: 5, ctr: 2.1 };
const aprilData = { spend: 246.94, conversions: 0, ctr: 1.77 };
const reports3 = {
  '2024-03': { campaigns: [{ spend: marchData.spend, impressions: 1000, clicks: 21, conversions: marchData.conversions }] },
  '2024-04': { campaigns: [{ spend: aprilData.spend, impressions: 1000, clicks: 17.7, conversions: aprilData.conversions }] }
};
const trends3 = calculateTrends(aprilData, '2024-04', reports3);

const expectedSpendTrend = ((aprilData.spend - marchData.spend) / marchData.spend) * 100;
const expectedConversionsTrend = ((aprilData.conversions - marchData.conversions) / marchData.conversions) * 100;
const expectedCtrTrend = ((aprilData.ctr - marchData.ctr) / marchData.ctr) * 100;

console.log(`March 2024: ${marchData.spend.toFixed(2)} zł, ${marchData.conversions} conversions, ${marchData.ctr.toFixed(2)}% CTR`);
console.log(`April 2024: ${aprilData.spend.toFixed(2)} zł, ${aprilData.conversions} conversions, ${aprilData.ctr.toFixed(2)}% CTR`);
console.log(`Expected spend trend: ${expectedSpendTrend >= 0 ? '+' : ''}${expectedSpendTrend.toFixed(1)}%`);
console.log(`Calculated spend trend: ${trends3.spend.toFixed(1)}%`);
console.log(`Spend label: ${generateTrendLabel(trends3.spend)}`);
console.log('✅ Should show the correct large percentage increase\n');

console.log('\n🎯 Summary of the fix:');
console.log('- Removed hardcoded demo values (8.5%, 12.3%, 3.2%)');
console.log('- Now shows 0% when no previous month data exists');
console.log('- Displays "Brak danych z poprzedniego miesiąca" instead of fake trends');
console.log('- Calculates real trends when previous month data is available');
console.log('- The 246.94 zł value will now show proper trend or "no data" message'); 