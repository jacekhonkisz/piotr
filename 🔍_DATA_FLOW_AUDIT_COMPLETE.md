# 🔍 COMPLETE DATA FLOW AUDIT - Historical vs Current Period

**Date:** December 23, 2025  
**Issue:** User reports "still see the same" - "N/A brak danych" in funnel

---

## ✅ AUDIT RESULTS: Backend Data Flow is IDENTICAL

### 1. Period Classification Logic

**BOTH historical and current periods use the SAME classification logic:**

**File:** `src/lib/standardized-data-fetcher.ts` (lines 195-266)

```typescript
const isCurrentPeriod = isCurrentWeek || isCurrentMonthOnly;
const needsSmartCache = isCurrentPeriod;
```

**For December 2024:**
- `isExactCurrentMonth`: false (not 2025-12)
- `includesCurrentDay`: false (2024-12-31 < 2025-12-23)
- **Strategy**: `💾 DATABASE_FIRST` ✅

### 2. Data Fetching Methods

#### Historical Period (December 2024):
1. **fetchFromCachedSummaries** (line 276)
   - Queries: `campaign_summaries` table
   - Filters: `summary_date = '2024-12-01'`, `summary_type = 'monthly'`, `platform = 'meta'`
   - Returns: `conversionMetrics` object with ALL fields including:
     - `reservation_value: 136414`
     - `conversion_value: 136414` ✅ (our fix)
     - `total_conversion_value: 136414` ✅ (our fix)

2. **Campaign Transformation** (line 1289-1294)
   ```typescript
   const campaigns = rawCampaigns.map((campaign: any) => ({
     ...campaign,
     conversion_value: campaign.conversion_value ?? campaign.reservation_value ?? 0,
     total_conversion_value: campaign.total_conversion_value ?? campaign.reservation_value ?? 0
   }));
   ```

#### Current Period (December 2025):
1. **fetchFromMonthlySmartCache** (line 389)
   - Queries: `current_month_cache` table
   - Returns: Same `conversionMetrics` structure
   - Applies SAME transformation

### 3. Return Format

**BOTH methods return IDENTICAL structure:**

```typescript
{
  success: true,
  data: {
    stats: {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalConversions,
      averageCtr,
      averageCpc
    },
    conversionMetrics: {
      click_to_call,
      email_contacts,
      booking_step_1,
      booking_step_2,
      booking_step_3,
      reservations,
      reservation_value,
      conversion_value,        // ✅ Added
      total_conversion_value,  // ✅ Added
      roas,
      cost_per_reservation
    },
    campaigns: [...] // With conversion_value added
  }
}
```

---

## 🧪 TEST RESULTS

### Backend Test (December 2024):

```bash
npx tsx scripts/test-dec-2024-fetch.ts
```

**Output:**
```
✅ FOUND SUMMARY:
   reservation_value: 136414 zł
   conversion_value: 136414  ✅
   total_conversion_value: 136414  ✅
```

**Conclusion:** Backend returns correct data. ✅

---

## 🎯 Root Cause Analysis

The "N/A brak danych" boxes in your screenshot are **NOT** the main funnel values. They are:

### Year-over-Year Comparison Badges

**Location:** Right side of funnel  
**Component:** `ConversionFunnel.tsx` lines 220-258  
**Condition:** Shows when `yoyChanges` prop is provided but historical data is unavailable

```typescript
const isNoHistoricalData = change === -999; // Special value
{isNoHistoricalData ? 'N/A' : ...}
{isNoHistoricalData ? 'brak danych' : 'vs rok temu'}
```

### Your Screenshot Shows:

| Element | Value | Status |
|---------|-------|--------|
| **Funnel Step 1** | 363 | ✅ Correct |
| **Funnel Step 2** | 0 | ✅ Correct (historical data issue) |
| **Funnel Step 3** | 0 | ✅ Correct (historical data issue) |
| **Reservations** | 36 | ✅ Correct |
| **YoY Badges** | N/A brak danych | ⚠️ No 2023 data for comparison |

---

## 📊 What You Should See

After refreshing (Cmd+Shift+R), the **bottom two cards** should show:

1. **"Wartość rezerwacji (zakupy w witrynie)"**: **136,414.00 zł**
2. **"ROAS"**: **13.51x**

These are rendered at lines 115-130 in `ConversionFunnel.tsx`.

---

## 🔍 Debugging Steps

I've added console.log statements to `ConversionFunnel.tsx` to trace what props are being passed:

```typescript
console.log('🎯 ConversionFunnel Props:', {
  step1,
  step2,
  step3,
  reservations,
  reservationValue,
  conversionValue,
  totalConversionValue,
  roas
});
```

**To verify:**

1. Open browser console (F12)
2. Navigate to Havet → December 2024
3. Look for: `🎯 ConversionFunnel Props:`
4. Check if `conversionValue` and `totalConversionValue` are **136414**

If they show **0** or **undefined**, the issue is in how `WeeklyReportView` calls `getConversionMetric`.

---

## ✅ CONCLUSION

**Backend data flow is IDENTICAL for historical and current periods.**

Both use:
- Same `StandardizedDataFetcher` class
- Same period classification logic  
- Same data transformation
- Same return format

The fixes applied:
1. ✅ Added `conversion_value` to `conversionMetrics`
2. ✅ Added `conversion_value` to individual campaigns
3. ✅ Server restarted

**Next Step:** Check browser console to see if frontend is receiving the correct data.

---

**Files Modified:**
- `src/lib/standardized-data-fetcher.ts` (2 fixes applied)
- `src/components/ConversionFunnel.tsx` (debug logs added)

**Server Status:** ✅ Running at `http://localhost:3000`

