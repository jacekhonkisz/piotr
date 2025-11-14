# 🔍 Belmonte October 2025 - Three Different Data Sources Audit

**Date**: November 9, 2025  
**Client**: Belmonte Hotel  
**Period**: October 2025 (2025-10-01 to 2025-10-31)

---

## 🚨 CRITICAL FINDING

The dashboard shows **THREE DIFFERENT VALUES** for the same October 2025 period:

| Source | Spend (PLN) | Impressions | Clicks | Conversions | Status |
|--------|-------------|-------------|--------|-------------|--------|
| **1. Dashboard Display** | **572.25** | 221 | 22 | ? | ❌ WRONG - Only 1 week |
| **2. Database (2 weeks)** | **1,586.40** | 574 | 52 | 106 | ⚠️ INCOMPLETE - Missing data |
| **3. Google Ads API** | **4,813.12** | 1,511 | 147 | 90 | ✅ COMPLETE - Full month |

### Discrepancy:
- **Dashboard vs API**: 91.49% difference (4,240.87 PLN missing)
- **Database vs API**: 67.04% difference (3,226.72 PLN missing)
- **Dashboard vs Database**: 63.95% difference (1,014.15 PLN missing)

---

## 📊 SOURCE 1: DASHBOARD (572.25 PLN)

### What the Dashboard Shows:
```
Źródło danych: standardized-fetcher
Polityka: google-ads-smart-cache
Wydana kwota: 572.25 zł
Wyświetlenia: 221
Kliknięcia linku: 22
Raport - Miesiąc: 1 paź 2025 - pt., 31 paź 2025
16 kampanii
```

### Root Cause:
The dashboard is displaying **ONLY ONE WEEKLY SUMMARY** (Week 2, dated 2025-10-27) instead of the full October month.

### Why This Happened:
The API route `/api/fetch-google-ads-live-data` had a bug where it used `.limit(1)` when fetching weekly summaries:

```typescript
// ❌ BUG: Only fetched 1 week
const weeklyQuery = await supabase
  .from('campaign_summaries')
  .select('*')
  .eq('client_id', clientId)
  .eq('summary_type', 'weekly')
  .eq('platform', 'google')
  .gte('summary_date', startDate)
  .lte('summary_date', endDate)
  .order('summary_date', { ascending: false })
  .limit(1);  // ❌ THIS IS THE BUG
```

### Fix Applied:
✅ **FIXED** in `/src/app/api/fetch-google-ads-live-data/route.ts` (lines 148-230)
- Removed `.limit(1)` 
- Now fetches ALL weekly summaries in the date range
- Aggregates all weeks into a monthly total

---

## 📊 SOURCE 2: DATABASE (1,586.40 PLN)

### What's in the Database:
**Table**: `campaign_summaries`  
**Platform**: `google`  
**Summary Type**: `weekly`

#### Weekly Breakdown:
| Week | Date | Spend (PLN) | Impressions | Clicks | Conversions |
|------|------|-------------|-------------|--------|-------------|
| 1 | 2025-10-13 | 1,014.16 | ? | ? | ? |
| 2 | 2025-10-27 | **572.25** | ? | ? | ? |
| **TOTAL** | - | **1,586.40** | **574** | **52** | **106** |

### Status:
⚠️ **INCOMPLETE** - The database only has 2 weekly summaries, missing approximately 2 more weeks of data.

### Missing Data:
- **Missing Spend**: ~3,226.72 PLN
- **Missing Impressions**: ~937
- **Missing Clicks**: ~95

### Data Sources:
- **Smart Cache**: ❌ Not found in `google_ads_current_month_cache`
- **Monthly Summary**: ❌ Not found (no `summary_type='monthly'` record for 2025-10-01)
- **Weekly Summaries**: ✅ Found 2 records (but incomplete)
- **Daily KPI Data**: ❌ Not found

---

## 📊 SOURCE 3: GOOGLE ADS API (4,813.12 PLN)

### Live API Data:
**Method**: Direct Google Ads API call  
**Date Range**: 2025-10-01 to 2025-10-31  
**Status**: ✅ **COMPLETE** - Full month data

| Metric | Value |
|--------|-------|
| **Spend** | **4,813.12 PLN** |
| **Impressions** | **1,511** |
| **Clicks** | **147** |
| **Conversions** | **90** |
| **CTR** | 9.73% |
| **CPC** | 32.74 PLN |
| **Conversion Value** | 88.67 PLN |

### API Query Used:
```sql
SELECT
  customer.id,
  customer.descriptive_name,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.ctr,
  metrics.average_cpc,
  metrics.conversions,
  metrics.conversions_value,
  metrics.cost_per_conversion
FROM customer
WHERE segments.date BETWEEN '2025-10-01' AND '2025-10-31'
```

---

## 🔍 WHY THREE DIFFERENT VALUES?

### Issue #1: Dashboard Query Bug (FIXED)
**Problem**: API route fetched only 1 weekly record instead of all weeks  
**Impact**: Dashboard showed 572.25 PLN instead of aggregated total  
**Fix**: Removed `.limit(1)` and added aggregation logic  
**Status**: ✅ **FIXED**

### Issue #2: Incomplete Data Collection
**Problem**: Only 2 out of ~4 weeks of October are stored in the database  
**Impact**: Database has 1,586.40 PLN instead of 4,813.12 PLN  
**Cause**: Weekly data collection incomplete or failed for some weeks  
**Status**: ⚠️ **NEEDS INVESTIGATION**

### Issue #3: Date Range Mismatch
**Problem**: Different sources use different date boundaries  
**Impact**: Data may not align perfectly across sources  
**Examples**:
- Dashboard uses month boundaries (Oct 1-31)
- Weekly summaries may have different start/end dates
- API uses campaign date ranges

---

## 💡 RECOMMENDATIONS

### HIGH PRIORITY:

1. **✅ FIXED: Dashboard Aggregation Bug**
   - The fix has been applied to `/src/app/api/fetch-google-ads-live-data/route.ts`
   - Dashboard should now show 1,586.40 PLN (all 2 weeks aggregated)
   - Need to refresh the dashboard to see the fix

2. **🔴 CRITICAL: Fill Missing Data Gaps**
   - Database is missing ~2 weeks of October data
   - Need to investigate why data collection failed
   - Recommendation: Run backfill script to fetch missing weeks from Google Ads API

3. **🔴 CRITICAL: Verify Data Collection Process**
   - Check `BackgroundDataCollector` is running correctly
   - Verify weekly data collection triggers properly
   - Check logs for any failed collection attempts in October

### MEDIUM PRIORITY:

4. **Implement Smart Cache for October**
   - October should have been cached in `google_ads_current_month_cache`
   - Investigate why cache is empty for October
   - Ensure cache refresh runs properly for current month

5. **Add Data Validation**
   - Compare database totals with API totals regularly
   - Alert if discrepancy > 10%
   - Automated audit script (like the one we just created)

6. **Standardize Date Ranges**
   - Ensure all sources use consistent date boundaries
   - Document expected behavior for month/week transitions
   - Add validation to ensure complete weeks are collected

### LOW PRIORITY:

7. **Add Monitoring Dashboard**
   - Show data collection status per client
   - Display missing periods
   - Show last successful collection time

8. **Improve Error Handling**
   - Better logging for data collection failures
   - Retry logic for failed collections
   - Notifications for persistent failures

---

## 🛠️ NEXT STEPS

### Immediate Actions:

1. **Test the Fix**:
   ```bash
   # Refresh the dashboard and verify October now shows 1,586.40 PLN
   # Instead of 572.25 PLN
   ```

2. **Backfill Missing Data**:
   ```bash
   # Run collection for missing October weeks
   node scripts/collect-october-belmonte.js
   ```

3. **Verify Data Consistency**:
   ```bash
   # Re-run the 3-month audit to verify fixes
   node scripts/belmonte-3-months-audit.js
   ```

### Long-term Actions:

1. **Set up automated weekly audits**
2. **Monitor data collection completion rates**
3. **Implement alerting for data gaps**
4. **Document data collection architecture**

---

## 📋 FILES MODIFIED

1. **`/src/app/api/fetch-google-ads-live-data/route.ts`**
   - Lines 148-230
   - Fixed weekly aggregation logic
   - Removed `.limit(1)` bug
   - Added aggregation of all weekly summaries

---

## 📈 EXPECTED OUTCOME AFTER FIX

### Before Fix:
- Dashboard: 572.25 PLN (1 week only)

### After Fix (Immediate):
- Dashboard: 1,586.40 PLN (2 weeks aggregated)

### After Backfill (Complete):
- Dashboard: 4,813.12 PLN (full month from API)
- Database: 4,813.12 PLN (all 4 weeks stored)
- API: 4,813.12 PLN (source of truth)

**All three sources should match: 4,813.12 PLN** ✅

---

**Report Generated**: November 9, 2025  
**Generated By**: Belmonte Data Audit Script  
**Status**: ✅ **FIX APPLIED - AWAITING VERIFICATION**



