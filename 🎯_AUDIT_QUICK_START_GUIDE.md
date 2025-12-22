# 🎯 Audit Quick Start Guide

## 📋 Overview

This guide provides quick commands to verify your reporting system's health based on the comprehensive audit findings.

---

## 🚀 Quick Health Check (5 Minutes)

Run these 4 verification scripts in your Supabase SQL Editor:

### 1️⃣ Check for Duplicates
```bash
scripts/verify-no-duplicates.sql
```
**Expected:** 0 rows  
**If failed:** Run `scripts/fix-duplicate-weeks.sql`

### 2️⃣ Verify Platform Separation
```bash
scripts/verify-platform-separation.sql
```
**Expected:** Separate Meta and Google records, no NULL platforms  
**If failed:** Check migration 042 and 044 applied

### 3️⃣ Check Cron Jobs
```bash
scripts/verify-cron-job-status.sql
```
**Expected:** All jobs show ✅ HEALTHY  
**If failed:** Check Vercel cron logs

### 4️⃣ Verify Data Consistency
```bash
scripts/verify-data-consistency.sql
```
**Expected:** campaign_summaries ≈ daily_kpi_data (within 5%)  
**If failed:** Review data collection jobs

---

## 🚨 Critical Issues Found

### Issue #1: Cron Job Timing Conflicts

**Problem:** Multiple jobs scheduled close together on Sundays

**Quick Fix:**
1. Edit `vercel.json`
2. Change line 45:
   ```json
   // BEFORE:
   { "path": "/api/automated/collect-monthly-summaries", "schedule": "0 1 * * 0" },
   { "path": "/api/automated/collect-weekly-summaries", "schedule": "0 3 * * 0" },
   
   // AFTER (Add 30min gap):
   { "path": "/api/automated/collect-monthly-summaries", "schedule": "0 1 * * 0" },
   { "path": "/api/automated/collect-weekly-summaries", "schedule": "30 3 * * 0" }
   ```
3. Deploy to Vercel

**Priority:** HIGH  
**Time:** 5 minutes

---

### Issue #2: Duplicate Cleanup Endpoints

**Problem:** Two different cleanup endpoints in vercel.json

**Quick Fix:**
1. Edit `vercel.json`
2. Remove ONE of these lines:
   ```json
   // REMOVE THIS ONE (lines 52-54):
   {
     "path": "/api/background/cleanup-old-data",
     "schedule": "0 2 * * 6"
   },
   
   // KEEP THIS ONE (lines 59-62):
   {
     "path": "/api/automated/cleanup-old-data",
     "schedule": "0 4 1 * *"
   }
   ```
3. Deploy to Vercel

**Priority:** MEDIUM  
**Time:** 2 minutes

---

### Issue #3: Historical Duplicate Weeks

**Problem:** Duplicate weekly records from before UNIQUE constraint

**Quick Fix:**
1. Open Supabase SQL Editor
2. Run (dry run first):
   ```sql
   -- Preview what will be deleted:
   scripts/fix-duplicate-weeks.sql
   ```
3. Review results
4. If looks good, uncomment DELETE statement and COMMIT
5. Run verification:
   ```sql
   scripts/verify-no-duplicates.sql
   ```

**Priority:** HIGH  
**Time:** 10 minutes

---

## ✅ Post-Fix Verification

After applying fixes, run this complete verification:

```sql
-- Full system health check
\i scripts/verify-no-duplicates.sql
\i scripts/verify-platform-separation.sql
\i scripts/verify-cron-job-status.sql
\i scripts/verify-data-consistency.sql
```

**Expected Results:**
- ✅ 0 duplicates
- ✅ Separate platforms
- ✅ All jobs healthy
- ✅ Data consistent

---

## 📊 Monitoring Dashboard

### Daily Health Check (1 Minute)

Run this single query in Supabase:

```sql
-- Quick Daily Health Check
SELECT 
  'Daily KPI Collection' as job,
  AGE(NOW(), MAX(created_at)) as last_run,
  CASE 
    WHEN AGE(NOW(), MAX(created_at)) < INTERVAL '36 hours' THEN '✅'
    ELSE '❌'
  END as status
FROM daily_kpi_data
WHERE created_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT 
  'Weekly Collection' as job,
  AGE(NOW(), MAX(last_updated)),
  CASE 
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '8 days' THEN '✅'
    ELSE '❌'
  END
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND last_updated >= NOW() - INTERVAL '14 days'

UNION ALL

SELECT 
  'Cache Refresh' as job,
  AGE(NOW(), MAX(last_updated)),
  CASE 
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '4 hours' THEN '✅'
    ELSE '❌'
  END
FROM current_month_cache
WHERE last_updated >= NOW() - INTERVAL '1 day';
```

**Expected:** All ✅

---

## 🔍 Full Audit Report

For detailed findings, see:
```
🔍_COMPREHENSIVE_PRODUCTION_AUDIT_REPORT.md
```

**Key Sections:**
- Platform Separation: 95% (✅ PASS)
- Period Distinction: 90% (✅ PASS)
- Cron Jobs: 70% (⚠️ WARNING)
- Metrics Consistency: 75% (⚠️ WARNING)
- Data Integrity: 80% (⚠️ WARNING)
- Production Readiness: 85% (✅ PASS)

**Overall Score:** 80% - Production Ready with Caveats

---

## 🎯 Priority Action Items

### This Week (Critical):
1. ✅ Fix cron timing conflicts
2. ✅ Remove duplicate cleanup endpoint
3. ✅ Clean up historical duplicates
4. ✅ Verify all UNIQUE constraints exist

### Next Week (High):
1. ⚠️ Standardize metric field names
2. ⚠️ Add monitoring/alerting
3. ⚠️ Document attribution windows

### This Month (Medium):
1. 📋 Clean up unused vercel-*.json files
2. 📋 Set up backup strategy
3. 📋 Improve daily KPI collection completeness

---

## 🆘 Troubleshooting

### "Duplicates found!"
→ Run `scripts/fix-duplicate-weeks.sql`

### "Cron jobs not healthy"
→ Check Vercel logs: `vercel logs --follow`

### "Platform separation failed"
→ Verify migrations 042, 043, 044 applied

### "Data inconsistency"
→ Review daily-kpi-collection logs

---

## 📞 Support

- Full Audit Report: `🔍_COMPREHENSIVE_PRODUCTION_AUDIT_REPORT.md`
- Verification Scripts: `scripts/verify-*.sql`
- Fix Scripts: `scripts/fix-*.sql`

---

**Last Updated:** November 20, 2025  
**Next Review:** After critical fixes applied



