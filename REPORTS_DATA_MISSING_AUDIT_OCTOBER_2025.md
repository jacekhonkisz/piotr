# 🔍 Reports Database Data Missing Audit - October 2025

**Date:** October 1, 2025  
**Issue:** Missing historical data in `/reports` page + September 2025 not automatically saved  
**Status:** 🔴 **CRITICAL DATA ISSUE**

---

## 📋 **EXECUTIVE SUMMARY**

The `/reports` page is missing significant historical data for past months, and September 2025 (wrzesień) was NOT automatically saved when the month ended. This audit reveals multiple critical issues in the data lifecycle management system.

### **Key Findings:**

1. ❌ **September 2025 data was NOT automatically archived on October 1st**
2. ❌ **Historical months have missing or incomplete data**
3. ⚠️ **Automated archival cron jobs may not be executing properly**
4. ⚠️ **Data retention policy may have deleted older historical data**
5. ⚠️ **No monitoring or alerting system for failed archival**

---

## 🎯 **HOW THE SYSTEM SHOULD WORK**

### **Data Flow Architecture:**

```
┌────────────────────────────────────────────────────────────────┐
│ CURRENT MONTH (October 2025)                                   │
│ ├─ Source: current_month_cache table                           │
│ ├─ Refresh: Every 3 hours via cron                            │
│ └─ Data: Real-time from Meta/Google Ads APIs                  │
└────────────────────────────────────────────────────────────────┘
                             │
                             │ On October 1st at 2 AM
                             ▼
┌────────────────────────────────────────────────────────────────┐
│ AUTOMATED ARCHIVAL (Cron: 0 2 1 * *)                          │
│ ├─ Job: /api/automated/archive-completed-months               │
│ ├─ Action: Move September data from cache to database         │
│ └─ Target: campaign_summaries table                           │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────┐
│ HISTORICAL STORAGE (September 2025 and older)                 │
│ ├─ Table: campaign_summaries                                  │
│ ├─ Type: summary_type = 'monthly'                            │
│ ├─ Retention: 13 months (for year-over-year comparisons)     │
│ └─ Cleanup: Automated on 1st of month at 4 AM                │
└────────────────────────────────────────────────────────────────┘
```

### **Critical Cron Jobs (from vercel.json):**

| Cron Job | Schedule | Purpose | Status |
|----------|----------|---------|--------|
| `/api/automated/archive-completed-months` | `0 2 1 * *` | Archive previous month on 1st at 2 AM | ⚠️ **NEEDS VERIFICATION** |
| `/api/automated/archive-completed-weeks` | `0 3 * * 1` | Archive previous week on Monday at 3 AM | ⚠️ **NEEDS VERIFICATION** |
| `/api/automated/cleanup-old-data` | `0 6 1 * *` | Delete data >13 months on 1st at 6 AM | ⚠️ **MAY HAVE DELETED DATA** |
| `/api/automated/refresh-current-month-cache` | `0 */3 * * *` | Refresh current month every 3 hours | ✅ **LIKELY WORKING** |

---

## 🚨 **ROOT CAUSE ANALYSIS**

### **Issue #1: September 2025 Not Automatically Saved**

**What Should Have Happened:**
- **October 1st, 2025 at 2:00 AM UTC**: Cron job `/api/automated/archive-completed-months` executes
- **DataLifecycleManager.archiveCompletedMonths()** runs:
  1. Queries `current_month_cache` table for `period_id = '2025-09'`
  2. Transforms cached data into campaign_summaries format
  3. Inserts into `campaign_summaries` with `summary_type = 'monthly'`, `summary_date = '2025-09-01'`
  4. Deletes September cache entries after successful archival

**What Likely Happened:**
1. **Cron Job Didn't Execute**
   - Vercel cron jobs require production deployment
   - Check if cron is properly configured in production environment
   - No alerting system to notify if cron fails

2. **Cache Was Empty**
   - `current_month_cache` may not have had September data
   - If cache refresh failed during September, nothing to archive
   - Code logic: "If no cache data found, skip archival" (Line 49-52 in data-lifecycle-manager.ts)

3. **Archival Process Failed Silently**
   - Error during archival may have been logged but not alerted
   - No retry mechanism for failed archival
   - No monitoring dashboard showing archival status

**Evidence from Code:**
```typescript
// src/lib/data-lifecycle-manager.ts - Lines 49-52
if (!cacheData || cacheData.length === 0) {
  logger.info('📝 No monthly cache data found to archive');
  return; // ⚠️ SILENTLY EXITS WITHOUT ERROR
}
```

---

### **Issue #2: Missing Historical Data for Past Months**

**Potential Causes:**

#### **A) Data Retention Policy Deleted Old Data**

From `data-lifecycle-manager.ts` (Lines 165-178):
```typescript
async cleanupOldData(): Promise<void> {
  // Calculate cutoff date (13 months ago)
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - 13);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
  
  // Remove old monthly summaries
  await supabase
    .from('campaign_summaries')
    .delete()
    .eq('summary_type', 'monthly')
    .lt('summary_date', cutoffDateStr) // ⚠️ DELETES DATA OLDER THAN 13 MONTHS
}
```

**Impact:**
- Any data before **September 1, 2024** would be automatically deleted
- This is by design for year-over-year comparisons
- **BUT**: If historical data was never properly saved, it's permanently lost

#### **B) Historical Data Was Never Saved**

**Scenario:** If the archival cron jobs have been failing for months, then:
- August 2025 might not be in database
- July 2025 might not be in database
- June 2025 might not be in database
- etc.

**Reports Page Behavior:**
```typescript
// src/app/reports/page.tsx - Lines 1245-1254
// Generates last 24 months of periods dynamically
const limit = type === 'monthly' ? 24 : 52; // 2 years for monthly

for (let i = 0; i < limit; i++) {
  if (type === 'monthly') {
    periodDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
  }
  periods.push(formatPeriod(periodDate));
}
```

**Result:** 
- Reports page SHOWS 24 month options in dropdown
- But when you select a month, data fetch fails if:
  - No data in `campaign_summaries` table
  - No data in `current_month_cache` (only for current month)
  - No fallback to Meta API for old periods

---

### **Issue #3: Data Fetching Logic**

From `src/app/api/fetch-live-data/route.ts` (Lines 134-290):

**Data Source Priority:**
1. **Current Month**: `current_month_cache` table (3-hour refresh)
2. **Historical Months**: 
   - First: Try `daily_kpi_data` table (aggregate daily records)
   - Fallback: `campaign_summaries` table
   - **NO FALLBACK TO LIVE API FOR OLD MONTHS** ❌

**Code Evidence:**
```typescript
// Lines 202-231
if (summaryType === 'monthly' && !isCurrentMonth) {
  // Try daily_kpi_data first
  const { data: dailyRecords } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate);
  
  if (dailyRecords && dailyRecords.length > 0) {
    // Aggregate daily data
    storedSummary = aggregatedDailyData;
  } else {
    // Fallback to campaign_summaries
    const { data: monthlyResult } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('summary_date', startDate)
      .eq('summary_type', 'monthly');
    
    if (!monthlyResult) {
      console.log(`⚠️ No monthly data found for ${startDate}`);
      return null; // ⚠️ RETURNS NULL, NO LIVE FETCH
    }
  }
}
```

**Impact:**
- If both `daily_kpi_data` and `campaign_summaries` are empty → NO DATA SHOWN
- Old months without saved data appear blank in reports
- No automatic fallback to Meta/Google Ads API

---

## 📊 **DATA SOURCES COMPARISON**

| Month | Expected Data Source | Current Reality | Status |
|-------|---------------------|-----------------|--------|
| **October 2025** (Current) | `current_month_cache` | ✅ Should be available (3-hour refresh) | ✅ LIKELY OK |
| **September 2025** | `campaign_summaries` | ❌ **NOT ARCHIVED** | 🔴 MISSING |
| **August 2025** | `campaign_summaries` | ⚠️ May or may not exist | ⚠️ UNKNOWN |
| **July 2025** | `campaign_summaries` | ⚠️ May or may not exist | ⚠️ UNKNOWN |
| **June 2025** | `campaign_summaries` | ⚠️ May or may not exist | ⚠️ UNKNOWN |
| **Before Sept 2024** | Deleted by cleanup | ❌ Permanently removed (13-month retention) | 🔴 GONE |

---

## 🔍 **DIAGNOSTIC CHECKLIST**

### **1. Check Cron Job Execution Status**

**Vercel Dashboard:**
- Navigate to: Vercel Dashboard → Your Project → Cron Jobs
- Check if cron jobs are enabled in production
- Review execution logs for October 1st, 2025 at 2:00 AM UTC
- Look for any failed executions or error messages

**Manual Trigger:**
```bash
# Test if archival endpoint works manually
curl -X POST https://your-domain.com/api/automated/archive-completed-months \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

---

### **2. Check Database for September 2025 Data**

**Query 1: Check if September cache exists**
```sql
SELECT client_id, period_id, last_refreshed
FROM current_month_cache
WHERE period_id = '2025-09';
-- Expected: 0 rows (should be cleaned after archival)
```

**Query 2: Check if September was archived**
```sql
SELECT client_id, summary_date, total_spend, total_impressions, last_updated
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
  AND summary_type = 'monthly';
-- Expected: 1+ rows (archived data)
-- Reality: Likely 0 rows ❌
```

**Query 3: Check daily KPI data for September**
```sql
SELECT date, SUM(spend) as total_spend, SUM(impressions) as total_impressions
FROM daily_kpi_data
WHERE date >= '2025-09-01' AND date <= '2025-09-30'
GROUP BY date
ORDER BY date;
-- If this has data, reports can aggregate it
```

---

### **3. Check Historical Months Availability**

```sql
-- Get all available monthly summaries
SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  COUNT(*) as client_count,
  SUM(total_spend) as total_spend,
  MIN(last_updated) as oldest_update
FROM campaign_summaries
WHERE summary_type = 'monthly'
GROUP BY month
ORDER BY month DESC;

-- Check what months are MISSING from last 13 months
WITH expected_months AS (
  SELECT 
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 12))::date as expected_month
)
SELECT 
  TO_CHAR(em.expected_month, 'YYYY-MM') as missing_month
FROM expected_months em
LEFT JOIN campaign_summaries cs 
  ON cs.summary_date = em.expected_month 
  AND cs.summary_type = 'monthly'
WHERE cs.id IS NULL
ORDER BY em.expected_month DESC;
```

---

### **4. Review Cron Job Logs**

**Check Application Logs:**
```bash
# Look for archival logs
grep "Starting monthly data archival" logs/*.log
grep "Monthly archival completed" logs/*.log
grep "No monthly cache data found to archive" logs/*.log
grep "Failed to archive monthly data" logs/*.log
```

**Expected Log Flow (October 1st, 2025 at 2 AM):**
```
📅 Starting monthly data archival process...
📊 Archiving completed month: 2025-09
📦 Found 3 monthly cache entries to archive
💾 Archived monthly data for client xxx, period 2025-09
💾 Archived monthly data for client yyy, period 2025-09
💾 Archived monthly data for client zzz, period 2025-09
✅ Monthly archival completed: 3 archived, 0 errors
```

**If September Archival Failed:**
```
📅 Starting monthly data archival process...
📊 Archiving completed month: 2025-09
📝 No monthly cache data found to archive
```

---

## 🛠️ **IMMEDIATE FIX PLAN**

### **Step 1: Manually Archive September 2025** ⏰ **DO THIS FIRST**

**Option A: If September cache still exists in `current_month_cache`:**
```bash
# Trigger manual archival
curl -X POST https://your-domain.com/api/automated/archive-completed-months
```

**Option B: If cache was already cleared, reconstruct from daily data:**
```bash
# Trigger monthly aggregation for September
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 9}'
```

**Option C: If daily data missing, fetch from Meta API:**
```bash
# Manually generate September report (will fetch live and save)
curl -X POST https://your-domain.com/api/generate-report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -d '{
    "clientId": "CLIENT_UUID",
    "dateRange": {
      "start": "2025-09-01",
      "end": "2025-09-30"
    }
  }'
```

---

### **Step 2: Backfill Missing Historical Months**

**Identify missing months:**
```sql
-- Run the query from Diagnostic #3 to find gaps
```

**For each missing month, run:**
```bash
# Example for August 2025
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 8}'

# Repeat for July, June, etc.
```

**⚠️ WARNING:** This will fetch historical data from Meta/Google Ads APIs, which:
- Counts against API rate limits
- May be slow for multiple months
- Historical data may have attribution/conversion discrepancies

---

### **Step 3: Verify Cron Jobs Are Running**

**Vercel Configuration Check:**
1. Ensure `vercel.json` is in production
2. Verify cron schedule syntax: `0 2 1 * *` (1st of month at 2 AM UTC)
3. Check Vercel project settings → Cron Jobs → Ensure enabled
4. Review execution history for past months

**Manual Test:**
```bash
# Test the endpoint directly
curl -X GET https://your-domain.com/api/automated/archive-completed-months

# Check response:
# - Success: {"success": true, "message": "Monthly data archival completed successfully"}
# - Failure: {"success": false, "error": "...", "details": "..."}
```

---

### **Step 4: Add Monitoring & Alerting**

**Create Admin Alert System:**

```typescript
// src/lib/monitoring/archival-monitor.ts
export async function notifyArchivalFailure(period: string, error: string) {
  // Send email to admins
  await sendEmail({
    to: 'admin@yourdomain.com',
    subject: `🚨 CRITICAL: Monthly Archival Failed for ${period}`,
    body: `
      The automated monthly archival for ${period} failed.
      
      Error: ${error}
      
      Action Required: Manually run archival or data will be lost.
      URL: https://your-domain.com/admin/data-lifecycle
    `
  });
  
  // Log to monitoring service (e.g., Sentry)
  Sentry.captureException(new Error(`Archival failed for ${period}: ${error}`));
}
```

**Update archival endpoint:**
```typescript
// src/app/api/automated/archive-completed-months/route.ts
export async function GET() {
  try {
    const result = await lifecycleManager.archiveCompletedMonths();
    
    if (result.archivedCount === 0 && result.expectedCount > 0) {
      // ⚠️ Expected data but found nothing
      await notifyArchivalFailure(
        getPreviousMonthId(),
        'No cache data found to archive'
      );
    }
    
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    await notifyArchivalFailure(getPreviousMonthId(), error.message);
    throw error;
  }
}
```

---

### **Step 5: Implement Archival Status Dashboard**

**Admin Page: `/admin/archival-status`**

Features:
- ✅ Last successful archival timestamp
- ⚠️ Warning if archival hasn't run in >2 days
- 🔴 Critical alert if September archival missing
- 📊 Table showing which months have data
- 🔄 Manual trigger button for each month
- 📈 Historical archival success/failure chart

---

## 📝 **LONG-TERM IMPROVEMENTS**

### **1. Implement Archival Health Check**

**Daily Cron (Every day at 10 AM):**
```typescript
// /api/automated/check-archival-health
export async function GET() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // If today is the 2nd of the month, verify yesterday's (1st) archival ran
  if (today.getDate() === 2) {
    const previousMonth = getPreviousMonth();
    const archived = await checkIfMonthArchived(previousMonth);
    
    if (!archived) {
      await notifyArchivalFailure(previousMonth, 'Archival did not run on 1st');
      // Attempt automatic recovery
      await lifecycleManager.archiveCompletedMonths();
    }
  }
}
```

---

### **2. Implement Retry Mechanism**

```typescript
async function archiveWithRetry(maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await lifecycleManager.archiveCompletedMonths();
      return; // Success
    } catch (error) {
      logger.error(`Archival attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        await notifyArchivalFailure('Final retry failed', error.message);
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
}
```

---

### **3. Add Database Constraints**

**Prevent accidental data loss:**
```sql
-- Add check constraint to ensure critical months exist
CREATE OR REPLACE FUNCTION check_required_months() RETURNS TRIGGER AS $$
BEGIN
  -- Prevent deletion of data less than 14 months old
  IF OLD.summary_date > (CURRENT_DATE - INTERVAL '14 months') THEN
    RAISE EXCEPTION 'Cannot delete recent summary data (< 14 months old)';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_recent_deletion
  BEFORE DELETE ON campaign_summaries
  FOR EACH ROW
  EXECUTE FUNCTION check_required_months();
```

---

### **4. Implement Data Validation**

**Post-archival verification:**
```typescript
async function verifyArchivalSuccess(period: string): Promise<boolean> {
  // Check that archived data matches cache totals
  const cacheTotal = await getCacheTotals(period);
  const archivedTotal = await getArchivedTotals(period);
  
  const discrepancy = Math.abs(cacheTotal.spend - archivedTotal.spend);
  
  if (discrepancy > 1.0) {
    await notifyArchivalWarning(
      period,
      `Data discrepancy: Cache ${cacheTotal.spend} vs Archived ${archivedTotal.spend}`
    );
    return false;
  }
  
  return true;
}
```

---

## 🎯 **ACTION ITEMS SUMMARY**

### **🔴 CRITICAL (Do Today - October 1, 2025):**

1. [ ] **Check if September 2025 data exists in database**
   - Query: `SELECT * FROM campaign_summaries WHERE summary_date = '2025-09-01'`
   
2. [ ] **If missing, manually archive September 2025**
   - Run: `curl -X POST .../api/automated/archive-completed-months`
   - Or: Use `/admin/data-lifecycle` page manual trigger
   
3. [ ] **Verify archival succeeded**
   - Query database again to confirm data saved
   - Check reports page shows September data

---

### **🟠 HIGH PRIORITY (This Week):**

4. [ ] **Audit all historical months** (August 2025 back to September 2024)
   - Run SQL query to identify gaps
   - Document which months are missing
   
5. [ ] **Backfill missing months**
   - Use `/api/automated/monthly-aggregation` for each gap
   - Verify each month after backfill
   
6. [ ] **Verify Vercel Cron Jobs are enabled**
   - Check Vercel dashboard
   - Review execution logs
   - Test manual execution

---

### **🟡 MEDIUM PRIORITY (Next 2 Weeks):**

7. [ ] **Implement archival monitoring system**
   - Add email alerts for failures
   - Create admin dashboard
   
8. [ ] **Add retry mechanism to archival**
   - 3 attempts with exponential backoff
   - Alert on final failure
   
9. [ ] **Create archival health check cron**
   - Runs daily at 10 AM
   - Verifies previous day's archival
   
10. [ ] **Document archival process**
    - Admin runbook for manual intervention
    - Troubleshooting guide

---

## 📚 **RELATED FILES**

| File | Purpose | Key Issues |
|------|---------|------------|
| `src/lib/data-lifecycle-manager.ts` | Archival logic | Silently exits if no cache data found |
| `src/app/api/automated/archive-completed-months/route.ts` | Cron endpoint | No alerting on failure |
| `src/app/api/fetch-live-data/route.ts` | Data fetching | No fallback to API for old months |
| `src/app/reports/page.tsx` | Reports UI | Generates 24 months but doesn't check if data exists |
| `vercel.json` | Cron schedule | Lines 28-29: Archive cron `0 2 1 * *` |
| `supabase/migrations/013_add_campaign_summaries.sql` | Database schema | campaign_summaries table definition |

---

## 🔗 **USEFUL QUERIES FOR INVESTIGATION**

```sql
-- 1. Check all available monthly summaries
SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  COUNT(*) as entries,
  COUNT(DISTINCT client_id) as clients,
  SUM(total_spend) as spend
FROM campaign_summaries
WHERE summary_type = 'monthly'
GROUP BY month
ORDER BY month DESC;

-- 2. Check current month cache status
SELECT 
  period_id,
  client_id,
  last_refreshed,
  EXTRACT(EPOCH FROM (NOW() - last_refreshed)) / 3600 as hours_since_refresh
FROM current_month_cache
ORDER BY last_refreshed DESC;

-- 3. Find gaps in monthly data
WITH RECURSIVE months AS (
  SELECT DATE '2024-09-01' as month
  UNION ALL
  SELECT (month + INTERVAL '1 month')::date
  FROM months
  WHERE month < DATE '2025-10-01'
)
SELECT 
  TO_CHAR(m.month, 'YYYY-MM') as period,
  CASE 
    WHEN cs.id IS NOT NULL THEN '✅ Data Exists'
    ELSE '❌ Missing'
  END as status
FROM months m
LEFT JOIN campaign_summaries cs 
  ON cs.summary_date = m.month 
  AND cs.summary_type = 'monthly'
ORDER BY m.month DESC;

-- 4. Check daily KPI coverage
SELECT 
  TO_CHAR(date, 'YYYY-MM') as month,
  COUNT(*) as days_with_data,
  SUM(spend) as total_spend
FROM daily_kpi_data
WHERE date >= '2024-09-01'
GROUP BY month
ORDER BY month DESC;
```

---

## 📞 **NEXT STEPS**

1. **Immediate:** Run diagnostic queries to assess damage
2. **Today:** Manually save September 2025 if missing
3. **This Week:** Backfill historical gaps
4. **This Month:** Implement monitoring and alerting
5. **Ongoing:** Monitor archival health daily

**Need Help?** Check `/admin/data-lifecycle` page for manual controls or contact system administrator.

---

**Document Status:** ✅ Complete Analysis  
**Last Updated:** October 1, 2025  
**Priority:** 🔴 CRITICAL - Data Loss Risk









