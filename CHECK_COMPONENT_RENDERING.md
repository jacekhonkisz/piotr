# 🔍 Check If MetaAdsTables Component Is Being Called

## Issue: Can't see "FORCING SMART CACHE" logs

This could be because:
1. ❌ Console filter is active (I see "ART CACHE" filter)
2. ❌ Component not being rendered on current page
3. ❌ API not being called at all

## 🔧 Quick Fix Steps:

### Step 1: Clear Console Filter

1. In the console, find the filter box that says **"ART CACHE"**
2. **Click the X** to clear it
3. OR type a new filter: `FORCING`

### Step 2: Check Which Page You're On

The `MetaAdsTables` component is only rendered on **REPORTS page**, NOT the dashboard.

**Are you on:**
- ✅ `/reports` page? → Component SHOULD render
- ❌ `/dashboard` page? → Component WON'T render (no meta tables there)

### Step 3: Verify Component Renders

1. Go to **Reports page** (`/reports`)
2. **Select November 2025** period
3. **Scroll down** to where you see "Brak danych dla tego okresu"
4. **Open Console** (F12)
5. **Clear the filter** (remove "ART CACHE")
6. **Reload** the page

You should now see:
```
🔧 FORCING SMART CACHE USE FOR CURRENT MONTH
```

## 🎯 Quick Test - Which Page Are You On?

Run this in console to check:

```javascript
console.log('Current URL:', window.location.pathname);
console.log('Is on Reports page?', window.location.pathname.includes('reports'));
```

If it says `false`, you're not on the reports page!

---

## 📊 Where MetaAdsTables Is Used:

The component is ONLY rendered in:
- **Reports Page** (`src/app/reports/page.tsx`)
- When viewing a specific period (monthly/weekly/custom)
- After main campaign data loads

It's NOT on:
- Dashboard page
- Any other page

---

## ✅ Correct Test Steps:

1. **Navigate to**: `http://localhost:3000/reports` (or your domain/reports)
2. **Select client**: Choose Belmonte
3. **Select period**: Choose November 2025 (or any current month period)
4. **Scroll to demographics section** (usually at bottom)
5. **Open Console** with NO FILTERS
6. **Reload the page**
7. **Look for**: `🔧 FORCING` log

---

## 🔍 Alternative: Search Console Logs

If you've already reloaded, search the console:

1. Press **Ctrl+F** (or Cmd+F on Mac)
2. Search for: `FORCING`
3. If found → Expand and copy all logs
4. If not found → Component not being called

---

## 🚨 If Still Not Seeing Logs:

Try this in console:

```javascript
// Check if component is mounted
const metaTablesComponent = document.querySelector('[data-testid*="meta"]') || 
                            document.querySelector('div').textContent.includes('Brak danych');
console.log('MetaAdsTables component found?', !!metaTablesComponent);

// Check if API was called
console.log('Network requests containing "meta-tables":', 
  performance.getEntriesByType('resource')
    .filter(r => r.name.includes('meta-tables'))
    .map(r => ({ url: r.name, when: new Date(r.startTime).toLocaleTimeString() }))
);
```

This will show if:
- Component is mounted
- API was ever called

Copy the results!

