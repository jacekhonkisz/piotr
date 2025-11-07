# ✅ Automated Data Collection System - Complete Setup

## 🎯 Overview

The system now **automatically collects data for ALL clients** (both existing and new) for both Meta and Google Ads platforms.

---

## 🤖 Automated Cron Jobs

### **1. Weekly Collection** 
📅 **Schedule:** Every Monday at 2:00 AM  
🔗 **Endpoint:** `/api/automated/collect-weekly-summaries`  
⏱️ **Frequency:** Weekly

**What it does:**
- ✅ Fetches **ALL active clients** from database
- ✅ Collects **53 weeks** of historical data + current week
- ✅ **Both platforms:** Meta Ads + Google Ads (if enabled)
- ✅ Stores in `campaign_summaries` with proper platform separation
- ✅ Includes conversion metrics, campaign data, and tables

**Vercel cron config:**
```json
{
  "path": "/api/automated/collect-weekly-summaries",
  "schedule": "0 2 * * 1"
}
```

---

### **2. Monthly Collection**
📅 **Schedule:** Every Sunday at 11:00 PM  
🔗 **Endpoint:** `/api/automated/collect-monthly-summaries`  
⏱️ **Frequency:** Weekly (collects all months)

**What it does:**
- ✅ Fetches **ALL active clients** from database
- ✅ Collects **12 months** of historical data
- ✅ **Both platforms:** Meta Ads + Google Ads (if enabled)
- ✅ Stores in `campaign_summaries` with proper platform separation
- ✅ Includes conversion metrics, campaign data, and tables

**Vercel cron config:**
```json
{
  "path": "/api/automated/collect-monthly-summaries",
  "schedule": "0 23 * * 0"
}
```

---

### **3. Current Period Smart Caching**
📅 **Schedule:** Every 3 hours (staggered)  
⏱️ **Frequency:** 8 times per day

**Cron jobs:**
```json
// Meta current month cache - Every 3 hours at :05
{ "path": "/api/automated/refresh-current-month-cache", "schedule": "5 */3 * * *" }

// Meta current week cache - Every 3 hours at :10
{ "path": "/api/automated/refresh-current-week-cache", "schedule": "10 */3 * * *" }

// Google Ads current month cache - Every 3 hours at :15
{ "path": "/api/automated/refresh-google-ads-current-month-cache", "schedule": "15 */3 * * *" }

// Google Ads current week cache - Every 3 hours at :20
{ "path": "/api/automated/refresh-google-ads-current-week-cache", "schedule": "20 */3 * * *" }
```

**What it does:**
- ✅ Refreshes current period data from live APIs
- ✅ Both platforms (Meta + Google)
- ✅ Both periods (weekly + monthly)
- ✅ Ensures fresh data for dashboards and reports

---

### **4. Data Archival**
📅 **Schedule:** Monthly + Weekly archival  

**Monthly Archival:**
```json
// 1st of month at 2:30 AM - After collection completes
{ "path": "/api/automated/archive-completed-months", "schedule": "30 2 1 * *" }
```

**Weekly Archival:**
```json
// Every Monday at 3:00 AM - After weekly collection
{ "path": "/api/automated/archive-completed-weeks", "schedule": "0 3 * * 1" }
```

**What it does:**
- ✅ Moves completed periods from cache to `campaign_summaries`
- ✅ Both platforms (Meta + Google)
- ✅ Cleans up old cache entries
- ✅ Ensures historical data is preserved

---

## 🆕 New Client Onboarding

### **Automatic Historical Data Initialization**

**Trigger:** When a new client is created via `/api/clients` POST

**What happens:**
```typescript
// In /api/clients/route.ts (POST handler)
collector.collectMonthlySummariesForSingleClient(newClient.id);
collector.collectWeeklySummariesForSingleClient(newClient.id);
```

**Data collected:**
- ✅ **Last 12 months** (Meta + Google if configured)
- ✅ **Last 53 weeks** (Meta + Google if configured)
- ✅ Runs in **background** (non-blocking)
- ✅ Complete historical data immediately available

**Timeline:**
- Client creation: Instant (< 1 second)
- Historical data collection: 5-10 minutes (background)
- Result: New clients see full year of data within 10 minutes

---

## 📊 Data Coverage Summary

### **For Each Client:**

| Data Type | Coverage | Platforms | Frequency |
|-----------|----------|-----------|-----------|
| **Weekly** | 53 weeks (1 year + 1 week) | Meta + Google | Every Monday |
| **Monthly** | 12 months | Meta + Google | Every Sunday |
| **Current Week Cache** | Live data | Meta + Google | Every 3 hours |
| **Current Month Cache** | Live data | Meta + Google | Every 3 hours |

### **Platform Separation:**
- ✅ `platform='meta'` for Meta Ads data
- ✅ `platform='google'` for Google Ads data
- ✅ `data_source='meta_api'` or `'google_ads_api'`
- ✅ Unique constraint: `(client_id, summary_type, summary_date, platform)`

---

## 🔄 Complete Data Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    NEW CLIENT CREATED                        │
│                                                              │
│  Immediate:  Client record in database                      │
│  Background: Historical data collection starts (12m + 53w)  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               ONGOING DATA COLLECTION                        │
│                                                              │
│  Current Periods:  Smart cache (every 3 hours)              │
│  Weekly History:   Monday 2 AM (53 weeks)                   │
│  Monthly History:  Sunday 11 PM (12 months)                 │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  DATA ARCHIVAL                               │
│                                                              │
│  Completed Weeks:  Monday 3 AM → campaign_summaries         │
│  Completed Months: 1st @ 2:30 AM → campaign_summaries       │
│  Cache Cleanup:    Remove archived entries                  │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Verification

### **Check that automation is working:**

**1. Check Weekly Data:**
```bash
node scripts/check-google-weekly-data.js
```

Expected: 53+ weeks for both Meta and Google

**2. Check Database:**
```sql
SELECT 
  platform,
  summary_type,
  COUNT(*) as records,
  MIN(summary_date) as earliest,
  MAX(summary_date) as latest,
  data_source
FROM campaign_summaries
WHERE client_id = 'YOUR_CLIENT_ID'
GROUP BY platform, summary_type, data_source
ORDER BY platform, summary_type;
```

**3. Check Cron Jobs (Vercel Dashboard):**
- Go to Vercel Project → Settings → Cron Jobs
- Verify all jobs are scheduled and running
- Check execution logs for errors

---

## 📝 Manual Triggers

### **For Testing or Backfilling:**

**Trigger weekly collection for all clients:**
```bash
curl -X POST https://your-domain.com/api/automated/collect-weekly-summaries
```

**Trigger monthly collection for all clients:**
```bash
curl -X POST https://your-domain.com/api/automated/collect-monthly-summaries
```

**Trigger for specific client:**
```bash
# Weekly
curl -X POST https://your-domain.com/api/admin/collect-weekly-data \
  -H "Content-Type: application/json" \
  -d '{"clientId": "CLIENT_ID"}'

# Monthly
curl -X POST https://your-domain.com/api/admin/collect-monthly-data \
  -H "Content-Type: application/json" \
  -d '{"clientId": "CLIENT_ID"}'
```

---

## 🎯 Production Checklist

✅ **Automated Collection:**
- [x] Weekly summaries (53 weeks) - Every Monday 2 AM
- [x] Monthly summaries (12 months) - Every Sunday 11 PM
- [x] Both Meta and Google Ads
- [x] All clients processed automatically

✅ **Smart Caching:**
- [x] Current week refresh - Every 3 hours
- [x] Current month refresh - Every 3 hours
- [x] Both Meta and Google Ads

✅ **Data Archival:**
- [x] Weekly archival - Every Monday 3 AM
- [x] Monthly archival - 1st of month 2:30 AM
- [x] Both Meta and Google Ads

✅ **New Client Onboarding:**
- [x] Automatic historical data initialization
- [x] 12 months + 53 weeks collected
- [x] Both Meta and Google Ads

✅ **Data Integrity:**
- [x] Platform separation (meta vs google)
- [x] Correct data sources
- [x] Unique constraints prevent duplicates
- [x] All records validated

---

## 🚀 System Status: PRODUCTION READY

**✅ Complete automation for:**
- All existing clients
- All new clients (auto-initialized)
- Both Meta and Google Ads platforms
- Both weekly and monthly summaries
- Current period smart caching
- Historical data archival

**📊 Data Coverage:**
- Weekly: 53 weeks (1 year + 1 week buffer)
- Monthly: 12 months (full year)
- Current periods: Live cache (3-hour refresh)

**🔄 Lifecycle:**
- Collection → Caching → Archival → Display
- Fully automated, no manual intervention required

---

## 📞 Support

**If data is missing:**
1. Check Vercel cron job logs
2. Check application logs for errors
3. Manually trigger collection for specific client
4. Verify client has valid API tokens/credentials

**Files to check:**
- `/Users/macbook/piotr/src/lib/background-data-collector.ts` - Main collection logic
- `/Users/macbook/piotr/src/app/api/automated/collect-weekly-summaries/route.ts` - Weekly automation
- `/Users/macbook/piotr/src/app/api/automated/collect-monthly-summaries/route.ts` - Monthly automation
- `/Users/macbook/piotr/vercel.json` - Cron schedule configuration

