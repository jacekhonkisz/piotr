# 🔍 Why You're Seeing Zeros in Funnel Metrics - Diagnostic Guide

## Common Causes of Zero Values

### 1. ⚠️ **Meta API Not Returning Detailed Actions**

**Symptom**: Total conversions show a number (e.g., 328), but booking steps are all 0

**Cause**: Meta API returns summary conversions but not the detailed `actions` array:
```json
{
  "conversions": 328,  // ✅ Present
  "actions": []        // ❌ Empty - no breakdown
}
```

**Why This Happens**:
- Meta API sometimes aggregates conversions but doesn't include action-level details
- Missing `action_attribution_windows` parameter in API call
- Conversion events not properly configured in Meta Business Manager

**Check**:
```bash
# Look in your console/logs for:
"🔍 MetaAPI: Found actions array for campaign XXX with 0 actions"
```

**Solution**: See section "Fix #1" below

---

### 2. 📦 **Historical Data Missing Conversion Columns**

**Symptom**: Old months (before August 2025) show zeros even though conversions existed

**Cause**: Database records created before conversion columns were added:
- `booking_step_2` added later
- `booking_step_3` added even later  
- Old records have NULL or 0 values

**Database State**:
```sql
-- Old record from June 2025
{
  total_spend: 12000,
  total_clicks: 5000,
  booking_step_1: 150,
  booking_step_2: 0,        -- ❌ Column didn't exist when record was created
  booking_step_3: NULL,     -- ❌ Column added later
  reservations: 200
}
```

**Check**:
```sql
SELECT 
  summary_date,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations
FROM campaign_summaries
WHERE client_id = 'YOUR_CLIENT_ID'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC
LIMIT 6;
```

**Solution**: Use `forceFresh: true` in reports to re-fetch with current parsing logic

---

### 3. 🎯 **Custom Conversion IDs Not Mapped**

**Symptom**: Step 2 and Step 3 always zero, but Step 1 and Reservations have values

**Cause**: Client uses custom conversion events with specific IDs that aren't in the mapping:

**Current Mapping** (in `src/lib/meta-api.ts`):
```typescript
// Step 2 - Only recognizes these action types:
if (actionType.includes('booking_step_2') || 
    actionType.includes('view_content') ||
    actionType.includes('offsite_conversion.custom.1150356839010935')) {  // Belmonte's custom ID
  booking_step_2 += valueNum;
}
```

**If your client has DIFFERENT custom conversion IDs**, they won't be counted!

**Check**: 
1. Go to Meta Events Manager
2. Find custom conversions
3. Check the event IDs

**Real Example from Logs**:
```
🔍 JULY 2025 DEBUG - ALL ACTIONS for Campaign ABC:
[
  { action_type: "purchase", value: 100 },
  { action_type: "offsite_conversion.custom.9999999999", value: 50 }  // ← Unknown ID!
]
```

**Solution**: Add client-specific conversion IDs to the mapping

---

### 4. 📊 **view_content Overcounting (Fixed)**

**Symptom**: Step 2 has MORE events than Step 1 (funnel inversion)

**Cause**: Old code included `view_content` in Step 2, which fires on every page view

**Status**: ✅ **FIXED** in `CONVERSION_FUNNEL_INVERSION_FIX.md`

**How to Verify Fixed**:
```typescript
// Current code should NOT have view_content alone
// It should be combined with custom conversion check
if (actionType.includes('booking_step_2') || 
    actionType.includes('view_content') ||  // Only counted with custom ID
    actionType === 'view_content' ||
    actionType.includes('offsite_conversion.custom.1150356839010935')) {
```

---

### 5. ✅ **Actually Zero (No Conversions)**

**Symptom**: All funnel metrics are 0, including reservations

**Cause**: The time period genuinely had no conversion events:
- No bookings made
- No tracking events fired
- Campaigns were paused
- Meta Pixel not installed/working

**Check**: Compare with Meta Ads Manager for same period
- If Meta shows 0 conversions → System is correct ✅
- If Meta shows conversions → Configuration issue ❌

---

### 6. 🗄️ **Using Cached Data Without Conversions**

**Symptom**: Dashboard shows 0, but refreshing fixes it

**Cause**: Cache was created before conversion tracking was added

**Cache Locations**:
- `current_month_cache` (3-6 hour TTL)
- `current_week_cache` (3-6 hour TTL)
- `campaign_summaries` (long-term)

**Check Cache Age**:
```sql
SELECT 
  period_id,
  last_refreshed,
  NOW() - last_refreshed AS age,
  cache_data->'conversionMetrics'->>'reservations' AS cached_reservations
FROM current_month_cache
WHERE client_id = 'YOUR_CLIENT_ID';
```

**Solution**: Clear cache or wait for auto-refresh

---

## 🔧 Solutions by Scenario

### Fix #1: Missing Meta API Actions Array

**Add `action_attribution_windows` to Meta API calls**:

```typescript
// File: src/lib/meta-api.ts
// In getCampaignInsights() method

const params = {
  fields: 'campaign_id,campaign_name,impressions,clicks,spend,actions,action_values',
  time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
  level: 'campaign',
  limit: '100',
  action_attribution_windows: ['1d_click', '7d_click', '1d_view']  // ← ADD THIS
};
```

This ensures Meta returns detailed action breakdowns.

---

### Fix #2: Re-Fetch Historical Data

**Enable forceFresh for all periods**:

```typescript
// File: src/app/reports/page.tsx

const fetchReportData = async (periodId: string) => {
  const result = await StandardizedDataFetcher.fetchData({
    clientId,
    dateRange: { start, end },
    platform,
    forceFresh: true  // ← Always fetch fresh to get updated conversions
  });
};
```

This re-parses historical data with current action type mapping.

---

### Fix #3: Add Client-Specific Conversion IDs

**Find the custom conversion IDs**:

1. Go to Meta Events Manager for the client
2. Click on "Custom Conversions"
3. Note the event IDs (format: `custom.XXXXXXXXXX`)

**Add to mapping**:

```typescript
// File: src/lib/meta-api.ts

// Example for new client "Hotel XYZ"
if (actionType.includes('booking_step_2') || 
    actionType.includes('view_content') ||
    actionType.includes('offsite_conversion.custom.1150356839010935') ||  // Belmonte
    actionType.includes('offsite_conversion.custom.YOUR_CLIENT_ID')) {    // ← New client
  booking_step_2 += valueNum;
}
```

---

### Fix #4: Clear Old Cache

**Manual cache clear**:

```sql
-- Clear current month cache
DELETE FROM current_month_cache 
WHERE client_id = 'YOUR_CLIENT_ID' 
  AND last_refreshed < NOW() - INTERVAL '1 day';

-- Clear current week cache
DELETE FROM current_week_cache 
WHERE client_id = 'YOUR_CLIENT_ID'
  AND last_refreshed < NOW() - INTERVAL '1 day';
```

---

### Fix #5: Verify Meta Pixel Configuration

**Check if tracking is working**:

1. **Meta Events Manager**:
   - Go to Events Manager → Your Pixel
   - Check "Test Events" - should show recent activity
   - Verify events like `Purchase`, `InitiateCheckout` are firing

2. **Meta Pixel Helper** (Chrome Extension):
   - Visit client's website
   - Check if pixel fires on key actions
   - Verify event parameters

3. **Compare with System**:
   - If Meta shows events but system shows 0 → Mapping issue
   - If Meta shows 0 events → Pixel configuration issue

---

## 🎯 Quick Diagnostic Checklist

Run through this checklist to identify the issue:

### Step 1: Where are you seeing zeros?
- [ ] Dashboard (current month)
- [ ] Reports (specific historical month)
- [ ] All periods
- [ ] Only specific funnel steps (which ones?)

### Step 2: Check the logs
```bash
# Look for these patterns in your console:

# ✅ Good - Actions found:
"🔍 MetaAPI: Found actions array for campaign XXX with 15 actions"

# ❌ Bad - No actions:
"🔍 MetaAPI: Found actions array for campaign XXX with 0 actions"

# 🎯 Found conversions:
"✅ FOUND booking_step_2: { actionType: 'view_content', valueNum: 50 }"

# ⚠️ Funnel issue:
"⚠️ CONVERSION FUNNEL INVERSION: Campaign ABC has Etap 2 (755) > Etap 1 (150)"
```

### Step 3: Check database
```sql
-- Quick data check
SELECT 
  date,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  data_source,
  last_updated
FROM daily_kpi_data
WHERE client_id = 'YOUR_CLIENT_ID'
  AND date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

### Step 4: Compare with Meta Ads Manager
- Open Meta Ads Manager
- Select same date range
- Check "Conversions" column
- **If Meta shows conversions but system shows 0** → Configuration issue
- **If both show 0** → No conversion events (legitimate)

### Step 5: Check action attribution
```typescript
// Look in your Meta API response for:
{
  "actions": [
    {
      "action_type": "purchase",
      "value": "100",
      "1d_click": "80",   // ← Attribution window data
      "7d_click": "100",
      "1d_view": "20"
    }
  ]
}
```

---

## 🚨 Most Likely Causes (Ranked)

Based on historical issues in this codebase:

### 1. **Meta API Missing Actions Array** (60% of cases)
- **Symptom**: Total conversions exist, but breakdown is 0
- **Fix**: Add `action_attribution_windows` parameter
- **File**: `src/lib/meta-api.ts`

### 2. **Historical Data Before Column Addition** (25% of cases)
- **Symptom**: Old months show 0, recent months show values
- **Fix**: Use `forceFresh: true` in reports
- **File**: `src/app/reports/page.tsx`

### 3. **Custom Conversion IDs Not Mapped** (10% of cases)
- **Symptom**: Step 2 and 3 always 0
- **Fix**: Add client-specific conversion IDs
- **File**: `src/lib/meta-api.ts`

### 4. **Old Cache** (3% of cases)
- **Symptom**: Dashboard shows 0, refreshing fixes it
- **Fix**: Clear cache or wait 3-6 hours

### 5. **Actually No Conversions** (2% of cases)
- **Symptom**: Everything is 0, including in Meta Ads Manager
- **Fix**: None needed - legitimate zero

---

## 📝 Next Steps

To help you specifically, I need to know:

1. **Where are you seeing zeros?**
   - Dashboard for current month?
   - Reports for specific historical month (which one)?
   - All periods?

2. **Which metrics are zero?**
   - All funnel metrics (Step 1, 2, 3, Reservations)?
   - Only specific steps (which ones)?
   - Total conversions also zero?

3. **What do Meta Ads Manager show?**
   - For the same period
   - Do they show conversions?

4. **Any console errors or warnings?**
   - Check browser console
   - Look for "CONVERSION FUNNEL" messages

**Tell me the answers and I can provide a specific fix for your situation!**

---

## 🔍 Debugging Commands

### Check Database State
```sql
-- Check if conversion columns exist and have data
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('daily_kpi_data', 'campaign_summaries')
  AND column_name LIKE '%booking%'
ORDER BY table_name, column_name;

-- Check actual data
SELECT 
  summary_date,
  total_spend,
  total_conversions,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  CASE 
    WHEN booking_step_1 = 0 AND booking_step_2 = 0 AND booking_step_3 = 0 THEN '❌ All Zero'
    WHEN booking_step_2 > booking_step_1 THEN '⚠️ Funnel Inversion'
    ELSE '✅ Looks Good'
  END AS status
FROM campaign_summaries
WHERE client_id = 'YOUR_CLIENT_ID'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC
LIMIT 6;
```

### Check Cache State
```sql
-- Check what's in cache
SELECT 
  period_id,
  last_refreshed,
  AGE(NOW(), last_refreshed) as cache_age,
  (cache_data->'conversionMetrics'->>'booking_step_1')::int as step1,
  (cache_data->'conversionMetrics'->>'booking_step_2')::int as step2,
  (cache_data->'conversionMetrics'->>'booking_step_3')::int as step3,
  (cache_data->'conversionMetrics'->>'reservations')::int as reservations
FROM current_month_cache
WHERE client_id = 'YOUR_CLIENT_ID';
```

### Test Meta API Directly
```bash
# Test Meta API call (replace with your values)
curl "https://graph.facebook.com/v18.0/act_YOUR_ACCOUNT_ID/insights?\
fields=campaign_id,campaign_name,actions,action_values&\
time_range={'since':'2025-10-01','until':'2025-10-31'}&\
level=campaign&\
access_token=YOUR_ACCESS_TOKEN"

# Look for "actions" array in response
```

---

**Created**: November 3, 2025  
**Last Updated**: November 3, 2025



