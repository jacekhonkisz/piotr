# Demographic Data Diagnostic - Complete

## 🔧 Diagnostic Logging Added

I've added comprehensive logging at **two critical points** in the data flow:

### 1. **MetaAdsTables Component** (Data Receiver)
**File:** `src/components/MetaAdsTables.tsx`

Logs the RAW data received from API:
```typescript
console.log('🔍 RAW DEMOGRAPHIC DATA FROM API:', {
  count: ...,
  firstItem: {...},  // Full object structure
  allKeys: [...],    // All field names
  hasSpend: boolean,
  hasImpressions: boolean,
  hasClicks: boolean,
  spendValue: ...,
  spendType: 'string' | 'number' | 'undefined'
});
```

### 2. **DemographicPieCharts Component** (Data Consumer)
**File:** `src/components/DemographicPieCharts.tsx`

Logs the data being processed:
```typescript
console.log('🔍 DEMOGRAPHIC DATA STRUCTURE:', {
  firstItem: {...},
  allKeys: [...],
  metric: 'spend',
  metricValue: ...,  // The actual value for the metric
  sampleGender: ...,
  sampleAge: ...
});

console.log('🔍 Processing item:', {
  gender: ...,
  age: ...,
  metric: 'spend',
  value: ...,  // THIS is what should show in charts
  rawItem: {...}
});
```

---

## 🎯 How to Debug

### Step 1: Refresh the Page
Navigate to: `localhost:3000/reports?clientId=ab0b4c7e-2bf0-46bc-b455-b18ef6942baa`

### Step 2: Open Browser Console
Press **F12** → Click **Console** tab

### Step 3: Scroll to Demographic Section
Scroll down on the page to the "Analiza skuteczności reklam według płci i grup wiekowych" section

### Step 4: Look for These Logs (in order):

1. **`🔍 RAW DEMOGRAPHIC DATA FROM API:`**
   - Shows what Meta API returned
   - Check if `hasSpend`, `hasImpressions`, `hasClicks` are `true`
   - Check `spendType` - should be `'string'` or `'number'`, NOT `'undefined'`

2. **`🔍 DEMOGRAPHIC DATA STRUCTURE:`**
   - Shows data structure in the chart component
   - Check if `metricValue` has a value (not undefined)
   - Check `allKeys` contains the metric you're trying to display

3. **`🔍 Processing item:`** (multiple logs)
   - Shows each demographic record being processed
   - Check if `value` is a number, not `undefined` or `NaN`

---

## 🐛 Common Issues to Look For

### Issue 1: Empty Array
```
🔍 RAW DEMOGRAPHIC DATA FROM API: {
  count: 0,  // ← Problem: No data from API
  firstItem: undefined
}
```
**Solution:** Meta API isn't returning demographic data - check token/permissions

### Issue 2: Wrong Field Names
```
🔍 RAW DEMOGRAPHIC DATA FROM API: {
  firstItem: {
    "age": "25-34",
    "gender": "male",
    "total_spend": "100.50"  // ← Problem: Field is "total_spend" not "spend"
  }
}
```
**Solution:** Need to map field names from Meta API format to expected format

### Issue 3: String Values
```
🔍 RAW DEMOGRAPHIC DATA FROM API: {
  spendValue: "100.50",  // ← String
  spendType: "string"    // ← Problem: Need number
}
```
**Solution:** Convert string to number: `parseFloat(item.spend)`

### Issue 4: Missing Fields
```
🔍 RAW DEMOGRAPHIC DATA FROM API: {
  hasSpend: false,  // ← Problem: 'spend' field doesn't exist
  allKeys: ["age", "gender", "impressions", "clicks"]
}
```
**Solution:** Check if Meta API is returning all requested fields

---

## 📋 What I Need From You

**Please do this:**

1. ✅ Refresh the reports page
2. ✅ Open browser console (F12)
3. ✅ Scroll to demographic charts section
4. ✅ Find the log that says **"🔍 RAW DEMOGRAPHIC DATA FROM API:"**
5. ✅ Copy/paste or screenshot that entire log object

**This will show me:**
- Exact field names from Meta API
- Data types (string vs number)
- Whether data exists at all

**Then I can:**
- Fix any field name mapping issues
- Fix any data type conversion issues
- Fix any missing data issues

---

## 🔍 Expected Correct Output

If everything is working, you should see:

```javascript
🔍 RAW DEMOGRAPHIC DATA FROM API: {
  count: 19,
  firstItem: {
    age: "25-34",
    gender: "male",
    impressions: 1000,
    clicks: 50,
    spend: "100.50",  // or 100.50 (number)
    cpm: "10.50",
    cpc: "2.01",
    ctr: "5.0"
  },
  allKeys: ["age", "gender", "impressions", "clicks", "spend", "cpm", "cpc", "ctr"],
  hasSpend: true,  // ← Must be true
  hasImpressions: true,
  hasClicks: true,
  spendValue: "100.50" or 100.50,
  spendType: "string" or "number"  // ← NOT "undefined"
}
```

---

## ⏱️ This Should Take 2 Minutes

Just:
1. Refresh
2. F12 (console)
3. Scroll down
4. Find the "🔍 RAW" log
5. Share it

Then I can fix the exact issue immediately!










