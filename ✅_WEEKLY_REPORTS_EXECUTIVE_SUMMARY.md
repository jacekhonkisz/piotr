# ✅ WEEKLY REPORTS SYSTEM - EXECUTIVE SUMMARY

**Date:** November 18, 2025  
**Status:** 🟡 FUNCTIONAL WITH KNOWN ISSUES  
**Action Required:** YES - Data quality improvements needed

---

## 🎯 TL;DR (30 SECONDS)

Your weekly reports system **WORKS** but has **data quality issues**:

✅ **Good:** No duplicates, recent data is complete  
❌ **Bad:** 37% of weekly records have wrong dates (Google Ads bug)  
⚠️ **OK:** 18% have empty data (may be legitimate)

**Fix:** Run cleanup script + fix Google Ads week calculation (2-3 hours)

---

## 📊 SYSTEM OVERVIEW

### What It Does:

```
Weekly Reports System
├── Collects campaign data every Monday at 2 AM
├── Aggregates into 7-day periods (Mon-Sun)
├── Stores in campaign_summaries table
├── Supports Meta Ads and Google Ads
└── Provides historical data for reports
```

### How It Works:

```
1. Cron Job Triggers
   ↓
2. Check database for missing weeks
   ↓
3. Fetch ONLY missing weeks from APIs
   ↓
4. Aggregate metrics (spend, conversions, etc.)
   ↓
5. Store in campaign_summaries
   ↓
6. Reports use this pre-aggregated data
```

### Data Storage:

```sql
campaign_summaries (
  client_id UUID,
  summary_type TEXT,      -- 'weekly' | 'monthly'
  summary_date DATE,      -- Week start (MUST BE MONDAY)
  platform TEXT,          -- 'meta' | 'google'
  
  -- Metrics
  total_spend DECIMAL,
  total_clicks BIGINT,
  reservations BIGINT,
  
  -- Rich data
  campaign_data JSONB,
  
  UNIQUE(client_id, summary_type, summary_date, platform)
)
```

---

## ✅ WHAT'S WORKING

### 1. No Duplicates ✅

```
Expected: Each week appears once per platform
Actual: Each week appears once per platform
Status: ✅ PERFECT!
```

The UNIQUE constraint is working correctly. No data duplication issues.

### 2. Incremental Collection ✅

```
Endpoint: /api/automated/incremental-weekly-collection
Schedule: Every Monday 2 AM
Performance: < 2 minutes (fast!)
Logic: Collects only missing weeks (smart!)
```

This is the **recommended** collection method. It's fast and efficient.

### 3. Recent Data Complete ✅

```
Week Nov 10, 2025 (Monday):
  Meta:   $6,271 spend | 18 reservations ✅
  Google:    $79 spend | 12 reservations ✅
  
Data: Complete and accurate
```

Your most recent weekly data is correct and complete.

---

## ❌ WHAT'S BROKEN

### 1. Google Ads Uses Wrong Week Dates (CRITICAL)

**Problem:** 59 out of 158 weekly records (37%) have dates that are NOT Mondays

```
❌ WRONG:
2025-11-06 (Thursday)  | Google Ads weekly record
2025-11-05 (Wednesday) | Google Ads weekly record
2025-11-04 (Tuesday)   | Google Ads weekly record

✅ CORRECT:
2025-11-10 (Monday)    | Meta Ads weekly record
2025-11-10 (Monday)    | Google Ads weekly record
```

**Impact:**
- Week-over-week comparisons are meaningless
- Reports show incorrect trends
- Data doesn't align with Meta Ads weeks

**Root Cause:**
Google Ads collection code doesn't force Monday start dates:

```typescript
// ❌ Current (WRONG):
const weekStart = date;  // Could be any day!

// ✅ Should be:
const weekStart = getMondayOfWeek(date);  // Always Monday
```

**Fix:** Add `getMondayOfWeek()` helper to Google Ads collection

---

## ⚠️ WHAT'S QUESTIONABLE

### 1. Empty Data Records (29 weeks)

**Problem:** 29 weeks have $0 spend and 0 conversions (mostly Google Ads)

**Possible Explanations:**
1. ✅ **Legitimate** - Client didn't run Google Ads those weeks
2. ❌ **Collection failure** - API timeout or error
3. ❌ **Not synced** - Campaigns existed but data wasn't fetched

**Recommendation:** Investigate whether client actually uses Google Ads consistently

---

## 🔍 AUDIT RESULTS

### Current Database State (Belmonte Hotel):

```
Total Weekly Records: 158
Platform Breakdown:
  Meta Ads:   ~99 records (63%)
  Google Ads: ~59 records (37%)

Data Quality:
  ✅ Duplicates: 0 (0%)
  ❌ Non-Monday Weeks: 59 (37%)
  ⚠️  Empty Data: 29 (18%)
```

### Platform Comparison:

| Platform | Total Records | Wrong Dates | Empty Data | Quality |
|----------|--------------|-------------|------------|---------|
| **Meta Ads** | 99 | 10 (10%) | 0 (0%) | 🟢 GOOD |
| **Google Ads** | 59 | 49 (83%!) | 29 (49%) | 🔴 POOR |

**Conclusion:** Google Ads collection has significant issues

---

## 🚨 CONFLICTS & DUPLICATES

### Collection Endpoints:

You have **4 different endpoints** that can collect weekly data:

| Endpoint | Status | Use Case | Risk |
|----------|--------|----------|------|
| `/api/automated/incremental-weekly-collection` | ✅ ACTIVE | Primary (recommended) | 🟢 LOW |
| `/api/automated/collect-weekly-summaries` | ⚠️ SCHEDULED | Legacy (timeouts) | 🔴 HIGH |
| `/api/background/collect-weekly` | ⚠️ MANUAL | Duplicate of #2 | 🟡 MEDIUM |
| `/api/optimized/weekly-collection` | ❓ UNUSED | Google only (?) | 🟢 LOW |

**Conflict Risk:** If multiple endpoints run simultaneously, they may:
- Overwrite each other's data
- Waste API quota
- Create race conditions

**Recommendation:** 
1. Keep ONLY `/api/automated/incremental-weekly-collection` active
2. Disable or remove other endpoints

### Data Priority System:

Weekly data can come from multiple sources. Priority order:

```
1. daily_kpi_data (HIGHEST)
   - Manual uploads
   - Most accurate
   
2. Meta/Google API
   - Real-time data
   - Official source
   
3. smart_cache
   - Cached responses
   - Fast but stale
   
4. campaign_summaries (LOWEST)
   - Pre-aggregated
   - Historical only
```

**Current Logic:**
```typescript
// Check daily_kpi_data first
if (dailyKpiData.exists) {
  use(dailyKpiData);  // ✅ Priority 1
} else {
  use(apiData);       // ⚠️ Priority 2
}
```

This is working correctly!

---

## 🛠️ HOW TO FIX

### Quick Fix (30 minutes):

```bash
# Step 1: Clean up bad data
# Run in Supabase SQL Editor:
scripts/remove-non-monday-weeks.sql

# Step 2: Re-collect with correct dates
curl -X POST https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection

# Step 3: Verify
npx tsx scripts/check-weekly-duplicates.ts
# Expected: 0 non-Monday weeks
```

### Complete Fix (2-3 hours):

1. **Clean database** (30 min)
   - Delete non-Monday weeks
   - Verify no duplicates remain

2. **Fix Google Ads code** (1-2 hours)
   - Add `getMondayOfWeek()` helper function
   - Update Google Ads collection logic
   - Add validation before insert

3. **Re-collect data** (30 min)
   - Trigger incremental collection
   - Fill gaps with correct dates
   - Verify data quality

4. **Test & deploy** (30 min)
   - Run audit script
   - Check reports
   - Monitor for issues

---

## 📋 CODE CHANGES NEEDED

### File: `src/lib/background-data-collector.ts`

Add this helper function:

```typescript
/**
 * Get the Monday of the ISO week containing the given date
 */
private getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
```

Update Google Ads collection:

```typescript
private async collectGoogleAdsWeekly(clientId: string, date: Date) {
  // ✅ FORCE MONDAY START DATE
  const weekStart = this.getMondayOfWeek(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  // ... rest of collection logic
  
  await supabase
    .from('campaign_summaries')
    .upsert({
      summary_date: weekStart.toISOString().split('T')[0],  // ✅ MONDAY!
      // ... other fields
    });
}
```

Add validation:

```typescript
function validateWeeklySummary(summary: WeeklySummary): void {
  if (summary.summary_type === 'weekly') {
    const date = new Date(summary.summary_date);
    if (date.getDay() !== 1) {
      throw new Error('Weekly summary_date must be a Monday!');
    }
  }
}
```

---

## 📚 DOCUMENTATION CREATED

I've created 3 comprehensive documents for you:

### 1. **📊_WEEKLY_REPORTS_SYSTEM_LOGIC_AND_AUDIT.md**
- Complete system architecture
- Data flow diagrams
- Collection mechanisms
- Cleanup scripts
- Best practices

### 2. **🔍_WEEKLY_REPORTS_AUDIT_RESULTS.md**
- Detailed audit findings
- Root cause analysis
- Fix plan with code examples
- Step-by-step instructions

### 3. **✅_WEEKLY_REPORTS_EXECUTIVE_SUMMARY.md** (this file)
- Quick overview
- Action items
- Code snippets
- Decision guide

### 4. **scripts/check-weekly-duplicates.ts**
- Automated audit script
- Run anytime to check data quality
- Shows duplicates, wrong dates, empty data

---

## 🎯 DECISION GUIDE

### Should I fix this now?

**YES, if:**
- You need accurate week-over-week reports
- You use Google Ads data in dashboards
- You have time for 2-3 hour fix

**NO, if:**
- You only use Meta Ads (mostly correct)
- Reports are for rough trends only
- You're in middle of other critical work

### Which endpoint should I use?

**Use:** `/api/automated/incremental-weekly-collection`

**Because:**
- ✅ Fast (< 2 minutes)
- ✅ Smart (only collects missing weeks)
- ✅ Reliable (won't timeout)
- ✅ Already scheduled (Monday 2 AM)

**Don't use:** Other endpoints (legacy, will timeout)

### Do I have duplicates?

**NO!** The audit confirms:
```
Duplicates: 0
UNIQUE constraint: Working perfectly
```

You can safely continue collecting without duplicate concerns.

---

## ⚡ IMMEDIATE ACTION ITEMS

**Priority 1 (Do Today):**
- [ ] Run cleanup script to remove non-Monday weeks
- [ ] Review Google Ads usage (is empty data legitimate?)
- [ ] Disable legacy collection endpoints in `vercel.json`

**Priority 2 (Do This Week):**
- [ ] Fix Google Ads week calculation code
- [ ] Add validation to prevent future issues
- [ ] Re-collect missing weeks with correct dates
- [ ] Run audit script to verify fixes

**Priority 3 (Do This Month):**
- [ ] Remove unused collection endpoints
- [ ] Add monitoring for data quality
- [ ] Document which endpoint to use when
- [ ] Set up alerts for non-Monday weeks

---

## ❓ QUICK FAQ

**Q: Do I have duplicates?**  
A: No! ✅ The UNIQUE constraint is working perfectly.

**Q: Why 158 weeks instead of ~60?**  
A: Google Ads is creating multiple records per week (wrong dates).

**Q: Will cleanup break my reports?**  
A: No! We'll re-collect with correct dates. Reports will be MORE accurate.

**Q: Which collection endpoint should I use?**  
A: Use ONLY `/api/automated/incremental-weekly-collection`

**Q: Is this a critical bug?**  
A: No, system is functional. But data quality should be improved.

**Q: How long to fix?**  
A: 30 min (quick cleanup) or 2-3 hours (complete fix)

---

## 🔗 NEXT STEPS

### Step 1: Understand (DONE ✅)
- [x] Read this summary
- [x] Review audit results
- [x] Understand the issues

### Step 2: Clean (30 minutes)
- [ ] Run `scripts/remove-non-monday-weeks.sql`
- [ ] Verify cleanup with audit script
- [ ] Re-collect missing weeks

### Step 3: Fix (1-2 hours)
- [ ] Add `getMondayOfWeek()` helper
- [ ] Update Google Ads collection
- [ ] Add validation
- [ ] Test thoroughly

### Step 4: Verify (15 minutes)
- [ ] Run `npx tsx scripts/check-weekly-duplicates.ts`
- [ ] Check reports for accuracy
- [ ] Monitor for new issues

---

## ✅ SUMMARY

**System Status:** 🟡 Functional with data quality issues

**Duplicates:** ✅ None found  
**Wrong Dates:** ❌ 37% (Google Ads bug)  
**Empty Data:** ⚠️ 18% (investigate)

**Recommendation:** Fix Google Ads week calculation + clean up database

**Effort:** 2-3 hours for complete fix

**Risk:** 🟢 LOW - No system failures, just data quality

**Urgency:** 🟡 MEDIUM - Works but should be improved

---

**All audit scripts and fix instructions are ready to use!** 🚀

Need help implementing? Check the detailed documents:
- `📊_WEEKLY_REPORTS_SYSTEM_LOGIC_AND_AUDIT.md` - System deep-dive
- `🔍_WEEKLY_REPORTS_AUDIT_RESULTS.md` - Fix instructions
- `scripts/check-weekly-duplicates.ts` - Run audit anytime

