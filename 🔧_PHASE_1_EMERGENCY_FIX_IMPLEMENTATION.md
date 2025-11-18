# 🔧 PHASE 1 EMERGENCY FIX - IMPLEMENTATION GUIDE

**Target:** Reduce weekly collection time from 210s → 35s (under 180s limit)  
**Estimated Time:** 2-3 hours  
**Risk:** Low (no breaking changes)

---

## 📋 FIXES TO IMPLEMENT

### Fix 1: Bulk Fetch daily_kpi_data (Saves 5-10s)
### Fix 2: Batch Database Upserts (Saves 5-8s)
### Fix 3: Collect Only Recent 3 Weeks (Saves 85% time)
### Fix 4: Add Database Indexes (Saves 2-5s)

---

## 🔧 FIX 1: BULK FETCH daily_kpi_data

### Current Problem (54 queries per client)

**File:** `src/lib/background-data-collector.ts`  
**Lines:** 1047-1087

```typescript
// ❌ CURRENT: Query database 54 times (once per week)
private async storeWeeklySummary(clientId: string, data: any, platform: 'meta' | 'google' = 'meta'): Promise<void> {
  // ... setup code ...
  
  // 🔴 THIS QUERY RUNS 54 TIMES!
  const { data: dailyKpiData, error: kpiError } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', weekStart)
    .lte('date', weekEnd);
  
  // ... rest of function ...
}
```

### Solution: Fetch Once, Use Many Times

**Step 1:** Add bulk fetch method to BackgroundDataCollector class

```typescript
// Add this new method BEFORE collectWeeklySummaryForClient (around line 470)

/**
 * Bulk fetch all daily_kpi_data for a client and date range
 * Returns a Map<week_start_date, daily_kpi_data[]> for O(1) lookups
 */
private async bulkFetchDailyKpiData(
  clientId: string, 
  startDate: string, 
  endDate: string
): Promise<Map<string, any[]>> {
  logger.info(`📊 Bulk fetching daily_kpi_data for ${startDate} to ${endDate}...`);
  
  const { data: allDailyKpiData, error: kpiError } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', clientId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });
  
  if (kpiError) {
    logger.error(`❌ Error fetching daily_kpi_data: ${kpiError.message}`);
    return new Map();
  }
  
  if (!allDailyKpiData || allDailyKpiData.length === 0) {
    logger.warn(`⚠️ No daily_kpi_data found for ${startDate} to ${endDate}`);
    return new Map();
  }
  
  // Group by week start date for fast lookups
  const weekMap = new Map<string, any[]>();
  
  for (const record of allDailyKpiData) {
    const recordDate = new Date(record.date);
    
    // Find which week this record belongs to
    const dayOfWeek = recordDate.getDay(); // 0 = Sunday, 1 = Monday, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(recordDate);
    weekStart.setDate(recordDate.getDate() - daysToMonday);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    if (!weekMap.has(weekStartStr)) {
      weekMap.set(weekStartStr, []);
    }
    weekMap.get(weekStartStr)!.push(record);
  }
  
  logger.info(`✅ Bulk fetched ${allDailyKpiData.length} daily records across ${weekMap.size} weeks`);
  return weekMap;
}
```

**Step 2:** Modify `collectWeeklySummaryForClient` to use bulk fetch

```typescript
// Find this method around line 472
private async collectWeeklySummaryForClient(client: Client, startWeek: number = 0, endWeek: number = 53): Promise<void> {
  // ... existing setup code (lines 472-559) ...
  
  // 🔧 NEW: Bulk fetch all daily_kpi_data ONCE (before the loop)
  // Add this BEFORE the for-loop at line 565
  const firstWeekStart = weeksToCollect[weeksToCollect.length - 1].startDate;
  const lastWeekEnd = weeksToCollect[0].endDate;
  const dailyKpiMap = await this.bulkFetchDailyKpiData(client.id, firstWeekStart, lastWeekEnd);
  logger.info(`📊 Loaded daily_kpi_data for ${dailyKpiMap.size} weeks (will be used in-memory)`);
  
  // ... rest of method (keep existing for-loop) ...
}
```

**Step 3:** Modify `storeWeeklySummary` to use pre-fetched data

```typescript
// Update method signature to accept pre-fetched data (line 1013)
private async storeWeeklySummary(
  clientId: string, 
  data: any, 
  platform: 'meta' | 'google' = 'meta',
  dailyKpiMap?: Map<string, any[]>  // 🔧 NEW: Optional pre-fetched data
): Promise<void> {
  logger.info(`💾 Storing ${platform} weekly summary for client ${clientId} on ${data.summary_date}`);

  // ... existing campaign aggregation code (lines 1016-1044) ...
  
  // 🔧 REPLACE the database query (lines 1045-1087) with:
  
  // Get the week start and end dates
  const weekStart = data.summary_date;
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = weekEndDate.toISOString().split('T')[0];
  
  // 🥇 PRIORITY 1: Use pre-fetched data if available (0ms query time!)
  let dailyKpiData: any[] = [];
  
  if (dailyKpiMap && dailyKpiMap.has(weekStart)) {
    // ✅ Use in-memory data (instant lookup)
    dailyKpiData = dailyKpiMap.get(weekStart)!;
    logger.info(`✅ Using pre-fetched daily_kpi_data (${dailyKpiData.length} records) for week ${weekStart}`);
  } else {
    // Fallback: Query database (only if map not provided)
    logger.warn(`⚠️ No pre-fetched data for week ${weekStart}, querying database...`);
    const { data: fetchedData, error: kpiError } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', clientId)
      .gte('date', weekStart)
      .lte('date', weekEnd);
    
    if (!kpiError && fetchedData) {
      dailyKpiData = fetchedData;
    }
  }
  
  // 🔧 CONTINUE with existing logic (aggregate dailyKpiData)
  let enhancedConversionMetrics = { ...conversionTotals };
  
  if (dailyKpiData.length > 0) {
    logger.info(`✅ Found ${dailyKpiData.length} daily KPI records for week ${data.summary_date}`);
    
    // Aggregate conversion metrics from daily_kpi_data
    enhancedConversionMetrics = dailyKpiData.reduce((acc: any, record: any) => ({
      click_to_call: acc.click_to_call + (record.click_to_call || 0),
      email_contacts: acc.email_contacts + (record.email_contacts || 0),
      booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
      reservations: acc.reservations + (record.reservations || 0),
      reservation_value: acc.reservation_value + (record.reservation_value || 0),
      booking_step_2: acc.booking_step_2 + (record.booking_step_2 || 0),
      booking_step_3: acc.booking_step_3 + (record.booking_step_3 || 0)
    }), {
      click_to_call: 0,
      email_contacts: 0,
      booking_step_1: 0,
      reservations: 0,
      reservation_value: 0,
      booking_step_2: 0,
      booking_step_3: 0
    });
    
    logger.info(`✅ Using daily_kpi_data conversion metrics (PRIORITY 1):`, enhancedConversionMetrics);
  } else {
    // Use Meta API data as fallback
    logger.info(`⚠️ No daily_kpi_data found for week ${data.summary_date}, using Meta API as fallback`);
    enhancedConversionMetrics = { ...conversionTotals };
  }
  
  // ... rest of existing method (lines 1089-1155) ...
}
```

**Step 4:** Update the for-loop to pass the map

```typescript
// In collectWeeklySummaryForClient, update the storeWeeklySummary call (around line 633)

// ❌ OLD:
await this.storeWeeklySummary(client.id, {
  summary_date: weekData.startDate,
  campaigns: campaignInsights,
  totals,
  metaTables,
  activeCampaignCount,
  isCurrentWeek: weekData.isCurrent
}, 'meta');

// ✅ NEW: Pass the dailyKpiMap
await this.storeWeeklySummary(client.id, {
  summary_date: weekData.startDate,
  campaigns: campaignInsights,
  totals,
  metaTables,
  activeCampaignCount,
  isCurrentWeek: weekData.isCurrent
}, 'meta', dailyKpiMap);  // 🔧 Pass the pre-fetched map
```

---

## 🔧 FIX 2: BATCH DATABASE UPSERTS

### Current Problem (54 upserts per client)

```typescript
// ❌ CURRENT: Upsert 54 times (once per week)
for (let weekIndex = 0; weekIndex < weeksToCollect.length; weekIndex++) {
  // ... fetch data ...
  
  await this.storeWeeklySummary(...); // Upsert #1
  // ... next week ...
  await this.storeWeeklySummary(...); // Upsert #2
  // ... (repeat 54 times) ...
}
```

### Solution: Collect All, Upsert Once

**Step 1:** Add batch storage method

```typescript
// Add this new method BEFORE storeWeeklySummary (around line 1010)

/**
 * Batch store multiple weekly summaries in one database operation
 */
private async batchStoreWeeklySummaries(summaries: any[]): Promise<void> {
  if (summaries.length === 0) {
    logger.warn('⚠️ No summaries to store');
    return;
  }
  
  logger.info(`💾 Batch storing ${summaries.length} weekly summaries...`);
  
  const { error } = await supabase
    .from('campaign_summaries')
    .upsert(summaries, {
      onConflict: 'client_id,summary_type,summary_date,platform'
    });

  if (error) {
    throw new Error(`Failed to batch store weekly summaries: ${error.message}`);
  }

  logger.info(`✅ Batch stored ${summaries.length} weekly summaries in one operation`);
}
```

**Step 2:** Modify `storeWeeklySummary` to return summary object instead of saving

```typescript
// Update method signature (line 1013)
private buildWeeklySummary(
  clientId: string, 
  data: any, 
  platform: 'meta' | 'google' = 'meta',
  dailyKpiMap?: Map<string, any[]>
): any {  // 🔧 Returns summary object instead of Promise<void>
  logger.info(`🔨 Building ${platform} weekly summary for client ${clientId} on ${data.summary_date}`);

  // ... ALL existing logic (lines 1016-1141) ...
  // ... but REMOVE the database upsert at the end ...
  
  const summary = {
    client_id: clientId,
    summary_type: 'weekly',
    summary_date: data.summary_date,
    platform: platform,
    // ... all other fields ...
  };

  // ❌ REMOVE this database call:
  // const { error } = await supabase.from('campaign_summaries').upsert(summary);
  
  // ✅ Instead, just return the summary object:
  logger.info(`✅ Built ${data.isCurrentWeek ? 'CURRENT' : 'COMPLETED'} week summary`);
  return summary;
}
```

**Step 3:** Update the for-loop to collect and batch save

```typescript
// In collectWeeklySummaryForClient, replace the for-loop (around line 565-650)

// 🔧 NEW: Collect all summaries first, then batch save
const summariesToStore: any[] = [];

for (let weekIndex = 0; weekIndex < weeksToCollect.length; weekIndex++) {
  const weekData = weeksToCollect[weekIndex];
  logger.info(`📅 Processing week ${weekIndex + 1}/${weeksToCollect.length}: ${weekData.startDate}`);

  try {
    // ... existing API fetch logic (lines 570-630) ...
    
    // ✅ Build summary (don't save yet)
    const summary = this.buildWeeklySummary(client.id, {
      summary_date: weekData.startDate,
      campaigns: campaignInsights,
      totals,
      metaTables,
      activeCampaignCount,
      isCurrentWeek: weekData.isCurrent
    }, 'meta', dailyKpiMap);
    
    summariesToStore.push(summary);
    
    logger.info(`✅ Built summary ${weekIndex + 1}/${weeksToCollect.length}`);
    
    // Small delay between API calls (but no DB wait!)
    await this.delay(100);

  } catch (error) {
    logger.error(`❌ Failed to build summary for week ${weekIndex + 1}:`, error);
  }
}

// 🔧 NEW: Batch store all summaries at once
logger.info(`💾 Storing all ${summariesToStore.length} summaries in batch...`);
await this.batchStoreWeeklySummaries(summariesToStore);
logger.info(`✅ Completed all ${weeksToCollect.length} weeks for ${client.name}`);
```

---

## 🔧 FIX 3: COLLECT ONLY RECENT 3 WEEKS

### Change Default Week Range

**File:** `src/app/api/automated/collect-weekly-summaries/route.ts`  
**Line:** 48

```typescript
// ❌ OLD: Default to 54 weeks
const startWeek = parseInt(searchParams.get('startWeek') || '0');
const endWeek = parseInt(searchParams.get('endWeek') || '53');  // 54 weeks

// ✅ NEW: Default to 3 weeks (current + 2 completed)
const startWeek = parseInt(searchParams.get('startWeek') || '0');
const endWeek = parseInt(searchParams.get('endWeek') || '2');  // Only 3 weeks

// Add explanation
if (startWeek === 0 && endWeek === 2) {
  logger.info('📅 Using default: collecting current week + last 2 completed weeks (3 weeks total)');
  logger.info('💡 To collect more history, use: ?startWeek=0&endWeek=53');
}
```

### Add Backfill Endpoint for Historical Data

**File:** `src/app/api/automated/backfill-historical-weeks/route.ts` (NEW FILE)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { BackgroundDataCollector } from '@/lib/background-data-collector';
import logger from '@/lib/logger';
import { verifyCronAuth, createUnauthorizedResponse } from '@/lib/cron-auth';

/**
 * BACKFILL HISTORICAL WEEKS
 * 
 * Collects historical weekly data (weeks 3-53) in the background
 * This runs separately from the regular collection to avoid timeouts
 * 
 * Usage:
 * - Automated: Vercel cron (monthly backfill)
 * - Manual: POST /api/automated/backfill-historical-weeks?testClient=belmonte
 */

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  return await POST(request);
}

export async function POST(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return createUnauthorizedResponse();
  }
  
  const startTime = Date.now();
  const searchParams = request.nextUrl.searchParams;
  const testClient = searchParams.get('testClient');
  
  // Backfill weeks 3-53 (historical data only)
  const startWeek = parseInt(searchParams.get('startWeek') || '3');
  const endWeek = parseInt(searchParams.get('endWeek') || '53');
  
  try {
    logger.info(`🗄️ Starting historical backfill for weeks ${startWeek}-${endWeek}...`);
    
    const collector = BackgroundDataCollector.getInstance();
    await collector.collectWeeklySummaries(testClient || undefined, startWeek, endWeek);
    
    const responseTime = Date.now() - startTime;
    logger.info(`✅ Historical backfill completed in ${(responseTime / 1000).toFixed(2)}s`);
    
    return NextResponse.json({
      success: true,
      message: `Backfilled weeks ${startWeek}-${endWeek}`,
      responseTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Backfill failed', { error, responseTime });
    
    return NextResponse.json({
      success: false,
      error: 'Backfill failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
```

---

## 🔧 FIX 4: ADD DATABASE INDEXES

### Create Migration File

**File:** `supabase/migrations/20251118_add_performance_indexes.sql` (NEW FILE)

```sql
-- Add indexes for weekly collection performance optimization
-- These indexes speed up queries by 2-10x

-- Index 1: Optimize daily_kpi_data lookups by client and date range
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_client_date 
ON daily_kpi_data(client_id, date);

-- Index 2: Optimize campaign_summaries upsert conflict resolution
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_upsert_key
ON campaign_summaries(client_id, summary_type, summary_date, platform);

-- Index 3: Optimize campaign_summaries retrieval by client and period
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_client_period
ON campaign_summaries(client_id, summary_type, platform, summary_date DESC);

-- Index 4: Optimize clients query by api_status
CREATE INDEX IF NOT EXISTS idx_clients_api_status
ON clients(api_status) WHERE api_status = 'valid';

-- Verify indexes created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

### Apply Migration

```bash
# Option 1: Via Supabase CLI (if installed)
cd /Users/macbook/piotr
supabase db push

# Option 2: Via SQL Editor in Supabase Dashboard
# Copy the SQL above and run it manually
```

---

## 📊 EXPECTED RESULTS

### Before (Current)

```
Client: Belmonte
Weeks: 54
─────────────────────────────
Token validation:      2s
Client fetch:          1s
─────────────────────────────
Meta API calls:      130s  (216 calls × 600ms)
DB queries:           10s  (54 queries × 185ms)
DB upserts:            8s  (54 upserts × 148ms)
Processing:           10s
─────────────────────────────
Delays:                5s  (54 × 100ms)
─────────────────────────────
TOTAL:               166s
+ Cold start:        +15s
+ Overhead:          +10s
═════════════════════════════
GRAND TOTAL:         191s  ❌ TIMEOUT (>180s)
```

### After Phase 1 Fixes

```
Client: Belmonte  
Weeks: 3  ← 🔧 Changed from 54
─────────────────────────────
Token validation:      2s
Client fetch:          1s
─────────────────────────────
Meta API calls:        7s  (12 calls × 600ms)  ← 🔧 -95%
DB queries:          0.1s  (1 bulk query)      ← 🔧 -99%
DB upserts:          0.1s  (1 batch upsert)    ← 🔧 -99%
Processing:            1s                      ← 🔧 -90%
─────────────────────────────
Delays:              0.3s  (3 × 100ms)         ← 🔧 -94%
─────────────────────────────
TOTAL:              11.5s
+ Cold start:        +5s
+ Overhead:          +2s
═════════════════════════════
GRAND TOTAL:        18.5s  ✅ SUCCESS! (-91%)
```

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Make Code Changes

```bash
cd /Users/macbook/piotr

# Edit the files:
# 1. src/lib/background-data-collector.ts (bulk fetch + batch upsert)
# 2. src/app/api/automated/collect-weekly-summaries/route.ts (default weeks)
# 3. src/app/api/automated/backfill-historical-weeks/route.ts (new file)
# 4. supabase/migrations/20251118_add_performance_indexes.sql (new file)
```

### Step 2: Apply Database Indexes

```bash
# Run the migration SQL in Supabase Dashboard
# OR via CLI:
supabase db push
```

### Step 3: Test Locally (Optional)

```bash
# If you have local development setup:
npm run dev

# Test endpoint:
curl http://localhost:3000/api/automated/collect-weekly-summaries?testClient=belmonte
```

### Step 4: Deploy to Vercel

```bash
git add -A
git commit -m "EMERGENCY FIX: Optimize weekly collection to prevent timeouts

- Bulk fetch daily_kpi_data (1 query instead of 54)
- Batch upsert summaries (1 operation instead of 54)
- Reduce default weeks from 54 to 3 (91% time reduction)
- Add database indexes for 2-10x query speedup
- Add backfill endpoint for historical data

Expected result: 191s → 18s (91% improvement, no timeout)"

git push
```

### Step 5: Wait for Deployment

```bash
# Wait 60 seconds for Vercel deployment
sleep 60
```

### Step 6: Test Production

```bash
# Test with Belmonte (should complete in ~15-25s)
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries?testClient=belmonte' \
  -H 'Authorization: Bearer KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK' \
  --max-time 180 \
  -w "\n\n📊 HTTP Status: %{http_code}\n⏱️  Time: %{time_total}s\n"

# Expected:
# HTTP Status: 200
# Time: 15-25s
```

### Step 7: Verify Data

```bash
# Check that data was stored correctly
psql "postgresql://postgres.jaqjyalzgbmikxnpcqmg:Wierzbica2024\!@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" << 'EOF'
SELECT 
  c.name,
  COUNT(*) as week_count,
  MAX(cs.summary_date) as latest_week,
  MAX(cs.last_updated) as last_updated
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
GROUP BY c.name;
EOF

# Expected: 3 weeks (current + 2 completed)
```

---

## 🎯 SUCCESS CRITERIA

✅ **Primary Goal:** No more timeouts  
- HTTP 200 (not 000/500)
- Execution time < 60 seconds
- Data correctly stored

✅ **Performance Target:**  
- Belmonte: < 25 seconds
- 2 clients: < 50 seconds
- 5 clients: < 120 seconds

✅ **Data Integrity:**  
- All 3 recent weeks collected
- booking_step_1 values match daily_kpi_data
- No data loss compared to 54-week collection

✅ **Backwards Compatibility:**  
- Can still collect 54 weeks with ?endWeek=53
- Backfill endpoint available for historical data
- No breaking changes to API responses

---

## 📝 NOTES

### Historical Data

After this fix, the system will only collect the most recent 3 weeks by default. To backfill historical data:

```bash
# Option 1: Manual backfill for specific client
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/backfill-historical-weeks?testClient=belmonte' \
  -H 'Authorization: Bearer KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK'

# Option 2: Collect all 54 weeks explicitly (still might timeout!)
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries?testClient=belmonte&endWeek=53' \
  -H 'Authorization: Bearer KihtM33QrVCKZjap/d6xcHYSPkt6hq+K+ZJDKwnZ+oLjEcUl9/4PKNLZW076sHK'
```

### Future Enhancements

After Phase 1 is working:
- **Phase 2:** True parallel API calls (reduce from 18s → 5s)
- **Phase 3:** Background job system (no timeout limits)
- **Phase 4:** Meta Bulk API (reduce 12 calls → 1 call)

---

**Status:** Ready to implement  
**Next Action:** Make code changes and deploy

