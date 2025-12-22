# Data Source Audit - Simplification Plan

## Current Problem

Multiple inconsistent data source names are being used across the system, causing confusion:

### Current Sources Found

**From Smart Cache System:**
1. `cache` - Fresh cache hit (from current_month_cache)
2. `stale-cache` - Cache expired, refreshing
3. `google-ads-cache` - Google Ads smart cache
4. `google-ads-smart-cache` - Same as above (duplicate!)
5. `meta-smart-cache` - Meta smart cache (from cache-first)

**From Daily Metrics System:**
6. `daily-cache-fresh` - Memory cache hit
7. `daily-database` - From daily_kpi_data table
8. `daily-unified-fallback` - Extracted from unified API
9. `daily-metrics-fallback` - Reason passed to unified fetcher

**From Standardized Fetcher:**
10. `daily-kpi-data` - Direct from daily_kpi_data
11. `live-api-with-cache-storage` - Live API with caching
12. `database` - Historical database summaries

**From Dashboard/Components:**
13. `dashboard-shared` - Component using dashboard shared data
14. `placeholder` - Empty placeholder data
15. `unknown` - Fallback when source unclear

**Total:** 15+ different source names! 🚨

---

## Issues

1. **Confusing Names**: "daily-unified-fallback" vs "daily-database" vs "daily-kpi-data" - all from database
2. **Duplicates**: "google-ads-cache" vs "google-ads-smart-cache"
3. **Inconsistent**: "cache" for Meta vs "google-ads-cache" for Google
4. **Too Granular**: User doesn't need to know "memory cache" vs "database cache"
5. **Misleading**: "fresh cache" is just a log message, not actual source

---

## Simplified Source System

### 🎯 Proposed: 3 Main Sources Only

```
1. "cache"          → Data from any cache (smart cache, memory cache, database cache)
2. "database"       → Historical data from campaign_summaries/daily_kpi_data
3. "live-api"       → Fresh data from Meta/Google Ads API
```

### Optional: Add Platform Prefix When Needed

```
"meta-cache"        → Meta Ads cached data
"google-cache"      → Google Ads cached data
"meta-live"         → Live Meta Ads API
"google-live"       → Live Google Ads API
```

---

## Mapping Old → New

| Old Source | New Source | Rationale |
|------------|------------|-----------|
| `cache` | `cache` | ✅ Already good |
| `stale-cache` | `cache` | Still cache, just refreshing |
| `google-ads-cache` | `cache` or `google-cache` | Simplify |
| `google-ads-smart-cache` | `cache` or `google-cache` | Simplify |
| `meta-smart-cache` | `cache` or `meta-cache` | Simplify |
| `daily-cache-fresh` | `cache` | It's still cache |
| `daily-database` | `database` | ✅ Correct name |
| `daily-unified-fallback` | `database` | It's from database via API |
| `daily-kpi-data` | `database` | ✅ Correct name |
| `live-api-with-cache-storage` | `live-api` | Source is live API |
| `database` | `database` | ✅ Already good |
| `dashboard-shared` | `cache` | Shared data is cached data |
| `placeholder` | `empty` | More clear |
| `unknown` | `cache` | Default to cache |

---

## Implementation Plan

### Phase 1: Standardize Dashboard Sources ✅ PRIORITY

**File:** `src/app/dashboard/page.tsx`

```typescript
// When using cache-first
result = {
  debug: {
    source: activeAdsProvider === 'google' ? 'google-cache' : 'meta-cache',  // ← SIMPLIFIED
    // ...
  }
};

// When using database
result = {
  debug: {
    source: 'database',  // ← SIMPLIFIED
    // ...
  }
};

// When using live API
result = {
  debug: {
    source: activeAdsProvider === 'google' ? 'google-live' : 'meta-live',  // ← SIMPLIFIED
    // ...
  }
};
```

### Phase 2: Standardize Daily Metrics

**File:** `src/lib/daily-metrics-cache.ts`

```typescript
// Line 79: Memory cache
source: 'cache',  // Instead of 'daily-cache-fresh'

// Line 100: Database
source: 'database',  // Instead of 'daily-database'  

// Line 123: Unified fallback
source: 'database',  // Instead of 'daily-unified-fallback' (it's from DB via API)
```

### Phase 3: Standardize Fetchers

**File:** `src/lib/standardized-data-fetcher.ts`

```typescript
// Line 311: Daily KPI data
source: 'database',  // Instead of 'daily-kpi-data'

// Line 340: Live API
source: 'live-api',  // Instead of 'live-api-with-cache-storage'
```

**File:** `src/lib/smart-cache-helper.ts`

```typescript
// Monthly cache
source: 'cache',  // Consistent across all cache types
```

**File:** `src/lib/google-ads-smart-cache-helper.ts`

```typescript
// Google cache
source: 'cache',  // Or 'google-cache' if platform distinction needed
```

---

## Benefits

### Before (15+ sources):
```
User sees: "daily-unified-fallback"
User thinks: "What does this mean? Is it good or bad?"
```

### After (3 sources):
```
User sees: "cache"
User thinks: "Fast cached data ✅"

User sees: "database"  
User thinks: "Historical data from database ✅"

User sees: "live-api"
User thinks: "Fresh data from API (might be slower) ✅"
```

### With Platform Prefix (Optional):
```
User sees: "google-cache"
User thinks: "Fast cached Google Ads data ✅"

User sees: "meta-live"
User thinks: "Fresh Meta Ads API data ✅"
```

---

## User-Facing Display

### Data Source Indicator

**Current:**
```
Source: daily-unified-fallback  ← Confusing!
```

**Proposed:**
```
Source: Cache (Google Ads)  ← Clear!
```

or

```
Source: Database (Historical)  ← Clear!
```

or

```
Source: Live API (Meta Ads)  ← Clear!
```

---

## Implementation Priority

### 🔴 High Priority (Do First)
1. ✅ Dashboard cache-first sources (lines 826, 848, 893, 918)
2. ✅ Daily metrics cache sources (daily-metrics-cache.ts)
3. ✅ Component shared data source (GoogleAdsPerformanceLive.tsx line 371)

### 🟡 Medium Priority
4. Standardized fetcher sources (standardized-data-fetcher.ts)
5. Smart cache helper sources (smart-cache-helper.ts)

### 🟢 Low Priority
6. Update DataSourceIndicator to show friendly names
7. Update logging to use new source names consistently

---

## Example: Simplified Flow

### Tab Switch to Google Ads (Cache-First)

**Before:**
```
Source: google-ads-smart-cache
Daily Metrics: daily-unified-fallback
```

**After:**
```
Source: google-cache
Daily Metrics: cache
```

### Historical Data

**Before:**
```
Source: daily-kpi-data
Daily Metrics: daily-database
```

**After:**
```
Source: database
Daily Metrics: database
```

### Fresh API Call

**Before:**
```
Source: live-api-with-cache-storage
Daily Metrics: daily-unified-fallback
```

**After:**
```
Source: live-api
Daily Metrics: cache
```

---

## Recommendation

**Use 3-source system with platform prefix:**

1. **`meta-cache`** / **`google-cache`** - Cached data (fast, 3-hour refresh)
2. **`database`** - Historical data from database
3. **`meta-live`** / **`google-live`** - Fresh API call

This provides:
- ✅ Clear meaning for users
- ✅ Platform visibility when needed
- ✅ Source type clarity (cache/database/live)
- ✅ Minimal number of sources (6 total, 3 per platform)

---

## Next Steps

1. Update dashboard cache-first logic to use new sources
2. Update daily metrics cache to use new sources
3. Update component shared data source
4. Test to ensure display shows new simplified sources
5. Update documentation

**Goal:** User sees clear, consistent source names that are easy to understand!








