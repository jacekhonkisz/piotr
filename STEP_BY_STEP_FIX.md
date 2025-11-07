# 🎯 Step-by-Step: Fix Legacy Data Sources

## ⚠️ IMPORTANT: The Constraint is Already Fixed!

The error you're seeing means the **constraint was already successfully applied** earlier. You don't need to run the constraint fix again!

---

## 📋 Follow These Exact Steps in Supabase

### Step 1: Open Fresh SQL Editor
1. Go to **Supabase Dashboard**
2. Click **SQL Editor**
3. **Close ALL existing tabs** (very important!)
4. Click **"+ New Query"**

### Step 2: Copy ONLY This Simple Query

**Copy and paste EXACTLY this:**

```sql
-- Show what needs fixing
SELECT 
  platform,
  data_source,
  COUNT(*) as records
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND data_source IN ('historical', 'smart', 'standardized_coverage')
GROUP BY platform, data_source;
```

### Step 3: Click "Run"

**Expected Results:**
- If you see rows: Those need to be fixed
- If you see "No rows": Everything is already fixed! ✅

### Step 4: If You Saw Rows, Run This Update

**Copy and paste EXACTLY this:**

```sql
-- Fix the incorrect sources
UPDATE campaign_summaries
SET data_source = 'meta_api'
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND data_source IN ('historical', 'smart', 'standardized_coverage');
```

### Step 5: Verify It Worked

**Copy and paste EXACTLY this:**

```sql
-- Verify all sources are now correct
SELECT 
  platform,
  data_source,
  COUNT(*) as records
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY platform, data_source
ORDER BY platform, data_source;
```

**Expected Result:**
- Meta records show: `meta_api` ✅
- Google records show: `google_ads_api` ✅

---

## 🚫 DO NOT Run These Commands

**These will give you errors because they're already done:**

```sql
❌ ALTER TABLE campaign_summaries
❌ ADD CONSTRAINT
❌ DROP CONSTRAINT
```

If you see **any** of these, you're in the **WRONG FILE**!

---

## 🎯 Summary

**3 Simple Steps:**

1. **SELECT** to see what needs fixing
2. **UPDATE** to fix it
3. **SELECT** to verify

**No schema changes. No constraints. Just data cleanup.**

If you're still getting constraint errors, it means:
- You have the wrong tab open in Supabase
- Or Supabase has cached the wrong query
- **Solution**: Close ALL tabs, open new query, copy ONLY the queries above

---

## ✅ How to Know It's Working

**GOOD** - You should see:
```
Success. No rows returned
  or
X rows updated
```

**BAD** - You should NOT see:
```
ERROR: 42P07: relation "campaign_summaries_client_id_summary_type_summary_date_platform" already exists
```

If you see that error, you're running the constraint file (which is already done), not the data fix file!

---

## 🆘 Still Having Issues?

Run this test to confirm which file you're running:

```sql
SELECT 'TEST: If you see this, you have a clean query!' as result;
```

If you see "TEST: If you see this..." then paste the Step 2 query above.

If you see a constraint error, **you have old SQL cached in Supabase** - close the tab and start fresh!

