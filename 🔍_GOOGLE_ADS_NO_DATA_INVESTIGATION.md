# 🔍 Google Ads Data Investigation

## Issue Report
**Date:** January 2, 2026  
**Problem:** No Google Ads data visible in cache or stored data

---

## What We Changed

### Code Changes (Labels Only - No Data Logic):
1. ✅ **Number Formatting** - Removed "K" and "M" abbreviations
2. ✅ **Label Update** - Changed "Łączna wartość konwersji" to "Łączna wartość rezerwacji" for Google Ads
3. ✅ **Pattern Matching** - Verified PBM conversion names are correctly identified
4. ✅ **Documentation** - Updated to reflect PBM patterns

**⚠️ IMPORTANT: We did NOT change any data fetching logic!**

---

## Possible Reasons for No Data

### 1. Cache is Empty/Expired
**Check:**
```sql
SELECT * FROM google_ads_current_month_cache 
WHERE period_id = '2025-01' 
ORDER BY last_updated DESC;
```

**What this means:**
- Cache should refresh every 3 hours
- If cache is empty, first user will trigger API call
- If cache is old, data is stale

### 2. Database Storage Empty
**Check:**
```sql
SELECT * FROM campaign_summaries 
WHERE platform = 'google' 
  AND summary_date >= '2025-01-01'
ORDER BY last_updated DESC;
```

**What this means:**
- Historical data stored here
- If empty, background collection may not have run

### 3. Live API Not Fetching
**Possible causes:**
- Google Ads API credentials expired
- No refresh token available
- API rate limits hit
- Network issues

---

## Investigation Steps

### Step 1: Check if Dev Server is Running
```bash
# Check if Next.js dev server is running
ps aux | grep "next dev"
```

### Step 2: Check Database for Google Ads Data
Run the SQL query we created:
```bash
psql $DATABASE_URL -f check-google-data.sql
```

### Step 3: Check Google Ads API Credentials
```sql
SELECT 
  client_name,
  google_ads_customer_id,
  google_ads_refresh_token IS NOT NULL as has_refresh_token,
  google_ads_developer_token IS NOT NULL as has_dev_token
FROM clients 
WHERE google_ads_customer_id IS NOT NULL;
```

### Step 4: Try Manual Refresh
```bash
# This will fetch fresh data from Google Ads API
curl -X POST http://localhost:3000/api/google-ads-smart-cache \
  -H "Content-Type: application/json" \
  -d '{"clientId": "YOUR_CLIENT_ID", "forceRefresh": true}'
```

---

## Quick Diagnosis Checklist

- [ ] Dev server is running (`npm run dev`)
- [ ] Database connection working
- [ ] Google Ads credentials configured
- [ ] Cache tables exist (`google_ads_current_month_cache`)
- [ ] Storage tables exist (`campaign_summaries`, `daily_kpi_data`)
- [ ] API routes accessible
- [ ] No console errors in browser
- [ ] No errors in terminal logs

---

## What to Do Next

1. **First, check if server is running:**
   ```bash
   cd /Users/macbook/piotr
   npm run dev
   ```

2. **Open browser dev tools** (F12) and check:
   - Network tab for API calls
   - Console tab for errors
   - Look for calls to `/api/platform-separated-metrics` or similar

3. **Check terminal logs** for errors when loading the page

4. **Try force refresh:**
   - Hard refresh browser (Cmd+Shift+R on Mac)
   - Clear browser cache
   - Incognito/private window

---

## Likely Scenarios

### Scenario A: Cache is Working, Frontend Not Reading
**Symptom:** Data in database but not showing in UI
**Fix:** Check browser console, rebuild frontend

### Scenario B: Cache is Empty
**Symptom:** No data in `google_ads_current_month_cache`
**Fix:** First page load will trigger API call, wait 3-5 seconds

### Scenario C: API Credentials Issue
**Symptom:** Errors in terminal about Google Ads authentication
**Fix:** Update Google Ads refresh token in database

### Scenario D: Background Collection Not Running
**Symptom:** Old data or no historical data
**Fix:** Run `./scripts/run-google-ads-refresh.sh` (you aborted this earlier!)

---

## Recovery Steps

### If you need fresh data:

1. **Run the refresh script** (you aborted it earlier):
   ```bash
   cd /Users/macbook/piotr
   ./scripts/run-google-ads-refresh.sh
   ```
   - This will backup existing data
   - Delete old Google Ads summaries
   - Re-fetch from Google Ads API
   - Store fresh data

2. **Or manually trigger cache refresh:**
   ```bash
   # From the project directory
   curl -X POST http://localhost:3000/api/automated/refresh-google-ads-current-month-cache
   ```

---

## Next Steps for User

**Please provide:**
1. Is your dev server running? (`npm run dev`)
2. Any errors in browser console?
3. Any errors in terminal?
4. Which client/hotel are you viewing?
5. Should we run the refresh script you aborted earlier?

