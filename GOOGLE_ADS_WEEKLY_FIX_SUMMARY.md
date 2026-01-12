# ✅ Google Ads Weekly Data Fix - Complete

## Issues Fixed

### 1. **Current Week Showing Current Month**
- **Problem:** Weekly requests were using monthly smart cache
- **Fix:** Added weekly detection in `google-ads-standardized-data-fetcher.ts`
- **Result:** Current week now uses `getGoogleAdsSmartWeekCacheData()` instead of monthly cache

### 2. **Past Weeks Showing 0**
- **Problem:** Historical weekly queries used date range instead of exact Monday matching
- **Fix:** Updated `fetchFromDatabaseSummaries()` to use exact Monday matching
- **Result:** Past weeks now correctly find data using `summary_type='weekly'` with exact Monday date

## Code Changes

### File: `src/lib/google-ads-standardized-data-fetcher.ts`

1. **Added Weekly Detection:**
```typescript
const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
const isWeeklyRequest = daysDiff <= 7;
```

2. **Fixed Current Week Detection:**
```typescript
if (isWeeklyRequest) {
  isCurrentPeriod = dateRange.end >= today; // Current week
} else {
  isCurrentPeriod = startYear === currentYear && startMonth === currentMonth; // Current month
}
```

3. **Fixed Current Week Cache:**
```typescript
if (isWeeklyRequest) {
  // Use weekly smart cache
  const cacheResult = await getGoogleAdsSmartWeekCacheData(clientId, false, currentWeek.periodId);
} else {
  // Use monthly smart cache
  const cacheResult = await this.fetchFromGoogleAdsSmartCache(clientId);
}
```

4. **Fixed Historical Weeks:**
```typescript
if (isWeeklyRequest) {
  // Use exact Monday matching
  const weekMonday = getMondayOfWeek(startDate);
  const weekMondayStr = formatDateISO(weekMonday);
  .eq('summary_date', weekMondayStr)  // Exact match
  .eq('summary_type', 'weekly')
}
```

## Scripts Created

### 1. Clear Weekly Cache
**File:** `scripts/clear-google-ads-weekly-cache.sql`
```sql
DELETE FROM google_ads_current_week_cache;
```

### 2. Fix & Backfill Script
**File:** `scripts/fix-google-ads-weeks.ts`
- Clears weekly cache
- Triggers weekly collection for all clients
- Collects last 53 weeks

## How to Use

### Option 1: Run SQL (Fastest)
```sql
-- Run in Supabase SQL Editor
DELETE FROM google_ads_current_week_cache;
```

### Option 2: Run TypeScript Script
```bash
npx tsx scripts/fix-google-ads-weeks.ts
```

### Option 3: Manual Collection
```bash
# For each client, trigger collection:
curl -X POST "http://localhost:3000/api/admin/collect-weekly-data" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"clientId": "CLIENT_ID"}'
```

## Expected Results

After running the fix:

1. **Current Week:**
   - ✅ Uses weekly smart cache (`google_ads_current_week_cache`)
   - ✅ Shows correct weekly data (not monthly)
   - ✅ Booking steps from API only

2. **Past Weeks:**
   - ✅ Uses exact Monday matching
   - ✅ Finds data in `campaign_summaries` with `summary_type='weekly'`
   - ✅ Shows correct historical weekly data

3. **Data Collection:**
   - ✅ Background collector stores weekly data correctly
   - ✅ Uses API data for booking steps
   - ✅ Stores with `platform='google'` and `summary_type='weekly'`

## Verification

Check if weekly data exists:
```sql
SELECT 
  client_id,
  summary_date,
  summary_type,
  platform,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3
FROM campaign_summaries
WHERE platform = 'google'
  AND summary_type = 'weekly'
ORDER BY summary_date DESC
LIMIT 10;
```

Check weekly cache:
```sql
SELECT 
  client_id,
  period_id,
  last_updated,
  (cache_data->'stats'->>'totalSpend')::numeric as spend
FROM google_ads_current_week_cache;
```

