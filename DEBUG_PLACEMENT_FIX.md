# 🐛 Debug Steps: Why Placement Names Still Show as Blank

## Issue
After implementing the placement name fix, the "Miejsce Docelowe" column still shows blank spaces.

## Root Cause
The data currently displayed is **cached** from before the fix was applied. The fix is in the code, but needs fresh data.

## ✅ Solution Steps

### Step 1: Restart Dev Server
```bash
# Stop the current dev server (Ctrl+C)
# Then restart it
npm run dev
```

This ensures the new code is loaded.

### Step 2: Open Browser Console
1. Open your app in the browser
2. Press F12 (or Cmd+Option+I on Mac)
3. Go to "Console" tab
4. Keep it open

### Step 3: Navigate to the Page with Blank Placements
Go to the page showing "Najlepsze Miejsca Docelowe"

### Step 4: Check Console Debug Output
Look for this debug message:
```
🔍 PLACEMENT DATA DEBUG: {
  placementCount: 22,
  firstPlacement: {...},
  hasPlacementField: 'YES' or 'NO'  <-- KEY INDICATOR
}
```

### Step 5: Interpret Results

**If hasPlacementField = 'NO':**
- The data is from cache/database WITHOUT the placement field
- Solution: Force refresh the data (see Step 6)

**If hasPlacementField = 'YES' but still blank:**
- Check if `firstPlacement.placement` has a value
- Might be a frontend rendering issue

### Step 6: Force Refresh Data (Clear Cache)

**Option A: Use Force Refresh Button (if available)**
- Look for a refresh icon or button on the page
- Click it while watching the console

**Option B: Clear Cache via SQL**
```sql
-- Clear Meta tables cache for current month
DELETE FROM current_month_cache 
WHERE client_id = 'YOUR_CLIENT_ID'
AND platform = 'meta';
```

**Option C: Force Refresh via API**
```bash
# Use the fetch-meta-tables endpoint with forceRefresh
curl -X POST http://localhost:3000/api/fetch-meta-tables \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "YOUR_CLIENT_ID",
    "dateRange": {"start": "2025-11-01", "end": "2025-11-17"},
    "forceRefresh": true
  }'
```

### Step 7: Expected Console Output (Success)
```
🔍 PLACEMENT DATA DEBUG: {
  placementCount: 22,
  firstPlacement: {
    placement: "Facebook - Aktualności",  ✅ This should have a value!
    publisher_platform: "facebook",
    platform_position: "feed",
    spend: 9204.61,
    ...
  },
  hasPlacementField: 'YES',
  rawFields: {
    publisher_platform: 'facebook',
    platform_position: 'feed'
  }
}
```

## 🔍 Diagnostic Checklist

- [ ] Dev server restarted with new code
- [ ] Browser console open and visible
- [ ] Page refreshed (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
- [ ] Console shows "🔍 PLACEMENT DATA DEBUG" message
- [ ] Check `hasPlacementField` value
- [ ] If 'NO', force refresh data
- [ ] If 'YES', check `firstPlacement.placement` value

## 🚨 If Still Not Working

### Check 1: Is the Data Source Correct?
Look for this console message:
```
📊 MetaAdsTables: Response from API: {
  source: 'smart-cache' or 'meta_api'
}
```

If source is 'smart-cache' or 'database', the cached data might not have placement names yet.

### Check 2: Verify Backend Code is Running
```bash
# Check if meta-api-optimized.ts changes are active
# Look for these console logs when data is fetched:
"Meta API: Fetched X placement records with conversion data"
```

### Check 3: Check if Client Has Placement Data
Some clients might not have any placement performance data in Meta for the selected period.

## 📝 Quick Test
Run this in browser console while on the page:
```javascript
// Check current placement data in component state
console.log('Placement data:', document.querySelector('[data-testid="placement-table"]'));
```

## 💡 Most Common Solution
**90% of the time, this is the fix:**
1. Restart dev server: `npm run dev`
2. Hard refresh browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. Clear application cache: DevTools → Application → Clear Storage → "Clear site data"
4. Reload the page

The placement names should then appear!





