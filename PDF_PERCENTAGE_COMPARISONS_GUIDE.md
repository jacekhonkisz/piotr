# PDF Report Percentage Comparisons Implementation Guide

## ✅ What's Been Implemented

The PDF generation has been updated to support month-over-month percentage comparisons with:

### 1. **Removed Split KPI Section**
- ❌ Removed the KPI overview that was splitting across pages 
- ✅ Now starts clean with "Wydajność kampanii" on Page 2

### 2. **Added Comparison Infrastructure**
- ✅ CSS styling for percentage indicators (↗ +5.2%, ↘ -3.1%)
- ✅ TypeScript interfaces for previous month data
- ✅ Helper functions for calculating and formatting changes
- ✅ Updated all metrics to show comparisons when data is available

### 3. **Enhanced Data Structure**
```typescript
interface ReportData {
  // ... existing fields ...
  previousMonthTotals?: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpm: number;
  };
  previousMonthConversions?: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    reservations: number;
    reservation_value: number;
    booking_step_2: number;
  };
}
```

## 🚧 What Needs to Be Done

To enable the actual percentage comparisons, update the API that calls PDF generation:

### Step 1: Update Report Generation API

**File**: `src/app/api/generate-report/route.ts` (or wherever PDF generation is called)

Add previous month data fetching:

```typescript
// Fetch current month data (existing)
const currentMonthData = await fetchReportData(client, dateRange);

// NEW: Fetch previous month data
const previousMonth = getPreviousMonth(dateRange);
const previousMonthData = await fetchReportData(client, previousMonth);

// NEW: Prepare comparison data
const reportData = {
  ...currentMonthData,
  previousMonthTotals: previousMonthData?.totals,
  previousMonthConversions: {
    click_to_call: previousMonthData?.conversions?.click_to_call || 0,
    email_contacts: previousMonthData?.conversions?.email_contacts || 0,
    booking_step_1: previousMonthData?.conversions?.booking_step_1 || 0,
    reservations: previousMonthData?.conversions?.reservations || 0,
    reservation_value: previousMonthData?.conversions?.reservation_value || 0,
    booking_step_2: previousMonthData?.conversions?.booking_step_2 || 0,
  }
};
```

### Step 2: Add Previous Month Helper Function

```typescript
function getPreviousMonth(dateRange: { start: string; end: string }) {
  const currentStart = new Date(dateRange.start);
  const previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
  const previousEnd = new Date(currentStart.getFullYear(), currentStart.getMonth(), 0);
  
  return {
    start: previousStart.toISOString().split('T')[0],
    end: previousEnd.toISOString().split('T')[0]
  };
}
```

## 📊 Expected Results

Once the API is updated, the PDF will show:

### Performance Metrics (Page 2)
```
Wydajność kampanii                 Statystyki konwersji
─────────────────────             ─────────────────────
Wydatki łączne                    Potencjalne kontakty – telefon
4,376.21 zł ↗ +15.2%              2,322 ↗ +8.5%

Wyświetlenia                      Rezerwacje (zakończone)  
722,027 ↘ -5.3%                   82 ↗ +12.1%

CTR                               ROAS (x)
1.16% ↗ +2.1%                     73.07x ↗ +18.3%
```

### Visual Indicators
- 🟢 **Green ↗** for positive changes
- 🔴 **Red ↘** for negative changes  
- ⚪ **Gray →** for no change

## 🧪 Testing

Test the implementation by:

1. Generate a PDF for a month that has previous month data
2. Check that metrics show percentage comparisons
3. Verify that months without previous data still work (no comparisons shown)

## 📁 Files Modified

- `src/app/api/generate-pdf/route.ts` - Main PDF generation logic
- Added percentage comparison infrastructure
- Removed split KPI section
- Enhanced data structure

## 🎯 Benefits

✅ **Cleaner Layout**: No more split metrics across pages  
✅ **Better Insights**: Month-over-month performance tracking  
✅ **Professional Look**: Color-coded trend indicators  
✅ **Proper Spacing**: Logical page breaks (Metrics → Demographics → Placement) 