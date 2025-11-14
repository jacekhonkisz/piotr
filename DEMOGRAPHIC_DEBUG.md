# Demographic Data Debug - November 4, 2025

## 🔍 Diagnostic Logging Added

Added comprehensive logging to `DemographicPieCharts.tsx` to identify why data shows as NaN.

### What I Added:

1. **Data Structure Log** - Shows exact format of first item
2. **Field Names Log** - Shows all available keys
3. **Value Processing Log** - Shows how each item is processed
4. **Metric Matching Log** - Shows if the metric field exists

### How to Debug:

1. **Refresh the Reports Page** (`localhost:3000/reports?clientId=...`)
2. **Open Browser Console** (F12 → Console tab)
3. **Look for these logs:**

```
🔍 DEMOGRAPHIC DATA STRUCTURE:
  firstItem: {...}
  allKeys: [...]
  metric: "spend"
  metricValue: ...
  sampleGender: ...
  sampleAge: ...
```

4. **Check if the metric field exists in the data**

---

## 🎯 Expected vs Actual

### What Meta API Should Return:
```json
{
  "age": "25-34",
  "gender": "male",
  "impressions": 1000,
  "clicks": 50,
  "spend": "100.50",  // ← This should exist
  "cpm": "10.50",
  "cpc": "2.01",
  "ctr": "5.0"
}
```

### Potential Issues:

1. **Field names might be different:**
   - API returns: `spend` (string?)
   - Component expects: `spend` (number)

2. **Data might not be transformed:**
   - API returns raw Meta format
   - Component expects processed format

3. **Array might be empty:**
   - API call fails silently
   - Empty array passed to component

---

## 🔧 Fixes Applied

1. ✅ Added null/undefined fallback: `const value = item[metric] || 0;`
2. ✅ Added zero-division protection: `total > 0 ? ... : '0'`
3. ✅ Added comprehensive diagnostic logging

---

## 📋 Next Steps

**Please:**
1. Refresh the reports page
2. Open console (F12)
3. Look for "🔍 DEMOGRAPHIC DATA STRUCTURE" logs
4. Share screenshot or paste the log output

This will show us the EXACT data structure and help identify the mismatch.





