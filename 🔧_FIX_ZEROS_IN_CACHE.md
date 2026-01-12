# 🔧 Fix: Google Ads Cache Storing Zeros

**Issue:** Cache is being updated (last update: 2026-01-02 16:03:04) but storing zeros  
**Status:** ✅ Cron job working, ❌ API returning zeros

---

## 🎯 **ROOT CAUSE**

The cron job IS running and IS storing data, but `getCampaignData()` is returning campaigns with zeros.

**Possible causes:**
1. **Wrong date range** - Querying dates with no data
2. **API returning empty campaigns** - Campaigns exist but no spend for period
3. **Date calculation error** - `getCurrentMonthInfo()` returning wrong dates
4. **Silent API failure** - API succeeds but returns zeros

---

## 🔍 **DIAGNOSTIC STEPS**

### **Step 1: Check What Date Range is Being Used**

The cache refresh uses `getCurrentMonthInfo()`. Let's verify it's correct:

```sql
-- Check what the current month period should be
SELECT 
  TO_CHAR(CURRENT_DATE, 'YYYY-MM') as current_month_period,
  DATE_TRUNC('month', CURRENT_DATE)::date as month_start,
  (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date as month_end;
```

**Expected for January 2026:**
- `current_month_period`: `2026-01`
- `month_start`: `2026-01-01`
- `month_end`: `2026-01-31`

---

### **Step 2: Check What's Actually in the Cache**

```sql
-- Check the cache data structure
SELECT 
  period_id,
  (cache_data->'period'->>'startDate')::text as cache_start_date,
  (cache_data->'period'->>'endDate')::text as cache_end_date,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  jsonb_array_length(COALESCE(cache_data->'campaigns', '[]'::jsonb)) as campaign_count,
  -- Check if campaigns exist but have zeros
  (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(cache_data->'campaigns', '[]'::jsonb)) 
   WHERE (value->>'spend')::numeric > 0) as campaigns_with_spend
FROM google_ads_current_month_cache
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
```

**What to look for:**
- Are the dates correct?
- How many campaigns are there?
- Do any campaigns have spend > 0?

---

### **Step 3: Manually Test the API Call**

Test if the API returns data for the current month:

```bash
# Test the Google Ads API directly
curl -X POST https://your-domain.com/api/fetch-google-ads-live-data \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "93d46876-addc-4b99-b1e1-437428dd54f1",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }'
```

**Check the response:**
- Does it return campaigns?
- Do campaigns have spend > 0?
- Are the dates correct?

---

### **Step 4: Check System Settings**

The cache refresh needs these settings:

```sql
SELECT 
  key,
  CASE 
    WHEN value IS NOT NULL THEN '✅ Set'
    ELSE '❌ Missing'
  END as status
FROM system_settings
WHERE key IN (
  'google_ads_client_id',
  'google_ads_client_secret',
  'google_ads_developer_token',
  'google_ads_manager_refresh_token',
  'google_ads_manager_customer_id'
);
```

**All must be set!**

---

## 🛠️ **MOST LIKELY FIXES**

### **Fix 1: Date Range Issue** ⚠️ **MOST LIKELY**

If `getCurrentMonthInfo()` is calculating dates incorrectly:

**Check the function:**
```typescript
// In google-ads-smart-cache-helper.ts
const currentMonth = getCurrentMonthInfo();
// Should return:
// { startDate: '2026-01-01', endDate: '2026-01-31', periodId: '2026-01' }
```

**If dates are wrong, the API will return zeros for that period.**

---

### **Fix 2: API Returning Zeros for Current Month**

If January 2026 just started, there might not be data yet. But if it's January 2nd and you have data when fetching manually, then:

**Check if manual fetch uses different dates:**
- Manual fetch might use a different date range
- Manual fetch might use historical data
- Manual fetch might use a different API endpoint

---

### **Fix 3: Silent API Failure**

The API might be failing but returning empty campaigns instead of throwing an error.

**Check logs for:**
- API errors
- Validation failures
- Credential issues

---

## 🎯 **IMMEDIATE ACTION**

1. **Run this SQL to check cache structure:**
```sql
SELECT 
  period_id,
  (cache_data->'period'->>'startDate')::text as start_date,
  (cache_data->'period'->>'endDate')::text as end_date,
  jsonb_array_length(COALESCE(cache_data->'campaigns', '[]'::jsonb)) as campaign_count,
  (SELECT COUNT(*) FROM jsonb_array_elements(COALESCE(cache_data->'campaigns', '[]'::jsonb)) 
   WHERE (value->>'spend')::numeric > 0) as campaigns_with_data
FROM google_ads_current_month_cache
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND period_id = '2026-01';
```

2. **Manually trigger a refresh with force:**
```bash
curl -X POST https://your-domain.com/api/google-ads-smart-cache \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "93d46876-addc-4b99-b1e1-437428dd54f1",
    "forceRefresh": true
  }'
```

3. **Check the response:**
- Does it return data?
- What dates does it use?
- What campaigns does it return?

---

## 💡 **KEY INSIGHT**

**The cron job is working correctly!** The issue is that the API call (`getCampaignData()`) is returning zeros.

**This could mean:**
- ✅ Cron job runs
- ✅ Fetches from API
- ❌ API returns zeros (wrong dates, no data, or API issue)
- ✅ Stores zeros in cache

**The fix is to figure out why the API returns zeros when called by the cron job, but works when called manually.**

---

## 📋 **CHECKLIST**

- [ ] Check date range in cache (`startDate`, `endDate`)
- [ ] Check if campaigns exist in cache
- [ ] Check if any campaigns have spend > 0
- [ ] Manually test API with same dates
- [ ] Compare manual fetch vs automatic fetch
- [ ] Check system settings
- [ ] Check API logs for errors

**Share the results and we'll pinpoint the exact issue!**

