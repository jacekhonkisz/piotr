# 🤖 Automated Monthly Data Collection System

**Date:** October 2, 2025  
**Goal:** Ensure every client (current & future) has monthly data saved automatically when each month ends  
**Status:** 🔧 BUILDING

---

## 🎯 System Requirements

### **What We Need:**

1. ✅ **Automatic Monthly Save:** When month ends → Save all client data
2. ✅ **Rich Campaign Details:** Save full campaign breakdown (not just totals)
3. ✅ **All Clients:** Process ALL active clients (current and future)
4. ✅ **Platform Separation:** Meta and Google Ads tracked separately
5. ✅ **No Manual Intervention:** Fully automated via cron job
6. ✅ **Quality Validation:** Skip if rich data already exists
7. ✅ **Error Recovery:** Continue if one client fails

---

## 📊 Current System Analysis

### **What Already Exists:**

#### **1. Monthly Aggregation Endpoint** ✅
- **File:** `src/app/api/automated/monthly-aggregation/route.ts`
- **Purpose:** Aggregates data for previous month
- **Status:** EXISTS but needs enhancement

#### **2. Backfill Endpoint** ✅
- **File:** `src/app/api/backfill-all-client-data/route.ts`
- **Purpose:** Backfills historical data
- **Status:** FIXED (quality validation added)

#### **3. Database Tables** ✅
- `campaign_summaries` - Stores monthly summaries with campaigns
- `clients` - All client records
- Platform column enforces Meta/Google separation

---

## 🔧 System Architecture

### **Flow Diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│ TRIGGER: 1st of every month at 2:00 AM                     │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Get All Active Clients                             │
│  - Query: SELECT * FROM clients WHERE api_status = 'active'│
│  - Includes: Meta token, Google token, account IDs         │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Calculate Previous Month Dates                     │
│  - Start: First day of previous month                      │
│  - End: Last day of previous month                         │
│  - Example: On Oct 1, process Sept 1-30                    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: For Each Client - Check Existing Data              │
│  - Query campaign_summaries for previous month             │
│  - Check if RICH data exists (has campaigns)               │
│  - If rich data exists → SKIP                              │
│  - If no data or poor quality → FETCH                      │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Fetch Data from Meta/Google APIs                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Meta Ads API:                                      │    │
│  │  - Get campaigns with spend/impressions/clicks     │    │
│  │  - Get conversion metrics (reservations, etc.)     │    │
│  │  - Get demographics, placements, ad relevance      │    │
│  │  - Save to campaign_summaries with platform='meta' │    │
│  └────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Google Ads API:                                    │    │
│  │  - Get campaigns with spend/impressions/clicks     │    │
│  │  - Get conversion metrics                          │    │
│  │  - Save to campaign_summaries with platform='google'│   │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Store in Database                                  │
│  - UPSERT to campaign_summaries table                      │
│  - Includes: campaigns array, conversion metrics, totals   │
│  - Platform tag: 'meta' or 'google'                        │
│  - Conflict resolution: Skip if rich data exists           │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: Send Summary Email (Optional)                      │
│  - Success: "September data saved for 15 clients"          │
│  - Failures: "3 clients failed (list reasons)"             │
│  - Send to: admin@example.com                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Implementation Plan

### **Task 1: Fix Existing Monthly Aggregation Endpoint**

**Current issues:**
- Might not check data quality
- Might not handle all clients
- Might not have platform separation

**What to fix:**
1. Add quality check (skip if has campaigns)
2. Process all active clients automatically
3. Enforce platform separation
4. Add error handling per client

---

### **Task 2: Create Cron Job Configuration**

**Options:**

#### **Option A: Vercel Cron (Recommended for Production)**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/automated/monthly-aggregation",
      "schedule": "0 2 1 * *"
    }
  ]
}
```
**Schedule:** 2:00 AM on the 1st of every month

#### **Option B: Supabase Cron (Alternative)**
```sql
-- Run via Supabase Edge Functions
SELECT cron.schedule(
  'monthly-data-collection',
  '0 2 1 * *',
  $$
  SELECT net.http_post(
    url:='https://yourapp.com/api/automated/monthly-aggregation',
    headers:='{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

#### **Option C: GitHub Actions (For Testing)**
```yaml
# .github/workflows/monthly-aggregation.yml
on:
  schedule:
    - cron: '0 2 1 * *'  # 2 AM on 1st of month
  workflow_dispatch:  # Manual trigger for testing
```

---

### **Task 3: Add Platform Field Migration**

**Fix existing NULL platforms:**
```sql
-- Migration to backfill NULL platforms
UPDATE campaign_summaries 
SET platform = 'meta' 
WHERE platform IS NULL;
```

---

### **Task 4: Add New Client Onboarding Check**

**When new client is added:**
```typescript
// After creating new client
// Optionally backfill last 3 months of data
await fetch('/api/backfill-all-client-data', {
  method: 'POST',
  body: JSON.stringify({
    clientIds: [newClientId],
    monthsToBackfill: 3,
    platform: 'all',
    forceRefresh: false
  })
});
```

---

## 📋 Complete Implementation Checklist

### **Phase 1: Fix Current Data (Immediate)**
- [ ] Run `FIX_NULL_PLATFORMS.sql` to fix September
- [ ] Run `FIX_AUGUST_DATA_NOW.sh` to backfill August
- [ ] Verify all historical months have rich data

### **Phase 2: Enhance Monthly Aggregation Endpoint**
- [ ] Add quality check (skip if has campaigns)
- [ ] Add per-client error handling
- [ ] Add platform separation validation
- [ ] Add detailed logging
- [ ] Add email notification on completion

### **Phase 3: Set Up Automation**
- [ ] Choose cron solution (Vercel/Supabase/GitHub)
- [ ] Configure cron job for 1st of month
- [ ] Test manual trigger
- [ ] Monitor first automated run

### **Phase 4: New Client Onboarding**
- [ ] Add backfill to client creation flow
- [ ] Document process for adding new clients
- [ ] Test with dummy client

### **Phase 5: Monitoring & Alerts**
- [ ] Add health check endpoint
- [ ] Set up error monitoring (Sentry?)
- [ ] Create admin dashboard for data status
- [ ] Weekly email report on data completeness

---

## 🚀 Quick Start Commands

### **1. Fix Current Data Now**
```bash
# Fix NULL platforms
# Run in Supabase SQL Editor:
UPDATE campaign_summaries SET platform = 'meta' WHERE platform IS NULL;

# Backfill poor quality months
./FIX_AUGUST_DATA_NOW.sh
```

### **2. Test Monthly Aggregation**
```bash
# Manual trigger to test the endpoint
curl -X POST http://localhost:3000/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{
    "targetMonth": "2025-09",
    "dryRun": true
  }'
```

### **3. Enable Cron Job**
```bash
# Deploy with Vercel cron
vercel --prod
# Vercel will automatically detect vercel.json cron config
```

---

## 📊 Data Quality Guarantees

After implementation, every month will have:

✅ **All Active Clients** - No one left behind  
✅ **Rich Campaign Data** - Full campaign breakdown  
✅ **Conversion Metrics** - Reservations, ROAS, funnel steps  
✅ **Platform Separated** - Meta and Google distinct  
✅ **No Duplicates** - UNIQUE constraint enforced  
✅ **Quality Validated** - Only saves if complete  
✅ **Error Recovery** - One failure doesn't stop others  

---

## 🎯 Expected Outcome

**What happens on October 1st at 2:00 AM:**

```
🤖 Monthly Aggregation Started
  ├─ Found 15 active clients
  ├─ Target month: September 2025
  │
  ├─ Client 1 (Belmonte Hotel):
  │   ├─ Check: September data exists? Yes (22 campaigns)
  │   └─ Action: SKIP (rich data already exists) ✅
  │
  ├─ Client 2 (Hotel XYZ):
  │   ├─ Check: September data exists? No
  │   ├─ Fetch: Meta API → 15 campaigns, 8,432 PLN
  │   ├─ Fetch: Google API → 8 campaigns, 3,211 PLN
  │   └─ Action: SAVED both platforms ✅
  │
  ├─ Client 3 (Restaurant ABC):
  │   ├─ Check: September data exists? Yes (0 campaigns)
  │   ├─ Quality: Poor (no campaigns)
  │   ├─ Fetch: Meta API → 12 campaigns, 5,123 PLN
  │   └─ Action: UPDATED with rich data ✅
  │
  └─ Summary:
      ├─ Total: 15 clients
      ├─ Skipped: 8 (already have rich data)
      ├─ Updated: 6 (poor quality replaced)
      ├─ Failed: 1 (API error, will retry tomorrow)
      └─ Duration: 4 minutes

📧 Email sent to admin with summary
```

---

## 🔍 Monitoring Dashboard (Future Enhancement)

Create admin page: `/admin/data-health`

```
Data Health Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Last Automated Run: Oct 1, 2025 2:04 AM ✅

September 2025 Status:
  Clients with rich data: 14 / 15 ✅
  Clients missing data: 1 ⚠️
    - Hotel XYZ (API error: token expired)

August 2025 Status:
  Clients with rich data: 15 / 15 ✅

July 2025 Status:
  Clients with rich data: 15 / 15 ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Actions Available:
  [Retry Failed Clients]
  [Manual Trigger for September]
  [View Detailed Logs]
```

---

## 📞 Next Steps

**Which approach do you want?**

### **Option 1: Quick Fix (Today)**
- ✅ Fix NULL platforms
- ✅ Enhance existing monthly aggregation
- ✅ Set up Vercel cron
- ⏱️ Time: 1-2 hours

### **Option 2: Complete System (This Week)**
- ✅ Everything from Option 1
- ✅ Admin dashboard
- ✅ Email notifications
- ✅ New client onboarding flow
- ⏱️ Time: 1-2 days

### **Option 3: Enterprise Grade (This Month)**
- ✅ Everything from Option 2
- ✅ Error monitoring (Sentry)
- ✅ Data quality alerts
- ✅ Automatic retry logic
- ✅ Historical data validation
- ⏱️ Time: 1 week

---

**Tell me which option you prefer, and I'll start implementing!** 🚀

