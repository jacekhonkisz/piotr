# 🧪 Cache & Real-Time Update Testing Guide

**Purpose:** Verify that your smart caching and auto-refresh are working correctly  
**Server Status:** ✅ Running at `http://localhost:3000`

---

## 🎯 Quick Visual Tests

### Test 1: Dashboard Auto-Refresh (5 minutes)
**Expected:** Dashboard should refresh every 5 minutes

1. Open browser to `http://localhost:3000/dashboard`
2. Open DevTools Console (F12)
3. Look for this message every 5 minutes:
   ```
   🔄 Auto-refresh triggered
   ```
4. Watch for subsequent API calls to `/api/fetch-live-data`

**Pass Criteria:** Console shows refresh message every 5 minutes

---

### Test 2: Cache Hit Detection
**Expected:** Current month should load from cache (1-3 seconds)

1. Open dashboard and note load time
2. Refresh page (F5)
3. Check console for messages like:
   ```
   ✅ Returning fresh cached data
   🎯 Smart cache result: { success: true, source: 'cache', ... }
   ```

**Pass Criteria:** 
- Load time < 3 seconds
- Console shows `source: 'cache'` or `source: 'stale-cache'`

---

### Test 3: Manual Refresh Button
**Expected:** Clicking refresh should clear cache and fetch fresh data

1. Open dashboard
2. Find the refresh button (🔄 icon)
3. Click it
4. Watch console for:
   ```
   Odświeżanie danych...
   Dane odświeżone pomyślnie
   ```

**Pass Criteria:** 
- Button shows loading state
- Data updates after click
- Console shows cache clear and fresh fetch

---

### Test 4: Stale Cache + Background Refresh
**Expected:** Stale cache returns instantly, then refreshes in background

**Setup:** This only happens if cache is 3-6 hours old. To test:

1. Open dashboard (uses fresh cache)
2. Wait 3+ hours (or manually modify cache timestamp in database)
3. Reload page
4. Look for console message:
   ```
   ⚠️ Cache is stale, returning stale data instantly + refreshing in background
   🔄 Starting background cache refresh for: { clientId: ..., periodId: ... }
   ```

**Pass Criteria:**
- Page loads instantly with stale data
- Background refresh starts
- Next page load has fresh cache

---

## 🔍 Console Debugging Commands

Open DevTools Console and run these to inspect cache:

### Check if data is from cache
```javascript
// Look for this in network responses
fetch('/api/fetch-live-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientId: 'YOUR_CLIENT_ID',
    dateRange: { 
      start: '2025-09-01', 
      end: '2025-09-30' 
    },
    platform: 'meta'
  })
})
.then(r => r.json())
.then(data => {
  console.log('Data source:', data.debug?.source);
  console.log('Cache age (ms):', data.debug?.cacheAge);
  console.log('From cache:', data.data?.fromCache);
});
```

### Check localStorage cache
```javascript
// Dashboard uses localStorage for 1-minute cache
Object.keys(localStorage)
  .filter(k => k.includes('dashboard_cache'))
  .forEach(key => {
    const cache = JSON.parse(localStorage.getItem(key));
    console.log('Cache key:', key);
    console.log('Cache age:', Date.now() - cache.timestamp, 'ms');
    console.log('Cache source:', cache.dataSource);
  });
```

### Force clear all caches
```javascript
// Clear localStorage
localStorage.clear();

// Clear session storage
sessionStorage.clear();

// Then reload
location.reload();
```

---

## 📊 Expected Console Output (Normal Operation)

### On Page Load (Fresh Cache)
```
🔧 AuthProvider useEffect starting...
🔧 initializeAuth called
User found: user@example.com
🚀 DASHBOARD: Initializing dashboard...
🚀 DASHBOARD: loadMainDashboardData called for client: ClientName
🎯 STANDARDIZED FETCH: { clientId: '...', dateRange: {...}, platform: 'meta' }
🎯 USING SMART CACHE ENDPOINT for current period...
📅 Using MONTHLY smart cache for current month...
✅ Returning fresh cached data
🎯 Smart cache result: { success: true, source: 'cache', campaignsCount: 15 }
✅ Dashboard data loaded successfully
```

### Every 5 Minutes (Auto-Refresh)
```
🔄 Auto-refresh triggered
🚀 DASHBOARD: loadMainDashboardData called for client: ClientName
🎯 STANDARDIZED FETCH: { clientId: '...', dateRange: {...}, platform: 'meta' }
✅ Returning fresh cached data
```

### On Manual Refresh Button Click
```
Odświeżanie danych...
Cleared cache for all clients
🚀 DASHBOARD: loadMainDashboardData called for client: ClientName
🎯 STANDARDIZED FETCH: { clientId: '...', dateRange: {...}, platform: 'meta', reason: 'force-refresh' }
Dane odświeżone pomyślnie
```

---

## ⏱️ Expected Performance

| Scenario | Load Time | Data Source | Console Message |
|----------|-----------|-------------|-----------------|
| **First Load (Fresh Cache)** | 1-3s | Smart Cache | `✅ Returning fresh cached data` |
| **Reload (Cache < 1min)** | 0.1-0.5s | localStorage | `Using localStorage cache` |
| **Reload (Cache 1min-3h)** | 1-3s | Smart Cache | `✅ Returning fresh cached data` |
| **Reload (Cache 3-6h)** | 2-5s | Stale Cache + BG Refresh | `⚠️ Cache is stale, returning stale data` |
| **Reload (No Cache)** | 10-20s | Live API | `🔄 Fetching fresh current month data` |
| **Historical Month** | 0.1-2s | Database | `HISTORICAL - using database` |

---

## 🔧 Troubleshooting

### Issue: No Auto-Refresh After 5 Minutes

**Check:**
1. Console for any errors
2. Make sure you're not in a loading state (`loading: false`)
3. Make sure `refreshingData: false`
4. Check if `clientData` exists

**Fix:**
```javascript
// In console, check these values:
console.log('Loading:', document.querySelector('[data-loading]'));
console.log('Has client data:', !!window.clientData);
```

### Issue: Every Load Takes 10-20 Seconds

**Possible Causes:**
1. Cache is not being created/saved
2. Cache duration expired
3. Database connection issues
4. Cron jobs not running (production only)

**Debug:**
```sql
-- Check if cache exists in Supabase
SELECT 
  client_id,
  period_id,
  last_updated,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as hours_old
FROM current_month_cache
ORDER BY last_updated DESC;
```

### Issue: Data Seems Outdated

**Check Cache Age:**
1. Look for `cacheAge` in console output
2. Should be < 3 hours (10,800,000 ms)
3. If > 3 hours, background refresh might be failing

**Manual Force Refresh:**
1. Click refresh button in dashboard
2. Or clear localStorage and reload
3. Or call API with `forceRefresh: true`

---

## 📈 Production Monitoring

### Check Vercel Cron Job Logs

1. Go to Vercel Dashboard
2. Select your project
3. Click "Cron Jobs" tab
4. Check execution logs for:
   - `/api/automated/refresh-current-month-cache` (every 3 hours)
   - `/api/automated/refresh-current-week-cache` (every 3 hours)
   - `/api/automated/refresh-google-ads-current-month-cache` (every 3 hours)

### Expected Cron Output

```json
{
  "success": true,
  "message": "Automated cache refresh completed",
  "processed": 5,
  "successful": 5,
  "failed": 0,
  "skipped": 0,
  "duration": 45234
}
```

---

## ✅ Success Criteria

Your caching is working correctly if:

- [x] Dashboard loads in < 3 seconds (current month)
- [x] Historical months load in < 2 seconds
- [x] Console shows `source: 'cache'` for current month
- [x] Auto-refresh message appears every 5 minutes
- [x] Manual refresh button works
- [x] No timeout errors (20-40 second waits)
- [x] Background refresh messages appear when cache is stale
- [x] Cron jobs run every 3 hours (production)

---

## 🎯 Quick Checklist

Run through this checklist right now:

1. ✅ **Server is running:** `http://localhost:3000` ✓
2. ⬜ **Dashboard loads quickly:** Open and time it
3. ⬜ **Console shows cache messages:** Check DevTools
4. ⬜ **Refresh button works:** Click the 🔄 button
5. ⬜ **Auto-refresh set up:** Wait 5 minutes or check code
6. ⬜ **No error messages:** Check console for red errors
7. ⬜ **Historical data fast:** Click previous months
8. ⬜ **Platform switching works:** Toggle Meta ↔ Google Ads

---

**Last Updated:** September 30, 2025  
**Next Test:** After deploying to production, verify cron jobs
