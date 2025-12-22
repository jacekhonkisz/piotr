# 🚨 CRITICAL BUG: Weekly Collection Returns Same Data

**Date**: November 18, 2025  
**Severity**: CRITICAL - Blocks all historical weekly collection

---

## 🔍 Problem Identified

All Belmonte weekly records have **IDENTICAL values** for EVERY week:
- spend: 25261.07 (same for all weeks!)
- reservations: 420 (same for all weeks!)
- booking_step_1: 27968 (same for all weeks!)

**Root Cause**: The collection script calls the API 53 times (once per week) but doesn't pass which specific week to collect, so EVERY call fetches the CURRENT MONTH data.

---

## 🔧 Technical Details

### **Script Flow** (`scripts/recollect-weeks-controlled.ts`):
```typescript
// For each week (53 times):
await fetch(
  `${apiUrl}/api/automated/collect-weekly-summaries?testClient=${clientName}`
  // ❌ MISSING: Week date parameters!
);
```

### **API Endpoint** (`src/app/api/automated/collect-weekly-summaries/route.ts`):
```typescript
const startWeek = parseInt(searchParams.get('startWeek') || '0'); // Defaults to 0 (current)
const endWeek = parseInt(searchParams.get('endWeek') || '53'); // Defaults to 53

await collector.collectWeeklySummaries(testClient, startWeek, endWeek);
// This collects weeks 0-53 (ALL weeks including current) on EVERY call!
```

### **Background Collector** (`src/lib/background-data-collector.ts`):
```typescript
collectWeeklySummaries(clientNameFilter, startWeek = 0, endWeek = 53) {
  // startWeek/endWeek are OFFSETS, not specific dates
  // 0 = current week, 1 = last week, 2 = 2 weeks ago, etc.
  const weeksToCollect = getLastNWeeks(endWeek - startWeek + 1, includeCurrentWeek);
  // ❌ This generates the SAME weeks every time!
}
```

---

## 💥 Impact

1. **Every API call collects ALL 53 weeks** (not just one)
2. **UPSERT logic updates the same weeks** 53 times with the same current data
3. **Result**: All historical weeks show current month metrics
4. **Data is completely wrong** for historical analysis

---

## ✅ Solution Options

### **Option 1: Call Collector Directly** (RECOMMENDED)
Bypass the API and call `BackgroundDataCollector` directly from the script with specific week dates.

**Pros**:
- Direct control over which weeks to collect
- No API timeout issues
- Can pass specific date ranges
- Faster execution

**Cons**:
- Need to import and use collector directly
- Requires TypeScript environment

### **Option 2: Fix API to Accept Specific Week Dates**
Modify API to accept `weekStart` and `weekEnd` date parameters and modify collector to support specific date ranges.

**Pros**:
- Keeps API/script separation
- Can be used by other systems

**Cons**:
- More complex changes
- Need to modify both API and collector
- Still has Vercel timeout risk

---

## 🔧 Recommended Fix (Option 1)

### **Modify** `scripts/recollect-weeks-controlled.ts`:

```typescript
import { BackgroundDataCollector } from '../src/lib/background-data-collector';

// Instead of calling API:
// await fetch(`${apiUrl}/api/automated/collect-weekly-summaries...`);

// Call collector directly with specific week:
const collector = BackgroundDataCollector.getInstance();

// Need to modify collectWeeklySummaryForClient to accept specific date
await collector.collectSpecificWeek(client.id, weekMonday);
```

### **Add New Method** to `src/lib/background-data-collector.ts`:

```typescript
async collectSpecificWeek(clientId: string, weekMonday: Date): Promise<void> {
  const client = await this.getClientById(clientId);
  
  const weekData = {
    startDate: formatDateISO(weekMonday),
    endDate: formatDateISO(getSundayOfWeek(weekMonday)),
    weekNumber: 0, // Not used for specific week
    isComplete: true,
    isCurrent: false
  };
  
  // Call existing collection logic with specific week
  await this.collectSingleWeek(client, weekData);
}
```

---

## ⚠️ Current State

**Data Status**:
- ❌ All Belmonte weekly records are WRONG (showing current month for all weeks)
- ❌ Need to DELETE all today's collection (234 records from 16 clients)
- ❌ Need to implement fix before re-collecting

**Action Required**:
1. Stop all collection processes ✅ DONE
2. Delete bad data from today
3. Implement fix (Option 1 recommended)
4. Test with single client (Belmonte)
5. If successful, collect all clients

---

## 📊 Verification After Fix

After implementing the fix, verify:
- ✅ Each week has DIFFERENT values (not identical)
- ✅ Older weeks have lower/different spend than recent weeks
- ✅ Weekly totals != Monthly totals
- ✅ Realistic data progression over time

---

**Status**: 🔴 **CRITICAL - FIX REQUIRED BEFORE PROCEEDING**  
**Next Step**: Implement Option 1 (direct collector call)



