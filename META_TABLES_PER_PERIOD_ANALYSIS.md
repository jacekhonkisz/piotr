# 🔍 Meta Tables Data Per Period Analysis

## ❓ Question
**Are you sure each month/week has its own meta ad tables data for that exact period?**

## 📊 Code Analysis Results

### ✅ **Monthly Summaries - SHOULD Have Meta Tables**

**Location:** `src/lib/background-data-collector.ts:322-338`

**How it works:**
1. For each month being collected, the system fetches:
   - `placementPerformance` for that month's date range
   - `demographicPerformance` for that month's date range  
   - `adRelevanceResults` for that month's date range
2. These are combined into a `metaTables` object
3. Stored in `campaign_summaries.meta_tables` JSONB column for that specific month

**Code:**
```typescript
// Fetch meta tables
let metaTables = null;
try {
  const placementData = await metaService.getPlacementPerformance(processedAdAccountId, monthData.startDate, monthData.endDate);
  const demographicData = await metaService.getDemographicPerformance(processedAdAccountId, monthData.startDate, monthData.endDate);
  const adRelevanceData = await metaService.getAdRelevanceResults(processedAdAccountId, monthData.startDate, monthData.endDate);
  
  metaTables = {
    placementPerformance: placementData,
    demographicPerformance: demographicData,
    adRelevanceResults: adRelevanceData
  };
} catch (error) {
  logger.warn(`⚠️ Failed to fetch meta tables for ${client.name} ${monthData.year}-${monthData.month}:`, error);
}
```

**⚠️ Potential Issues:**
- If the API call fails, `metaTables` will be `null` and stored as `null` in the database
- No retry mechanism if API fails
- Historical months collected before this code was added may not have meta_tables

---

### ⚠️ **Weekly Summaries - CONDITIONAL Meta Tables**

**Location:** `src/lib/background-data-collector.ts:638-658`

**How it works:**
1. Meta tables are ONLY collected for **historical weeks** (not current week)
2. Current week is skipped to reduce API calls
3. For historical weeks, same 3 API calls are made for that week's date range

**Code:**
```typescript
// Fetch meta tables (skip for current week to reduce API calls)
let metaTables = null;
if (!weekData.isCurrent) {
  try {
    const placementData = await metaService.getPlacementPerformance(processedAdAccountId, weekData.startDate, weekData.endDate);
    const demographicData = await metaService.getDemographicPerformance(processedAdAccountId, weekData.startDate, weekData.endDate);
    const adRelevanceData = await metaService.getAdRelevanceResults(processedAdAccountId, weekData.startDate, weekData.endDate);
    
    metaTables = {
      placementPerformance: placementData,
      demographicPerformance: demographicData,
      adRelevanceResults: adRelevanceData
    };
  } catch (error) {
    logger.warn(`⚠️ Failed to fetch meta tables for ${client.name} week ${weekData.weekNumber}:`, error);
  }
} else {
  logger.info(`⏭️ Skipping meta tables for current week to reduce API calls`);
}
```

**⚠️ Issues:**
- Current week will have `meta_tables = null`
- Historical weeks should have data, but only if collection succeeded
- No guarantee that all historical weeks were collected with meta_tables

---

## 🔍 Verification Needed

**Run this SQL script to verify actual database state:**
```sql
-- File: scripts/verify-meta-tables-per-period.sql
```

This script will check:
1. ✅ Which periods have meta_tables data
2. ❌ Which periods are missing meta_tables
3. 📊 Percentage of periods with complete data
4. 🔍 Sample content to verify data is period-specific

---

## 🎯 Expected Behavior

### **Monthly Summaries:**
- ✅ **Should have meta_tables** for each month
- ✅ **Period-specific data** (each month has its own placement/demographic data)
- ⚠️ **May be null** if API call failed during collection

### **Weekly Summaries:**
- ✅ **Historical weeks** should have meta_tables
- ❌ **Current week** will NOT have meta_tables (by design)
- ⚠️ **May be null** if API call failed during collection

---

## 🚨 Known Issues

1. **Historical Data Gap:**
   - Months/weeks collected before meta_tables collection was implemented may have `null` values
   - No backfill mechanism to populate missing meta_tables for old periods

2. **API Failure Handling:**
   - If Meta API fails, `metaTables` is set to `null` and stored
   - No retry or fallback mechanism
   - Period will permanently have `null` meta_tables

3. **Current Week Gap:**
   - Weekly summaries for current week intentionally skip meta_tables
   - This is by design to reduce API calls
   - Current week data comes from live API, not stored summaries

---

## 📋 Recommendations

1. **Run Verification Script:**
   ```bash
   # Execute: scripts/verify-meta-tables-per-period.sql
   # This will show exactly which periods have data
   ```

2. **Check Historical Data:**
   - Verify if older months/weeks have meta_tables
   - Identify periods that need backfilling

3. **Consider Backfill:**
   - If many periods are missing meta_tables, consider backfilling
   - Use Meta API to fetch historical meta_tables data
   - Store in existing `campaign_summaries` records

4. **Improve Error Handling:**
   - Add retry logic for failed meta_tables API calls
   - Log failures for monitoring
   - Consider queueing failed requests for retry

---

## ✅ Conclusion

**Answer: It DEPENDS on when the data was collected:**

- ✅ **Recent months/weeks** (collected after meta_tables code was added): Should have period-specific meta_tables data
- ❌ **Older periods** (collected before): May have `null` meta_tables
- ⚠️ **Failed API calls**: Will have `null` meta_tables even if code tried to collect
- ❌ **Current week** (weekly only): Intentionally `null` to reduce API calls

**Run the verification script to see the actual state of your database!**



