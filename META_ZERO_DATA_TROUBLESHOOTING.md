# Meta Data Shows 0s - Troubleshooting Guide

## Quick Diagnostics

### Step 1: Check Backend Logs
Run the application and look for these log messages:

```bash
npm run dev
```

**Expected Log Sequence:**
1. `🔄 Fetching fresh current month data from Meta API...`
2. `✅ Fetched X campaigns and Y insights for caching`
3. `🔍 DIAGNOSTIC: Raw Meta API data received:`
4. `🔍 DIAGNOSTIC: Aggregated metrics from Meta API:`
5. `🔍 DIAGNOSTIC: Data being cached:`
6. `💾 Fresh data cached successfully`
7. `💾 Cached stats: { totalSpend: X, ... }`

**If you see:**
- `🚨 ZERO DATA DETECTED: Meta API returned no metrics!` → Meta API issue
- `⚠️ Caching ZERO metrics data` → Confirming zero data is being cached
- `🚨 WARNING: Cached data contains ZERO metrics!` → Returning cached zeros

### Step 2: Check Frontend Console
Open browser console and look for:

```javascript
🔍 MetaPerformanceLive: Raw stats from API: { totalSpend: 0, ... }
🚨 ZERO DATA DETECTED IN FRONTEND!
```

**If you see this:** The backend is successfully returning data, but it's zeros.

### Step 3: Check Database Cache
Run the diagnostic script:

```bash
npx tsx scripts/check_meta_cache.ts
```

**This will show:**
- What's actually stored in `current_month_cache`
- Whether cache is fresh or stale
- Exact values of all metrics
- Campaign count and details

**If ALL metrics are 0 in cache:** The problem is at the Meta API fetch level.

---

## Root Cause Analysis

### Scenario 1: Meta API Returns Empty Data ✅ MOST LIKELY

**Symptoms:**
- Logs show: `✅ Fetched 0 campaigns and 0 insights`
- Or: `✅ Fetched X campaigns and 0 insights`
- Stats calculated as 0 from empty array

**Possible Causes:**
1. **Invalid/Expired Token**
   - Check: `client.meta_access_token` in database
   - Test: Try refreshing Meta access token

2. **Wrong Ad Account ID**
   - Check: `client.ad_account_id` format
   - Should be: `act_123456789` or just `123456789`

3. **No Active Campaigns**
   - Check: Meta Ads Manager
   - Verify campaigns are active in this period

4. **Date Range Issue**
   - Check: Date range being passed to Meta API
   - Current month should have data if campaigns are running

5. **API Permissions**
   - Check: Meta app permissions
   - Required: `ads_read`, `business_management`

**How to Fix:**
1. Test Meta API credentials manually
2. Check Meta Business Manager for active campaigns
3. Verify date range calculation
4. Check Meta API error responses (if any)

---

### Scenario 2: Meta API Returns Data, But It's Lost in Processing ⚠️ LESS LIKELY

**Symptoms:**
- Logs show: `✅ Fetched X campaigns and Y insights` (X, Y > 0)
- But: `totalSpend = 0`, `totalImpressions = 0`

**Possible Causes:**
1. Data format mismatch (e.g., spend is a string not a number)
2. Field names don't match expectations
3. Data is nested differently than expected

**How to Fix:**
Check the diagnostic logs for `firstInsight` object structure.

---

### Scenario 3: Data is Correct, But Cache is Stale ⚠️ LESS LIKELY

**Symptoms:**
- Cache age > 3 hours
- Cache contains old zero data
- Background refresh is failing

**How to Fix:**
1. Force cache refresh by calling API with `forceRefresh: true`
2. Check background refresh logs for errors
3. Clear cache manually:
   ```sql
   DELETE FROM current_month_cache WHERE client_id = 'your-client-id';
   ```

---

## Immediate Actions

### 1. Run Diagnostic Script
```bash
npx tsx scripts/check_meta_cache.ts
```

This will tell you:
- ✅ If cache exists
- ✅ What data is cached
- ✅ If it's fresh or stale
- ✅ If it's zeros or real data

### 2. Check Backend Logs
```bash
# Start dev server with logging
npm run dev

# In another terminal, trigger a data fetch
# Navigate to dashboard in browser
```

Look for the diagnostic logs added in `smart-cache-helper.ts`:
- `🔍 DIAGNOSTIC: Raw Meta API data received:`
- `🔍 DIAGNOSTIC: Aggregated metrics from Meta API:`
- `🔍 DIAGNOSTIC: Data being cached:`

### 3. Check Meta API Directly

Create a test script to call Meta API:

```typescript
import { MetaAPIServiceOptimized } from './src/lib/meta-api-optimized';

const client = {
  meta_access_token: 'YOUR_TOKEN',
  ad_account_id: 'act_YOUR_ACCOUNT_ID'
};

const metaService = new MetaAPIServiceOptimized(client.meta_access_token);
const adAccountId = client.ad_account_id.startsWith('act_') 
  ? client.ad_account_id.substring(4)
  : client.ad_account_id;

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth() + 1;
const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
const endDate = now.toISOString().split('T')[0];

// Test placement performance
const insights = await metaService.getPlacementPerformance(
  adAccountId,
  startDate,
  endDate
);

console.log('Meta API Response:', insights);
```

---

## Solution Checklist

- [ ] Run diagnostic script (`check_meta_cache.ts`)
- [ ] Check backend logs for DIAGNOSTIC messages
- [ ] Check frontend console for ZERO DATA warnings
- [ ] Verify Meta access token is valid
- [ ] Verify ad account ID is correct
- [ ] Check Meta Ads Manager for active campaigns
- [ ] Test Meta API call directly
- [ ] Clear cache if needed
- [ ] Force refresh to get new data

---

## Expected Behavior After Fix

Once fixed, you should see:

**Backend Logs:**
```
✅ Fetched X campaigns and Y insights for caching
🔍 DIAGNOSTIC: Aggregated metrics: { totalSpend: 1234.56, totalImpressions: 50000, ... }
💾 Cached stats: { totalSpend: 1234.56, totalImpressions: 50000, ... }
```

**Frontend Console:**
```
🔍 MetaPerformanceLive: Raw stats from API: { totalSpend: 1234.56, totalImpressions: 50000, ... }
✅ MetaPerformanceLive: Data loaded from smart-cache
```

**Database Cache:**
```
totalSpend: 1234.56
totalImpressions: 50000
totalClicks: 2500
```

**Dashboard:**
- Real spend numbers displayed
- Real impressions, clicks, conversions shown
- Charts populated with real data

---

## Next Steps

1. **Run diagnostics** to identify exact failure point
2. **Fix root cause** (likely Meta API credentials or no campaigns)
3. **Clear stale cache** if needed
4. **Verify fix** by checking all three levels (backend, frontend, database)
5. **Monitor** to ensure data stays correct





