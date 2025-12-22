# 📊 Historical Data Fetching Systems - Complete Audit

## 🎯 Systems That Fetch Historical Weekly Data from Database

### 1. **StandardizedDataFetcher** (Primary System)
**File:** `src/lib/standardized-data-fetcher.ts`
**Method:** `fetchFromCachedSummaries()`
**Query Method:** Exact Monday match using `week-helpers.getMondayOfWeek()`
**Status:** ✅ **UPDATED** - Uses exact Monday match

```typescript
// Line 1033-1067
const weekMonday = getMondayOfWeek(requestedStartDate);
const weekMondayStr = formatDateISO(weekMonday);
.eq('summary_date', weekMondayStr) // Exact match
```

**Used By:**
- Server-side direct calls
- Reports page (when server-side rendered)

---

### 2. **fetch-live-data API Route** (Client-Side Proxy)
**File:** `src/app/api/fetch-live-data/route.ts`
**Method:** `loadFromDatabase()`
**Query Method:** Exact Monday match using `week-helpers.getMondayOfWeek()`
**Status:** ✅ **UPDATED** - Uses exact Monday match

```typescript
// Line 222-256
const weekMonday = getMondayOfWeek(requestedStartDate);
const weekMondayStr = formatDateISO(weekMonday);
.eq('summary_date', weekMondayStr) // Exact match
```

**Used By:**
- Client-side requests (redirected from StandardizedDataFetcher)
- Reports page (when client-side)

**Import Path:** `../../../lib/week-helpers` (from `src/app/api/fetch-live-data/route.ts`)

---

### 3. **Google Ads Standardized Data Fetcher**
**File:** `src/lib/google-ads-standardized-data-fetcher.ts`
**Method:** `fetchFromDatabaseSummaries()`
**Query Method:** Uses date range (`.gte()` / `.lte()`)
**Status:** ⚠️ **NEEDS UPDATE** - Should use exact Monday match for consistency

---

## 🔍 Data Storage System

### **BackgroundDataCollector** (Data Storage)
**File:** `src/lib/background-data-collector.ts`
**Method:** `storeWeeklySummary()`
**Storage Method:** Uses `week-helpers.getMondayOfWeek()` to calculate Monday
**Status:** ✅ **CORRECT** - Stores with Monday as `summary_date`

```typescript
// Line 1180-1197
const weekMonday = getMondayOfWeek(new Date(data.summary_date));
const weekMondayStr = formatDateISO(weekMonday);
summary_date: weekMondayStr // Always Monday
```

---

## ✅ Consistency Status

| System | Monday Calculation | Query Method | Status |
|--------|-------------------|--------------|--------|
| BackgroundDataCollector (Storage) | `week-helpers.getMondayOfWeek()` | N/A (writes) | ✅ Correct |
| StandardizedDataFetcher | `week-helpers.getMondayOfWeek()` | `.eq()` exact match | ✅ Updated |
| fetch-live-data API | `week-helpers.getMondayOfWeek()` | `.eq()` exact match | ✅ Updated |
| Google Ads Fetcher | ❓ Unknown | `.gte()` / `.lte()` | ⚠️ Needs Update |

---

## 🎯 All Systems Now Use Same Monday Calculation

**Single Source of Truth:** `src/lib/week-helpers.ts`
- `getMondayOfWeek()` - Calculates Monday from any date
- `formatDateISO()` - Formats date as YYYY-MM-DD
- `validateIsMonday()` - Validates date is Monday

**All systems import from:** `./week-helpers` or `../../../lib/week-helpers` (depending on location)



