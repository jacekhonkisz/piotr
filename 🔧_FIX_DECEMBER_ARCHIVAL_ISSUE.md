# 🔧 Fix December 2025 Archival Issue

**Problem:** December 2025 had real data, but was archived with zeros instead of the final values  
**Root Cause:** December cache had zeros when archival job ran on January 1st  
**Impact:** December historical data is permanently stored as zeros

---

## 🎯 **THE REAL ISSUE**

**What happened:**
1. **December 1-31:** Google Ads cache had zeros (token was missing)
2. **Token added:** Refresh token was added (date unknown)
3. **December 31:** Cache was NOT refreshed with final December data
4. **January 1, 2:30 AM:** Archival job ran and archived zeros from cache
5. **Result:** December permanently stored as zeros in `campaign_summaries`

**Why Meta worked:**
- Meta cache was refreshed throughout December
- December 31st cache had real data
- Archival job archived real data ✅

**Why Google didn't:**
- Google cache had zeros throughout December
- Cache was NOT refreshed at end of December (even after token added)
- Archival job archived zeros ❌

---

## 🔍 **DIAGNOSTIC STEPS**

### **Step 1: Check What Was Actually Archived**

Run `CHECK_DECEMBER_ARCHIVAL_ISSUE.sql` to see:
- What's in `campaign_summaries` for December (archived data)
- What's in `google_ads_campaigns` for December (real data source)
- When the cache was last updated
- When the token was added

---

### **Step 2: Check If December Data Exists in Database**

The real December data might be in `google_ads_campaigns` table:

```sql
SELECT 
  date_range_start,
  COUNT(*) as campaigns,
  SUM(spend)::numeric as total_spend,
  SUM(reservations) as reservations
FROM google_ads_campaigns
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND date_range_start >= '2025-12-01'
  AND date_range_start <= '2025-12-31'
GROUP BY date_range_start
ORDER BY date_range_start DESC;
```

**If this shows real data:** We can backfill `campaign_summaries` from this!

---

## 🛠️ **THE FIX**

### **Fix 1: Backfill December Data from Database**

If December data exists in `google_ads_campaigns`, we can recreate the summary:

```sql
-- Aggregate December data from google_ads_campaigns
WITH december_data AS (
  SELECT 
    '2025-12-01'::date as summary_date,
    SUM(spend)::numeric as total_spend,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(booking_step_1) as booking_step_1,
    SUM(booking_step_2) as booking_step_2,
    SUM(booking_step_3) as booking_step_3,
    SUM(reservations) as reservations,
    SUM(reservation_value)::numeric as reservation_value,
    COUNT(DISTINCT campaign_id) as total_campaigns,
    COUNT(DISTINCT CASE WHEN status = 'ENABLED' THEN campaign_id END) as active_campaigns
  FROM google_ads_campaigns
  WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
    AND date_range_start >= '2025-12-01'
    AND date_range_start <= '2025-12-31'
)
-- Update campaign_summaries with real data
UPDATE campaign_summaries cs
SET 
  total_spend = dd.total_spend,
  total_impressions = dd.total_impressions,
  total_clicks = dd.total_clicks,
  booking_step_1 = dd.booking_step_1,
  booking_step_2 = dd.booking_step_2,
  booking_step_3 = dd.booking_step_3,
  reservations = dd.reservations,
  reservation_value = dd.reservation_value,
  total_campaigns = dd.total_campaigns,
  active_campaigns = dd.active_campaigns,
  data_source = 'manual_backfill_from_google_ads_campaigns',
  last_updated = NOW()
FROM december_data dd
WHERE cs.client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND cs.summary_date = '2025-12-01'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly';
```

---

### **Fix 2: Backfill from Google Ads API (If Database Doesn't Have Data)**

If `google_ads_campaigns` doesn't have December data, fetch from Google Ads API:

```typescript
// Fetch December 2025 historical data
const decemberData = await googleAdsService.getCampaignData(
  '2025-12-01',
  '2025-12-31'
);

// Aggregate and store in campaign_summaries
// (Similar to archival logic but for past month)
```

---

### **Fix 3: Prevent Future Issues - End-of-Month Cache Refresh**

Add a cron job to refresh cache at end of month:

```json
// Add to vercel.json
{
  "path": "/api/automated/refresh-month-end-cache",
  "schedule": "0 23 28-31 * *"  // Run at 11 PM on last 4 days of month
}
```

**This job should:**
1. Check if it's the last day of month
2. Force refresh current month cache for all clients
3. Ensure final data is cached before archival runs

---

## 📋 **ACTION PLAN**

### **Immediate (Fix December):**

1. **Run diagnostic SQL** (`CHECK_DECEMBER_ARCHIVAL_ISSUE.sql`)
2. **Check if December data exists in `google_ads_campaigns`**
3. **If yes:** Run backfill SQL to update `campaign_summaries`
4. **If no:** Fetch from Google Ads API and store

### **Short-term (Prevent Future):**

1. **Add end-of-month cache refresh job**
2. **Add pre-archival data quality check**
3. **Alert if cache has zeros before archival**

### **Long-term (Monitoring):**

1. **Monitor cache refresh success rate**
2. **Alert if cache not refreshed in last 24 hours**
3. **Alert if cache has zeros for active campaigns**

---

## 🎯 **KEY INSIGHT**

**The problem is timing:**

- ✅ Archival job works correctly
- ✅ Cache refresh works correctly
- ❌ Cache wasn't refreshed at end of December
- ❌ Archival archived stale (zero) data

**Solution:**
1. **Immediate:** Backfill December from database or API
2. **Prevention:** Add end-of-month cache refresh
3. **Monitoring:** Alert on data quality issues

---

## 💡 **WHY THIS HAPPENED**

**Timeline:**
```
December 1-30: Token missing → Cache has zeros
December 31: Token added, but cache NOT refreshed
January 1, 2:30 AM: Archival runs → Archives zeros
Result: December permanently stored as zeros
```

**Meta worked because:**
- Token was valid throughout December
- Cache was refreshed regularly
- Final cache had real data

**Google didn't because:**
- Token was missing most of December
- Cache had zeros
- Cache wasn't refreshed at end of month
- Archival archived zeros

---

**Run the diagnostic SQL first to see what data we have available for backfilling!**

