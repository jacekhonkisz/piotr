# 🔴 CRITICAL BUG: Wrong API Method Used for Campaign Data

## ❌ The Problem

### **Line 545 in background-data-collector.ts**:
```typescript
// ❌ WRONG: Using placement performance method for campaign insights!
const campaignInsights = await metaService.getPlacementPerformance(
  processedAdAccountId,
  weekData.startDate,
  weekData.endDate
);
```

### **What getPlacementPerformance() Actually Returns**:
```typescript
// src/lib/meta-api-optimized.ts:461-476
async getPlacementPerformance(...): Promise<any[]> {
  const url = `...&breakdowns=publisher_platform,platform_position...`;
  // Returns: Placement breakdown data (Feed, Stories, Reels, etc.)
  // NOT campaign-level data!
}
```

### **What getCampaignInsights() Returns (The Correct Method)**:
```typescript
// src/lib/meta-api-optimized.ts:397-424
async getCampaignInsights(...): Promise<any[]> {
  const params = `level=campaign&...&fields=campaign_id,campaign_name,spend,impressions,clicks...`;
  // Returns: Campaign-level data with campaign IDs and names
  // This is what we actually need!
}
```

---

## 🔍 Why This Causes Issues

1. **❌ Wrong Data Structure**: Placement data doesn't have `campaign_id` or `campaign_name`
2. **❌ Duplicate Calls**: Both calls use `getPlacementPerformance()` but for different purposes
3. **❌ Incorrect Aggregation**: Campaign totals are calculated from placement data (wrong level)
4. **❌ Performance Impact**: 53 duplicate calls per client that return the same placement data twice

---

## ✅ The Fix

### **Change Line 545 to use the CORRECT method**:

```typescript
// ✅ CORRECT: Use getCampaignInsights() for campaign data
const campaignInsights = await metaService.getCampaignInsights(
  processedAdAccountId,
  weekData.startDate,
  weekData.endDate,
  0  // timeIncrement = 0 for period totals
);
```

### **Keep Line 583 as is (it's correct)**:

```typescript
// ✅ CORRECT: This is the right method for placement breakdown
const placementData = await metaService.getPlacementPerformance(
  processedAdAccountId,
  weekData.startDate,
  weekData.endDate
);
```

---

## 📊 Impact of Fix

### **Correctness**:
- ✅ Campaign data will have proper `campaign_id` and `campaign_name`
- ✅ Placement data will be separate (for meta tables display)
- ✅ No more mixing of aggregation levels

### **Performance**:
- ✅ Eliminates 53 duplicate calls (one per historical week)
- ✅ **Saves ~26 seconds per client**
- ✅ 2 clients: 150s → 124s
- ✅ 5 clients: 380s → 315s (might still timeout, but closer!)

### **Data Quality**:
- ✅ Proper campaign-level metrics
- ✅ Correct booking step aggregation
- ✅ Better alignment with smart cache logic

---

## 🎯 Implementation

Need to:
1. Change `getPlacementPerformance` → `getCampaignInsights` on line 545
2. Add `timeIncrement: 0` parameter for period totals
3. Test to ensure campaign data structure matches expectations
4. Verify UI still displays correctly

---

## 🚨 Severity: CRITICAL

This is a **fundamental misuse** of the Meta API:
- Using placement-level data where campaign-level data is expected
- Causing duplicate API calls
- Potentially returning incorrect campaign structures
- Contributing to timeout issues

**This should be fixed IMMEDIATELY!** 🔥

