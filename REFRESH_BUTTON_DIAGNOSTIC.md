# 🔍 Refresh Button Diagnostic Guide

## Changes Made

1. ✅ Added extensive console logging to track refresh flow
2. ✅ Improved error handling to prevent data from being zeroed out
3. ✅ Added validation to only update if fresh data is received
4. ✅ Added 2-second wait for database/cache to update

## How to Diagnose

### Step 1: Check Browser Console

When you click "Odśwież", you should see these logs in order:

1. `🔄 REFRESH BUTTON CLICKED:` - Confirms button was clicked
2. `✅ REFRESH STARTED` - Confirms function is executing
3. `🔄 REFRESH: Calling Google Ads API with:` - Shows API call details
4. `📡 Google Ads API Response:` - Shows API response status
5. `✅ Google Ads API Success:` - Shows data received
6. `⏳ REFRESH: Waiting for API calls to complete...`
7. `📊 REFRESH: API calls completed:`
8. `✅ REFRESH: All API calls succeeded` OR `❌ REFRESH: Some refresh calls failed`
9. `📊 REFRESH: Fresh data received:`
10. `✅ REFRESH: Updating dashboard with fresh data`

### Step 2: Check for Blocking Conditions

If you see `❌ REFRESH BLOCKED:`, check:
- `noUser: true` → User not logged in
- `loading: true` → Another operation in progress
- `alreadyRefreshing: true` → Refresh already running
- `noClient: true` → No client selected

### Step 3: Check API Response

If API calls fail, you'll see:
- `❌ Google Ads API Error:` with error details
- Check Network tab in browser DevTools for actual HTTP status codes

### Step 4: Verify Data Update

After refresh, check console for:
- `📊 REFRESH: Updated clientData:` with new values
- Dashboard should show updated numbers

## If Nothing Happens

### Option 1: Restart Development Server

If running in dev mode:
```bash
# Stop the server (Ctrl+C)
# Then restart:
npm run dev
```

### Option 2: Rebuild Application

If changes aren't being picked up:
```bash
npm run build
npm run start  # For production
# OR
npm run dev    # For development
```

### Option 3: Clear Browser Cache

1. Open browser DevTools (F12)
2. Right-click refresh button → "Empty Cache and Hard Reload"
3. Or clear localStorage: `localStorage.clear()` in console

### Option 4: Check if Function is Called

Add this temporary log at the very start of `refreshLiveData`:
```typescript
console.log('🔥 REFRESH FUNCTION CALLED - THIS SHOULD APPEAR');
```

If this doesn't appear, the button click isn't reaching the function.

## Common Issues

### Issue 1: "Refresh blocked" - No client selected
**Solution:** Make sure a client is selected in the dashboard

### Issue 2: API returns 401/403
**Solution:** Check if session token is valid. May need to re-login.

### Issue 3: API returns empty data
**Solution:** Check if Google Ads credentials are configured correctly

### Issue 4: Data updates but dashboard doesn't refresh
**Solution:** Check if `setRenderKey` is being called to force re-render

## Next Steps

1. **Open browser console** (F12 → Console tab)
2. **Click "Odśwież" button**
3. **Copy all console logs** starting with 🔄, ✅, ❌, 📊
4. **Share the logs** so we can see exactly where it's failing

## Expected Behavior

✅ **Working correctly:**
- Button click triggers logs
- API calls succeed (status 200)
- Fresh data received (campaigns > 0 or totalSpend > 0)
- Dashboard updates with new values
- No data is zeroed out

❌ **Not working:**
- No logs appear → Button not wired correctly
- Logs show "blocked" → Check blocking conditions
- API returns error → Check API endpoint and credentials
- Data is zeroed → Check error handling (should preserve data)

