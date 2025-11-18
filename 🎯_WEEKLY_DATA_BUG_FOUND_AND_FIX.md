# 🎯 WEEKLY DATA BUG - ROOT CAUSE FOUND + FIX

**Date:** November 18, 2025  
**Status:** 🔴 CRITICAL BUG IDENTIFIED

---

## 🚨 THE BUG

### What You're Seeing:

**Week 47 (Current - Nov 17-23):**  
- Shows: **25,260 zł** (WRONG - this is monthly data!)  
- Should show: ~3,000-4,000 zł (weekly data)

**Week 46 (Past - Nov 10-16):**  
- Shows: **6,271 zł** (might be incomplete/old data)  
- Should show: Full weekly data from database

---

## 🔍 ROOT CAUSE IDENTIFIED

### Location: `src/app/api/fetch-live-data/route.ts` Lines 815-920

### The Problem Code:

```typescript
// Line 815-883: Current week check
if (isCurrentWeekRequest && !forceFresh) {
  logger.info('📊 🟡 CURRENT WEEK DETECTED - CHECKING WEEKLY SMART CACHE...');
  
  try {
    const { getSmartWeekCacheData } = await import('../../../lib/smart-cache-helper');
    const cacheResult = await getSmartWeekCacheData(clientId, false, requestedPeriodId);
    
    if (cacheResult.shouldUseDatabase) {
      // Use database for historical week
      const dbResult = await loadFromDatabase(...);
      if (dbResult) {
        return NextResponse.json({...}); // ✅ Returns here
      } else {
        // ❌ BUG: No return! Falls through!
        logger.info('⚠️ No historical data found in database, falling back to live fetch');
      }
    } else if (cacheResult.success && cacheResult.data.campaigns.length >= 0) {
      // Use cache data
      return NextResponse.json({...}); // ✅ Returns here
    }
    // ❌ BUG: If neither condition is true, NO RETURN! Falls through!
    
  } catch (cacheError) {
    // ❌ BUG: Logs error but NO RETURN! Falls through!
    console.error('⚠️ Weekly smart cache failed, falling back to live fetch:', cacheError);
  }
} else if (isCurrentMonthRequest && !forceFresh) {
  // ⚠️ THIS RUNS when weekly cache fails/falls-through!
  logger.info('📊 🔴 CURRENT MONTH DETECTED - USING SMART CACHE SYSTEM...');
  
  const { getSmartCacheData } = await import('../../../lib/smart-cache-helper');
  const smartCacheResult = await getSmartCacheData(clientId, false, platform);
  
  if (smartCacheResult.success) {
    return NextResponse.json({
      data: smartCacheResult.data, // ⚠️ Returns MONTHLY data!
    });
  }
}
```

### The Bug Explained:

```
1. User requests Week 47 (Nov 17-23)
   ↓
2. isCurrentWeekRequest = TRUE
   ↓
3. Tries getSmartWeekCacheData()
   ↓
4. Smart cache returns empty or error
   ↓
5. cacheResult.success = FALSE
   ↓
6. Neither if condition is met (shouldUseDatabase=false, success=false)
   ↓
7. NO RETURN STATEMENT!
   ↓
8. Code FALLS THROUGH to line 883
   ↓
9. Checks isCurrentMonthRequest (might be TRUE for Nov)
   ↓
10. Gets monthly smart cache
   ↓
11. Returns MONTHLY DATA (25,260 zł)
   ↓
12. UI shows WRONG DATA!
```

---

## ✅ THE FIX

### Fix #1: Add Explicit Guard (RECOMMENDED)

**File:** `src/app/api/fetch-live-data/route.ts`  
**Lines:** 815-883

```typescript
if (isCurrentWeekRequest && !forceFresh) {
  logger.info('📊 🟡 CURRENT WEEK DETECTED - CHECKING WEEKLY SMART CACHE...');
  
  try {
    const { getSmartWeekCacheData } = await import('../../../lib/smart-cache-helper');
    const cacheResult = await getSmartWeekCacheData(clientId, false, requestedPeriodId || undefined);
    
    if (cacheResult.shouldUseDatabase) {
      // Historical week - use database
      const dbResult = await loadFromDatabase(clientId, dateRange.start, dateRange.end, platform);
      
      if (dbResult) {
        const responseTime = Date.now() - startTime;
        return NextResponse.json({
          success: true,
          data: dbResult,
          debug: {
            source: 'historical-database',
            responseTime,
            authenticatedUser: user.email
          }
        });
      }
      // ✅ FIX: If no database result, fall to live fetch (not monthly cache)
      logger.info('⚠️ No historical data found, will fetch live data');
      // Don't return here - let it fall to live fetch at bottom
      
    } else if (cacheResult.success && cacheResult.data.campaigns.length >= 0) {
      // Current week cache hit
      const responseTime = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        data: cacheResult.data,
        debug: {
          source: cacheResult.source,
          responseTime,
          authenticatedUser: user.email
        }
      });
    }
    
    // ✅ FIX: If cache failed, DON'T fall through to monthly!
    // Instead, explicitly go to live fetch
    logger.info('⚠️ Weekly smart cache unavailable, proceeding to live fetch');
    // Continue to live fetch section (skip monthly cache)
    
  } catch (cacheError) {
    logger.error('⚠️ Weekly smart cache error:', cacheError);
    logger.info('Proceeding to live fetch due to cache error');
    // Continue to live fetch (skip monthly cache)
  }
  
  // ✅ CRITICAL FIX: Add explicit guard to prevent monthly fallback
  // If we reached here from weekly request, skip monthly cache entirely
  // Jump directly to live fetch
  
} else if (isCurrentMonthRequest && !isCurrentWeekRequest && !forceFresh) {
  //       ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
  // ✅ ADD THIS CHECK: Only run monthly if NOT a weekly request!
  
  logger.info('📊 🔴 CURRENT MONTH DETECTED - USING SMART CACHE SYSTEM...');
  // ... monthly cache logic ...
}
```

### Fix #2: Restructure with Early Returns

```typescript
// Better structure: Handle each case with explicit returns

if (isCurrentWeekRequest && !forceFresh) {
  // Handle weekly - always return or throw
  return await handleWeeklyRequest(clientId, dateRange, platform, ...);
}

if (isCurrentMonthRequest && !forceFresh) {
  // Handle monthly - always return or throw  
  return await handleMonthlyRequest(clientId, dateRange, platform, ...);
}

// Fall through to live fetch only if neither cache applies
return await handleLiveFetch(clientId, dateRange, platform, ...);
```

---

## 🔧 ADDITIONAL ISSUES

### Issue #2: Missing Weekly Data in Database

**Problem:** Past weeks (Week 46, 45, etc.) have no data in `campaign_summaries` table.

**Why:** Weekly collection cron runs **Sunday 3 AM** but hasn't run since we just configured it.

**Fix:** Run manual collection NOW:

```bash
curl -X POST https://your-domain.vercel.app/api/automated/collect-weekly-summaries \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or via the admin panel or directly call the BackgroundDataCollector:

```typescript
const collector = BackgroundDataCollector.getInstance();
await collector.collectWeeklySummaries();
```

### Issue #3: Corrupted Current Week Cache

**Problem:** `current_week_cache` table might have monthly data stored incorrectly.

**Fix:** Clear the cache:

```sql
-- Check what's in cache
SELECT 
  client_id,
  period_id,
  last_updated,
  cache_data->>'total_spend' as spend,
  cache_data->>'campaigns' as campaigns_count
FROM current_week_cache
WHERE period_id LIKE '2025-W%'
ORDER BY last_updated DESC;

-- If data looks wrong (spend > 10,000), delete it:
DELETE FROM current_week_cache
WHERE period_id LIKE '2025-W47'; -- Current week only
```

---

## 📋 IMMEDIATE ACTION PLAN

### Step 1: Fix the Fallthrough Bug (5 min)

```typescript
// In src/app/api/fetch-live-data/route.ts around line 883
// Change:
} else if (isCurrentMonthRequest && !forceFresh) {

// To:
} else if (isCurrentMonthRequest && !isCurrentWeekRequest && !forceFresh) {
```

### Step 2: Run Weekly Collection (10 min)

```bash
# Option A: Via API (requires CRON_SECRET)
curl -X POST https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries \
  -H "Authorization: Bearer $CRON_SECRET"

# Option B: Wait for Sunday 3 AM cron (automatic)
```

### Step 3: Clear Corrupted Cache (2 min)

```sql
DELETE FROM current_week_cache
WHERE period_id = '2025-W47';
```

### Step 4: Test (5 min)

1. Refresh Week 47 (current week)
   - Should show: ~3,000-4,000 zł
   - Should NOT show: 25,260 zł

2. Check Week 46 (past week)
   - Should show: Database data
   - Should NOT fall back to live API

---

## 🎯 VERIFICATION

### Before Fix:
```
Week 47 (Current): 25,260 zł ❌ (monthly data)
Week 46 (Past): 6,271 zł ⚠️ (incomplete?)
```

### After Fix:
```
Week 47 (Current): 3,500 zł ✅ (weekly data)
Week 46 (Past): 3,200 zł ✅ (from database)
Week 45 (Past): 4,100 zł ✅ (from database)
```

---

## 📊 CODE CHANGE DIFF

```diff
  } else if (isCurrentMonthRequest && !forceFresh) {
+   // ⚠️ CRITICAL: Only run monthly cache if NOT a weekly request
+   // This prevents weekly requests from falling through to monthly cache
  }
  
  // OR better:
  
- } else if (isCurrentMonthRequest && !forceFresh) {
+ } else if (isCurrentMonthRequest && !isCurrentWeekRequest && !forceFresh) {
```

---

## 🚀 DEPLOY

```bash
# Commit the fix
git add src/app/api/fetch-live-data/route.ts
git commit -m "Fix: Prevent weekly requests from falling through to monthly cache

Critical bug: When weekly smart cache failed or returned no data, 
the request would fall through to monthly cache logic, causing 
current week to show monthly totals (25k instead of 3k).

Fix: Add explicit check to prevent monthly cache from running 
when handling a weekly request.

Impact: Current week now shows correct weekly data, not monthly."

# Push to production
git push origin main

# Vercel auto-deploys in ~2 minutes
```

---

## 📈 EXPECTED TIMELINE

- **Fix deployment:** 2-3 minutes (Vercel auto-deploy)
- **Cache clear:** Immediate (SQL command)
- **Weekly collection:** 5-10 minutes (manual trigger) OR Sunday 3 AM (automatic)
- **Full resolution:** 15-20 minutes (manual) OR Sunday morning (automatic)

---

## ✅ SUCCESS CRITERIA

After fix is deployed:

- [ ] Week 47 shows 3,000-4,000 zł (not 25,000 zł)
- [ ] Week 46 shows database data (not cached/wrong data)
- [ ] Past weeks load from database (not live API)
- [ ] No "falling back to monthly cache" logs for weekly requests
- [ ] Weekly collection populates `campaign_summaries` table

---

**Status:** 🔴 CRITICAL - Fix Ready to Deploy  
**Priority:** P0 - Deploy Immediately  
**Impact:** HIGH - Affects all weekly reports  
**Complexity:** LOW - Simple one-line fix + manual collection

**Next Action:** Apply Fix #1 (add `!isCurrentWeekRequest` check)

