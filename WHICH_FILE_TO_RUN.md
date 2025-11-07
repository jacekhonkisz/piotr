# 📋 Which SQL File Should I Run?

## ❌ **DO NOT RUN** - Already Completed

### `FIX_UNIQUE_CONSTRAINT.sql`
- **Purpose**: Add `platform` to unique constraint
- **Status**: ✅ **ALREADY DONE** (successfully applied earlier)
- **Error if run again**: `relation "campaign_summaries_client_id_summary_type_summary_date_platform" already exists`
- **Action**: ❌ **DO NOT RUN THIS FILE AGAIN**

---

## ✅ **SAFE TO RUN** - Data Cleanup Only

### `SIMPLE_FIX_DATA_SOURCES.sql` ⭐ **USE THIS ONE**
- **Purpose**: Fix 40 old records with wrong data_source names
- **What it does**: 
  - Changes `"historical"` → `"meta_api"`
  - Changes `"smart"` → `"meta_api"`
  - Changes `"standardized_coverage"` → `"meta_api"`
- **Safe**: ✅ Can run multiple times, only updates data
- **No schema changes**: ✅ No constraints, no tables, no indexes

---

## 📊 **RUN ANYTIME** - Read-Only Audits

### `COMPREHENSIVE_DATA_AUDIT.sql`
- **Purpose**: Full audit of data separation
- **Safe**: ✅ Read-only, no changes
- **Use**: Anytime you want to check system status

---

## 🎯 **What You Need To Do Now**

1. **Open Supabase Dashboard** → SQL Editor
2. **Copy contents of**: `SIMPLE_FIX_DATA_SOURCES.sql`
3. **Paste and Run**
4. **Expected result**: 
   - Step 1: Shows ~40 records to fix
   - Step 2: Updates them
   - Step 3: All show ✅

**No errors expected** - this file only updates data, not schema!

---

## 🔍 **How To Tell Which File You're Running**

If you see **any** of these lines, you're in the **WRONG FILE**:
```sql
ALTER TABLE campaign_summaries
ADD CONSTRAINT
DROP CONSTRAINT
```

The **CORRECT FILE** (`SIMPLE_FIX_DATA_SOURCES.sql`) only has:
```sql
SELECT ...
UPDATE ...
SELECT ...
```

---

## ✨ **Summary**

| File | Status | Action |
|------|--------|--------|
| `FIX_UNIQUE_CONSTRAINT.sql` | ✅ Done | ❌ Don't run |
| `SIMPLE_FIX_DATA_SOURCES.sql` | ⏳ Pending | ✅ Run this! |
| `COMPREHENSIVE_DATA_AUDIT.sql` | - | ✅ Audit anytime |

**The constraint is already fixed** - you just need to clean up 40 legacy data source names! 🚀

