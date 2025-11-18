# 📈 WEEKLY vs MONTHLY COLLECTION SYSTEMS - VISUAL COMPARISON

**Report Date:** November 18, 2025  
**Purpose:** Visual guide to understand system differences

---

## 🎯 QUICK REFERENCE TABLE

| Aspect | WEEKLY System | MONTHLY System |
|--------|---------------|----------------|
| **Purpose** | Track week-by-week trends | Track month-by-month trends |
| **Data Span** | 7 days (Mon-Sun) | 28-31 days (1st-last) |
| **Storage Type** | `summary_type='weekly'` | `summary_type='monthly'` |
| **Date Field** | Week start (Monday) | Month start (1st) |
| **Collection Frequency** | Every Monday | Every Sunday + 1st of month |
| **Historical Range** | 53 weeks (~1 year) | 12 months (1 year) |
| **Primary Endpoint** | `incremental-weekly-collection` | `collect-monthly-summaries` |
| **API Calls (Incremental)** | 40-120/week | 480/week |
| **API Calls (Full)** | 2,160/week | 480/week |
| **Execution Time** | 2-5 minutes | 20-30 minutes |

---

## 📊 DATA STORAGE COMPARISON

### Weekly Record Example

```json
{
  "id": "uuid-1",
  "client_id": "client-abc-123",
  "summary_type": "weekly",
  "summary_date": "2025-11-04",  // Monday (week start)
  "platform": "meta",
  
  "campaign_data": [
    {
      "campaign_id": "123456",
      "campaign_name": "Summer Campaign",
      "spend": 245.50,
      "impressions": 12500,
      "clicks": 345,
      "booking_step_1": 45,
      "booking_step_2": 28,
      "booking_step_3": 15,
      "reservations": 8
    }
  ],
  
  "total_spend": 245.50,
  "total_impressions": 12500,
  "total_clicks": 345,
  "booking_step_1": 45,
  "booking_step_2": 28,
  "booking_step_3": 15,
  "reservations": 8,
  
  "created_at": "2025-11-11T05:00:00Z"
}
```

### Monthly Record Example

```json
{
  "id": "uuid-2",
  "client_id": "client-abc-123",
  "summary_type": "monthly",
  "summary_date": "2025-10-01",  // 1st of month
  "platform": "meta",
  
  "campaign_data": [
    {
      "campaign_id": "123456",
      "campaign_name": "Summer Campaign",
      "spend": 4813.12,
      "impressions": 245000,
      "clicks": 6780,
      "booking_step_1": 890,
      "booking_step_2": 567,
      "booking_step_3": 312,
      "reservations": 145
    }
  ],
  
  "total_spend": 4813.12,
  "total_impressions": 245000,
  "total_clicks": 6780,
  "booking_step_1": 890,
  "booking_step_2": 567,
  "booking_step_3": 312,
  "reservations": 145,
  
  "created_at": "2025-11-01T01:00:00Z"
}
```

### 🔴 CRITICAL RULE:
**NEVER aggregate weekly records to create monthly data!**

❌ **WRONG:**
```sql
-- BAD: Don't do this!
SELECT 
  SUM(total_spend) as monthly_spend
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND summary_date >= '2025-10-01'
  AND summary_date < '2025-11-01';
```

✅ **CORRECT:**
```sql
-- GOOD: Use dedicated monthly records
SELECT 
  total_spend as monthly_spend
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date = '2025-10-01';
```

---

## 🔄 COLLECTION FLOW COMPARISON

### Weekly Collection Flow

```
MONDAY 5:00 AM
     │
     ├─→ Cron Trigger
     │   /api/automated/incremental-weekly-collection
     │
     ├─→ For each client:
     │   │
     │   ├─→ Query Database
     │   │   "What weeks exist for last 12 weeks?"
     │   │
     │   ├─→ Identify Gaps
     │   │   Week 2025-11-04: EXISTS ✅
     │   │   Week 2025-10-28: MISSING ❌
     │   │   Week 2025-10-21: EXISTS ✅
     │   │
     │   ├─→ Collect Missing Weeks Only
     │   │   │
     │   │   ├─→ Meta API
     │   │   │   getCampaignInsights(2025-10-28, 2025-11-03)
     │   │   │   Parse actions array → conversion metrics
     │   │   │
     │   │   └─→ Google Ads API
     │   │       getCampaignData(2025-10-28, 2025-11-03)
     │   │
     │   └─→ Store to Database
     │       INSERT campaign_summaries
     │       summary_type: 'weekly'
     │       summary_date: '2025-10-28'
     │
     └─→ Complete in 2-5 minutes
         40-120 API calls total
```

### Monthly Collection Flow

```
SUNDAY 1:00 AM
     │
     ├─→ Cron Trigger
     │   /api/automated/collect-monthly-summaries
     │
     ├─→ For each client:
     │   │
     │   ├─→ Calculate Months
     │   │   Current: November 2025 → SKIP (incomplete)
     │   │   Month 1: October 2025 (Oct 1-31) ✅
     │   │   Month 2: September 2025 (Sep 1-30) ✅
     │   │   ... (up to 12 months)
     │   │
     │   ├─→ Collect Each Month
     │   │   │
     │   │   ├─→ Meta API
     │   │   │   getCampaignInsights(2025-10-01, 2025-10-31)
     │   │   │   Entire month in ONE call
     │   │   │
     │   │   └─→ Google Ads API
     │   │       getCampaignData(2025-10-01, 2025-10-31)
     │   │       Entire month in ONE call
     │   │
     │   └─→ Store to Database
     │       INSERT campaign_summaries
     │       summary_type: 'monthly'
     │       summary_date: '2025-10-01'
     │
     └─→ Complete in 20-30 minutes
         480 API calls total

PLUS

1st OF MONTH 2:00 AM
     │
     ├─→ Cron Trigger
     │   /api/automated/end-of-month-collection
     │
     ├─→ For each client:
     │   │
     │   ├─→ Collect Previous Month ONLY
     │   │   (e.g., on Nov 1st → collect Oct 1-31)
     │   │
     │   ├─→ Quality Check
     │   │   "Does October monthly record already exist?"
     │   │   If YES → SKIP
     │   │   If NO → COLLECT
     │   │
     │   └─→ Store Rich Data
     │       Full campaign details
     │       summary_type: 'monthly'
     │
     └─→ Complete in 5-10 minutes
         40 API calls total
```

---

## 🚨 PROBLEM: DUPLICATE WEEKLY ENDPOINTS

### Current Problematic Setup

```
SUNDAY 11:00 PM                     MONDAY 2:00 AM
     │                                    │
     ├─→ collect-weekly-summaries         ├─→ incremental-weekly-collection
     │   (OLD ENDPOINT)                   │   (NEW ENDPOINT)
     │                                    │
     ├─→ Mechanism: Full Collection      ├─→ Mechanism: Incremental
     │   - Collects ALL 53 weeks         │   - Collects ONLY missing weeks
     │   - 54 API calls per client       │   - 1-3 API calls per client
     │   - 2,160 total calls             │   - 40-120 total calls
     │   - 30-60 minutes                 │   - 2-5 minutes
     │   - TIMEOUT RISK 🔴               │   - FAST ✅
     │                                    │
     └─→ BOTH ENDPOINTS RUN! 🔴         └─→ BOTH COLLECT SAME DATA! 🔴

TOTAL: 2,200 API calls in ~3 hours
       ↓
RESULT: Rate limiting, timeouts, wasted resources
```

### Fixed Setup (Recommended)

```
SUNDAY 1:00 AM                      MONDAY 5:00 AM
     │                                    │
     ├─→ collect-monthly-summaries        ├─→ incremental-weekly-collection
     │   (MONTHLY DATA)                   │   (WEEKLY DATA)
     │                                    │
     ├─→ 12 months × 2 platforms         ├─→ 1-3 weeks × 2 platforms
     │   480 API calls                    │   40-120 API calls
     │   20-30 minutes                    │   2-5 minutes
     │   SAFE ✅                          │   FAST ✅
     │                                    │
     └─→ Completes at ~1:30 AM           └─→ Starts 3.5 hours later

TOTAL: 520-600 API calls over 4 hours
       ↓
RESULT: Safe rate limits, no timeouts, efficient
```

---

## 📊 API CALL VOLUME BREAKDOWN

### Current State (Before Fix)

```
PER WEEK:
├─ Sunday 11PM: collect-weekly-summaries
│  ├─ Meta: 20 clients × 54 weeks = 1,080 calls
│  └─ Google: 20 clients × 54 weeks = 1,080 calls
│  └─ SUBTOTAL: 2,160 calls
│
├─ Monday 2AM: incremental-weekly-collection
│  ├─ Meta: 20 clients × 1-3 weeks = 40-60 calls
│  └─ Google: 20 clients × 1-3 weeks = 40-60 calls
│  └─ SUBTOTAL: 80-120 calls
│
├─ Sunday 11PM: collect-monthly-summaries
│  ├─ Meta: 20 clients × 12 months = 240 calls
│  └─ Google: 20 clients × 12 months = 240 calls
│  └─ SUBTOTAL: 480 calls
│
└─ TOTAL: 2,720-2,760 calls per week

PER MONTH:
└─ ~11,000 calls

ISSUES:
🔴 Exceeds Meta 200 calls/hour limit
🔴 Massive waste of resources
🔴 High timeout risk
```

### After Fix (Recommended)

```
PER WEEK:
├─ Sunday 1AM: collect-monthly-summaries
│  ├─ Meta: 20 clients × 12 months = 240 calls
│  └─ Google: 20 clients × 12 months = 240 calls
│  └─ SUBTOTAL: 480 calls
│
├─ Monday 5AM: incremental-weekly-collection
│  ├─ Meta: 20 clients × 1-3 weeks = 40-60 calls
│  └─ Google: 20 clients × 1-3 weeks = 40-60 calls
│  └─ SUBTOTAL: 80-120 calls
│
└─ TOTAL: 560-600 calls per week

PER MONTH:
├─ Weekly: ~2,400 calls
├─ End-of-month: ~40 calls
└─ TOTAL: ~2,440 calls

BENEFITS:
✅ Well within Meta 200 calls/hour limit
✅ 78% reduction in API calls
✅ No timeout risk
✅ Efficient resource usage
```

---

## 🎯 ENDPOINT PURPOSE MATRIX

### Weekly Endpoints

| Endpoint | Type | Scheduled | Purpose | Status |
|----------|------|-----------|---------|--------|
| `incremental-weekly-collection` | Automated | ✅ Mon 5AM | Smart gap-filling, efficient | ✅ **PRIMARY** |
| `collect-weekly-summaries` | Automated | ❌ REMOVE | Full collection, inefficient | 🔴 **DEPRECATED** |
| `background/collect-weekly` | Manual | ❌ None | Admin backfill trigger | ✅ **KEEP** |
| `optimized/weekly-collection` | Unused | ❌ None | Google Ads only, incomplete | 🔴 **DELETE** |

### Monthly Endpoints

| Endpoint | Type | Scheduled | Purpose | Status |
|----------|------|-----------|---------|--------|
| `collect-monthly-summaries` | Automated | ✅ Sun 1AM | 12-month historical | ✅ **PRIMARY** |
| `end-of-month-collection` | Automated | ✅ 1st 2AM | Previous month rich data | ✅ **SECONDARY** |
| `background/collect-monthly` | Manual | ❌ None | Admin backfill trigger | ✅ **KEEP** |

---

## 🔍 DETECTION QUERY COMPARISON

### How System Detects Weekly vs Monthly Requests

```typescript
// User requests data from 2025-11-04 to 2025-11-10
const startDate = '2025-11-04';
const endDate = '2025-11-10';

// Calculate day difference
const start = new Date(startDate);
const end = new Date(endDate);
const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

if (daysDiff <= 7) {
  // WEEKLY REQUEST
  summaryType = 'weekly';
  
  // Query:
  SELECT * FROM campaign_summaries
  WHERE summary_type = 'weekly'
    AND summary_date >= '2025-11-04'
    AND summary_date <= '2025-11-10'
    AND platform = 'meta';
  
} else {
  // MONTHLY REQUEST
  summaryType = 'monthly';
  
  // Query:
  SELECT * FROM campaign_summaries
  WHERE summary_type = 'monthly'
    AND summary_date >= '2025-11-01'
    AND summary_date <= '2025-11-30'
    AND platform = 'meta';
  
  // ❌ NO FALLBACK to weekly aggregation!
}
```

---

## 📅 CRON SCHEDULE VISUAL

### Current (Problematic)

```
SUNDAY
├─ 11:00 PM ─→ collect-monthly-summaries (480 calls, 30 min) 🔴 CONFLICT
└─ 11:30 PM → Still running monthly...

MONDAY
├─ 12:00 AM → Monthly collection ongoing...
├─ 12:30 AM → Monthly collection complete
├─ 02:00 AM ─→ incremental-weekly-collection (80 calls, 5 min) 🔴 TOO CLOSE
└─ 02:05 AM → Complete

ISSUE: Only 2.5 hours between jobs, both hitting Meta API hard
```

### Recommended (Fixed)

```
SUNDAY
├─ 01:00 AM ─→ collect-monthly-summaries (480 calls, 30 min) ✅
└─ 01:30 AM → Monthly collection complete

MONDAY
├─ 05:00 AM ─→ incremental-weekly-collection (80 calls, 5 min) ✅
└─ 05:05 AM → Weekly collection complete

BENEFIT: 3.5 hour gap between jobs, smooth API usage
```

---

## 🎯 PLATFORM HANDLING

### Both Systems Support Both Platforms

```
META PLATFORM:
├─ Weekly: ✅ Collected via incremental-weekly-collection
├─ Monthly: ✅ Collected via collect-monthly-summaries
├─ Storage: platform='meta'
└─ API: Meta Marketing API

GOOGLE ADS PLATFORM:
├─ Weekly: ✅ Collected via incremental-weekly-collection
├─ Monthly: ✅ Collected via collect-monthly-summaries
├─ Storage: platform='google'
└─ API: Google Ads API

SEPARATION:
- Each platform stored separately
- Independent error handling
- Parallel collection possible
- No mixing between platforms
```

---

## ✅ WHAT'S WORKING CORRECTLY

1. **Platform Separation** ✅
   - Meta and Google Ads stored separately
   - `platform='meta'` vs `platform='google'`
   - No data mixing

2. **Monthly/Weekly Separation** ✅
   - No fallback aggregation (fixed Nov 9)
   - Strict query separation
   - Correct data retrieval

3. **Incremental Collection** ✅
   - Smart gap detection
   - Only missing weeks collected
   - Fast and efficient

4. **Conversion Metrics** ✅
   - parseMetaActions() working
   - Booking funnel captured
   - Reservations tracked

---

## 🔴 WHAT NEEDS FIXING

1. **Duplicate Endpoints** 🔴 HIGH
   - Remove `collect-weekly-summaries` from cron
   - Delete `optimized/weekly-collection`

2. **Cron Timing** ⚠️ MEDIUM
   - Adjust monthly: Sunday 1AM (was 11PM)
   - Adjust weekly: Monday 5AM (was 2AM)

3. **Week Calculation** ⚠️ MEDIUM
   - Standardize to ISO 8601
   - Create shared helper function

---

## 📖 RELATED DOCUMENTATION

- **Full Audit:** `📊_WEEKLY_MONTHLY_AUDIT_REPORT.md`
- **Quick Actions:** `⚡_IMMEDIATE_ACTIONS_REQUIRED.md`
- **Separation Fix:** `MONTHLY_WEEKLY_SEPARATION_FIX.md`
- **System Guide:** `📘_AUTOMATED_DATA_COLLECTION.md`

---

**Last Updated:** November 18, 2025  
**Status:** Audit Complete - Action Required

