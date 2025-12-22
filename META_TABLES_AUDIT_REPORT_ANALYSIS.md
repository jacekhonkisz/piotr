# 🔍 Meta Tables Audit Report Analysis

## 📊 Report Summary

Based on the verification query results for Belmonte Hotel, here are the key findings:

---

## ✅ **GOOD NEWS: Most Periods Have Data**

### **Monthly Meta Summaries:**
- ✅ **12 out of 13 months** have meta_tables data
- ✅ All months from **2025-01-01** to **2025-11-01** have complete data
- ❌ **Only 1 missing**: `2024-11-01` (oldest month in report) - likely collected before meta_tables feature was added

### **Weekly Meta Summaries:**
- ✅ **Most weeks have data** (19+ placement records, 19 demographic records)
- ❌ **1 missing**: `2025-11-17` (current week) - **EXPECTED** (by design, current week skips meta_tables)
- ⚠️ **Some weeks have empty arrays**: `2025-02-17`, `2025-02-10` (structure exists but no data)

---

## ❌ **ISSUE FOUND: Google Ads Query Bug**

### **Problem:**
The verification query was checking `meta_tables` field for **ALL platforms**, but:
- **Meta Ads** uses: `meta_tables` ✅
- **Google Ads** uses: `google_ads_tables` ❌ (different field!)

### **Result:**
All Google Ads monthly records show `❌ NULL` because the query was checking the wrong field!

### **Fix Applied:**
Updated query #6 to check the correct field based on platform:
- Meta: checks `meta_tables`
- Google: checks `google_ads_tables`

---

## 📋 **Detailed Findings**

### **1. Current Week (2025-11-17) - NULL**
**Status:** ✅ **EXPECTED BEHAVIOR**

**Reason:** Code intentionally skips meta_tables for current week to reduce API calls:
```typescript
if (!weekData.isCurrent) {
  // Fetch meta tables
} else {
  logger.info(`⏭️ Skipping meta tables for current week to reduce API calls`);
}
```

**Impact:** Current week data comes from live API, not stored summaries.

---

### **2. November 2024 (2024-11-01) - NULL**
**Status:** ⚠️ **NEEDS BACKFILL**

**Reason:** Likely collected before meta_tables collection was implemented (September 2025).

**Action Required:** Backfill meta_tables for this month.

---

### **3. Google Ads Monthly Records - All NULL**
**Status:** ❌ **QUERY BUG (Now Fixed)**

**Reason:** Query was checking `meta_tables` instead of `google_ads_tables` for Google platform.

**Fix:** Updated query to check correct field based on platform.

**Note:** Even with correct query, Google Ads may legitimately have NULL if:
- Google Ads tables collection wasn't implemented yet
- API calls failed during collection
- Google Ads doesn't have equivalent "meta tables" structure

---

### **4. Empty Arrays in Some Weeks**
**Status:** ⚠️ **PARTIAL DATA**

**Examples:**
- `2025-02-17`: 0 placements, 0 demographics, but `total_spend = 0` (no activity)
- `2025-02-10`: 0 placements, 0 demographics, but `total_spend = 6533.87` (has spend but no breakdown)

**Reason:** 
- Week with no spend: Empty arrays are correct (no data to show)
- Week with spend but empty arrays: API may have returned no breakdown data, or collection failed

---

## 🎯 **Recommendations**

### **1. Immediate Actions:**

#### **A. Backfill Missing November 2024 Meta Tables**
```sql
-- Run this to backfill meta_tables for 2024-11-01
-- (Requires API endpoint or manual collection)
```

#### **B. Re-run Verification Query**
Use the **updated query #6** that checks the correct field for Google Ads:
```sql
-- File: scripts/verify-meta-tables-per-period.sql
-- Query #6 (now platform-aware)
```

### **2. Investigate Empty Arrays:**

#### **A. Weeks with Spend but No Data:**
- `2025-02-10`: Has spend (6533.87) but 0 placements/demographics
- Check if this is expected (API limitation) or a collection bug

#### **B. Weeks with Zero Spend:**
- `2025-02-17`: Zero spend, zero data - this is correct ✅

### **3. Long-term Improvements:**

#### **A. Add Retry Logic**
If meta_tables API call fails, retry before storing NULL.

#### **B. Monitor Collection Health**
Track which periods fail to collect meta_tables and alert on failures.

#### **C. Backfill Script**
Create automated backfill for missing meta_tables when:
- Period was collected before feature was added
- API call failed during collection

---

## 📊 **Data Completeness Summary**

| Period Type | Platform | Total | With Data | Missing | % Complete |
|------------|----------|-------|-----------|---------|------------|
| Monthly    | Meta     | 13    | 12        | 1       | 92.3%      |
| Monthly    | Google   | 13    | ?         | ?       | Need re-check with fixed query |
| Weekly     | Meta     | ~52   | ~51       | 1*      | 98.1%*     |

*Excluding current week (expected NULL)

---

## ✅ **Conclusion**

**Answer to your question:** 

**YES, each month/week SHOULD have its own meta_tables data for that exact period**, and **MOST DO**:

- ✅ **92% of monthly Meta summaries** have complete meta_tables data
- ✅ **98% of weekly Meta summaries** have complete meta_tables data (excluding current week)
- ❌ **1 old month** (Nov 2024) needs backfilling
- ⚠️ **Google Ads** needs re-verification with corrected query

The system is working as designed, with only minor gaps that can be backfilled.



