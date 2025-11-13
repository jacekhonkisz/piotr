# 🔍 Demographic Data Missing in PDF Reports - Root Cause Analysis

**Date:** November 5, 2025  
**Status:** ✅ ROOT CAUSE IDENTIFIED

---

## 🎯 Issue Summary

Demographics charts are not visible in generated PDF reports, even though the system fetches demographic data from Meta API.

---

## 🔬 Root Cause Analysis

### The Problem Chain

1. **Meta API Query - Missing Conversion Fields**
   - **File:** `src/lib/meta-api-optimized.ts:443`
   - **Current Query:**
     ```typescript
     fields=impressions,clicks,spend,cpm,cpc,ctr&breakdowns=age,gender
     ```
   - **Missing:** Conversion actions (`actions`, `action_values`)

2. **PDF Generation Expects Conversion Data**
   - **File:** `src/app/api/generate-pdf/route.ts:1099`
   - **Code tries to access:**
     ```typescript
     const value = metric === 'reservation_value' 
       ? (item.reservation_value || 0)  // ❌ This field doesn't exist!
       : (item.clicks || 0);
     ```

3. **Data Validation Filters Out Valid Data**
   - **File:** `src/app/api/generate-pdf/route.ts:1053-1059`
   - **Validation logic:**
     ```typescript
     const validData = demographicData.filter(item => 
       item && 
       typeof item === 'object' && 
       (item.age || item.gender) &&      // ✅ These exist
       typeof item.spend === 'number' &&  // ✅ This exists
       item.spend > 0                     // ✅ This works
     );
     ```
   - The data passes validation BUT has no `reservation_value` field

4. **Charts Show Empty/Zero Values**
   - Charts are generated but show zeros because `reservation_value` is undefined
   - Falls back to `clicks` which ARE available, but the primary metric fails

---

## 📊 Data Flow Diagram

```
Meta API getDemographicPerformance()
   ↓
Returns: { age, gender, impressions, clicks, spend, cpm, cpc, ctr }
   ↓
PDF Route: fetchReportData()
   ↓
Assigns to: reportData.metaData.tables.demographicPerformance
   ↓
PDF Generation: generateDemographicChartsHTML()
   ↓
Tries to access: item.reservation_value  ❌ UNDEFINED!
   ↓
Result: Charts show zeros or missing data
```

---

## 🔍 Evidence

### 1. Meta API Query (Current - INCOMPLETE)

**Location:** `src/lib/meta-api-optimized.ts:443`

```typescript
const url = `${this.baseUrl}/${endpoint}?time_range={"since":"${dateStart}","until":"${dateEnd}"}&fields=impressions,clicks,spend,cpm,cpc,ctr&breakdowns=age,gender&limit=500&access_token=${this.accessToken}`;
```

**Missing Fields:**
- `actions` - Contains conversion actions including reservations
- `action_values` - Contains monetary values for conversions
- `conversions` - Alternative conversion field
- `conversion_values` - Alternative conversion value field

### 2. Campaign Query (COMPLETE - For Comparison)

**Location:** `src/lib/meta-api-optimized.ts:326` (getCampaigns method)

```typescript
fields=campaign_id,campaign_name,account_id,status,spend,impressions,clicks,ctr,cpc,reach,actions,action_values,conversions,conversion_values&limit=500
```

**Notice:** Campaign queries include `actions` and `action_values` ✅

### 3. PDF Generation Expectation

**Location:** `src/app/api/generate-pdf/route.ts:1089-1111`

```typescript
const generateChartsForMetric = (metric: 'reservation_value' | 'clicks') => {
  // Process gender data for the specific metric
  const genderMap = new Map();
  validData.forEach(item => {
    let gender = item.gender || 'Nieznane';
    const value = metric === 'reservation_value' 
      ? (item.reservation_value || 0)  // ❌ EXPECTED BUT DOESN'T EXIST
      : (item.clicks || 0);              // ✅ This works as fallback
    genderMap.set(gender, (genderMap.get(gender) || 0) + value);
  });
  // ... same for age groups
};
```

---

## 💡 Solution

### Fix 1: Update Meta API Demographic Query (PRIMARY FIX)

**File:** `src/lib/meta-api-optimized.ts`

**Change the fields parameter** from:
```typescript
fields=impressions,clicks,spend,cpm,cpc,ctr
```

**To:**
```typescript
fields=impressions,clicks,spend,cpm,cpc,ctr,actions,action_values,conversions,conversion_values
```

**Full URL should be:**
```typescript
const url = `${this.baseUrl}/${endpoint}?time_range={"since":"${dateStart}","until":"${dateEnd}"}&fields=impressions,clicks,spend,cpm,cpc,ctr,actions,action_values,conversions,conversion_values&breakdowns=age,gender&limit=500&access_token=${this.accessToken}`;
```

### Fix 2: Add Data Transformation (SECONDARY FIX)

After fetching demographic data, transform it to extract conversion values:

```typescript
// Transform Meta API response to extract conversion metrics
const data = (response.data || []).map(item => {
  // Extract conversion actions
  const actions = item.actions || [];
  const actionValues = item.action_values || [];
  
  // Find reservation-related conversions
  const reservationAction = actions.find(a => 
    a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
    a.action_type === 'offsite_conversion.fb_pixel_complete_registration' ||
    a.action_type === 'omni_purchase'
  );
  
  const reservationValue = actionValues.find(a => 
    a.action_type === 'offsite_conversion.fb_pixel_purchase' ||
    a.action_type === 'offsite_conversion.fb_pixel_complete_registration' ||
    a.action_type === 'omni_purchase'
  );
  
  return {
    ...item,
    reservation_value: parseFloat(reservationValue?.value || '0'),
    reservations: parseInt(reservationAction?.value || '0')
  };
});
```

### Fix 3: Add Fallback in PDF Generation (DEFENSIVE FIX)

**File:** `src/app/api/generate-pdf/route.ts`

Update the validation to check if ANY useful data exists:

```typescript
const validData = demographicData.filter(item => 
  item && 
  typeof item === 'object' && 
  (item.age || item.gender) && 
  typeof item.spend === 'number' && 
  item.spend > 0 &&
  // ✅ Ensure at least one displayable metric exists
  (item.reservation_value > 0 || item.clicks > 0 || item.impressions > 0)
);
```

---

## 🎯 Implementation Priority

1. **HIGH PRIORITY:** Fix Meta API query to include conversion fields
2. **MEDIUM PRIORITY:** Add data transformation logic
3. **LOW PRIORITY:** Add defensive checks in PDF generation

---

## 🧪 Testing Checklist

After implementing the fix:

1. ✅ Check Meta API response includes `actions` and `action_values`
2. ✅ Verify demographic data has `reservation_value` field
3. ✅ Generate a PDF and confirm demographics charts appear
4. ✅ Verify charts show non-zero values for clients with conversions
5. ✅ Check that clicks fallback still works if no conversions exist

---

## 📝 Related Files

- `src/lib/meta-api-optimized.ts:429-456` - getDemographicPerformance()
- `src/app/api/generate-pdf/route.ts:1022-1209` - generateDemographicChartsHTML()
- `src/app/api/generate-pdf/route.ts:2597-2686` - Meta tables fetch
- `src/app/api/fetch-meta-tables/route.ts:77-81` - API endpoint for meta tables

---

## 🔗 Cross-References

Similar conversion handling exists in:
- Campaign queries: `src/lib/meta-api-optimized.ts:326`
- Google Ads demographics: `src/lib/google-ads-api.ts:636-887`
- Standardized data fetcher: `src/lib/standardized-data-fetcher.ts`

---

**Next Steps:** Implement Fix 1 (primary fix) to add conversion fields to the demographic query.


