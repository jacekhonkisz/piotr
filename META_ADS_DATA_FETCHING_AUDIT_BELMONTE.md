# 🔍 META ADS DATA FETCHING AUDIT - BELMONTE CLIENT
**Date:** November 14, 2025  
**Focus:** Main metrics vs Funnel metrics fetching and caching mechanisms

---

## 🎯 EXECUTIVE SUMMARY

### Audit Question
> "Main metrics are properly fetched but the funnel and other metrics look generic - can you audit if caching applies to all metrics and how do you fetch that?"

### Key Findings

| Aspect | Main Metrics (Spend, Impressions, Clicks) | Funnel Metrics (booking_step_1, _2, _3, reservations) |
|--------|-------------------------------------------|-------------------------------------------------------|
| **Data Source** | Meta API top-level fields | Meta API `actions` array (requires parsing) |
| **Caching Applied** | ✅ YES (5min + 3hr cache) | ✅ YES (same cache) BUT with priority fallback |
| **Fetching Method** | Direct field extraction | Multi-tier priority system |
| **Data Quality** | Always accurate | Depends on priority source availability |
| **Generic Data Risk** | ❌ NO | ⚠️ YES (falls back to estimates) |

**⚠️ CRITICAL ISSUE IDENTIFIED:**  
Funnel metrics can appear "generic" because the system uses a **3-tier priority fallback system** where estimates are used if real data is unavailable.

---

## 📊 PART 1: HOW DATA IS FETCHED

### 1.1 Meta API Service Layer

**File:** `src/lib/meta-api-optimized.ts`  
**Method:** `getCampaignInsights()` (lines 397-425)

```typescript
async getCampaignInsights(adAccountId: string, dateStart: string, dateEnd: string, timeIncrement?: number) {
  const endpoint = `act_${adAccountId}/insights`;
  const params = `level=campaign&since=${dateStart}&until=${dateEnd}&fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,cpp,reach,frequency,conversions,actions,action_values,cost_per_action_type`;
  
  // Check 5-minute memory cache first
  const cached = this.getCachedResponse(cacheKey);
  if (cached) {
    return cached; // Returns FULL raw response including actions array
  }
  
  // Fetch from Meta API
  const url = `${this.baseUrl}/${endpoint}?${params}&access_token=${this.accessToken}`;
  const response = await this.makeRequest(url);
  
  // Cache the RAW response (includes actions array)
  this.setCachedResponse(cacheKey, insights);
  
  return insights; // Raw data with actions/action_values arrays
}
```

**What Gets Fetched:**
- ✅ **Main metrics:** `spend`, `impressions`, `clicks` (top-level fields)
- ✅ **Funnel data:** `actions` array (RAW, unparsed)
- ✅ **Conversion values:** `action_values` array (RAW, unparsed)

**Cache Duration:** 5 minutes (in-memory)

---

### 1.2 Actions Array Structure (From Meta API)

```json
{
  "campaign_id": "123456789",
  "campaign_name": "Test Campaign",
  "spend": "100.50",
  "impressions": "5000",
  "clicks": "250",
  "actions": [
    { "action_type": "offsite_conversion.fb_pixel_purchase", "value": "12" },
    { "action_type": "offsite_conversion.custom.1150356839010935", "value": "45" },
    { "action_type": "offsite_conversion.custom.3490904591193350", "value": "30" },
    { "action_type": "initiate_checkout", "value": "67" },
    { "action_type": "click_to_call", "value": "8" }
  ],
  "action_values": [
    { "action_type": "offsite_conversion.fb_pixel_purchase", "value": "4200.00" }
  ]
}
```

**⚠️ KEY POINT:** Main metrics are simple fields, but funnel metrics require **parsing the actions array** to extract booking steps.

---

## 📊 PART 2: CACHING MECHANISMS

### 2.1 Multi-Layer Cache Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER REQUEST                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 1: Memory Cache (0-1ms)                               │
│ Duration: In-memory, session-based                          │
│ Stores: Processed data with parsed funnel metrics           │
└────────────────────────┬────────────────────────────────────┘
                         │ MISS
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 2: Smart Cache Database (10-50ms)                     │
│ Table: current_month_cache                                   │
│ Duration: 3 hours                                            │
│ Stores: Processed data with parsed funnel metrics           │
└────────────────────────┬────────────────────────────────────┘
                         │ MISS or FORCE REFRESH
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ LAYER 3: Fresh Data Fetch (10-20s)                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3A: Meta API (5min cache)                            │  │
│  │ → getCampaignInsights()                              │  │
│  │ → Returns RAW data with actions array                │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3B: Parse Actions Array                              │  │
│  │ → Extract booking_step_1, _2, _3                     │  │
│  │ → Extract reservations, click_to_call                │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3C: Priority Merge System                            │  │
│  │ Priority 1: daily_kpi_data (real collected data)     │  │
│  │ Priority 2: Parsed Meta API data                     │  │
│  │ Priority 3: Estimated values (⚠️ GENERIC!)           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### 2.2 Where Caching is Applied

#### ✅ Cache Point 1: Meta API Service (5 minutes)

**File:** `src/lib/meta-api-optimized.ts:401-408`

```typescript
// Check cache first
const cached = this.getCachedResponse(cacheKey);
if (cached) {
  logger.info('Meta API: Cache hit for campaign insights');
  return cached; // ✅ Returns FULL RAW response (includes actions array)
}
```

**What's Cached:** Complete Meta API response including:
- ✅ Main metrics (spend, impressions, clicks)
- ✅ Actions array (RAW funnel data)
- ✅ Action values array (RAW conversion values)

**Cache Scope:** ALL metrics cached together

---

#### ✅ Cache Point 2: Smart Cache (3 hours)

**File:** `src/lib/smart-cache-helper.ts:928-957`

```typescript
const { data: cachedData, error: cacheError } = await supabase
  .from('current_month_cache')
  .select('*')
  .eq('client_id', clientId)
  .eq('period_id', currentMonth.periodId)
  .single();

if (!cacheError && cachedData && isCacheFresh(cachedData.last_updated)) {
  // ✅ Returns PROCESSED data with parsed metrics
  return {
    success: true,
    data: cachedData.cache_data, // Includes BOTH main and funnel metrics
    source: 'database-cache'
  };
}
```

**What's Cached:** Processed data including:
- ✅ Main metrics (already processed)
- ✅ Funnel metrics (already parsed from actions array)
- ✅ All conversion metrics

**Cache Scope:** ALL metrics cached together

---

## 🔍 PART 3: THE FUNNEL METRICS PROBLEM

### 3.1 Why Funnel Metrics Can Appear "Generic"

**File:** `src/lib/smart-cache-helper.ts:252-318`

The system uses a **3-tier priority fallback** for funnel metrics:

```typescript
// STEP 1: Extract from Meta API campaigns
const metaConversionMetrics = campaignInsights.reduce((acc, campaign) => {
  return {
    click_to_call: acc.click_to_call + (campaign.click_to_call || 0), // ⚠️ Requires campaign to have this property
    email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
    booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0), // ⚠️ Must be pre-parsed
    booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
    booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
    reservations: acc.reservations + (campaign.reservations || 0),
    reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
  };
}, { /* initial zeros */ });

// STEP 2: 3-tier priority merge
const conversionMetrics = {
  booking_step_1: realConversionMetrics.booking_step_1 > 0 
    ? realConversionMetrics.booking_step_1           // Priority 1: daily_kpi_data
    : metaConversionMetrics.booking_step_1 > 0 
      ? metaConversionMetrics.booking_step_1         // Priority 2: Parsed Meta API
      : Math.round(metaTotalConversions * 0.75),     // Priority 3: ESTIMATE ⚠️
  
  booking_step_2: realConversionMetrics.booking_step_2 > 0 
    ? realConversionMetrics.booking_step_2 
    : metaConversionMetrics.booking_step_2 > 0 
      ? metaConversionMetrics.booking_step_2 
      : Math.round(metaTotalConversions * 0.375),    // 50% of step 1 ESTIMATE ⚠️
  
  booking_step_3: realConversionMetrics.booking_step_3 > 0 
    ? realConversionMetrics.booking_step_3 
    : metaConversionMetrics.booking_step_3 > 0 
      ? metaConversionMetrics.booking_step_3 
      : Math.round(metaTotalConversions * 0.30),     // 80% of step 2 ESTIMATE ⚠️
};
```

---

### 🚨 3.2 ROOT CAUSE: Wrong API Method + Missing Action Parsing

**THE CRITICAL DOUBLE FAILURE:**

1. ❌ **WRONG API METHOD:** Smart cache calls `getPlacementPerformance()` instead of `getCampaignInsights()`
2. ❌ **NO ACTIONS ARRAY:** Placement performance data doesn't include `actions` array (it's aggregated by platform/position, not campaigns)
3. ❌ **NO PARSING:** Even if actions existed, there's no parser to extract booking steps
4. ⚠️ The code expects `campaign.booking_step_1` to already exist, but it doesn't!
5. 🔴 Result: `metaConversionMetrics` is all zeros → falls back to **GENERIC ESTIMATES**

**Evidence from code:**

```typescript
// ❌ WRONG: src/lib/smart-cache-helper.ts:121-125
// Fetches PLACEMENT performance (no actions array, no conversion data)
campaignInsights = await metaService.getPlacementPerformance(
  adAccountId,
  currentMonth.startDate!,
  currentMonth.endDate!
);
// Returns: [{ impressions, clicks, spend, publisher_platform, platform_position }]
// ❌ Missing: actions array, action_values array, campaign-level data

// Line 252: Trying to extract from placement data
const metaConversionMetrics = campaignInsights.reduce((acc, campaign) => {
  return {
    booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),  
    // ⚠️ campaign.booking_step_1 is UNDEFINED because:
    //    1. Placement data doesn't have it
    //    2. Actions array wasn't fetched
    //    3. No parser exists anyway
    // ⚠️ Always evaluates to 0
  };
}, {});

// Line 286-290: Falls back to estimates
booking_step_1: realConversionMetrics.booking_step_1 > 0 
  ? realConversionMetrics.booking_step_1 
  : metaConversionMetrics.booking_step_1 > 0  // ← Always 0 (wrong API + no parsing)
    ? metaConversionMetrics.booking_step_1 
    : Math.round(metaTotalConversions * 0.75),  // 🔴 ALWAYS ENDS UP HERE: GENERIC ESTIMATE!
```

**What SHOULD happen:**

```typescript
// ✅ CORRECT: Use getCampaignInsights() which returns actions array
campaignInsights = await metaService.getCampaignInsights(
  adAccountId,
  currentMonth.startDate!,
  currentMonth.endDate!
);
// Returns: [{ campaign_id, campaign_name, spend, impressions, clicks, actions[], action_values[] }]

// ✅ THEN parse the actions array
const parsedCampaigns = campaignInsights.map(campaign => ({
  ...campaign,
  ...parseMetaActions(campaign.actions, campaign.action_values)
}));

// ✅ NOW metaConversionMetrics will have real data
const metaConversionMetrics = parsedCampaigns.reduce((acc, campaign) => ({
  booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0), // ✅ Has real value
  // ...
}), {});
```

---

## 🔧 PART 4: WHERE IS ACTION PARSING SUPPOSED TO HAPPEN?

### 4.1 The Missing Link

Looking at audit scripts (e.g., `scripts/audit-belmonte-conversions.js:89-125`), the parsing logic exists but is **NOT integrated into the main data flow**:

```typescript
// This parsing logic exists in audit scripts but NOT in production code path
if (insight.actions && Array.isArray(insight.actions)) {
  insight.actions.forEach((action) => {
    const actionType = action.action_type;
    const value = parseInt(action.value || '0');
    
    if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
      booking_step_1 += value;
    }
    if (actionType.includes('booking_step_2') || actionType.includes('add_to_cart')) {
      booking_step_2 += value;
    }
    if (actionType.includes('booking_step_3') || actionType.includes('purchase')) {
      booking_step_3 += value;
    }
    if (actionType === 'purchase' || actionType.includes('purchase')) {
      reservations += value;
    }
  });
}
```

**⚠️ This parsing needs to be integrated AFTER `getCampaignInsights()` and BEFORE using `metaConversionMetrics`**

---

## 📋 PART 5: COMPARISON TABLE

### Main Metrics vs Funnel Metrics

| Aspect | Main Metrics | Funnel Metrics |
|--------|-------------|----------------|
| **API Fields** | `spend`, `impressions`, `clicks` (top-level) | `actions` array (nested, requires parsing) |
| **Extraction** | Direct field access | Requires iterating through actions array |
| **5min Cache** | ✅ Cached | ✅ Cached (but as RAW actions array) |
| **3hr Cache** | ✅ Cached (processed) | ✅ Cached (processed IF parsing happened) |
| **Parsing Required** | ❌ NO | ✅ YES |
| **Parsing Location** | N/A | ❌ MISSING in smart-cache-helper.ts |
| **Fallback Behavior** | N/A | Falls back to estimates if parsing fails |
| **Risk of Generic Data** | ❌ None | ✅ HIGH (if parsing not done) |

---

## 🎯 PART 6: AUDIT CONCLUSIONS

### 6.1 Main Question Answers

**Q1: "Are main metrics properly fetched?"**  
✅ **YES** - Main metrics (spend, impressions, clicks) are top-level fields, directly extracted, properly cached.

**Q2: "Are funnel metrics generic?"**  
⚠️ **PARTIALLY YES** - Funnel metrics CAN be generic because:
1. The `actions` array from Meta API is fetched and cached properly
2. BUT the parsing of `actions` into funnel metrics is MISSING in the smart cache flow
3. System falls back to **estimated percentages** instead of real data

**Q3: "Does caching apply to all metrics?"**  
✅ **YES** - Caching applies uniformly to ALL metrics:
- 5-minute Meta API cache: Caches RAW response (main metrics + actions array)
- 3-hour smart cache: Caches PROCESSED response (main metrics + parsed funnel metrics)
- **BUT** if parsing fails, estimates are cached instead of real data

**Q4: "How do you fetch that?"**  
- Main metrics: Direct field extraction → Always accurate
- Funnel metrics: 3-tier priority system:
  1. `daily_kpi_data` table (if available)
  2. Parsed Meta API `actions` array (if parsing works)
  3. Estimated percentages (if above fail) ← **THIS IS THE PROBLEM**

---

### 6.2 Critical Issues for Belmonte

1. **❌ Missing Action Parser Integration**
   - Location: `src/lib/smart-cache-helper.ts:252-270`
   - Issue: Code tries to access `campaign.booking_step_1` but it doesn't exist
   - Impact: Falls back to estimates instead of using real Meta API data

2. **⚠️ Reliance on daily_kpi_data**
   - If `daily_kpi_data` table has no records for current period, falls back to estimates
   - Need to verify: Does Belmonte have recent `daily_kpi_data` entries?

3. **📊 Generic Estimates Used**
   - booking_step_1: 75% of total conversions
   - booking_step_2: 37.5% (50% of step 1)
   - booking_step_3: 30% (80% of step 2)
   - These are FIXED percentages, not real client behavior

---

## 🔧 PART 7: RECOMMENDED FIXES

### Fix #1: Integrate Action Parsing (HIGH PRIORITY)

**File to modify:** `src/lib/smart-cache-helper.ts`  
**Location:** After line 180 (after `campaignInsights` are fetched)

```typescript
// ✅ ADD THIS: Parse actions array BEFORE using campaigns
import { parseMetaActions } from './meta-actions-parser'; // Create this utility

// After fetching campaignInsights from metaService.getCampaignInsights()
const parsedCampaigns = campaignInsights.map(campaign => {
  const parsed = parseMetaActions(campaign.actions || [], campaign.action_values || []);
  return {
    ...campaign,
    ...parsed // Adds booking_step_1, booking_step_2, booking_step_3, reservations, etc.
  };
});

// Then use parsedCampaigns instead of campaignInsights in metaConversionMetrics
```

### Fix #2: Create Meta Actions Parser Utility

**New file:** `src/lib/meta-actions-parser.ts`

```typescript
/**
 * Parses Meta API actions array into structured conversion metrics
 */
export function parseMetaActions(actions: any[], actionValues: any[] = []) {
  let click_to_call = 0;
  let email_contacts = 0;
  let booking_step_1 = 0;
  let booking_step_2 = 0;
  let booking_step_3 = 0;
  let reservations = 0;
  let reservation_value = 0;

  // Parse actions array
  actions.forEach((action) => {
    const actionType = String(action.action_type || '').toLowerCase();
    const value = parseInt(action.value || '0', 10);
    
    if (actionType.includes('click_to_call')) {
      click_to_call += value;
    }
    if (actionType.includes('contact') || actionType.includes('email')) {
      email_contacts += value;
    }
    if (actionType.includes('booking_step_1') || actionType.includes('initiate_checkout')) {
      booking_step_1 += value;
    }
    if (actionType.includes('booking_step_2') || 
        actionType.includes('view_content') ||
        actionType.includes('offsite_conversion.custom.1150356839010935')) {
      booking_step_2 += value;
    }
    if (actionType.includes('booking_step_3') || 
        actionType.includes('add_to_cart') ||
        actionType.includes('offsite_conversion.custom.3490904591193350')) {
      booking_step_3 += value;
    }
    if (actionType === 'purchase' || 
        actionType.includes('fb_pixel_purchase') ||
        actionType.includes('omni_purchase')) {
      reservations += value;
    }
  });

  // Parse action_values array
  actionValues.forEach((actionValue) => {
    const actionType = String(actionValue.action_type || '').toLowerCase();
    if (actionType === 'purchase' || actionType.includes('fb_pixel_purchase')) {
      reservation_value += parseFloat(actionValue.value || '0');
    }
  });

  return {
    click_to_call,
    email_contacts,
    booking_step_1,
    booking_step_2,
    booking_step_3,
    reservations,
    reservation_value
  };
}
```

### Fix #3: Verify daily_kpi_data Collection

**Check for Belmonte:**

```sql
SELECT 
  date,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  data_source
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%')
  AND date >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY date DESC;
```

**Expected:** Daily records with non-zero funnel metrics  
**If missing:** The background data collector may not be running properly

---

## ✅ VERIFICATION CHECKLIST

After fixes:

- [ ] Action parsing integrated into smart-cache-helper.ts
- [ ] Meta actions parser utility created and tested
- [ ] Belmonte daily_kpi_data table has current month data
- [ ] Test current month fetch shows REAL funnel data (not estimates)
- [ ] Verify cache stores parsed data correctly
- [ ] Compare cached vs fresh data (should be identical)
- [ ] Check UI displays real funnel metrics (not generic percentages)

---

## 📊 FINAL SUMMARY

### The Answer to Your Question

**"The main metrics are properly fetched but the funnel and other metrics look generic"**

✅ **Correct observation!** Here's why:

1. **Main metrics:** Fetched directly from top-level API fields → Always accurate
2. **Funnel metrics:** Should be parsed from `actions` array → Parser is MISSING
3. **Result:** System falls back to generic percentage-based estimates
4. **Caching:** Works uniformly for ALL metrics, BUT caches whatever data is available (including estimates)

**The fix:** Integrate action parsing BEFORE the priority fallback system runs. This ensures real Meta API data is used instead of estimates.

---

---

## 🎯 SPECIFIC BELMONTE ISSUE DIAGNOSIS

### Current Behavior for Belmonte Client

Based on the code audit, here's what happens when Belmonte data is fetched:

1. **Request:** User loads Belmonte dashboard/reports
2. **Smart Cache Check:** System checks `current_month_cache` table
3. **Cache Miss:** Fetches fresh data via `fetchFreshCurrentMonthData()`
4. **❌ WRONG API CALL:**
   ```typescript
   // Calls getPlacementPerformance() instead of getCampaignInsights()
   const data = await metaService.getPlacementPerformance(...);
   // Returns aggregated placement data WITHOUT actions array
   ```
5. **❌ NO FUNNEL DATA:** Placement data doesn't contain conversion actions
6. **❌ FALLS BACK TO ESTIMATES:**
   ```typescript
   booking_step_1: Math.round(totalConversions * 0.75)  // Generic 75%
   booking_step_2: Math.round(totalConversions * 0.375) // Generic 37.5%
   booking_step_3: Math.round(totalConversions * 0.30)  // Generic 30%
   ```
7. **Result:** Dashboard shows **generic funnel** instead of Belmonte's real data

### Why Main Metrics Look Correct

Main metrics (spend, impressions, clicks) are top-level fields in BOTH:
- ✅ `getCampaignInsights()` response → Correct
- ✅ `getPlacementPerformance()` response → Also correct (aggregated)

So they work regardless of which API is called.

### Why Funnel Metrics Look Generic

Funnel metrics require:
- ❌ `actions` array from Meta API → Only in `getCampaignInsights()`, NOT in placement data
- ❌ Action parsing logic → Missing entirely
- ❌ Proper campaign-level data → Using aggregated placement data instead

Result: **Always uses hardcoded percentage estimates**

---

## 📊 QUICK VERIFICATION FOR BELMONTE

Run these queries to confirm:

### Check 1: Current Month Cache

```sql
SELECT 
  period_id,
  last_updated,
  cache_data->'conversionMetrics'->>'booking_step_1' as step_1,
  cache_data->'conversionMetrics'->>'booking_step_2' as step_2,
  cache_data->'conversionMetrics'->>'booking_step_3' as step_3,
  cache_data->'conversionMetrics'->>'reservations' as reservations
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%')
ORDER BY last_updated DESC
LIMIT 1;
```

**Expected:** If values are suspiciously round numbers or exact percentages → Using estimates

### Check 2: Daily KPI Data

```sql
SELECT 
  date,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  data_source
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%')
  AND date >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY date DESC;
```

**Expected:** 
- If NO rows → System has no real data, using estimates
- If rows with zeros → Collection job not working properly
- If rows with real numbers → Data exists but not being used by smart cache

---

## ✅ ACTION PLAN

### Immediate Fix (1-2 hours)

1. **Fix API Method** in `src/lib/smart-cache-helper.ts:121`
   ```typescript
   // CHANGE FROM:
   campaignInsights = await metaService.getPlacementPerformance(...)
   
   // CHANGE TO:
   campaignInsights = await metaService.getCampaignInsights(
     adAccountId,
     currentMonth.startDate!,
     currentMonth.endDate!,
     0 // timeIncrement: 0 for monthly data
   );
   ```

2. **Add Action Parser** - Create `src/lib/meta-actions-parser.ts` (see Fix #2 above)

3. **Integrate Parser** in `src/lib/smart-cache-helper.ts` after line 180:
   ```typescript
   import { parseMetaActions } from './meta-actions-parser';
   
   // Parse actions BEFORE using campaigns
   const parsedCampaigns = campaignInsights.map(campaign => ({
     ...campaign,
     ...parseMetaActions(campaign.actions || [], campaign.action_values || [])
   }));
   
   // Use parsedCampaigns instead of campaignInsights in line 252
   ```

4. **Clear Cache** for Belmonte to force refresh with real data

### Verification (30 minutes)

1. Clear `current_month_cache` for Belmonte
2. Trigger fresh fetch (refresh dashboard)
3. Check logs for "Fetched campaign insights" (not placement performance)
4. Verify funnel metrics are NOT round percentages
5. Compare with Meta Ads Manager to confirm accuracy

---

## 🔍 ROOT CAUSE SUMMARY

**User's observation:** "Main metrics properly fetched but funnel metrics look generic"

**Root cause:** 
1. ❌ Smart cache uses WRONG Meta API method (`getPlacementPerformance` instead of `getCampaignInsights`)
2. ❌ Placement data doesn't include `actions` array needed for funnel metrics
3. ❌ No action parsing logic integrated in data flow
4. ❌ System falls back to hardcoded percentage estimates (75%, 37.5%, 30%)

**Why main metrics work:** They exist in both API responses as top-level fields

**Why funnel metrics fail:** They require campaign-level `actions` array parsing (only available in `getCampaignInsights`)

**Caching status:** Caching works correctly for ALL metrics, but it caches WHATEVER data is available (including generic estimates if real parsing fails)

---

**Audit completed:** November 14, 2025  
**Reviewed by:** AI Code Auditor  
**Status:** 🔴 CRITICAL FIX REQUIRED - Wrong API method + missing action parser  
**Estimated fix time:** 1-2 hours  
**Impact:** HIGH - Affects all clients using smart cache for current month data

