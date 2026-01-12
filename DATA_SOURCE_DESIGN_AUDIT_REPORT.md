# 📊 Data Source Design Audit Report

**Question:** Is the design correct where `daily_kpi_data` is for current periods and `campaign_summaries` is for historical data?

**Answer:** ✅ **YES, the design is correct** - but there's a **consistency issue** in year-over-year comparisons.

---

## 🎯 **INTENDED DESIGN**

### **Data Source Purpose:**

| Source | Purpose | Retention | When Used |
|--------|---------|-----------|-----------|
| **Smart Cache** | Current period (real-time) | 3-hour refresh | Current month/week |
| **daily_kpi_data** | Current period (granular) | 90 days | Current period fallback |
| **campaign_summaries** | Historical periods (archived) | 14 months | Past months/weeks |

### **Data Flow:**

```
CURRENT PERIOD (January 2026):
  ↓
1. Smart Cache (3-hour refresh) → PRIMARY
  ↓ (if expired)
2. daily_kpi_data (90-day retention) → FALLBACK
  ↓ (if missing)
3. Live API → LAST RESORT

HISTORICAL PERIOD (January 2025):
  ↓
1. campaign_summaries (14-month retention) → PRIMARY
  ↓ (if missing)
2. Live API → FALLBACK
```

---

## ✅ **DESIGN IS CORRECT**

### **Why This Design Makes Sense:**

1. **Current Period = Real-Time Data**
   - Smart cache: Fast, fresh (3-hour refresh)
   - daily_kpi_data: Granular daily tracking (90 days)
   - Both are for **active/current** periods

2. **Historical Period = Archived Data**
   - campaign_summaries: Permanent storage (14 months)
   - Aggregated monthly/weekly summaries
   - For **completed/past** periods

3. **Retention Policies Make Sense:**
   - `daily_kpi_data`: 90 days (matches API retention)
   - `campaign_summaries`: 14 months (for year-over-year)

---

## ⚠️ **THE PROBLEM: Year-Over-Year Consistency**

### **Current Year-Over-Year Behavior:**

```typescript
// From: src/app/api/year-over-year-comparison/route.ts

// CURRENT PERIOD (January 2026):
currentData = await fetch('/api/fetch-live-data')  // Uses smart cache
  ↓
Source: Smart Cache → daily_kpi_data fallback

// PREVIOUS YEAR (January 2025):
previousData = await fetchFromCampaignSummaries()  // Uses campaign_summaries
  ↓
Source: campaign_summaries
```

### **Issue: Different Sources = Different Data Quality**

**Problem:**
- Current: Smart Cache (fresh API data, may use daily_kpi_data)
- Previous: campaign_summaries (archived data)
- **Different sources = Potential discrepancies**

**Why This Happens:**
1. Smart cache prioritizes fresh parser results
2. campaign_summaries uses stored aggregated data
3. Data collection timing may differ
4. Conversion metric extraction may differ

---

## 🔍 **ROOT CAUSE ANALYSIS**

### **Scenario 1: Current Period NOT Archived**

```
January 2026 (Current):
  - Smart Cache: ✅ Exists
  - campaign_summaries: ❌ 0 records (not archived yet)
  - daily_kpi_data: ✅ 9 records

January 2025 (Previous):
  - campaign_summaries: ✅ 5 records
  - daily_kpi_data: ❌ 0 records (deleted after 90 days)

Year-Over-Year Comparison:
  Current: Smart Cache (fresh data)
  Previous: campaign_summaries (archived data)
  ⚠️ DIFFERENT SOURCES
```

**This is your current situation!**

### **Scenario 2: Current Period IS Archived**

```
January 2026 (Current):
  - Smart Cache: ✅ Exists
  - campaign_summaries: ✅ 1 record (archived)
  - daily_kpi_data: ✅ 9 records

January 2025 (Previous):
  - campaign_summaries: ✅ 5 records
  - daily_kpi_data: ❌ 0 records

Year-Over-Year Comparison:
  Current: Smart Cache (still used, ignores campaign_summaries)
  Previous: campaign_summaries (archived data)
  ⚠️ STILL DIFFERENT SOURCES
```

**Even if archived, year-over-year API doesn't check it!**

---

## ✅ **THE FIX: Check campaign_summaries for Current Period**

### **Recommended Change:**

```typescript
// In: src/app/api/year-over-year-comparison/route.ts

// BEFORE (Current):
currentData = await fetch('/api/fetch-live-data')  // Always uses smart cache

// AFTER (Fixed):
// 1. Check campaign_summaries FIRST for current period
const currentSummary = await fetchFromCampaignSummaries(currentPeriod);
if (currentSummary.exists) {
  currentData = currentSummary;  // ✅ Use archived data for consistency
} else {
  currentData = await fetch('/api/fetch-live-data');  // Fallback to smart cache
}

// 2. Previous year (unchanged)
previousData = await fetchFromCampaignSummaries(previousYear);
```

### **Benefits:**

1. ✅ **Consistency**: Both periods use same source (campaign_summaries)
2. ✅ **Accuracy**: Archived data is validated and complete
3. ✅ **Reliability**: No dependency on smart cache freshness
4. ✅ **Comparability**: Same data collection methodology

---

## 📋 **DESIGN VALIDATION**

### **Is the Design Correct?**

| Aspect | Status | Notes |
|--------|--------|-------|
| **daily_kpi_data for current** | ✅ Correct | 90-day retention matches API limits |
| **campaign_summaries for historical** | ✅ Correct | 14-month retention for YoY |
| **Smart cache for current** | ✅ Correct | Fast, fresh data |
| **Year-over-year consistency** | ⚠️ **NEEDS FIX** | Should check campaign_summaries for current too |

---

## 🎯 **RECOMMENDATIONS**

### **Immediate Fix:**

1. **Update Year-Over-Year API** to check `campaign_summaries` for current period first
2. **Only use Smart Cache** if `campaign_summaries` doesn't exist for current period
3. **This ensures** both periods use same source when available

### **Long-term Improvement:**

1. **Archive current period** at month-end (already implemented)
2. **Use archived data** for year-over-year comparisons
3. **Smart cache** remains for real-time dashboard views

---

## 📊 **CURRENT STATE SUMMARY**

### **Your Audit Results:**

```
CURRENT PERIOD:
  - Smart Cache: ✅ Exists
  - campaign_summaries: ❌ 0 records (not archived)
  - daily_kpi_data: ✅ 9 records (5 with issues)

PREVIOUS YEAR:
  - campaign_summaries: ✅ 5 records
  - daily_kpi_data: ❌ 0 records (deleted after 90 days)
```

### **Year-Over-Year Comparison:**

```
Current: Smart Cache → daily_kpi_data (9 records, 5 with issues)
  vs
Previous: campaign_summaries (5 records, complete)
  =
⚠️ DIFFERENT SOURCES = POTENTIAL DISCREPANCIES
```

---

## ✅ **CONCLUSION**

**Design is correct**, but **year-over-year implementation needs fix**:

1. ✅ `daily_kpi_data` for current periods (90 days) - **CORRECT**
2. ✅ `campaign_summaries` for historical periods (14 months) - **CORRECT**
3. ⚠️ Year-over-year should check `campaign_summaries` for **BOTH** periods - **NEEDS FIX**

**Action Required:**
- Update year-over-year API to prioritize `campaign_summaries` for current period
- This ensures consistency when comparing periods

---

**Report Generated:** January 2026  
**Status:** ✅ Design is correct, ⚠️ Implementation needs consistency fix

