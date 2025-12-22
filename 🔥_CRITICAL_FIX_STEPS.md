# Critical Fix Steps - Monthly Cache Zero Data

## What Happened

1. **Next.js Build Corrupted**: The `.next` directory was broken, causing 500 errors
2. **Monthly Cache Contains Zeros**: The cache was populated before the `sanitizeNumber()` fix was applied

## Fixes Applied ✅

### Code Fixes (Already Applied)
1. ✅ `src/lib/smart-cache-helper.ts` (line 197): Added `sanitizeNumber()` to monthly data aggregation
2. ✅ `src/lib/smart-cache-helper.ts` (line 1189): Added `sanitizeNumber()` to weekly data aggregation  
3. ✅ `src/lib/meta-actions-parser.ts` (line 237): Added `sanitizeNumber()` to conversion metrics

### Build Fix (Just Done)
4. ✅ Cleared `.next` directory and restarted dev server

## Next Steps - USER ACTION REQUIRED

### Step 1: Wait for Build to Complete
Wait ~30-60 seconds for the Next.js build to finish. You'll see:
```
✓ Compiled successfully
✓ Ready on http://localhost:3000
```

### Step 2: Start Supabase (if not running)
```bash
npx supabase start
```

### Step 3: Clear the Corrupted Cache
Run these commands to delete the zero-data cache:

```bash
# Clear monthly cache (contains zeros)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "DELETE FROM current_month_cache WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';"

# Clear weekly cache (also has corrupted data)
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "DELETE FROM current_week_cache WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';"
```

### Step 4: Regenerate Cache with Fixed Code
1. Go to `http://localhost:3000/reports?clientId=ab0b4c7e-2bf0-46bc-b455-b18ef6942baa`
2. Click the **"Odśwież dane"** (Refresh Data) button
3. Wait for the data to load (this will regenerate the cache with correct numeric aggregation)

### Step 5: Verify the Fix
Check the terminal logs for:
- ✅ No more "ZERO metrics" warnings
- ✅ `totalSpend` should be a **number**, not `0` or a concatenated string
- ✅ `campaignsCount` should be > 0 if there are active campaigns

## Expected Results After Fix

### Current Month (November 2025)
- Should show real data from Meta API (if campaigns are running)
- If no campaigns are active, zeros are expected

### Past Periods
- Should show data from `campaign_summaries` table
- Example: November 2024 showed 29,589.15 zł spend

## Troubleshooting

If data still shows zeros after cache clear + refresh:
1. Check if Meta API is returning data (look for Meta API errors in logs)
2. Verify client has active campaigns in November 2025
3. Check Meta access token is valid (`META_ACCESS_TOKEN` in `.env.local`)

## Files Changed in This Fix

```
src/lib/smart-cache-helper.ts       (line 197, 1189)
src/lib/meta-actions-parser.ts      (line 237-261)
src/app/api/fetch-meta-tables/route.ts
src/app/api/generate-pdf/route.ts
```

