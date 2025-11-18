# 🔍 AUDIT: Missing Booking Step Metrics in Historical Weeks

**Date:** November 18, 2025  
**Issue:** Week 46 (Nov 10-16) showing booking_step_1 and booking_step_2 as 0
**Source:** User console logs from WeeklyReportView.tsx

---

## 📊 OBSERVED DATA

From user's console output for Week 46:

```javascript
🔍 Local YoY Current Totals: {
  spend: 6271.48,           // ✅ Present
  impressions: 521757,      // ✅ Present
  clicks: 15159,            // ✅ Present
  booking_step_1: 0,        // ❌ Missing!
  booking_step_2: 0,        // ❌ Missing!
  booking_step_3: 83,       // ✅ Present
  reservations: 18          // ✅ Present
}
```

**Pattern:**
- Basic metrics (spend, impressions, clicks) ✅ Working
- booking_step_3 and reservations ✅ Working
- booking_step_1 and booking_step_2 ❌ Missing

---

## 🔍 AUDIT FINDINGS

### 1. Database Query Logic (fetch-live-data/route.ts)

**Lines 388-427:**
```typescript
// Use pre-aggregated conversion metrics from database columns (preferred)
if (storedSummary.click_to_call !== null && storedSummary.click_to_call !== undefined) {
  conversionMetrics = {
    click_to_call: storedSummary.click_to_call || 0,
    email_contacts: storedSummary.email_contacts || 0,
    booking_step_1: storedSummary.booking_step_1 || 0,  // ← Uses DB column
    booking_step_2: storedSummary.booking_step_2 || 0,  // ← Uses DB column
    booking_step_3: storedSummary.booking_step_3 || 0,
    reservations: storedSummary.reservations || 0,
    ...
  };
} else {
  // Fallback: Calculate from campaign data
  conversionMetrics = {
    booking_step_1: campaigns.reduce(...),  // ← Calculates from campaigns
    booking_step_2: campaigns.reduce(...),
    ...
  };
}
```

**Issue:** If `storedSummary.click_to_call` exists (not null), it uses database columns. But if `booking_step_1` column is NULL or 0 in database, it stays 0.

### 2. Storage Logic (background-data-collector.ts)

**Lines 1110-1116:**
```typescript
// Add enhanced conversion metrics
click_to_call: enhancedConversionMetrics.click_to_call,
email_contacts: enhancedConversionMetrics.email_contacts,
booking_step_1: enhancedConversionMetrics.booking_step_1,  // ← Stored
reservations: enhancedConversionMetrics.reservations,
reservation_value: enhancedConversionMetrics.reservation_value,
booking_step_2: enhancedConversionMetrics.booking_step_2,  // ← Stored
booking_step_3: enhancedConversionMetrics.booking_step_3,
```

**Storage looks correct**, but we need to check what `enhancedConversionMetrics` contains.

---

## 🎯 ROOT CAUSE HYPOTHESIS

### Most Likely: Data Collection Issue

**When weekly collection runs:**
1. Fetches campaigns from Meta API
2. Aggregates metrics
3. For `booking_step_1` and `booking_step_2`:
   - Meta API might not return these fields
   - OR fields are returned but with value 0
   - OR aggregation logic misses these fields

**Why booking_step_3 works:**
- Different Meta API field name
- Or different custom conversion event

### Possible Causes:

1. **Meta API Field Names Mismatch**
   - API returns different field names than expected
   - `booking_step_1` might be `booking_1` or `step_1_bookings`

2. **Custom Conversion Events Not Configured**
   - booking_step_1 and booking_step_2 not set up as Meta custom conversions
   - booking_step_3 and reservations ARE set up

3. **Aggregation Logic Missing Fields**
   - Code calculates booking_step_3 but skips booking_step_1/2
   - Or falls back to 0 when field not present

4. **Database Column NULL**
   - Data stored as NULL instead of 0
   - `|| 0` fallback doesn't catch NULL properly

---

## 🔬 DIAGNOSTIC QUERIES

### Check Database Values

```sql
-- Check what's actually stored in database for Week 46
SELECT 
  period_id,
  summary_date,
  platform,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  data_source,
  created_at
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND period_id = '2025-W46'
  AND summary_type = 'weekly';
```

### Check Campaign Data

```sql
-- Check if campaign_data JSON contains booking steps
SELECT 
  period_id,
  summary_date,
  jsonb_array_length(campaign_data) as campaign_count,
  campaign_data->0->'booking_step_1' as first_campaign_step1,
  campaign_data->0->'booking_step_2' as first_campaign_step2,
  campaign_data->0->'booking_step_3' as first_campaign_step3
FROM campaign_summaries
WHERE period_id = '2025-W46'
  AND summary_type = 'weekly';
```

---

## 🔧 POTENTIAL FIXES

### Fix 1: Improve Fallback Logic

**Problem:** Database has NULL or 0, never falls back to calculate from campaigns

**Solution:**
```typescript
// IMPROVED: Check if ANY conversion metric is meaningful
const hasValidConversionData = storedSummary.click_to_call > 0 || 
                                storedSummary.email_contacts > 0 || 
                                storedSummary.booking_step_1 > 0 ||
                                storedSummary.booking_step_2 > 0 ||
                                storedSummary.booking_step_3 > 0 ||
                                storedSummary.reservations > 0;

if (hasValidConversionData) {
  // Use database columns
  conversionMetrics = { ... };
} else {
  // Calculate from campaign data
  conversionMetrics = campaigns.reduce(...);
}
```

### Fix 2: Always Aggregate from Campaigns

**Problem:** Database might have incomplete data

**Solution:**
```typescript
// ALWAYS calculate from campaign_data (most accurate)
conversionMetrics = {
  click_to_call: campaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0),
  email_contacts: campaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0),
  booking_step_1: campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0),
  booking_step_2: campaigns.reduce((sum, c) => sum + (c.booking_step_2 || 0), 0),
  booking_step_3: campaigns.reduce((sum, c) => sum + (c.booking_step_3 || 0), 0),
  reservations: campaigns.reduce((sum, c) => sum + (c.reservations || 0), 0),
  reservation_value: campaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0),
  ...
};

// Also use stored aggregates if campaigns missing
if (campaigns.length === 0 && storedSummary.reservations) {
  conversionMetrics = { ...storedSummary columns... };
}
```

### Fix 3: Check Campaign Data Structure

**Problem:** Campaign data might have booking steps but we're not reading them

**Solution:** Add logging to see what's actually in campaign_data

```typescript
console.log('🔍 Sample campaign data:', campaigns[0]);
console.log('🔍 Booking steps in first campaign:', {
  step1: campaigns[0]?.booking_step_1,
  step2: campaigns[0]?.booking_step_2,
  step3: campaigns[0]?.booking_step_3
});
```

---

## 🚀 RECOMMENDED ACTION

### Immediate: Add Debug Logging

Add to `loadFromDatabase` function (line ~407):

```typescript
console.log(`🔍 CONVERSION METRICS DEBUG:`, {
  storedSummary: {
    booking_step_1: storedSummary.booking_step_1,
    booking_step_2: storedSummary.booking_step_2,
    booking_step_3: storedSummary.booking_step_3,
    reservations: storedSummary.reservations
  },
  campaigns: {
    count: campaigns.length,
    sample: campaigns[0] ? {
      booking_step_1: campaigns[0].booking_step_1,
      booking_step_2: campaigns[0].booking_step_2,
      booking_step_3: campaigns[0].booking_step_3,
      reservations: campaigns[0].reservations
    } : null
  },
  willUseStoredMetrics: storedSummary.click_to_call !== null,
  calculatedFromCampaigns: campaigns.reduce((sum, c) => sum + (c.booking_step_1 || 0), 0)
});
```

This will show us:
1. What's in database columns
2. What's in campaign_data
3. Which path (database vs calculated) is taken
4. What the calculation would produce

---

## 📋 NEXT STEPS

1. **Run diagnostic SQL queries** to see database values
2. **Add debug logging** to see what data we have
3. **Deploy debug logging** and ask user to view Week 46 again
4. **Analyze output** to determine exact cause
5. **Apply appropriate fix** based on findings

---

**Current Status:** Awaiting diagnostic data to determine root cause

