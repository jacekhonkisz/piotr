# 🔄 Force Refresh Browser Cache - Instructions

The UI is showing 39 phone clicks because your browser has cached the old report data in React state.

## Quick Fix (Recommended):

1. **Hard Refresh the Browser:**
   - **Mac:** Press `Cmd + Shift + R` (or `Cmd + Option + R`)
   - **Windows/Linux:** Press `Ctrl + Shift + R` (or `Ctrl + F5`)

2. **Switch Platform Tabs:**
   - Click on **Google** tab, then back to **Meta** tab
   - This triggers a fresh data fetch

3. **Clear Browser Storage (if above doesn't work):**
   - Open Browser DevTools (F12)
   - Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
   - Click **Clear Storage** or **Clear Site Data**
   - Refresh the page

## Alternative: Force Refresh via Console

Open browser console (F12) and run:

```javascript
// Clear all reports state
localStorage.clear();
sessionStorage.clear();
// Reload page
window.location.reload();
```

## What Should Happen:

After refreshing:
- **Meta tab** → Should show **21 phone clicks** ✅
- **Google tab** → Should show **18 phone clicks** ✅
- **Combined** → Should show **39** (only if viewing unified report)

## If Still Seeing 39:

1. Check which **tab** you're viewing (Meta vs Google)
2. Check which **period** you're viewing (December 2024 monthly vs weekly)
3. Check browser console for any errors
4. Verify the database has correct values (already done ✅)

