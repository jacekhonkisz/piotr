# 🔍 API Hanging Issue Audit Report

**Date**: November 18, 2025  
**Issue**: Collection script hanging when Meta API is rate limited

---

## 🚨 Root Cause Identified

### Problem 1: Multiple API Calls Per Week
When collecting ONE week of data, the code makes **4 separate Meta API calls**:

```typescript
// src/lib/background-data-collector.ts (lines 559-605)

// Call 1: Campaign insights
const rawCampaignInsights = await metaService.getCampaignInsights(...);  // ⏱️ 30s timeout

// Call 2-4: Meta tables (placement, demographic, ad relevance)
const placementData = await metaService.getPlacementPerformance(...);     // ⏱️ 30s timeout
const demographicData = await metaService.getDemographicPerformance(...); // ⏱️ 30s timeout
const adRelevanceData = await metaService.getAdRelevanceResults(...);     // ⏱️ 30s timeout
```

### Problem 2: Rate Limit Cascade
When Meta API is rate limited:

1. **First call** (`getCampaignInsights`) hits rate limit → returns error **OR** times out after 30s
2. Code catches the error but **continues anyway**
3. **Second call** (`getPlacementPerformance`) hits rate limit → times out after 30s
4. **Third call** (`getDemographicPerformance`) hits rate limit → times out after 30s
5. **Fourth call** (`getAdRelevanceResults`) hits rate limit → times out after 30s

**Total time per week when rate limited**: 30s × 4 = **120 seconds (2 minutes)**

### Problem 3: No Early Exit on Rate Limit
The error handling catches individual API failures but doesn't stop the collection process:

```typescript
try {
  const placementData = await metaService.getPlacementPerformance(...);
  const demographicData = await metaService.getDemographicPerformance(...);
  const adRelevanceData = await metaService.getAdRelevanceResults(...);
} catch (error) {
  logger.warn(`⚠️ Failed to fetch meta tables...`);
  // ❌ CONTINUES ANYWAY - doesn't throw/exit
}
```

---

## 📊 Current Behavior

### When Collecting 2 Weeks with Rate Limit Active:

| Week | API Calls | Timeout Per Call | Total Wait Time |
|------|-----------|------------------|-----------------|
| Week 1 | 4 calls | 30s each | 120s (2 min) |
| Week 2 | 4 calls | 30s each | 120s (2 min) |
| **Total** | **8 calls** | **30s each** | **240s (4 min)** |

This explains why the script appeared to "hang" - it was waiting for each timeout to complete.

---

## 🔧 Recommended Fixes

### Fix 1: Detect Rate Limit and Exit Early (HIGH PRIORITY)

```typescript
// In background-data-collector.ts, around line 559

try {
  let rawCampaignInsights = await metaService.getCampaignInsights(...);
  
  // ✅ CHECK: If response indicates rate limit, throw immediately
  if (isRateLimited(rawCampaignInsights)) {
    throw new Error('Meta API rate limit reached. Please wait before retrying.');
  }
  
  const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);
  
  // ... rest of collection
} catch (error) {
  // ✅ CHECK: If rate limit error, stop ALL collection
  if (error.message.includes('rate limit')) {
    logger.error(`🛑 RATE LIMIT HIT for ${client.name}. Stopping collection.`);
    throw error; // Propagate to stop the entire collection process
  }
  logger.error(`❌ Failed to collect week...`, error);
}
```

### Fix 2: Reduce Timeout When Rate Limited

```typescript
// In meta-api-optimized.ts

private async makeRequest(url: string, options: RequestInit = {}): Promise<MetaAPIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

  try {
    const response = await fetch(url, ...);
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // ✅ CHECK: Detect rate limit error (Meta returns specific error codes)
      if (response.status === 429 || errorData.error?.code === 4) {
        return {
          error: {
            message: 'RATE_LIMIT_EXCEEDED',
            type: 'OAuthException',
            code: 4
          }
        };
      }
      // ... rest of error handling
    }
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
```

### Fix 3: Skip Meta Tables When Rate Limited

```typescript
// Only fetch meta tables if campaign insights succeeded AND we have API quota

let metaTables = null;
if (!weekData.isCurrent && campaignInsights.length > 0) {
  try {
    // ✅ Add timeout protection - if this fails, continue without meta tables
    metaTables = await Promise.race([
      this.fetchMetaTables(processedAdAccountId, weekData.startDate, weekData.endDate),
      this.delay(15000).then(() => null) // Max 15s for all meta tables
    ]);
  } catch (error) {
    logger.warn(`⚠️ Skipping meta tables (API quota may be exhausted)`, error);
    // Continue without meta tables - campaign data is more important
  }
}
```

---

## ✅ Immediate Action Items

1. **Delete Bad Data**: ✅ Script created (`delete-remaining-bad-data.sql`)
2. **Wait for Rate Limit Reset**: Meta API rate limits typically reset after 1 hour
3. **Implement Rate Limit Detection**: Add early exit when rate limit is detected
4. **Reduce API Calls**: Consider skipping meta tables for historical data (they're optional)
5. **Add Progress Tracking**: Log which week is being processed so user knows it's not hung

---

## 🎯 Testing Plan

1. Wait 1 hour for Meta API rate limit to reset
2. Test with **1 week only** to verify fix works
3. Check logs for rate limit detection
4. If successful, proceed with full 53-week collection

---

## 📝 Current Data Status

- **Bad Records Found**: 2 records from today (18:51:45 and 18:51:51)
- **Data Quality**: Both show duplicate current month data (25261.29 spend, 420 reservations)
- **Ready for Deletion**: Yes, script prepared

---

## 🔄 Next Steps

1. Run `delete-remaining-bad-data.sql` to clean up
2. Wait 1 hour for API rate limit reset
3. Implement rate limit detection (optional but recommended)
4. Test collection with 1-2 weeks
5. If successful, run full collection



