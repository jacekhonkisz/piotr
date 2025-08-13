# Weekly PDF Generation Audit Report

## Executive Summary

The PDF generation system has **critical gaps** for weekly reports. While monthly PDFs work correctly with proper "previous month" comparisons, weekly PDFs are using incorrect **monthly comparison logic** instead of weekly-specific comparisons.

**Status**: 🔴 **MAJOR ISSUES FOUND**  
**Date**: January 11, 2025  
**Impact**: Weekly PDFs show wrong or missing comparison data  
**Priority**: HIGH - Weekly PDFs are not production-ready

## 🔍 **Issues Identified**

### **Issue 1: Hardcoded Monthly Logic for All Reports**
**Status**: 🔴 **CRITICAL**

**Problem**: PDF generation uses `getPreviousMonthDateRange()` for ALL reports, including weekly ones.

**Code Evidence**:
```typescript
// Line 1666 in generate-pdf/route.ts - WRONG for weekly reports
const previousDateRange = getPreviousMonthDateRange(dateRange);  // Always monthly!

// Line 1674 - WRONG for weekly reports  
.eq('summary_type', 'monthly')  // Should be 'weekly' for weekly reports
```

**Impact**: 
- Weekly PDFs compare to previous **month** instead of previous **week**
- Database lookup fails because it searches for monthly data when weekly is needed
- Comparison percentages are meaningless (week vs month data)

---

### **Issue 2: No Date Range Type Detection**
**Status**: 🔴 **CRITICAL**

**Problem**: The PDF generation doesn't detect if the request is for a weekly vs monthly report.

**Evidence**: No logic to determine:
```typescript
// Missing logic:
const isWeeklyReport = daysDiff === 7;
const isPreviousWeek = isWeeklyReport;
```

**Impact**: All reports treated as monthly, breaking weekly comparison logic.

---

### **Issue 3: Missing Weekly Comparison Functions**
**Status**: 🔴 **CRITICAL**

**Problem**: No equivalent functions for weekly comparisons:
- ❌ Missing `getPreviousWeekDateRange()`
- ❌ Missing `fetchPreviousWeekDataFromDB()`
- ❌ Only monthly functions exist

**Impact**: Weekly PDFs cannot generate proper comparative data.

---

### **Issue 4: Wrong Database Query for Weekly Data**
**Status**: 🔴 **CRITICAL**

**Problem**: Even if weekly dates were calculated correctly, the database query is wrong:

```typescript
// Current (WRONG for weekly):
.eq('summary_type', 'monthly')  // Should be 'weekly'
.eq('summary_date', previousDateRange.start)  // Month start, not week start
```

**Impact**: Database returns no data for weekly comparisons.

---

## 🎯 **Expected vs Actual Behavior**

### **Monthly PDF (✅ Working Correctly)**:
- Date Range: `2025-01-01` to `2025-01-31`
- Comparison: Previous month (`2024-12-01` to `2024-12-31`)
- Database Query: `summary_type = 'monthly'`, `summary_date = '2024-12-01'`
- Result: ✅ Proper month-over-month comparison

### **Weekly PDF (❌ Currently Broken)**:
**Current Behavior**:
- Date Range: `2025-01-06` to `2025-01-12` (Week 2)
- Comparison: Previous month (`2024-12-01` to `2024-12-31`) ❌ WRONG
- Database Query: `summary_type = 'monthly'` ❌ WRONG
- Result: ❌ No comparison data or wrong comparisons

**Expected Behavior**:
- Date Range: `2025-01-06` to `2025-01-12` (Week 2)  
- Comparison: Previous week (`2024-12-30` to `2025-01-05` - Week 1) ✅ CORRECT
- Database Query: `summary_type = 'weekly'`, `summary_date = '2024-12-30'` ✅ CORRECT
- Result: ✅ Proper week-over-week comparison

---

## 🔧 **Required Fixes**

### **Fix 1: Add Date Range Type Detection**
```typescript
function detectReportType(dateRange: { start: string; end: string }): 'weekly' | 'monthly' | 'custom' {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);
  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  if (daysDiff === 7) return 'weekly';
  if (daysDiff >= 28 && daysDiff <= 31) return 'monthly';
  return 'custom';
}
```

### **Fix 2: Add Weekly Date Range Calculation**
```typescript
function getPreviousWeekDateRange(dateRange: { start: string; end: string }) {
  const currentStart = new Date(dateRange.start);
  
  // Previous week is exactly 7 days before current week start
  const previousStart = new Date(currentStart.getTime() - (7 * 24 * 60 * 60 * 1000));
  const previousEnd = new Date(previousStart.getTime() + (6 * 24 * 60 * 60 * 1000));
  
  return {
    start: previousStart.toISOString().split('T')[0],
    end: previousEnd.toISOString().split('T')[0]
  };
}
```

### **Fix 3: Add Weekly Database Lookup**
```typescript
async function fetchPreviousWeekDataFromDB(dateRange: { start: string; end: string }, clientId: string) {
  const previousDateRange = getPreviousWeekDateRange(dateRange);
  
  const { data: storedSummary, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'weekly')  // CORRECT: weekly not monthly
    .eq('summary_date', previousDateRange.start)
    .single();
  
  // ... rest of processing
}
```

### **Fix 4: Update Main Logic to Use Correct Functions**
```typescript
// In main PDF generation logic:
const reportType = detectReportType(dateRange);

if (reportType === 'weekly') {
  previousWeekPromise = fetchPreviousWeekDataFromDB(dateRange, clientId);
} else if (reportType === 'monthly') {
  previousMonthPromise = fetchPreviousMonthDataFromDB(dateRange, clientId);
}
```

### **Fix 5: Update PDF Template Logic**
```typescript
// In generatePDFHTML function:
const formatStatValue = (current: any, previous?: number, formatter?: (val: number) => string): string => {
  // ... existing logic
  
  if (previous !== undefined && (reportData.previousMonthTotals || reportData.previousWeekTotals)) {
    const change = calculatePercentageChange(current, previous);
    const comparisonLabel = reportData.previousWeekTotals ? 'vs poprzedni tydzień' : 'vs poprzedni miesiąc';
    return `
      <div class="stat-value">
        <span class="stat-main-value">${formattedCurrent}</span>
        ${formatPercentageChange(change)} <span class="comparison-label">${comparisonLabel}</span>
      </div>
    `;
  }
  
  return `<span class="stat-value">${formattedCurrent}</span>`;
};
```

---

## 📊 **Testing Requirements**

After implementing fixes, test with:

### **Weekly PDF Test Cases**:
1. **Current Week PDF**: Should compare to previous week
2. **Week 1 of Year PDF**: Should compare to last week of previous year  
3. **Random Week PDF**: Should compare to week exactly 7 days prior

### **Monthly PDF Test Cases** (regression testing):
1. **Current Month PDF**: Should still compare to previous month
2. **January PDF**: Should compare to December of previous year
3. **Random Month PDF**: Should compare to previous month

### **Edge Cases**:
1. **Custom Date Range**: Should not show comparisons
2. **Missing Previous Data**: Should gracefully handle no comparison data
3. **Year Boundaries**: Should handle week/month transitions across years

---

## 🚨 **Severity Assessment**

**CRITICAL BUSINESS IMPACT**:
- Weekly PDFs provide **incorrect business intelligence**
- Clients making decisions based on **wrong comparison data**
- Professional credibility impacted by **broken weekly reports**

**TECHNICAL DEBT**:
- Weekly functionality **half-implemented**
- PDF system **not production-ready** for weekly use
- Requires **immediate architectural fix**

**RECOMMENDATION**: 
1. **Immediately** implement weekly-specific PDF logic
2. **Test thoroughly** with both weekly and monthly reports
3. **Update documentation** to reflect weekly PDF capabilities
4. **Consider** adding report type validation to prevent future issues

**Estimated Fix Time**: 4-6 hours  
**Priority**: 🔴 **URGENT** - Weekly PDFs currently unusable 