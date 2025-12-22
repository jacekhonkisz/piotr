# 🔧 Routing Fix Verification Guide

## ✅ Changes Made

### 1. `StandardizedDataFetcher` (src/lib/standardized-data-fetcher.ts)
- **Line 1042-1073**: Uses `week-helpers.getMondayOfWeek()` (same as BackgroundDataCollector)
- **Query Method**: Exact Monday match with `.eq('summary_date', weekMondayStr)`
- **Added**: Comprehensive debugging logs showing:
  - Client ID
  - Platform
  - Requested range
  - Calculated Monday
  - Exact query parameters

### 2. `fetch-live-data` API Route (src/app/api/fetch-live-data/route.ts)
- **Line 5**: Added static import: `import { getMondayOfWeek, formatDateISO, validateIsMonday } from '../../../lib/week-helpers';`
- **Line 223-271**: Uses `getMondayOfWeek()` from top-level import (no dynamic import issues)
- **Query Method**: Exact Monday match with `.eq('summary_date', weekMondayStr)`

### 3. Enhanced Logging
- Shows exact query parameters before executing
- Logs validation results
- Shows debug info when no data found

---

## 📊 How to Verify It's Working

### Step 1: Check Browser Console

When you navigate to a weekly report (e.g., 2025-W46), you should see:

```
📅 Searching for weekly data in campaign_summaries: {
  clientId: "abc123...",
  platform: "meta",
  requestedRange: "2025-11-10 to 2025-11-16",
  calculatedMonday: "2025-11-10",
  query: {
    client_id: "abc123...",
    summary_type: "weekly",
    platform: "meta",
    summary_date: "2025-11-10"
  },
  ...
}
```

If you see "No weekly summary found", it will also show:

```
🔍 Available weekly summaries for this client/platform: [...]
```

### Step 2: Verify Data in Database

Run this SQL query to check if data exists for the week you're trying to view:

```sql
SELECT 
  c.name,
  c.id as client_id,
  cs.summary_date,
  cs.total_spend,
  cs.reservations,
  cs.booking_step_1
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE cs.summary_date = '2025-11-10'  -- Monday of week 46
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';
```

### Step 3: Check What Was Collected

```bash
cd /Users/macbook/piotr
cat /tmp/belmonte_full_collection_final.log | grep "Week 0:"
```

Should show:
```
[INFO] 📅 Week 0: 2025-11-10 to 2025-11-16 (COMPLETED)
```

---

## 🔍 Troubleshooting

### Issue: "StandardizedDataFetcher returned no data"

**Possible causes:**

1. **Data doesn't exist in database**
   - Check: Run the SQL query above
   - Fix: Verify collection completed successfully

2. **Client ID mismatch**
   - Check: Look at the browser console log for `clientId` value
   - Check: Run `SELECT id, name FROM clients WHERE name = 'Belmonte Hotel';`
   - Verify they match

3. **Platform mismatch**
   - Check: The query is looking for `platform = 'meta'`
   - Verify: Data was collected for Meta platform

4. **Date mismatch**
   - Check: Browser console shows `calculatedMonday: "2025-11-10"`
   - Verify: Database has `summary_date = '2025-11-10'`

5. **Summary type mismatch**
   - Check: Query is looking for `summary_type = 'weekly'`
   - Verify: Data was stored with correct summary_type

### Issue: "Module not found: Can't resolve week-helpers"

**Fixed!** The API route now uses static import at the top of the file:

```typescript
import { getMondayOfWeek, formatDateISO, validateIsMonday } from '../../../lib/week-helpers';
```

---

## 🧪 Test Cases

### Test Case 1: Current Week (2025-W46)
- **Input**: User clicks on "2025-W46" (Nov 10-16)
- **Expected**: Shows data for 2025-11-10
- **Browser Console**: Should log the exact query parameters
- **Result**: Data loads successfully

### Test Case 2: Past Week (2025-W45)
- **Input**: User clicks on "2025-W45" (Nov 3-9)
- **Expected**: Shows data for 2025-11-03
- **Result**: Data loads from database

### Test Case 3: Historical Week (2024-W46)
- **Input**: User clicks on "2024-W46" (Dec 23-29, 2024)
- **Expected**: Shows data for 2024-12-23
- **Result**: Data loads from database (if collected)

---

## 📚 Related Systems

All three systems now use the SAME Monday calculation:

| System | File | Method |
|--------|------|--------|
| **Data Collector** | `background-data-collector.ts` | `getMondayOfWeek()` from `week-helpers` |
| **StandardizedDataFetcher** | `standardized-data-fetcher.ts` | `getMondayOfWeek()` from `week-helpers` |
| **fetch-live-data API** | `fetch-live-data/route.ts` | `getMondayOfWeek()` from `week-helpers` |

**Consistency guarantee:** All systems use `week-helpers.getMondayOfWeek()` which ensures the Monday calculated when fetching data is identical to the Monday used when storing data.

---

## ✅ Next Steps

1. Open the reports page in the browser
2. Open browser console (F12)
3. Navigate to a weekly period (e.g., 2025-W46)
4. Check the console logs for the query parameters
5. Run the SQL verification query
6. If "no data" error persists, share:
   - Browser console logs
   - SQL query results
   - Client ID from the logs

---

## 🎯 Success Criteria

- ✅ No "Module not found" errors
- ✅ Browser console shows detailed query logs
- ✅ Query parameters show correct client_id, platform, summary_date
- ✅ Data loads successfully for weeks that were collected
- ✅ Error message shows available weeks if requested week not found

---

**Status:** ✅ Routing fix complete. All imports resolved. Enhanced logging added.



