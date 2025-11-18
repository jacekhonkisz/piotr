# 🚀 WEEKLY DATA STANDARDIZATION & RE-COLLECTION PLAN

**Date:** November 18, 2025  
**Goal:** Standardize all weekly data, re-collect past data, ensure automatic collection works correctly  
**Estimated Time:** 3-4 hours total

---

## 🎯 OBJECTIVES

1. ✅ **Standardize Data** - All weekly records start on Monday (ISO 8601)
2. ✅ **Re-collect Historical Data** - Fill last 53 weeks with correct dates
3. ✅ **Fix Collection Code** - Google Ads uses proper week boundaries
4. ✅ **Automate Forever** - System maintains quality automatically
5. ✅ **Add Safeguards** - Prevent regression with validation

---

## 📋 EXECUTION PLAN

### Phase 1: Backup & Clean (30 minutes)

**What:** Backup current data and remove bad records

```sql
-- Step 1.1: Backup current data
CREATE TABLE campaign_summaries_backup_20251118 AS
SELECT * FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Step 1.2: Review what will be deleted
SELECT 
  summary_date,
  platform,
  EXTRACT(DOW FROM summary_date) as day_of_week,
  TO_CHAR(summary_date, 'Dy') as day_name,
  total_spend,
  reservations
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1
ORDER BY summary_date DESC;

-- Step 1.3: Delete non-Monday weeks
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1;

-- Expected: Delete ~59 records
```

**Result:** Clean database with only properly-dated records

---

### Phase 2: Fix Collection Code (1-2 hours)

**What:** Update all collection endpoints to use ISO week boundaries

#### 2.1: Add Helper Functions

**File:** `src/lib/week-helpers.ts` (NEW)

```typescript
/**
 * ISO Week Helper Functions
 * Ensures all weekly data uses Monday as week start
 */

/**
 * Get the Monday of the ISO week containing the given date
 * @param date Any date within the week
 * @returns Monday of that week (00:00:00)
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get the Sunday of the ISO week containing the given date
 * @param date Any date within the week
 * @returns Sunday of that week (23:59:59)
 */
export function getSundayOfWeek(date: Date): Date {
  const monday = getMondayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Get week boundaries for a given date
 * @param date Any date within the week
 * @returns { start: Monday, end: Sunday }
 */
export function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  return {
    start: getMondayOfWeek(date),
    end: getSundayOfWeek(date)
  };
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Validate that a date is a Monday
 * @throws Error if date is not Monday
 */
export function validateIsMonday(date: Date | string): void {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (d.getDay() !== 1) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    throw new Error(
      `Weekly summary_date must be a Monday! Got: ${formatDateISO(d)} (${dayNames[d.getDay()]})`
    );
  }
}

/**
 * Get an array of Mondays for the last N weeks
 * @param weeksBack Number of weeks to go back (default: 53)
 * @param includeCurrentWeek Include current incomplete week (default: true)
 * @returns Array of Monday dates, newest first
 */
export function getLastNWeeks(weeksBack: number = 53, includeCurrentWeek: boolean = true): Date[] {
  const weeks: Date[] = [];
  const today = new Date();
  
  if (includeCurrentWeek) {
    weeks.push(getMondayOfWeek(today));
  }
  
  const lastCompleteWeek = new Date(today);
  lastCompleteWeek.setDate(lastCompleteWeek.getDate() - 7);
  
  for (let i = 0; i < weeksBack; i++) {
    const weekDate = new Date(lastCompleteWeek);
    weekDate.setDate(weekDate.getDate() - (i * 7));
    weeks.push(getMondayOfWeek(weekDate));
  }
  
  return weeks;
}
```

#### 2.2: Update Background Data Collector

**File:** `src/lib/background-data-collector.ts`

Find and update the Google Ads collection methods:

```typescript
import { getMondayOfWeek, getSundayOfWeek, formatDateISO, validateIsMonday } from './week-helpers';

// ... existing code ...

/**
 * Collect Google Ads weekly data (FIXED VERSION)
 */
private async collectGoogleAdsWeeklyData(
  clientId: string,
  weekDate: Date,
  isCurrentWeek: boolean = false
): Promise<any> {
  // ✅ FORCE MONDAY START DATE
  const weekStart = getMondayOfWeek(weekDate);
  const weekEnd = getSundayOfWeek(weekDate);
  
  logger.info(`📊 Collecting Google Ads for week ${formatDateISO(weekStart)} - ${formatDateISO(weekEnd)}`);
  
  // Fetch data using correct week boundaries
  const data = await this.fetchGoogleAdsData(
    clientId,
    formatDateISO(weekStart),
    formatDateISO(weekEnd)
  );
  
  // Store with validated Monday date
  validateIsMonday(weekStart);
  
  return {
    ...data,
    summary_date: formatDateISO(weekStart),
    weekStart: formatDateISO(weekStart),
    weekEnd: formatDateISO(weekEnd),
    isCurrentWeek
  };
}
```

#### 2.3: Update Incremental Collection

**File:** `src/app/api/automated/incremental-weekly-collection/route.ts`

```typescript
import { getMondayOfWeek, getLastNWeeks, formatDateISO } from '@/lib/week-helpers';

export async function POST(request: NextRequest) {
  try {
    logger.info('🚀 Starting incremental weekly collection...');
    
    const clients = await getActiveClients();
    
    for (const client of clients) {
      // ✅ Get properly aligned weeks (all Mondays)
      const weeks = getLastNWeeks(12, true); // Last 12 weeks + current
      
      for (const weekMonday of weeks) {
        // Check if this week already exists
        const { data: existing } = await supabase
          .from('campaign_summaries')
          .select('id')
          .eq('client_id', client.id)
          .eq('summary_type', 'weekly')
          .eq('summary_date', formatDateISO(weekMonday))
          .eq('platform', 'meta')
          .single();
        
        if (!existing) {
          logger.info(`📅 Missing week ${formatDateISO(weekMonday)} for ${client.name}`);
          await collectWeekForClient(client.id, weekMonday);
        }
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('❌ Collection failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### 2.4: Add Validation Before Insert

**File:** `src/lib/background-data-collector.ts`

```typescript
import { validateIsMonday } from './week-helpers';

/**
 * Store weekly summary with validation
 */
private async storeWeeklySummary(clientId: string, data: any, platform: 'meta' | 'google'): Promise<void> {
  // ✅ VALIDATE BEFORE STORING
  validateIsMonday(data.summary_date);
  
  const summary = {
    client_id: clientId,
    summary_type: 'weekly',
    summary_date: data.summary_date,
    platform: platform,
    // ... rest of fields
  };
  
  const { error } = await supabase
    .from('campaign_summaries')
    .upsert(summary, {
      onConflict: 'client_id,summary_type,summary_date,platform'
    });
  
  if (error) {
    throw new Error(`Failed to store weekly summary: ${error.message}`);
  }
}
```

---

### Phase 3: Create Re-Collection Script (30 minutes)

**What:** Batch re-collect last 53 weeks with correct dates

**File:** `scripts/recollect-all-weeks.ts` (NEW)

```typescript
#!/usr/bin/env tsx

/**
 * Re-collect All Historical Weeks
 * 
 * This script re-collects the last 53 weeks with proper ISO week boundaries
 * Run: npx tsx scripts/recollect-all-weeks.ts
 */

import { createClient } from '@supabase/supabase-js';
import { getMondayOfWeek, getLastNWeeks, formatDateISO } from '../src/lib/week-helpers';

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function recollectAllWeeks() {
  console.log('🚀 Re-collecting Last 53 Weeks with Correct Dates\n');
  console.log('=' .repeat(70));
  
  // Get Belmonte client
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', '%belmonte%');
  
  if (!clients || clients.length === 0) {
    console.error('❌ Client not found');
    return;
  }
  
  const client = clients[0];
  console.log(`\n✅ Client: ${client.name}`);
  
  // Get last 53 weeks (Monday dates)
  const weeks = getLastNWeeks(53, false); // Exclude current week
  console.log(`📅 Will collect ${weeks.length} completed weeks\n`);
  
  let collected = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const weekMonday of weeks) {
    const weekStr = formatDateISO(weekMonday);
    
    try {
      // Check if week exists
      const { data: existing } = await supabase
        .from('campaign_summaries')
        .select('id, platform')
        .eq('client_id', client.id)
        .eq('summary_type', 'weekly')
        .eq('summary_date', weekStr);
      
      const hasMetaplatforms = existing?.some(e => e.platform === 'meta');
      const hasGoogle = existing?.some(e => e.platform === 'google');
      
      if (hasMeta && hasGoogle) {
        console.log(`⏭️  ${weekStr} - Already complete`);
        skipped++;
        continue;
      }
      
      // Trigger collection for this week
      console.log(`🔄 ${weekStr} - Collecting...`);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/automated/collect-weekly-summaries`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            clientId: client.id,
            weekStart: weekStr,
            weekEnd: formatDateISO(new Date(weekMonday.getTime() + 6 * 24 * 60 * 60 * 1000))
          })
        }
      );
      
      if (response.ok) {
        console.log(`✅ ${weekStr} - Collected successfully`);
        collected++;
      } else {
        console.log(`⚠️  ${weekStr} - Failed (${response.status})`);
        errors++;
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ ${weekStr} - Error:`, error.message);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Collected: ${collected}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total: ${weeks.length}`);
}

recollectAllWeeks().catch(console.error);
```

---

### Phase 4: Update Cron Configuration (15 minutes)

**What:** Ensure only the correct endpoint runs automatically

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/automated/incremental-weekly-collection",
      "schedule": "0 2 * * 1"
    }
  ]
}
```

**Remove or comment out:**
- `/api/automated/collect-weekly-summaries` (legacy, timeouts)
- Any other weekly collection endpoints

---

### Phase 5: Add Database Constraint (10 minutes)

**What:** Enforce Monday-only dates at database level

**File:** `supabase/migrations/20251118_enforce_monday_weeks.sql` (NEW)

```sql
-- Add check constraint to ensure weekly summary_date is always Monday
ALTER TABLE campaign_summaries
ADD CONSTRAINT weekly_must_be_monday
CHECK (
  summary_type != 'weekly' OR 
  EXTRACT(DOW FROM summary_date) = 1
);

-- Add helpful comment
COMMENT ON CONSTRAINT weekly_must_be_monday ON campaign_summaries IS 
'Ensures weekly reports always start on Monday (ISO 8601 standard)';
```

---

### Phase 6: Testing (30 minutes)

**What:** Verify everything works correctly

#### Test 1: Validate Helper Functions
```bash
npx tsx scripts/test-week-helpers.ts
```

#### Test 2: Check Current Data
```bash
npx tsx scripts/check-weekly-duplicates.ts
# Expected: 0 non-Monday weeks
```

#### Test 3: Test Single Week Collection
```bash
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection' \
  -H 'Authorization: Bearer YOUR_CRON_SECRET' \
  -w "\n⏱️  Time: %{time_total}s\n"

# Expected: 200 OK, < 60 seconds
```

#### Test 4: Verify Database
```sql
-- All weeks should be Monday
SELECT 
  COUNT(*) as total_weeks,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM summary_date) = 1) as monday_weeks,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM summary_date) != 1) as non_monday_weeks
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Expected: non_monday_weeks = 0
```

---

## 🚀 EXECUTION STEPS

### Step 1: Backup Current Data
```bash
# Run in Supabase SQL Editor
CREATE TABLE campaign_summaries_backup_20251118 AS
SELECT * FROM campaign_summaries;

SELECT COUNT(*) FROM campaign_summaries_backup_20251118;
-- Verify backup exists
```

### Step 2: Clean Database
```bash
# Run in Supabase SQL Editor
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1;

-- Expected: DELETE 59
```

### Step 3: Deploy Code Fixes
```bash
# 1. Create files (done by AI assistant)
# 2. Review changes
git diff

# 3. Test locally
npm run dev

# 4. Commit and push
git add -A
git commit -m "fix: Standardize weekly data to use ISO weeks (Monday start)"
git push

# 5. Wait for Vercel deployment (~60 seconds)
```

### Step 4: Re-collect Historical Data
```bash
# Option A: Automatic (incremental will fill gaps)
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection'

# Option B: Manual (batch script)
npx tsx scripts/recollect-all-weeks.ts
```

### Step 5: Add Database Constraint
```bash
# Run in Supabase SQL Editor
# File: supabase/migrations/20251118_enforce_monday_weeks.sql
```

### Step 6: Verify Everything
```bash
# Check data quality
npx tsx scripts/check-weekly-duplicates.ts

# Expected output:
# ✅ No duplicates
# ✅ All weeks start on Monday
# ✅ Recent data complete
```

---

## ⏱️ TIMELINE

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Backup & Clean | 30 min | ⏳ Pending |
| Phase 2: Fix Code | 1-2 hours | ⏳ Pending |
| Phase 3: Re-collection Script | 30 min | ⏳ Pending |
| Phase 4: Cron Config | 15 min | ⏳ Pending |
| Phase 5: DB Constraint | 10 min | ⏳ Pending |
| Phase 6: Testing | 30 min | ⏳ Pending |
| **TOTAL** | **3-4 hours** | |

---

## ✅ SUCCESS CRITERIA

After completion, you should have:

- ✅ All weekly records start on Monday (0 exceptions)
- ✅ Last 53 weeks collected with correct dates
- ✅ Google Ads and Meta Ads aligned to same weeks
- ✅ Automatic collection uses ISO week boundaries
- ✅ Database constraint prevents future bad dates
- ✅ Audit script shows 100% data quality
- ✅ System runs automatically every Monday

---

## 🔒 SAFETY MEASURES

1. **Backup Created** - Can restore if needed
2. **Validation Added** - Code throws error on bad dates
3. **DB Constraint** - Database rejects non-Monday weeks
4. **Audit Script** - Can check quality anytime
5. **Rollback Plan** - Restore from backup if issues

---

## 📊 EXPECTED RESULTS

### Before:
```
Total Records: 158
Non-Monday Weeks: 59 (37%)
Data Quality: 🔴 POOR
```

### After:
```
Total Records: ~120+ (clean + re-collected)
Non-Monday Weeks: 0 (0%)
Data Quality: ✅ EXCELLENT
Last 53 Weeks: ✅ Complete
Automatic Collection: ✅ Working
```

---

## 📞 SUPPORT

If anything goes wrong:

1. **Check logs** - Vercel dashboard
2. **Run audit** - `npx tsx scripts/check-weekly-duplicates.ts`
3. **Restore backup** - `INSERT INTO campaign_summaries SELECT * FROM campaign_summaries_backup_20251118`
4. **Review errors** - Check Supabase logs

---

**Ready to execute?** Let's standardize your weekly data! 🚀

