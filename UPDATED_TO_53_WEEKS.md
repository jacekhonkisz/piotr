# ✅ Updated Weekly Collection to 53 Weeks

## 🎯 What Changed

**Before:**
- ❌ Collected 52 weeks (364 days)
- ❌ Missing ~1 day of coverage for a full year

**After:**
- ✅ Collects **53 weeks** (371 days = 1 year + 1 week)
- ✅ Ensures complete year coverage with buffer

---

## 📝 Files Updated

### 1. **Background Data Collector**
`/src/lib/background-data-collector.ts`

```typescript
// Line 428-429
// 🔧 Collect 53 weeks (full year + 1 week for complete coverage)
for (let i = 0; i < 53; i++) {
  // ... collection logic
}
```

**What it does:**
- Collects 53 completed weeks of historical data
- Plus 1 current week (in progress)
- **Total: 54 weeks of data coverage**

---

### 2. **API Endpoint**
`/src/app/api/admin/collect-weekly-data/route.ts`

Updated message:
```
'Weekly data collection started in background (will collect last 53 weeks = 1 year + 1 week for both Meta & Google Ads)'
```

---

### 3. **New Client Initialization**
`/src/app/api/clients/route.ts`

Updated comment and logs:
```typescript
// This will collect last 12 months + 53 weeks for both Meta & Google (if configured)
console.log(`📊 Historical data collection started in background (12 months + 53 weeks)`);
```

---

### 4. **Testing Script**
`/scripts/test-google-weekly-collection.js`

Updated message:
```javascript
console.log('📊 This will collect 53 weeks of data (1 year + 1 week) for both Meta and Google Ads\n');
```

---

## 📊 Expected Coverage

### **Weekly Data (53 weeks):**
```
Start: ~November 2024
End:   November 2025
Total: 53 weeks = 371 days

✅ Covers full year + extra week buffer
✅ Ensures no gaps in annual reporting
✅ Provides overlap for data validation
```

### **Monthly Data (12 months):**
```
Start: November 2024
End:   October 2025
Total: 12 months

✅ Full year of monthly summaries
```

---

## 🔍 Verification

### **After Collection Completes (5-10 minutes):**

```bash
node scripts/check-google-weekly-data.js
```

**Expected Result:**
```
📊 WEEKLY DATA SUMMARY
   Google Ads: 53+ weeks ✅
   Meta Ads:   53+ weeks ✅

Date Range: 2024-11-xx to 2025-11-xx
```

### **Database Query:**
```sql
SELECT 
  platform,
  summary_type,
  COUNT(*) as records,
  MIN(summary_date) as earliest,
  MAX(summary_date) as latest,
  ROUND(EXTRACT(EPOCH FROM (MAX(summary_date::timestamp) - MIN(summary_date::timestamp))) / 604800) as weeks_coverage
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
GROUP BY platform, summary_type;
```

**Expected:**
| platform | summary_type | records | earliest | latest | weeks_coverage |
|----------|--------------|---------|----------|---------|----------------|
| google | weekly | 53+ | 2024-11-xx | 2025-11-xx | ~53 |
| meta | weekly | 53+ | 2024-11-xx | 2025-11-xx | ~53 |

---

## 🎯 Why 53 Weeks?

### **Calendar Math:**
- 1 year = 365 days
- 365 ÷ 7 = **52.14 weeks**
- 52 weeks = 364 days ❌ *Missing 1-2 days!*
- **53 weeks = 371 days** ✅ *Covers full year + buffer*

### **Benefits:**
1. ✅ **Complete Coverage** - No missing days at year boundaries
2. ✅ **Overlap Protection** - Extra week prevents gaps from timing issues
3. ✅ **Annual Reports** - Clean 1-year lookback for reports
4. ✅ **Week Boundary Safety** - Accounts for week start/end alignment

---

## 🚀 Current Status

**Collection Started:**
```
🔄 Running in background...
📅 Collecting 53 weeks for both Meta and Google Ads
⏰ Expected completion: 5-10 minutes
```

**Before Collection:**
```
Total records: 92
Google weekly: ~26 weeks
Meta weekly: ~50 weeks
```

**After Collection (Expected):**
```
Total records: ~120+
Google weekly: 53+ weeks ✅
Meta weekly: 53+ weeks ✅
```

---

## ✅ Summary

**Changed:** 52 weeks → **53 weeks**

**Reason:** Ensure complete year coverage (365+ days)

**Impact:**
- ✅ More complete historical data
- ✅ No gaps in year-over-year comparisons
- ✅ Better data for annual reports
- ✅ Matches industry standard (53-week fiscal year support)

**Files Updated:** 4 files (collector, API, client creation, test script)

**Status:** ✅ **DEPLOYED** - Collection running with 53-week coverage

