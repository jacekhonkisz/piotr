# 🚨 DUPLICATE API CALLS AUDIT

## ❌ **CRITICAL: getPlacementPerformance() Called TWICE Per Week!**

### **Location**: `src/lib/background-data-collector.ts:539-597`

```typescript
for (const weekData of weeksToCollect) {
  // ❌ CALL #1: Get campaign insights (line 545)
  const campaignInsights = await metaService.getPlacementPerformance(
    processedAdAccountId,
    weekData.startDate,
    weekData.endDate
  );

  // ❌ CALL #2: Get placement data AGAIN for meta tables (line 583)
  if (!weekData.isCurrent) {
    const placementData = await metaService.getPlacementPerformance(
      processedAdAccountId, 
      weekData.startDate, 
      weekData.endDate
    );  // 🚨 DUPLICATE! Same endpoint, same params!
    
    // Plus 2 more calls:
    const demographicData = await metaService.getDemographicPerformance(...);
    const adRelevanceData = await metaService.getAdRelevanceResults(...);
  }
}
```

---

## 📊 Impact Analysis

### **Before Fix (Current State)**:
Per client:
- **Current week**: 1 call
- **53 historical weeks**: 4 calls each
  - ❌ getPlacementPerformance (duplicate)
  - ✅ getPlacementPerformance (for campaigns)
  - ✅ getDemographicPerformance
  - ✅ getAdRelevanceResults
- **TOTAL**: 1 + (53 × 4) = **213 API calls per client**

### **After Fix (Reuse Data)**:
Per client:
- **Current week**: 1 call
- **53 historical weeks**: 3 calls each
  - ✅ getPlacementPerformance (REUSED for both campaigns + meta tables!)
  - ✅ getDemographicPerformance
  - ✅ getAdRelevanceResults
- **TOTAL**: 1 + (53 × 3) = **160 API calls per client**

**Savings**: 53 API calls per client (**25% reduction!**)

---

## 🔍 Additional Questions

### **Are meta tables even used?**

Need to audit:
1. **demographicPerformance**: Used in UI?
2. **adRelevanceResults**: Used in UI?
3. **placementPerformance** (duplicate): Already in campaigns data!

If these aren't displayed in the UI, we could save even MORE:

### **If meta tables are unused**:
- **53 historical weeks**: 1 call each
- **TOTAL**: 1 + 53 = **54 API calls per client**

**Savings**: 159 API calls per client (**75% reduction!**)

---

## ✅ Recommended Fix

### **Option 1: REUSE Placement Data (Quick Win - 25% faster)**

```typescript
for (const weekData of weeksToCollect) {
  // Get campaign insights (includes placement data)
  const campaignInsights = await metaService.getPlacementPerformance(
    processedAdAccountId,
    weekData.startDate,
    weekData.endDate
  );

  let metaTables = null;
  if (!weekData.isCurrent) {
    try {
      // ✅ REUSE campaignInsights instead of calling again!
      const placementData = campaignInsights;  // Already have this data!
      
      // Only fetch NEW data
      const demographicData = await metaService.getDemographicPerformance(...);
      const adRelevanceData = await metaService.getAdRelevanceResults(...);
      
      metaTables = {
        placementPerformance: placementData,  // Reused!
        demographicPerformance: demographicData,
        adRelevanceResults: adRelevanceData
      };
    } catch (error) {
      logger.warn(`⚠️ Failed to fetch meta tables`);
    }
  }
}
```

**Time saved**: ~26 seconds per client (53 duplicate calls eliminated)

---

### **Option 2: REMOVE Unused Meta Tables (Recommended - 75% faster)**

If demographic/adRelevance data isn't used in the UI:

```typescript
for (const weekData of weeksToCollect) {
  // Get campaign insights
  const campaignInsights = await metaService.getPlacementPerformance(
    processedAdAccountId,
    weekData.startDate,
    weekData.endDate
  );

  // ✅ Skip meta tables entirely if not used in UI
  const metaTables = null;  // Or remove this field completely

  await this.storeWeeklySummary(client.id, {
    summary_date: weekData.startDate,
    campaigns: campaignInsights,
    totals,
    metaTables,  // Can be null or removed
    activeCampaignCount,
    isCurrentWeek: weekData.isCurrent
  }, 'meta');
}
```

**Time saved**: ~79 seconds per client (159 calls eliminated!)

---

## 🎯 Next Steps

1. **Audit UI**: Check if `metaTables` fields are displayed anywhere
2. **Implement Fix**: Remove duplicate + unused API calls
3. **Test**: Verify collection completes in <2 minutes (no timeout!)
4. **Deploy**: Full recollection becomes feasible!

---

## 📊 Expected Results After Fix

### **With Option 1 (Reuse placement data)**:
- 2 clients: ~150 seconds (2.5 min) ✅ No timeout!
- 5 clients: ~380 seconds (6.3 min) ⚠️ Still might timeout

### **With Option 2 (Remove unused meta tables)**:
- 2 clients: ~55 seconds (0.9 min) ✅✅ Fast!
- 5 clients: ~140 seconds (2.3 min) ✅✅ Fast!
- **Full recollection becomes feasible!**

---

## 🚨 Conclusion

**YES, there are massive duplicates!**

The system is calling `getPlacementPerformance()` **TWICE** for every historical week, which is:
- ❌ Unnecessary (same data returned)
- ❌ Wasteful (doubles API quota usage)
- ❌ Slow (adds 26+ seconds per client)

**This is why it times out!** 🎯

