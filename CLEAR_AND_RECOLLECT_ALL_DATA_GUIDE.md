# 🔄 Clear All Caches and Recollect All Data - Guide

## Overview

This guide explains how to clear all current period caches for all clients and trigger a full data recollect, including booking steps and all other metrics.

## Problem

After fixing the booking steps bug (campaign ID type mismatch), all current period caches contain incorrect data. We need to:
1. Delete all current period caches (month & week) for ALL clients
2. Recollect ALL data (not just booking steps) for all clients

## Solution

Two scripts are provided:

### 1. SQL Script: `scripts/clear-all-current-period-caches.sql`

**Purpose:** Quickly delete all current period caches from the database

**What it does:**
- Deletes Google Ads current month cache
- Deletes Google Ads current week cache  
- Deletes Meta current month cache
- Deletes Meta current week cache
- For ALL clients with current period data

**Usage:**
```bash
psql -d your_database -f scripts/clear-all-current-period-caches.sql
```

**Note:** This only deletes caches. Data will be recollected on next request or via the TypeScript script.

---

### 2. TypeScript Script: `scripts/clear-all-caches-and-recollect-all-data.ts`

**Purpose:** Delete caches AND immediately recollect all data for all clients

**What it does:**
1. Deletes all current period caches (same as SQL script)
2. Fetches all active clients
3. For each client:
   - Recollects Meta Ads current month data (if client has Meta)
   - Recollects Meta Ads current week data (if client has Meta)
   - Recollects Google Ads current month data (if client has Google Ads)
   - Recollects Google Ads current week data (if client has Google Ads)
4. Verifies caches were recreated
5. Provides summary of success/failures

**Usage:**
```bash
npx tsx scripts/clear-all-caches-and-recollect-all-data.ts
```

**What gets recollected:**
- ✅ All campaign data
- ✅ All conversion metrics (including booking steps)
- ✅ All spend, impressions, clicks
- ✅ All conversion values
- ✅ All ROAS and performance metrics
- ✅ Everything that was in the cache

**Time Estimate:**
- ~2-5 seconds per client
- For 10 clients: ~20-50 seconds
- For 50 clients: ~2-4 minutes

---

## Which Script to Use?

### Use SQL Script If:
- ✅ You just want to clear caches quickly
- ✅ Data will be recollected automatically on next user request
- ✅ You want to avoid API rate limits
- ✅ You're doing this during off-peak hours

### Use TypeScript Script If:
- ✅ You want immediate data recollect
- ✅ You want to verify data is correct right away
- ✅ You want a summary of what was collected
- ✅ You want to ensure all clients get fresh data

---

## Expected Results

### Before:
- Cache: Booking Step 1: 48 (wrong)
- Reports Page: Shows 48 (wrong)

### After:
- Cache: Booking Step 1: 459 (correct)
- Reports Page: Shows 459 (correct)
- Matches Google Ads Console ✅

---

## Verification

After running the scripts, verify:

1. **Check Cache Count:**
   ```sql
   SELECT 
     'google_ads_current_month_cache' as table_name,
     COUNT(*) as entries
   FROM google_ads_current_month_cache
   WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
   UNION ALL
   SELECT 
     'current_month_cache' as table_name,
     COUNT(*) as entries
   FROM current_month_cache
   WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
   ```

2. **Check Booking Steps:**
   ```sql
   SELECT 
     client_id,
     cache_data->'conversionMetrics'->>'booking_step_1' as step1,
     cache_data->'conversionMetrics'->>'booking_step_2' as step2,
     cache_data->'conversionMetrics'->>'booking_step_3' as step3
   FROM google_ads_current_month_cache
   WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
   ```

3. **Check Reports Page:**
   - Navigate to reports page
   - Verify booking steps match Google Ads Console

---

## Troubleshooting

### Error: "No refresh token available"
- **Cause:** Client doesn't have Google Ads refresh token
- **Fix:** Check if manager refresh token exists in `system_settings`
- **Note:** Script will skip clients without tokens

### Error: "Meta token is required"
- **Cause:** Client doesn't have Meta access token
- **Fix:** Ensure client has `meta_access_token` or `system_user_token`
- **Note:** Script will skip clients without tokens

### Cache Not Recreated
- **Cause:** API error or rate limit
- **Fix:** Check error logs in script output
- **Retry:** Run script again for failed clients

### Booking Steps Still Wrong
- **Cause:** Code fix not deployed
- **Fix:** Ensure `src/lib/google-ads-api.ts` has the String() conversion fix
- **Verify:** Check lines 896 and 597 have `String(campaignId)` and `String(campaign.id)`

---

## Files Modified

1. **`src/lib/google-ads-api.ts`** - Fixed campaign ID type mismatch
2. **`scripts/clear-all-current-period-caches.sql`** - SQL script to delete caches
3. **`scripts/clear-all-caches-and-recollect-all-data.ts`** - Full recollect script

---

## Next Steps

After recollecting:
1. ✅ Verify booking steps match Google Ads Console
2. ✅ Check reports page shows correct data
3. ✅ Monitor cache refresh cron jobs (should maintain fresh data)
4. ✅ Run audit: `npx tsx scripts/fetch-havet-live-booking-steps-comparison.ts`

