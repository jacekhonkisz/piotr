# 📊 Data Source Audit Guide

## Overview

This guide explains how to use the comprehensive SQL audit scripts to identify the **real source of truth** for all metrics in your system.

---

## 🎯 Purpose

The audit scripts help you:
1. **Identify** which data sources exist for current and previous periods
2. **Compare** values across all sources to find discrepancies
3. **Determine** which source should be used for year-over-year comparisons
4. **Verify** data completeness and consistency

---

## 📁 Files

### 1. `scripts/comprehensive-data-source-audit.sql`
**Full audit script** with 7 parts:
- Part 1: Current period data sources (smart cache, summaries, daily_kpi_data)
- Part 2: Previous year data sources
- Part 3: Side-by-side comparison of all sources
- Part 4: Discrepancy detection
- Part 5: Year-over-year comparison from each source
- Part 6: Data completeness check
- Part 7: Recommended source of truth

### 2. `scripts/quick-data-source-check.sql`
**Quick check** to see which sources exist for a period

---

## 🔧 How to Use

### Step 1: Set Configuration Variables

Open `comprehensive-data-source-audit.sql` and replace:

```sql
\set CLIENT_ID 'PASTE_CLIENT_ID_HERE'  -- Your client UUID
\set CURRENT_START_DATE '2026-01-01'   -- Current period start
\set CURRENT_END_DATE '2026-01-31'     -- Current period end
\set PLATFORM 'meta'                    -- 'meta' or 'google'
\set PREVIOUS_YEAR_START '2025-01-01'  -- Previous year start
\set PREVIOUS_YEAR_END '2025-01-31'    -- Previous year end
```

### Step 2: Run Individual Parts

You can run each part separately:

**Part 1: Current Period Sources**
```sql
-- Shows all current period data sources
-- Run sections 1.1 through 1.5
```

**Part 2: Previous Year Sources**
```sql
-- Shows all previous year data sources
-- Run sections 2.1 and 2.2
```

**Part 3: Comprehensive Comparison**
```sql
-- Shows all sources side-by-side
-- Most useful for quick overview
```

**Part 4: Discrepancy Detection**
```sql
-- Identifies mismatches between sources
-- Critical for finding data inconsistencies
```

**Part 5: Year-Over-Year Comparison**
```sql
-- Shows YoY comparison from each source
-- Helps identify which source gives accurate comparison
```

**Part 6: Data Completeness**
```sql
-- Verifies which sources have data
-- Quick check before running comparisons
```

**Part 7: Recommended Source**
```sql
-- Determines best source to use
-- Based on data availability and consistency
```

---

## 📊 Understanding Results

### Part 3: Comprehensive Comparison

This shows all sources side-by-side:

```
source_type          | period        | booking_step_1 | reservations
---------------------|---------------|----------------|-------------
SMART_CACHE          | CURRENT       | 100            | 50
CAMPAIGN_SUMMARIES   | CURRENT       | 95             | 48
DAILY_KPI_DATA       | CURRENT       | 95             | 48
CAMPAIGN_SUMMARIES   | PREVIOUS_YEAR | 200            | 100
DAILY_KPI_DATA       | PREVIOUS_YEAR | 200            | 100
```

**Interpretation:**
- If values match: ✅ Data is consistent
- If values differ: ⚠️ Data source mismatch (investigate Part 4)

### Part 4: Discrepancy Detection

Shows if sources match:

```
booking_step_1_status | booking_step_1_vs_daily | reservations_status
----------------------|------------------------|-------------------
⚠️ MISMATCH           | ✅ MATCH               | ⚠️ MISMATCH
```

**Interpretation:**
- ✅ MATCH: Sources agree (good)
- ⚠️ MISMATCH: Sources differ (investigate why)

### Part 7: Recommended Source

Provides recommendation:

```
recommendation
----------------------------------------
✅ USE campaign_summaries (BOTH PERIODS) - Most consistent
```

**Interpretation:**
- ✅ Best option: Use this source for comparisons
- ⚠️ Warning: May have discrepancies
- ❌ Error: Insufficient data

---

## 🔍 Common Scenarios

### Scenario 1: All Sources Match

**Result:**
- All sources show same values
- ✅ **Use any source** - all are consistent

**Action:**
- Use `campaign_summaries` for performance (fastest)

### Scenario 2: Smart Cache Differs from Others

**Result:**
- Smart cache shows different values than summaries/daily_kpi_data
- ⚠️ **Smart cache may be stale or using different priority**

**Action:**
- Use `campaign_summaries` or `daily_kpi_data` for accuracy
- Investigate why smart cache differs

### Scenario 3: Current Period Missing in campaign_summaries

**Result:**
- Current period only in smart cache
- Previous year only in campaign_summaries
- ⚠️ **Different sources = potential mismatch**

**Action:**
- Use `daily_kpi_data` for both periods if available
- Or wait for current period to be archived to campaign_summaries

### Scenario 4: No Previous Year Data

**Result:**
- Previous year missing from all sources
- ❌ **Cannot perform year-over-year comparison**

**Action:**
- Collect previous year data first
- Or use different comparison period

---

## 🎯 Best Practices

1. **Always run Part 6 first** (Data Completeness)
   - Verify data exists before comparing

2. **Run Part 4** (Discrepancy Detection)
   - Identify mismatches early

3. **Use Part 7 recommendation**
   - Follow the recommended source of truth

4. **For year-over-year:**
   - Use same source for both periods
   - Prefer `campaign_summaries` if available for both
   - Fall back to `daily_kpi_data` if summaries missing

---

## 📝 Example Workflow

```sql
-- 1. Quick check (30 seconds)
\i scripts/quick-data-source-check.sql

-- 2. Full audit (2-5 minutes)
\i scripts/comprehensive-data-source-audit.sql

-- 3. Review Part 7 recommendation
-- 4. If discrepancies found, investigate Part 4
-- 5. Use recommended source for comparisons
```

---

## 🚨 Troubleshooting

### "No data found"
- Check CLIENT_ID is correct
- Verify date ranges are correct
- Check platform matches ('meta' vs 'google')

### "Values don't match"
- Run Part 4 to see which metrics differ
- Check Part 1 and 2 to see source timestamps
- Smart cache may be stale (check cache_age_hours)

### "Previous year missing"
- Data may not have been collected yet
- Check if client existed in previous year
- Verify date range calculation

---

## 📊 Output Interpretation

### Good Results ✅
```
✅ USE campaign_summaries (BOTH PERIODS) - Most consistent
✅ MATCH (all sources agree)
✅ EXISTS (all sources have data)
```

### Warning Results ⚠️
```
⚠️ USE smart_cache (CURRENT) + campaign_summaries (PREVIOUS) - May have discrepancies
⚠️ MISMATCH (sources differ)
```

### Error Results ❌
```
❌ INSUFFICIENT DATA - Cannot perform reliable comparison
❌ MISSING (source has no data)
```

---

**Last Updated:** January 2026  
**Version:** 1.0

