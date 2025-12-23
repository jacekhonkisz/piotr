# 📋 Period Transition System Audit

**Date:** December 23, 2025  
**Purpose:** Verify the system correctly handles period completion, data archival, and display switching

---

## ✅ Executive Summary

**The system IS prepared** to handle period transitions correctly. Here's the complete workflow:

### System Status: ✅ FULLY CONFIGURED

| Component | Status | Notes |
|-----------|--------|-------|
| **Period Detection** | ✅ Working | Strict rules distinguish current vs historical |
| **Cron Jobs** | ✅ Scheduled | All archival jobs configured in `vercel.json` |
| **Data Archival** | ✅ Implemented | Both Meta & Google Ads handled |
| **Display Switching** | ✅ Working | Reports page uses database for historical |
| **Cache Cleanup** | ✅ Implemented | Expired cache entries removed after archival |

---

## 🔄 How Period Transitions Work

### 1. **Period Boundary Detection**

The system uses **strict rules** to determine if a period is current or historical:

```
📁 src/lib/standardized-data-fetcher.ts (lines 199-265)

🔒 STRICT RULE #1: Only current month gets smart cache
   - startYear === currentYear && startMonth === currentMonth

🔒 STRICT RULE #2: Month must include TODAY to be current  
   - dateRange.end >= today

🔒 STRICT RULE #3: Current week detection
   - Week must include today (isWeekPeriod && includesCurrentDay)

🎯 FINAL DECISION:
   - Current periods → Smart Cache (live API)
   - Past periods → Database (campaign_summaries)
```

### 2. **When a Period Finishes**

The system has **two complementary mechanisms**:

#### A. **Automatic Cron Archival** (Primary)

```
📁 vercel.json - Scheduled Jobs

MONTHLY TRANSITIONS (1st of each month):
├── 02:00 - /api/automated/end-of-month-collection    ← Collects final data
├── 02:30 - /api/automated/archive-completed-months   ← Archives to database
└── 04:00 - /api/automated/cleanup-old-data           ← Removes data >14 months

WEEKLY TRANSITIONS (Every Monday):
├── 02:30 - /api/automated/archive-completed-weeks    ← Archives to database
└── 04:00 - /api/automated/collect-weekly-summaries   ← Collects new week data
```

#### B. **Period Transition Handler** (Backup/Manual)

```
📁 src/lib/period-transition-handler.ts

Called by: /api/cron/period-transition

What it does:
1. Finds expired cache entries (period_id ≠ current period)
2. Archives each entry to campaign_summaries
3. Deletes archived cache entries
4. Returns count of archived vs errors
```

### 3. **Data Flow Diagram**

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PERIOD LIFECYCLE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  CURRENT PERIOD                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  Live API                                                      │  │
│  │     ↓                                                         │  │
│  │  Smart Cache                                                   │  │
│  │  ├── current_month_cache (Meta)                               │  │
│  │  ├── current_week_cache (Meta)                                │  │
│  │  ├── google_ads_current_month_cache                           │  │
│  │  └── google_ads_current_week_cache                            │  │
│  │                                                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                    Period Ends (Midnight)                           │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ARCHIVAL PROCESS (Cron Jobs at 02:30)                        │  │
│  │                                                                │  │
│  │  1. DataLifecycleManager.archiveCompletedMonths/Weeks()       │  │
│  │  2. Copy cache_data → campaign_summaries                       │  │
│  │  3. Set data_source = 'smart_cache_archive'                   │  │
│  │  4. Delete from current_*_cache tables                         │  │
│  │                                                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  HISTORICAL PERIOD                                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                                                                │  │
│  │  campaign_summaries table                                      │  │
│  │  ├── summary_type: 'monthly' | 'weekly'                       │  │
│  │  ├── platform: 'meta' | 'google'                              │  │
│  │  ├── total_spend, impressions, clicks, conversions            │  │
│  │  ├── booking_step_1/2/3, reservations, reservation_value      │  │
│  │  └── campaign_data (JSON)                                      │  │
│  │                                                                │  │
│  │  💡 Instantly served to reports page                           │  │
│  │                                                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Cron Schedule Summary

| Time (UTC) | Schedule | Endpoint | Purpose |
|------------|----------|----------|---------|
| **Every 2h** | `0 */2 * * *` | `/api/automated/refresh-all-caches` | Keep current period fresh |
| **01:00** | `0 1 * * *` | Daily KPI collection (4 batches) | Collect daily metrics |
| **02:00 1st** | `0 2 1 * *` | `/api/automated/end-of-month-collection` | Final month data |
| **02:15** | `15 2 * * *` | `/api/automated/google-ads-daily-collection` | Google Ads daily |
| **02:30 1st** | `30 2 1 * *` | `/api/automated/archive-completed-months` | Archive last month |
| **02:30 Mon** | `30 2 * * 1` | `/api/automated/archive-completed-weeks` | Archive last week |
| **04:00 Mon** | `0 4 * * 1` | `/api/automated/generate-weekly-reports` | Generate reports |
| **04:00 1st** | `0 4 1 * *` | `/api/automated/cleanup-old-data` | Remove >14 month data |
| **05:00 1st** | `0 5 1 * *` | `/api/automated/generate-monthly-reports` | Generate reports |
| **09:00** | `0 9 * * *` | `/api/automated/send-scheduled-reports` | Send emails |

---

## 🔍 Display Switching Logic

### Reports Page Period Generation

```typescript
// 📁 src/app/reports/page.tsx (lines 1500-1565)

// Periods are generated from current date going backwards
for (let i = 0; i < limit; i++) {
  if (type === 'monthly') {
    // Go back from current month
    periodDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
  } else {
    // Use proper ISO week calculation
    const currentWeekNumber = getWeekNumber(currentDate);
    let targetWeek = currentWeekNumber - i;
    // Handle year boundaries...
    periodDate = getISOWeekStartDate(targetYear, targetWeek);
  }
}
```

### Data Source Routing

```typescript
// 📁 src/lib/standardized-data-fetcher.ts (lines 271-316)

// HISTORICAL PERIOD - Database first (instant)
if (!needsSmartCache) {
  console.log('⚡ HISTORICAL PERIOD: Checking campaign_summaries FIRST');
  
  const cachedResult = await this.fetchFromCachedSummaries(clientId, dateRange, platform);
  if (cachedResult.success) {
    return {
      success: true,
      data: cachedResult.data,
      debug: {
        source: 'campaign-summaries-database',
        cachePolicy: 'database-first-historical-instant',
        periodType: 'historical'
      }
    };
  }
}

// CURRENT PERIOD - Smart cache (live API)
if (needsSmartCache) {
  // Use smart cache with live API...
}
```

---

## ✅ What's Working Correctly

1. **Strict Period Classification**
   - Current month: Only if `startYear === currentYear && startMonth === currentMonth`
   - Current week: Only if week includes today
   - Everything else = HISTORICAL (database)

2. **Automatic Archival**
   - Monthly: Runs at 02:30 on 1st of month
   - Weekly: Runs at 02:30 every Monday
   - Both Meta and Google Ads handled

3. **Cache Cleanup**
   - Archived entries are deleted from cache tables
   - Old data (>14 months) is cleaned up monthly

4. **Display Switching**
   - Reports page dynamically generates periods
   - First period = current (smart cache)
   - All others = historical (database)

5. **Data Retention**
   - Keeps 14 months for year-over-year comparisons
   - Automatic cleanup prevents database bloat

---

## ⚠️ Potential Edge Cases

### 1. **Timezone Considerations**

The system uses server timezone for period boundaries. If cron jobs run at UTC and clients are in CET:
- Month transition at 02:30 UTC = 03:30 CET
- Week transition at 02:30 UTC = 03:30 CET

**Mitigation:** All dates are stored as UTC-normalized (YYYY-MM-DD format)

### 2. **Late Data Collection**

If the archival cron fails, expired cache entries remain until next run.

**Mitigation:** `PeriodTransitionHandler.handleTransition()` catches ALL expired entries, not just the previous period.

### 3. **Missing Historical Data**

If a period was never collected (new client, API failure), the database won't have data.

**Mitigation:** 
- Reports show "No data available" message
- BackgroundDataCollector can backfill historical data

---

## 🎯 Verification Commands

### Check Current Cache Status

```sql
-- Current month cache entries
SELECT client_id, period_id, platform, updated_at 
FROM current_month_cache 
ORDER BY updated_at DESC;

-- Current week cache entries  
SELECT client_id, period_id, platform, updated_at 
FROM current_week_cache 
ORDER BY updated_at DESC;
```

### Check Historical Data Coverage

```sql
-- Monthly summaries by client
SELECT 
  c.name as client_name,
  cs.platform,
  COUNT(*) as period_count,
  MIN(cs.summary_date) as earliest,
  MAX(cs.summary_date) as latest
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
GROUP BY c.name, cs.platform
ORDER BY c.name, cs.platform;
```

### Verify Period Transition Health

```bash
# Test the period transition endpoint
curl -X GET "https://your-domain.com/api/cron/period-transition" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 📝 Conclusion

**The system is fully prepared to handle period transitions:**

1. ✅ **Cron jobs are scheduled** at appropriate times
2. ✅ **Archival logic handles both platforms** (Meta + Google Ads)
3. ✅ **Strict period detection** ensures correct data source routing
4. ✅ **Display automatically switches** when periods change
5. ✅ **Data retention is managed** (14 months kept, older cleaned)

**No changes needed** - the system is production-ready for period transitions.

