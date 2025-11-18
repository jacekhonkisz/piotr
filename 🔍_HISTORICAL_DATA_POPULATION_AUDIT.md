# 🔍 AUDIT: Historical Database Data Not Fully Populated

**Date:** November 18, 2025  
**Issue:** Historical weekly and monthly data shows incomplete metrics  
**Evidence:** Screenshots show 0 reservations in some periods, but data exists in others

---

## 📸 OBSERVED ISSUES FROM SCREENSHOTS

### Screenshot 1 (Incomplete Data):
```
WYDATKI: 24,315.18 zł
WYŚWIETLENIA: 1.9M
KLIKNIĘCIA: 50.6K
CTR: 2.66%
CPC: 0.48 zł
KONWERSJE: 0 ❌

Konwersje Online:
- Koszyk: 0
- Krok 2: 0  
- Krok 3: 0
- Rezerwacje: 0 ❌

REZERWACJE: 0 ❌
WARTOŚĆ REZERWACJI: 0,00 zł ❌
```

### Screenshot 2 (Complete Data):
```
WYDATKI: 6,271.48 zł
WYŚWIETLENIA: 521.8K
KLIKNIĘCIA: 15.2K
CTR: 2.91%
CPC: 0,41 zł
KONWERSJE: 18 ✅

Konwersje Online:
- Koszyk: 0
- Krok 2: 0
- Krok 3: 83 ✅
- Rezerwacje: 18 ✅

REZERWACJE: 18 ✅
WARTOŚĆ REZERWACJI: 73,125.00 zł ✅
```

**Pattern:** Basic metrics (spend, impressions, clicks) are ALWAYS populated, but conversion metrics (booking steps, reservations) are MISSING in some periods.

---

## 🔍 ROOT CAUSES ANALYSIS

### Possible Cause 1: Data Collection Incomplete

**Problem:** BackgroundDataCollector might not be collecting all fields

**Check locations:**
1. `src/lib/background-data-collector.ts` - collectWeeklySummaries
2. `src/lib/background-data-collector.ts` - collectMonthlySummaries  
3. Meta API response parsing

### Possible Cause 2: Database Storage Issues

**Problem:** Data collected but not stored properly in campaign_summaries

**Check:**
- Are all conversion fields being saved?
- Is campaign_data JSON complete?
- Are aggregated fields (booking_step_1, etc.) stored?

### Possible Cause 3: Calculation vs Campaign Data Mismatch

**Current logic in loadFromDatabase (lines 389-446):**
```typescript
if (campaigns && campaigns.length > 0) {
  // ✅ Calculate from campaign_data
  conversionMetrics = {
    booking_step_1: campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0),
    booking_step_2: campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0),
    booking_step_3: campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0),
    reservations: campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0),
    // ...
  };
} else if (storedSummary.click_to_call !== null) {
  // Fallback to aggregated columns
  conversionMetrics = {
    booking_step_1: storedSummary.booking_step_1 || 0,
    // ...
  };
}
```

**Issue:** If `campaign_data` JSON doesn't have booking_step fields, calculation returns 0

### Possible Cause 4: Meta API Not Returning Conversion Data

**Problem:** Meta API might not return custom conversions for all date ranges

**Meta API Limitations:**
- Custom conversions might have attribution windows
- Some conversion data might be delayed
- Historical data might not include all conversion types

---

## 🔬 DIAGNOSTIC QUERIES

### Query 1: Check What's Actually in Database
```sql
SELECT 
  summary_type,
  summary_date,
  period_id,
  platform,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  jsonb_array_length(campaign_data) as campaign_count,
  campaign_data->0->>'booking_step_1' as first_campaign_booking1,
  campaign_data->0->>'booking_step_2' as first_campaign_booking2,
  campaign_data->0->>'booking_step_3' as first_campaign_booking3,
  data_source
FROM campaign_summaries
WHERE summary_type IN ('weekly', 'monthly')
  AND client_id = 'YOUR_CLIENT_ID'
ORDER BY summary_date DESC
LIMIT 10;
```

### Query 2: Find Periods with Missing Data
```sql
SELECT 
  summary_date,
  summary_type,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  CASE 
    WHEN booking_step_1 IS NULL OR booking_step_1 = 0 THEN 'MISSING'
    ELSE 'OK'
  END as booking_status
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND total_spend > 0  -- Has spend data
ORDER BY summary_date DESC;
```

### Query 3: Check Campaign Data Structure
```sql
SELECT 
  summary_date,
  jsonb_array_length(campaign_data) as campaigns,
  (SELECT jsonb_object_keys(campaign_data->0)) as sample_keys
FROM campaign_summaries
WHERE summary_date = '2025-11-10'  -- Week 46 start
  AND summary_type = 'weekly'
LIMIT 1;
```

---

## 🎯 LIKELY ISSUES

### Issue 1: Weekly Collection Not Running
**Location:** `/api/automated/collect-weekly-summaries`  
**Cron:** Sunday 3 AM

**Check:**
```bash
# Check Vercel cron logs
vercel logs --since 7d | grep "collect-weekly"
```

**Symptoms:**
- No weekly data in campaign_summaries
- Weekly reports fallback to empty or old data

### Issue 2: Meta API Not Returning Custom Conversions
**Location:** `src/lib/meta-service.ts` - getCampaignInsights

**Problem:** Meta API might not include custom conversion fields in response

**Fix needed:**
```typescript
// Ensure custom conversions are requested
const fields = [
  'campaign_id',
  'campaign_name',
  'spend',
  'impressions',
  'clicks',
  'actions',  // ← This contains conversions
  'action_values'  // ← This contains reservation values
];

// Then parse actions array for custom conversions
const booking_step_1 = insights.actions?.find(a => a.action_type === 'omni_custom.booking_step_1')?.value || 0;
```

### Issue 3: Campaign Data JSON Missing Fields
**Location:** `src/lib/background-data-collector.ts` - storeWeeklySummary

**Problem:** When saving campaign_data, conversion fields might be undefined

**Current code (lines 1106):**
```typescript
campaign_data: data.campaigns,  // Saves whatever is in data.campaigns
```

**Issue:** If `data.campaigns` doesn't have booking_step fields, they're missing from JSON

### Issue 4: Aggregation Columns Not Set
**Location:** Lines 1110-1116 in background-data-collector.ts

```typescript
booking_step_1: enhancedConversionMetrics.booking_step_1,  // What if this is undefined?
booking_step_2: enhancedConversionMetrics.booking_step_2,
booking_step_3: enhancedConversionMetrics.booking_step_3,
```

**Problem:** If `enhancedConversionMetrics` is calculated incorrectly, aggregated columns are wrong

---

## 🔍 COLLECTION LOGIC AUDIT

### collectWeeklySummary Logic (src/lib/background-data-collector.ts)

**Lines 1010-1066:** Enhanced conversion metrics logic
```typescript
// Try to get from Meta API response first
let enhancedConversionMetrics = {
  click_to_call: data.conversionMetrics?.click_to_call || 0,
  email_contacts: data.conversionMetrics?.email_contacts || 0,
  booking_step_1: data.conversionMetrics?.booking_step_1 || 0,
  // ...
};

// If all zeros, try daily_kpi_data fallback
if (enhancedConversionMetrics.reservations === 0) {
  // Query daily_kpi_data
  const dailyConversionTotals = dailyKpiData.reduce((acc, record) => ({
    booking_step_1: acc.booking_step_1 + (record.booking_step_1 || 0),
    // ...
  }));
  
  enhancedConversionMetrics = dailyConversionTotals;
}
```

**Issues:**
1. ❌ Fallback only triggers if `reservations === 0`, not if `booking_step_1 === 0`
2. ❌ If Meta API doesn't return the fields, they're 0
3. ❌ If daily_kpi_data also doesn't have them, still 0

---

## 🔧 FIXES NEEDED

### Fix 1: Improve Fallback Logic
**File:** `src/lib/background-data-collector.ts` Line 1018

```typescript
// CURRENT (line 1018):
if (enhancedConversionMetrics.reservations === 0 && 
    enhancedConversionMetrics.booking_step_3 === 0) {

// BETTER:
if (enhancedConversionMetrics.reservations === 0 && 
    enhancedConversionMetrics.booking_step_1 === 0 &&
    enhancedConversionMetrics.booking_step_2 === 0 &&
    enhancedConversionMetrics.booking_step_3 === 0) {
```

**Why:** Current logic only checks reservations + step 3, misses step 1 and 2

### Fix 2: Ensure Meta API Includes Custom Conversions
**File:** `src/lib/meta-service.ts`

**Add to fields array:**
```typescript
'actions',
'action_values',
'conversions'  // Ensure custom conversions are requested
```

### Fix 3: Force Recollection for Periods with Missing Data
**New script:** `scripts/fix-missing-weekly-data.ts`

```typescript
// For each week with missing data:
// 1. Delete old entry
// 2. Trigger fresh collection
// 3. Store with all fields
```

### Fix 4: Add Validation Before Storage
**File:** `src/lib/background-data-collector.ts` before line 1122

```typescript
// Validate conversion metrics before storage
console.log(`🔍 Validation before storage:`, {
  booking_step_1: enhancedConversionMetrics.booking_step_1,
  booking_step_2: enhancedConversionMetrics.booking_step_2,
  booking_step_3: enhancedConversionMetrics.booking_step_3,
  reservations: enhancedConversionMetrics.reservations,
  source: 'meta_api or daily_kpi_data'
});

if (enhancedConversionMetrics.reservations > 0 && 
    enhancedConversionMetrics.booking_step_1 === 0) {
  logger.warn(`⚠️ Data anomaly: Reservations exist but booking_step_1 is 0`);
}
```

---

## 📋 IMMEDIATE ACTIONS

1. **Check Database:** Run diagnostic SQL to see what's actually stored
2. **Check Cron Logs:** Verify weekly collection is running
3. **Fix Fallback Logic:** Update line 1018 in background-data-collector.ts
4. **Force Recollection:** Trigger collection for periods with missing data
5. **Add Validation:** Add logging before storage to catch issues

---

## 🚨 CRITICAL FINDINGS

Based on the screenshots:
- **Basic metrics work:** Spend, impressions, clicks are ALWAYS populated
- **Conversion metrics missing:** booking_step_1, booking_step_2, sometimes booking_step_3
- **Inconsistent data:** Some periods have complete data, others don't

**This suggests:**
1. ✅ Collection IS running (basic metrics populated)
2. ❌ Conversion data not being fetched or stored properly
3. ❌ Fallback to daily_kpi_data not working (or daily_kpi_data also empty)

---

**Next Step:** Run diagnostic SQL to see exact database state

