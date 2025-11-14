# 🔄 SUPABASE SCHEMA CACHE RELOAD

## ⚠️ CRITICAL ISSUE

**Problem:** Database columns are NUMERIC ✅, but Supabase's API still thinks they're BIGINT ❌

**Root Cause:** PostgREST (Supabase's API layer) caches database schema and hasn't reloaded after our column type changes.

---

## 🎯 SOLUTION

### Option A: Restart Supabase Project (RECOMMENDED) ⭐

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **General**
4. Click **"Pause Project"**
5. Wait 10 seconds
6. Click **"Resume Project"**
7. Wait 30 seconds for restart

**Time:** 1-2 minutes  
**Effect:** Forces complete schema reload

### Option B: Wait for Auto-Refresh

PostgREST schema cache auto-refreshes every **10-60 minutes** (depends on config).

**Time:** 10-60 minutes  
**Effect:** Schema will eventually reload

### Option C: Manual Schema Reload (If available)

Some Supabase plans have a "Reload Schema" button in:
- Dashboard → API → Schema Cache

---

## 🔍 HOW TO VERIFY IT WORKED

### After Restart/Reload:

```bash
# 1. Restart your Next.js server
killall node
npm run dev

# 2. Wait 15 seconds, then trigger collection
curl -X POST http://localhost:3000/api/automated/collect-weekly-summaries \
  -H "Content-Type: application/json"

# 3. Check for bigint errors (should be NONE)
tail -50 /tmp/next-server.log | grep bigint

# 4. Monitor progress
node scripts/check-collection-status.js
```

**Expected:** No more bigint errors, records steadily increasing to 1,950

---

## 📊 CURRENT STATUS

**Database:** ✅ Columns are NUMERIC (verified with test insert)  
**Supabase API:** ❌ Still using cached BIGINT schema  
**Application:** ❌ Fails when trying to save decimal values  

**Records:** 1,332 / 1,950 (stuck due to schema cache)  
**Missing:** 618 records (will be saved after schema reload)

---

## 🎯 WHAT THIS FIXES

**Before Schema Reload:**
```
Error: invalid input syntax for type bigint: "45.992112"
```

**After Schema Reload:**
```
✅ Record saved with $45.99 spend
✅ All decimal values accepted
✅ Collection completes successfully
```

---

## 🚀 ALTERNATIVE WORKAROUND (If Can't Restart)

If you can't restart the Supabase project right now, you could:

1. **Wait until tomorrow** - Monday's automated cron job will run after schema cache expires
2. **Schedule for later** - Pause/resume project when convenient
3. **Contact Supabase Support** - Ask them to reload schema cache

---

## 📝 WHY THIS HAPPENED

**Sequence of Events:**
1. We changed columns from BIGINT → NUMERIC in database ✅
2. Database accepted the changes ✅
3. PostgREST (Supabase's API layer) didn't reload its schema cache ❌
4. API still thinks columns are BIGINT ❌
5. Application tries to insert decimals → API rejects them ❌

**PostgreSQL vs PostgREST:**
- **PostgreSQL** (database): Has NUMERIC columns ✅
- **PostgREST** (API): Thinks they're BIGINT ❌
- **Solution:** Restart PostgREST to reload schema

---

## ✅ VERIFICATION CHECKLIST

After Supabase restart:

- [ ] Supabase project restarted (pause + resume)
- [ ] Next.js server restarted
- [ ] Collection triggered
- [ ] No bigint errors in logs
- [ ] Records increasing (check every 10 min)
- [ ] Final count: 1,950 records
- [ ] All 4 categories at 100%

---

**Priority:** HIGH  
**Time to fix:** 1-2 minutes (project restart)  
**Impact:** Unlocks 618 missing records (32% of data)




