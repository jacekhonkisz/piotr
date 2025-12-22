# Data Source Fix & Metrics Audit

## Issues Reported

1. ✅ **"Fresh Cache" still showing** - Fixed!
2. ⚠️ **Metrics don't match reports** - Needs investigation

---

## Part 1: Data Source Label Fixes ✅

### Problem
User was seeing "Fresh Cache" instead of simplified source names like "Google Cache" or "Meta Cache".

### Root Cause
The `DataSourceIndicator` component was checking if source contains "cache" and displaying "Fresh Cache" for all cache sources, overriding the simplified names.

### Files Fixed

#### 1. DataSourceIndicator.tsx
**Changed:** `getSourceLabel` function to prioritize exact matches first

```typescript
// Before:
if (source.includes('cache')) {
  return 'Fresh Cache';  // ❌ Generic
}

// After:
switch (source) {
  case 'google-cache':
    return 'Google Cache';  // ✅ Specific
  case 'meta-cache':
    return 'Meta Cache';    // ✅ Specific
  case 'cache':
    return 'Cache';         // ✅ Simple
}
```

#### 2. WelcomeSection.tsx
**Changed:** Development-only cache indicator

```typescript
// Before:
<span>Fresh Cache</span>

// After:
<span>Cache</span>
```

### Expected Result
Now when switching to Google Ads, you should see:
- **Top indicator:** "Google Cache" (not "Fresh Cache")
- **Daily Metrics:** "Cache" or "Database" (not "daily-unified-fallback")

---

## Part 2: Metrics Discrepancy Audit ⚠️

### Current Dashboard Values (From Screenshot)
```
WYDATKI (GOOGLE):      330,36 zł
WYŚWIETLENIA (GOOGLE): 105 (6 wcz)
KLIKNIĘCIA (GOOGLE):   16
KONWERSJE (GOOGLE):    0
```

### Questions to Investigate

1. **What values does /reports show for the same period?**
   - Please check reports page for Google Ads
   - Same date range (current month)
   - Compare spend, impressions, clicks, conversions

2. **What does the terminal log show?**
   - Look for: `✅ CACHE-FIRST: Loaded COMPLETE Google data from smart cache`
   - Check the stats values logged
   - Look for: `statsValues: { totalSpend: X, totalClicks: Y, ... }`

3. **Is the dashboard using cache while reports use live API?**
   - Dashboard: Uses cache-first mode for tab switching
   - Reports: May force refresh for accuracy

---

## Data Fetching Comparison

### Dashboard Flow (Cache-First Mode)
```
1. User switches to Google Ads tab
   ↓
2. handleTabSwitch(provider='google', cacheFirst=true)
   ↓
3. loadMainDashboardData(client, 'google', true)
   ↓
4. Attempt: POST /api/google-ads-smart-cache
   - Headers: Authorization: Bearer {token}
   - Body: { clientId, forceRefresh: false }
   ↓
5. If cache data is COMPLETE (has stats + metrics):
   - Use cache data immediately
   - Source: 'google-cache'
   - Time: 1-2 seconds
   ↓
6. If cache data is INCOMPLETE or failed:
   - Fallback to GoogleAdsStandardizedDataFetcher
   - Or POST /api/fetch-google-ads-live-data
   - Source: 'google-live' or 'database'
   - Time: 5-10 seconds
```

### Reports Flow
```
1. User selects period
   ↓
2. fetchReportDataUnified(params)
   ↓
3. If server-side:
   - GoogleAdsStandardizedDataFetcher.fetchData()
   - Reason: 'google-ads-reports-standardized'
   ↓
4. If client-side:
   - POST /api/fetch-google-ads-live-data
   - Headers: Authorization: Bearer {token}
   - Body: { clientId, dateRange, reason: 'google-ads-reports-standardized' }
   ↓
5. StandardizedDataFetcher checks:
   a. current_month_cache (3-hour TTL)
   b. daily_kpi_data table
   c. Live Google Ads API
   ↓
6. Returns data with source info
```

### Key Differences

| Aspect | Dashboard | Reports |
|--------|-----------|---------|
| **Mode** | Cache-first (speed priority) | Standard (accuracy priority) |
| **API** | `/api/google-ads-smart-cache` first | `/api/fetch-google-ads-live-data` |
| **Validation** | Checks if cache is "complete" | Uses whatever fetcher returns |
| **Fallback** | Falls back if incomplete | Uses StandardizedDataFetcher logic |
| **Reason** | `dashboard-tab-switch-cache-first` | `google-ads-reports-standardized` |

---

## Possible Causes of Discrepancy

### 1. ⚠️ Cache is Stale or Incomplete
**Symptom:** Dashboard shows old/partial data, reports show current data

**Debug:**
```bash
# Check terminal logs for:
🔍 CACHE-FIRST: Google cache data validation:
  hasValidStats: true/false
  statsValues: { totalSpend: X, ... }
```

**Solution:** If cache is incomplete, dashboard will fallback to live API. If not falling back, validation logic may be wrong.

### 2. ⚠️ Date Range Mismatch
**Symptom:** Dashboard and reports using different date ranges

**Debug:**
```typescript
// Dashboard date range:
const currentMonthInfo = getCurrentMonthInfo();
// Returns: { startDate: '2025-11-01', endDate: '2025-11-30', periodId: '2025-11' }

// Reports date range:
const { startDate, endDate } = getMonthBoundaries(year, month);
// Returns: similar format
```

**Solution:** Ensure both use the same `getCurrentMonthInfo()` function.

### 3. ⚠️ Different Data Sources
**Symptom:** Dashboard uses cache, reports use database or live API

**Debug:**
```bash
# Dashboard terminal logs:
Source: google-cache
Reason: dashboard-tab-switch-cache-first

# Reports terminal logs:
Source: database
Reason: google-ads-reports-standardized
```

**Solution:** Cache might be out of sync with database. Force refresh dashboard.

### 4. ⚠️ Conversion Metrics Calculation
**Symptom:** Stats match but conversion metrics don't

**Debug:**
```bash
# Check if conversionMetrics are calculated the same way:
Dashboard: result.data.conversionMetrics
Reports: result.data.conversionMetrics
```

**Solution:** Both should use `GoogleAdsStandardizedDataFetcher` which applies the same calculations.

---

## Debugging Steps

### Step 1: Compare Sources
1. Open Dashboard → Switch to Google Ads
2. Note the source shown (should now be "Google Cache")
3. Open Reports → Select current month
4. Note the source shown
5. **Are they different?** If yes, that's the issue.

### Step 2: Compare Date Ranges
1. Dashboard: Check terminal logs for:
   ```
   📅 Dashboard using smart cache date range: {
     periodId: '2025-11',
     dateRange: { start: '2025-11-01', end: '2025-11-30' }
   }
   ```
2. Reports: Check terminal logs for similar info
3. **Are dates different?** If yes, that's the issue.

### Step 3: Compare Stats Values
1. Dashboard: Check terminal logs for:
   ```
   📡 CACHE-FIRST: Google cache result: {
     statsValues: { totalSpend: X, totalClicks: Y, totalImpressions: Z }
   }
   ```
2. Reports: Check terminal logs for similar info
3. **Are values different?** If yes, cache is stale or calculation differs.

### Step 4: Force Refresh Test
1. Dashboard → Click refresh button (or modify code to set `forceRefresh: true`)
2. This will bypass cache and fetch live data
3. **Do values now match reports?** If yes, cache was stale.

---

## Expected Terminal Log Output

### ✅ Correct Flow (Cache Hit)
```
⚡ CACHE-FIRST MODE: Using Google Ads smart cache API directly
📡 CACHE-FIRST: Google cache response status: 200
📡 CACHE-FIRST: Google cache result: {
  success: true,
  hasData: true,
  hasStats: true,
  hasCampaigns: true
}
🔍 CACHE-FIRST: Google cache data validation: {
  hasCacheData: true,
  hasValidStats: true,
  hasValidMetrics: true,
  statsValues: { totalSpend: 330.36, totalClicks: 16, totalImpressions: 105 },
  isComplete: true
}
✅ CACHE-FIRST: Loaded COMPLETE Google data from smart cache - SKIPPING live API call!
```

### ⚠️ Problematic Flow (Cache Miss/Incomplete)
```
⚡ CACHE-FIRST MODE: Using Google Ads smart cache API directly
📡 CACHE-FIRST: Google cache response status: 200
📡 CACHE-FIRST: Google cache result: {
  success: true,
  hasData: true,
  hasStats: false,  ← Problem!
  hasCampaigns: true
}
🔍 CACHE-FIRST: Google cache data validation: {
  hasCacheData: true,
  hasValidStats: false,  ← Problem!
  hasValidMetrics: false,
  statsValues: { totalSpend: 0, totalClicks: 0, totalImpressions: 0 },
  isComplete: false  ← Will fallback
}
⚠️ CACHE-FIRST: Google cache data incomplete or invalid, will fallback
⚠️ CACHE-FIRST GOOGLE: Falling back to standard fetcher
```

---

## Next Steps

### Immediate Action Required

1. **Test the source label fix:**
   - Refresh dashboard
   - Switch to Google Ads tab
   - Verify you see "Google Cache" (not "Fresh Cache")
   - ✅ This should be fixed now

2. **Compare with reports:**
   - Open reports page
   - Select current month (November 2025)
   - Check Google Ads values
   - **Are they the same as dashboard?**

3. **Send me the terminal logs:**
   - Look for the cache validation logs
   - Copy the `statsValues` object
   - This will show what data the cache actually has

### If Values Don't Match

**Option A: Cache is stale**
- Click the refresh button on dashboard
- This will force a fresh fetch
- Values should update to match reports

**Option B: Different date ranges**
- Check terminal logs for both dashboard and reports
- Look for the `dateRange` objects
- If different, we need to fix date calculation

**Option C: Different data sources**
- Dashboard using cache from yesterday
- Reports using live API from today
- We need to ensure cache refreshes more frequently

---

## Files Modified

1. ✅ `/src/components/DataSourceIndicator.tsx` - Fixed source labels
2. ✅ `/src/components/WelcomeSection.tsx` - Fixed development indicator
3. ✅ `/src/lib/daily-metrics-cache.ts` - Simplified source names (earlier)
4. ✅ `/src/app/dashboard/page.tsx` - Simplified cache sources (earlier)

---

## Questions for You

1. **What values do you see on the /reports page for Google Ads?**
   - Spend: ?
   - Clicks: ?
   - Impressions: ?
   - Conversions: ?

2. **Do the dashboard values change when you click refresh?**

3. **Can you copy the terminal logs showing:**
   - `📡 CACHE-FIRST: Google cache result:`
   - `🔍 CACHE-FIRST: Google cache data validation:`
   - `statsValues: { ... }`

This will help me identify exactly where the discrepancy is!








