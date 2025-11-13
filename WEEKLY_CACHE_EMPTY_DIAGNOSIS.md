# 🔍 Meta Weekly Cache Empty - Root Cause Analysis

**Date:** November 12, 2025  
**Issue:** Meta Weekly Cache showing 0 entries  
**Status:** 🔴 **CRITICAL - Schema Mismatch Found**

---

## 🚨 ROOT CAUSE IDENTIFIED

**Problem:** Schema mismatch between database table and application code

### Schema Comparison

**Migration File** (`030_current_week_cache.sql`):
```sql
CREATE TABLE current_week_cache (
  id UUID,
  client_id UUID NOT NULL,
  period_id TEXT NOT NULL,
  cache_data JSONB NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),  ✅
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, period_id)
);
```

**Actual Database** (from `SAFE_01_CREATE_TABLES_ONLY.sql`):
```sql
CREATE TABLE current_week_cache (
  id UUID,
  client_id UUID NOT NULL,
  period_id TEXT NOT NULL,
  period_start DATE NOT NULL,          ❌ Extra field
  period_end DATE NOT NULL,            ❌ Extra field
  platform TEXT DEFAULT 'meta' NOT NULL, ❌ Extra field
  cache_data JSONB NOT NULL,
  last_refreshed TIMESTAMPTZ NOT NULL,  ❌ Wrong name!
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE(client_id, period_id)
);
```

**Application Code** (`smart-cache-helper.ts` line 1470):
```typescript
await supabase.from('current_week_cache').upsert({
  client_id: clientId,
  cache_data: freshData,
  last_updated: new Date().toISOString(),  ❌ Column doesn't exist!
  period_id: targetWeek.periodId
  // Missing: period_start, period_end, platform (required!)
}, {
  onConflict: 'client_id,period_id'
});
```

---

## 💥 Why Inserts Are Failing

**Database expects:**
```sql
INSERT INTO current_week_cache (
  client_id,
  period_id,
  period_start,     -- REQUIRED
  period_end,       -- REQUIRED
  platform,         -- REQUIRED (default: 'meta')
  cache_data,
  last_refreshed    -- Column name!
)
```

**Code is sending:**
```typescript
{
  client_id: '...',
  period_id: '2025-W46',
  cache_data: {...},
  last_updated: '2025-11-12...'  // ❌ Column doesn't exist!
  // ❌ Missing period_start
  // ❌ Missing period_end
  // ❌ Missing platform
}
```

**Result:** Insert fails silently because:
1. `last_updated` column doesn't exist (should be `last_refreshed`)
2. Missing required fields `period_start`, `period_end`

---

## 🎯 THE FIX

### Option 1: Fix Database Schema (RECOMMENDED)

Make the database match the migration file and code:

```sql
-- 1. Rename column
ALTER TABLE current_week_cache 
RENAME COLUMN last_refreshed TO last_updated;

-- 2. Make extra fields nullable (or drop them)
ALTER TABLE current_week_cache 
ALTER COLUMN period_start DROP NOT NULL;

ALTER TABLE current_week_cache 
ALTER COLUMN period_end DROP NOT NULL;

ALTER TABLE current_week_cache 
ALTER COLUMN platform DROP NOT NULL;
```

### Option 2: Update Code to Match Database

Update `smart-cache-helper.ts` line 1470:

```typescript
await supabase.from('current_week_cache').upsert({
  client_id: clientId,
  period_id: targetWeek.periodId,
  period_start: targetWeek.start,      // ✅ Add missing field
  period_end: targetWeek.end,          // ✅ Add missing field
  platform: 'meta',                    // ✅ Add missing field
  cache_data: freshData,
  last_refreshed: new Date().toISOString() // ✅ Use correct column name
}, {
  onConflict: 'client_id,period_id'
});
```

---

## 🔧 IMMEDIATE ACTION REQUIRED

### Step 1: Apply Database Fix

Run the SQL fix file:

```bash
# In Supabase Dashboard -> SQL Editor
# Execute: FIX_WEEKLY_CACHE_SCHEMA.sql
```

OR manually run:

```sql
ALTER TABLE current_week_cache 
RENAME COLUMN last_refreshed TO last_updated;

ALTER TABLE current_week_cache 
ALTER COLUMN period_start DROP NOT NULL;

ALTER TABLE current_week_cache 
ALTER COLUMN period_end DROP NOT NULL;

ALTER TABLE current_week_cache 
ALTER COLUMN platform DROP NOT NULL;
```

### Step 2: Manually Trigger Cache Refresh

```bash
curl -X POST https://yourdomain.com/api/automated/refresh-current-week-cache
```

### Step 3: Verify Data

Check the cache status screen - should now show entries!

---

## 🔎 HOW TO VERIFY THE FIX

### Check Database Schema:
```sql
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'current_week_cache'
ORDER BY ordinal_position;
```

**Expected Output:**
```
column_name   | data_type | is_nullable
--------------+-----------+-------------
id            | uuid      | NO
client_id     | uuid      | NO
period_id     | text      | NO
cache_data    | jsonb     | NO
last_updated  | timestamp | NO          ✅ Not last_refreshed!
created_at    | timestamp | NO
period_start  | date      | YES         ✅ Nullable
period_end    | date      | YES         ✅ Nullable
platform      | text      | YES         ✅ Nullable
```

### Check Cache Data:
```sql
SELECT 
  COUNT(*) as total_entries,
  COUNT(DISTINCT client_id) as unique_clients,
  MIN(last_updated) as oldest,
  MAX(last_updated) as newest
FROM current_week_cache;
```

**Expected Output:**
```
total_entries | unique_clients | oldest              | newest
--------------+----------------+---------------------+---------------------
      5       |       5        | 2025-11-04 18:34:00 | 2025-11-12 17:45:00
```

---

## 📊 WHY THIS HAPPENED

**Two Different Schema Versions:**

1. **Original Migration** (`030_current_week_cache.sql`):
   - Simple schema with `last_updated`
   - No extra fields

2. **Emergency Fix** (`SAFE_01_CREATE_TABLES_ONLY.sql`):
   - Added `period_start`, `period_end`, `platform`
   - Changed to `last_refreshed`
   - Created for schema recovery but never aligned with code

**Result:** Code expects one schema, database has another!

---

## ✅ SUCCESS CRITERIA

After applying the fix:

- [x] Database column is `last_updated` (not `last_refreshed`)
- [x] Extra fields are nullable
- [x] Cron job runs successfully
- [x] Weekly cache shows > 0 entries
- [x] Cache status shows fresh/stale counts
- [x] Weekly reports load correctly

---

## 🚨 SIMILAR ISSUE CHECK

**Also check Google Ads weekly cache:**

```sql
-- Check google_ads_current_week_cache schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'google_ads_current_week_cache'
ORDER BY ordinal_position;
```

**If similar issue exists, apply same fix!**

---

## 📝 PREVENTION

**Going Forward:**

1. ✅ **Single source of truth** for schema migrations
2. ✅ **Always validate** schema matches code expectations
3. ✅ **Add logging** to upsert operations to catch silent failures
4. ✅ **Test cache operations** after any schema changes
5. ✅ **Monitor cache metrics** - empty cache = red flag!

---

**Priority:** 🔴 **CRITICAL - FIX IMMEDIATELY**  
**Impact:** Weekly data not being cached, causing slower performance and API rate limit issues  
**Fix Time:** 5 minutes  
**Testing Time:** 5 minutes

---

**Action Required:**
1. Run `FIX_WEEKLY_CACHE_SCHEMA.sql` in Supabase
2. Manually trigger refresh endpoint
3. Verify cache shows data
4. Monitor for 24 hours

✅ **Once fixed, weekly cache will populate automatically every 3 hours!**

