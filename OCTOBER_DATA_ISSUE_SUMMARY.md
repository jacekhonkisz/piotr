# October 2025 Google Ads Data Issue - Summary

## 🔍 Problem Identified

**October 2025 Google Ads data is missing from the database**, causing slow loading (9 seconds) from live API instead of instant database retrieval.

---

## 🐛 Root Causes Found

### 1. **Missing `data_source` Field** ❌
`storeGoogleAdsMonthlySummary()` was NOT setting the `data_source` field, causing it to default to `'meta_api'` even for Google Ads data.

### 2. **Missing `onConflict` Clause** ❌
The `upsert` operation had no conflict resolution strategy, which could cause silent failures when updating existing records.

### 3. **`storeWeeklySummary()` Hardcoded for Meta** ❌
The weekly summary storage method:
- Hardcoded `data_source: 'meta_api'`
- Had NO `platform` field in the summary object
- Used `onConflict` with `platform` but didn't include it in the data - **THIS CAUSES UPSERT TO FAIL!**

---

## ✅ Fixes Implemented

### Fix #1: Added `data_source` to Monthly Storage
```typescript
// /Users/macbook/piotr/src/lib/background-data-collector.ts
const summary = {
  // ... other fields ...
  data_source: 'google_ads_api', // ✅ NEW: Explicitly set data source
  last_updated: new Date().toISOString()
};

const { error } = await supabase
  .from('campaign_summaries')
  .upsert(summary, {
    onConflict: 'client_id,summary_type,summary_date,platform' // ✅ NEW: Proper conflict resolution
  });
```

### Fix #2: Made Weekly Storage Platform-Aware
```typescript
// /Users/macbook/piotr/src/lib/background-data-collector.ts
private async storeWeeklySummary(
  clientId: string, 
  data: any, 
  platform: 'meta' | 'google' = 'meta' // ✅ NEW: Platform parameter
): Promise<void> {
  // ✅ NEW: Dynamic data_source and tables field
  const dataSource = platform === 'google' ? 'google_ads_api' : 'meta_api';
  const tablesField = platform === 'google' ? 'google_ads_tables' : 'meta_tables';
  const tablesData = platform === 'google' ? data.googleAdsTables : data.metaTables;

  const summary = {
    // ... other fields ...
    platform: platform, // ✅ NEW: Add platform field (was missing!)
    [tablesField]: tablesData, // ✅ NEW: Correct field name
    data_source: dataSource, // ✅ NEW: Correct data source
    // ...
  };
  
  // onConflict now works correctly with platform field present
}
```

---

## ⚠️ Remaining Issue

**Background collector is NOT successfully saving October data**, even after fixes.

Possible causes:
1. **Google Ads API errors** during data fetching
2. **RLS (Row Level Security) policies** blocking the insert
3. **Token/credentials issues** for Google Ads API
4. **Silent errors** in the background collector

---

## 🔧 Next Steps for Debugging

### 1. Check Server Logs
Look for errors in the Next.js server console when the collection runs.

### 2. Run Diagnostic SQL
```bash
# Check what data is actually in the database
supabase db query < DIAGNOSE_GOOGLE_DATA_ISSUE.sql
```

### 3. Test Google Ads API Directly
```bash
# Verify Google Ads credentials and data fetching
curl -X POST http://localhost:3000/api/fetch-google-ads-live-data \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-10-01","endDate":"2025-10-31"}'
```

### 4. Check RLS Policies
```sql
-- Verify service role can insert Google data
SELECT * FROM campaign_summaries 
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND platform = 'google'
LIMIT 1;
```

### 5. Manual Insert Test
Try manually inserting an October record to see if database accepts it:
```sql
INSERT INTO campaign_summaries (
  client_id,
  summary_type,
  summary_date,
  platform,
  total_spend,
  data_source,
  last_updated
) VALUES (
  'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
  'monthly',
  '2025-10-01',
  'google',
  4530.78,
  'google_ads_api',
  NOW()
) ON CONFLICT (client_id, summary_type, summary_date, platform) 
DO UPDATE SET total_spend = EXCLUDED.total_spend;
```

---

## 📊 Current Database State

- ✅ Belmonte client exists with `google_ads_customer_id` set
- ✅ November 2025 Google data EXISTS (but with wrong `data_source: 'meta_api'`)
- ✅ September 2025 Google WEEKLY data EXISTS
- ❌ October 2025 Google monthly data is MISSING
- ❌ All existing Google records show `data_source: 'meta_api'` (should be `'google_ads_api'`)

---

## 🎯 Immediate Action Required

1. **Check server logs** for errors during the last collection attempt
2. **Run the diagnostic SQL** to verify database constraints
3. **Test manual insert** to rule out database issues
4. **Verify Google Ads API credentials** are working

Once we identify the specific error, we can fix the underlying issue preventing October data from being saved.

---

## 📝 Files Modified

1. `/Users/macbook/piotr/src/lib/background-data-collector.ts`
   - Fixed `storeGoogleAdsMonthlySummary()` - added `data_source` and `onConflict`
   - Fixed `storeWeeklySummary()` - added `platform` parameter and field

2. Created diagnostic tools:
   - `/Users/macbook/piotr/DIAGNOSE_GOOGLE_DATA_ISSUE.sql`
   - `/Users/macbook/piotr/scripts/check-october-collection.js`
   - `/Users/macbook/piotr/VERIFY_OCTOBER_DATA_NOW.sql`

---

## ✨ Expected Behavior After Full Fix

1. **October 2025 loads instantly** (<100ms) from `campaign_summaries` table
2. **November 2025 loads from smart cache** (~300ms) with 3-hour refresh
3. **All Google data shows `data_source: 'google_ads_api'`** instead of `'meta_api'`
4. **New clients automatically get 12 months of historical data** upon creation

