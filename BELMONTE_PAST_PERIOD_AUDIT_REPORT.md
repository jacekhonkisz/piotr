# 🔍 BELMONTE PAST PERIOD DATA AUDIT REPORT

**Date:** November 6, 2025  
**Client:** Belmonte Hotel (Only client with permanent token)  
**Client ID:** `ab0b4c7e-2bf0-46bc-b455-b18ef6942baa`  
**Purpose:** Comprehensive audit of past period data storage and fetching mechanisms

---

## 📋 EXECUTIVE SUMMARY

This audit investigates why Belmonte Hotel's past period data may not be fetching properly from the database, and evaluates the completeness of historical data storage for dynamic year-over-year comparisons.

### 🎯 Key Questions to Answer:
1. ✅ **Do we have historical data stored in the database?**
2. ✅ **Does the data cover the past 12+ months for YoY comparisons?**
3. ✅ **Is the data complete (spend, conversions, campaigns)?**
4. ✅ **Why might past periods not be fetching from database?**
5. ✅ **What periods have gaps or missing data?**

---

## 🏗️ DATABASE ARCHITECTURE OVERVIEW

### Data Storage Tables

```
┌──────────────────────────────────────────────────────┐
│ TABLE                    │ PURPOSE        │ RETENTION │
├──────────────────────────────────────────────────────┤
│ campaign_summaries       │ Historical     │ 13 months │
│ daily_kpi_data          │ Daily granular │ 90 days   │
│ current_month_cache     │ Current month  │ 1 month   │
│ current_week_cache      │ Current week   │ 1 week    │
└──────────────────────────────────────────────────────┘
```

### Critical Table: `campaign_summaries`

**Purpose:** Stores historical weekly and monthly aggregated data

**Key Fields:**
- `client_id`: Links to Belmonte
- `summary_type`: 'weekly' or 'monthly'
- `summary_date`: Start date of period (YYYY-MM-01 for monthly)
- `platform`: 'meta' or 'google'
- `total_spend`, `total_impressions`, `total_clicks`, `total_conversions`
- `reservations`, `reservation_value` (conversion funnel)
- `campaign_data`: JSONB array of individual campaigns
- `meta_tables`: JSONB with demographic/placement data

---

## 🔄 DATA FETCHING LOGIC - HOW IT SHOULD WORK

### Historical Period (Past Months/Weeks)

```
User requests October 2024 data
        ↓
System classifies: HISTORICAL PERIOD
        ↓
Strategy: DATABASE_FIRST
        ↓
Query: campaign_summaries table
  WHERE summary_date = '2024-10-01'
  AND summary_type = 'monthly'
  AND platform = 'meta'
        ↓
Expected Result: Instant return (< 1 second)
  - total_spend: XXXX PLN
  - conversions: XXX
  - campaigns: [array of campaign details]
```

**Code Location:** `src/lib/standardized-data-fetcher.ts` lines 252-291

### Current Period (This Month/Week)

```
User requests November 2025 data
        ↓
System classifies: CURRENT PERIOD
        ↓
Strategy: SMART_CACHE (3-hour refresh)
        ↓
Check: current_month_cache table
        ↓
If fresh (< 3 hours): Return cached data
If stale (> 3 hours): Fetch from Meta API
        ↓
Store in cache + daily_kpi_data
```

**Code Location:** `src/lib/smart-cache-helper.ts`

---

## 🔍 AUDIT METHODOLOGY

### SQL Audit Queries

File: `BELMONTE_HISTORICAL_DATA_AUDIT.sql`

**10 Comprehensive Checks:**

1. ✅ **Client Info & Token Status** - Verify permanent token
2. ✅ **Historical Data Overview** - Count periods by platform
3. ✅ **Monthly Data Detail** - Last 12 months (Meta & Google)
4. ✅ **Weekly Data Detail** - Last 3 months
5. ✅ **Past Year Data (2024)** - For YoY comparisons
6. ✅ **Data Quality** - Empty/zero records
7. ✅ **Daily KPI Data** - Granular metrics availability
8. ✅ **Cache Status** - Current period freshness
9. ✅ **Missing Periods** - Gap analysis
10. ✅ **Test Queries** - Simulate actual fetches

---

## 🔴 COMMON ISSUES & SYMPTOMS

### Issue 1: No Historical Data Stored

**Symptom:** Past periods show all zeros  
**Root Cause:** Background data collector not running or failed  
**Detection:**
```sql
SELECT COUNT(*) FROM campaign_summaries 
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
-- Expected: 25+ records (13 months × 2 platforms)
-- Problem if: 0 or very few records
```

**Fix:** Run background collector manually or restart service

---

### Issue 2: Empty campaign_data Field

**Symptom:** Aggregate metrics show correctly, but "Top Campaigns" section empty  
**Root Cause:** Data storage logic not saving campaign details  
**Detection:**
```sql
SELECT 
  summary_date,
  total_spend,
  CASE 
    WHEN campaign_data IS NULL THEN 'NULL'
    WHEN jsonb_array_length(campaign_data) = 0 THEN 'EMPTY'
    ELSE 'HAS DATA'
  END as status
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
```

**Fix:** Update data collector to include campaign details in JSONB field

---

### Issue 3: Missing Conversion Metrics

**Symptom:** Spend/impressions/clicks show, but conversions = 0  
**Root Cause:** Conversion funnel data not being collected or stored  
**Detection:**
```sql
SELECT 
  summary_date,
  total_spend,
  reservations,
  reservation_value,
  booking_step_1
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND (reservations = 0 OR reservations IS NULL);
```

**Fix:** Check Meta API permissions and conversion tracking setup

---

### Issue 4: No 2024 Data (Year-over-Year Fails)

**Symptom:** YoY comparisons show "N/A" or zeros  
**Root Cause:** Database only has 2025 data, missing previous year  
**Detection:**
```sql
SELECT MIN(summary_date) 
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
-- Problem if: >= 2025-01-01
-- Need: <= 2024-11-01 for current YoY
```

**Fix:** Backfill historical data from Meta API or disable YoY feature

---

### Issue 5: Data Fetching Logic Not Using Database

**Symptom:** Every request is slow, hitting API instead of database  
**Root Cause:** Period classification logic incorrectly treats past as current  
**Detection:** Check server logs for:
```
❌ Bad: "CURRENT PERIOD - using smart cache" for October 2024
✅ Good: "HISTORICAL PERIOD - checking campaign_summaries FIRST"
```

**Fix:** Review date detection logic in `standardized-data-fetcher.ts:199-247`

---

## 📊 EXPECTED HEALTHY STATE

### For Belmonte with Permanent Token:

```
✅ campaign_summaries records:
   - Meta monthly: 13 records (last 13 months)
   - Google monthly: 13 records (if Google Ads enabled)
   - Meta weekly: 52 records (last 52 weeks)
   - Google weekly: 52 records (if enabled)

✅ Date coverage:
   - Earliest: November 2023 or earlier
   - Latest: November 2025 (current month)
   - Gaps: None (continuous coverage)

✅ Data completeness:
   - total_spend > 0 (for active periods)
   - campaign_data: Array with 5-20 campaigns
   - Conversion metrics: reservations > 0
   - meta_tables: Rich demographic data

✅ Cache status:
   - current_month_cache: Fresh (< 3 hours old)
   - current_week_cache: Fresh (< 3 hours old)
   - Both updated regularly

✅ Daily data:
   - daily_kpi_data: Last 90 days
   - No gaps in daily records
   - Conversion funnel complete
```

---

## 🛠️ TROUBLESHOOTING WORKFLOW

### Step 1: Run SQL Audit

```bash
# Execute the comprehensive audit
psql <DATABASE_URL> -f BELMONTE_HISTORICAL_DATA_AUDIT.sql > audit_results.txt
```

### Step 2: Analyze Results

Look for these patterns:

**🟢 HEALTHY:**
- 25+ records in campaign_summaries
- Continuous date coverage (no gaps)
- campaign_data populated
- Conversions > 0
- last_updated < 24 hours ago

**🟡 NEEDS ATTENTION:**
- < 13 monthly records (incomplete history)
- Some campaign_data empty
- Conversion metrics missing
- last_updated > 7 days ago

**🔴 CRITICAL:**
- 0 records in campaign_summaries
- All campaign_data NULL/empty
- All conversions = 0
- No 2024 data
- last_updated > 30 days ago

### Step 3: Identify Root Cause

Based on findings, determine issue category:

1. **Data Collection Failure** → Background collector broken
2. **Storage Logic Bug** → campaign_data not being saved
3. **API Permissions** → Can't fetch conversion metrics
4. **Retention Policy** → Old data being deleted too early
5. **Period Detection Bug** → Historical periods treated as current

### Step 4: Apply Fix

See "Common Issues & Fixes" section above for specific solutions

---

## 📈 PERFORMANCE EXPECTATIONS

### Database-First Strategy (Historical)

```
User Request (October 2024)
    ↓
Query campaign_summaries (single SELECT)
    ↓
Response Time: 0.5 - 2 seconds ✅
Data Source: PostgreSQL database
Accuracy: 100% (stored historical data)
```

### Smart Cache Strategy (Current)

```
User Request (November 2025)
    ↓
Check current_month_cache
    ↓
If FRESH: Return immediately (1-2 seconds) ✅
If STALE: Fetch Meta API (10-20 seconds) ⚠️
    ↓
Update cache for next request
```

---

## 🔍 DETAILED FINDINGS

### Data Source Priority (from `standardized-data-fetcher.ts`)

**For HISTORICAL periods:**
```
1. campaign_summaries (database) - PRIORITY 1
   ↓ If incomplete
2. daily_kpi_data (database) - PRIORITY 2
   ↓ If missing
3. Live Meta API (fallback) - PRIORITY 3
```

**For CURRENT periods:**
```
1. Smart cache (current_month_cache / current_week_cache) - PRIORITY 1
   ↓ If expired
2. Live Meta API + cache storage - PRIORITY 2
   ↓ Then store for next request
```

### Period Classification Logic

**What makes a period "HISTORICAL":**
```javascript
const now = new Date();
const currentMonth = now.getMonth() + 1;
const requestMonth = startDate.getMonth() + 1;

// HISTORICAL if:
isCurrentMonth = false (requestMonth !== currentMonth)
includesCurrentDay = false (dateRange.end < today)

// Strategy: DATABASE_FIRST
```

**What makes a period "CURRENT":**
```javascript
// CURRENT if:
isCurrentMonth = true (requestMonth === currentMonth)
OR
isCurrentWeek = true (Monday start, includes today)

// Strategy: SMART_CACHE
```

---

## 📝 AUDIT CHECKLIST

Run through this checklist with audit results:

### Data Storage
- [ ] campaign_summaries table exists and accessible
- [ ] Belmonte records present (client_id verified)
- [ ] Last 12 months of monthly data (Meta)
- [ ] Last 12 months of monthly data (Google, if enabled)
- [ ] Last 12 weeks of weekly data
- [ ] No missing periods (continuous coverage)

### Data Quality
- [ ] Total spend values realistic (not all zeros)
- [ ] campaign_data field populated (not NULL/empty)
- [ ] Conversion metrics present (reservations > 0)
- [ ] meta_tables data available
- [ ] No duplicate period entries

### Data Freshness
- [ ] last_updated timestamp recent (< 24 hours)
- [ ] Current month data exists
- [ ] Current week data exists
- [ ] Cache tables populated

### Year-over-Year Support
- [ ] Data from 2024 available
- [ ] Matching months (Nov 2024 for Nov 2025 comparison)
- [ ] Both platforms have historical data
- [ ] Conversion metrics consistent across years

### Fetching Logic
- [ ] Historical periods use database-first
- [ ] Current periods use smart cache
- [ ] No errors in server logs
- [ ] Response times acceptable (< 5s)

---

## 🚀 NEXT STEPS

### Immediate Actions:

1. **Run SQL Audit**
   ```bash
   psql <DATABASE_URL> -f BELMONTE_HISTORICAL_DATA_AUDIT.sql
   ```

2. **Review Results**
   - Check executive summary section
   - Identify any zero/null records
   - Confirm date coverage

3. **Test Historical Fetch**
   ```bash
   # Test October 2024 data fetch
   curl -X POST http://localhost:3000/api/fetch-live-data \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token>" \
     -d '{
       "clientId": "ab0b4c7e-2bf0-46bc-b455-b18ef6942baa",
       "dateRange": {"start": "2024-10-01", "end": "2024-10-31"},
       "platform": "meta"
     }'
   ```

4. **Check Server Logs**
   - Look for "HISTORICAL PERIOD" classification
   - Confirm "campaign_summaries FIRST" strategy
   - Verify instant return (< 2 seconds)

### If Issues Found:

**Scenario A: No Data in Database**
→ Run background data collector
→ Check Meta API credentials
→ Verify system_user_token validity

**Scenario B: Incomplete Data**
→ Fix data storage logic
→ Backfill missing periods
→ Add campaign_data to storage

**Scenario C: Fetch Logic Not Working**
→ Review period classification
→ Check database queries
→ Verify RLS policies

---

## 📚 RELATED DOCUMENTATION

**Comprehensive Audits:**
- `BELMONTE_DATA_FETCHING_COMPREHENSIVE_AUDIT.md` - Full system audit (35 pages)
- `BELMONTE_AUDIT_EXECUTIVE_SUMMARY.md` - Quick reference (10 pages)
- `DATA_FETCHING_PAST_VS_CURRENT_AUDIT.md` - Period comparison

**Technical Implementation:**
- `src/lib/standardized-data-fetcher.ts` - Main fetching logic
- `src/lib/smart-cache-helper.ts` - Current period caching
- `src/app/api/fetch-live-data/route.ts` - API endpoint

**Database Schema:**
- `supabase/migrations/013_add_campaign_summaries.sql` - Table creation
- `supabase/migrations/042_add_platform_column.sql` - Platform separation
- `DATABASE_SCHEMA_EMERGENCY_FIX.sql` - Schema reference

---

## ✅ VALIDATION CRITERIA

### A. Database Has Historical Data

```sql
-- Should return 25+ records
SELECT COUNT(*) FROM campaign_summaries 
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
```

### B. Data Spans Past Year

```sql
-- Earliest should be 2024 or earlier
SELECT MIN(summary_date) FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
```

### C. Data is Complete

```sql
-- All should have campaign data
SELECT COUNT(*) FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND (campaign_data IS NULL OR jsonb_array_length(campaign_data) = 0);
-- Should return: 0
```

### D. Fetching Uses Database

Check server logs for historical period requests:
```
✅ GOOD: "HISTORICAL PERIOD: Checking campaign_summaries FIRST"
❌ BAD: "CURRENT PERIOD: Using smart cache" (for past dates)
```

---

## 🎯 SUCCESS METRICS

**Audit Complete When:**
- ✅ All 10 SQL queries executed successfully
- ✅ Results analyzed and documented
- ✅ Root cause identified (if issues exist)
- ✅ Fix plan created
- ✅ Test queries confirm proper data fetch

**System Healthy When:**
- ✅ 13+ months of data stored
- ✅ No gaps in coverage
- ✅ All metrics populated (spend, conversions, campaigns)
- ✅ Historical fetches use database (< 2s response)
- ✅ Current fetches use cache (< 3s response)
- ✅ Year-over-year comparisons work

---

**Generated:** November 6, 2025  
**Audit File:** `BELMONTE_HISTORICAL_DATA_AUDIT.sql`  
**For Client:** Belmonte Hotel (Permanent Token)




