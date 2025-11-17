# 🎯 BELMONTE PAST PERIOD DATA - AUDIT SUMMARY

**Date:** November 6, 2025  
**Client:** Belmonte Hotel (Only client with permanent token)  
**Status:** Audit Ready - Awaiting Execution

---

## 📋 WHAT I'VE PREPARED

I've created a comprehensive audit to investigate why Belmonte's past period data may not be fetching from the database, and to verify if we have complete historical data for year-over-year comparisons.

### Files Created:

1. **`BELMONTE_HISTORICAL_DATA_AUDIT.sql`**
   - 10 comprehensive SQL queries
   - Checks all aspects of data storage
   - Identifies gaps and issues
   - Tests actual fetch scenarios

2. **`BELMONTE_PAST_PERIOD_AUDIT_REPORT.md`**
   - Complete technical analysis
   - Architecture overview
   - Common issues & fixes
   - Troubleshooting guide

3. **`RUN_BELMONTE_AUDIT.md`**
   - Step-by-step execution guide
   - Multiple connection options
   - Result interpretation
   - Quick troubleshooting

---

## 🔍 KEY QUESTIONS THIS AUDIT ANSWERS

### 1. ✅ Do we have historical data in the database?

**What we check:**
- How many periods stored in `campaign_summaries` table
- Coverage: weekly vs monthly, Meta vs Google
- Date range: from earliest to latest

**Expected:**
- 13 monthly periods (last 13 months)
- 52 weekly periods (last year)
- Both Meta and Google platforms

---

### 2. ✅ Is the data complete for year-over-year comparisons?

**What we check:**
- Do we have 2024 data for comparing with 2025?
- All 12 months of previous year present?
- Same months across both years?

**Required for YoY:**
```
To compare November 2025 with November 2024:
✅ Need: summary_date = '2024-11-01' (Meta & Google)
✅ Need: summary_date = '2025-11-01' (Meta & Google)
```

---

### 3. ✅ Is the stored data high quality?

**What we check:**
- Records with zero spend (data collection failures)
- Empty `campaign_data` field (missing campaign details)
- Missing conversion metrics (funnel data)
- NULL values in critical fields

**Quality indicators:**
```
✅ GOOD: All fields populated, spend > 0, campaigns array filled
⚠️ WARNING: Some empty fields, partial data
❌ BAD: Zero/NULL everywhere, no campaign details
```

---

### 4. ✅ Why is data not fetching from database?

**What we check:**
- Is the data actually stored in the database?
- Is the period classification working correctly?
- Are the fetch queries using right strategy?
- Is the database accessible with correct permissions?

**Possible causes:**
```
A. No data stored → Background collector not running
B. Wrong period detection → Historical treated as current
C. Database query fails → RLS policy or connection issue
D. Empty results → Data exists but query wrong
```

---

## 🏗️ HOW THE SYSTEM SHOULD WORK

### For Past Periods (e.g., October 2024):

```
User Request: October 2024 data
     ↓
System: "This is HISTORICAL period"
     ↓
Strategy: DATABASE_FIRST
     ↓
Query: campaign_summaries table
  WHERE summary_date = '2024-10-01'
  AND summary_type = 'monthly'
     ↓
Result: Instant return (< 1 second)
  - From stored database record
  - No API call needed
  - Data exactly as collected
```

### For Current Period (e.g., November 2025):

```
User Request: November 2025 data
     ↓
System: "This is CURRENT period"
     ↓
Strategy: SMART_CACHE
     ↓
Check: current_month_cache
     ↓
If fresh (< 3 hours): Return cached
If stale (> 3 hours): Fetch from Meta API
     ↓
Update cache and daily_kpi_data
```

---

## 🔴 MOST COMMON ISSUES

### Issue #1: Database Empty

**Symptom:**
- All past periods show zeros
- Reports page empty for historical data
- "No data available" message

**Root Cause:**
- Background data collector never ran
- Or failed silently without errors
- Data never persisted to database

**How to Detect:**
```sql
SELECT COUNT(*) FROM campaign_summaries 
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

Result: 0 (PROBLEM) vs Expected: 25+ (GOOD)
```

---

### Issue #2: Campaign Details Missing

**Symptom:**
- Aggregate metrics show correctly (spend, clicks, impressions)
- But "Top 5 Campaigns" section is empty in reports
- campaign_data field is NULL or empty array

**Root Cause:**
- Data collector stores aggregates but not campaign details
- JSONB field not being populated
- Storage logic incomplete

**How to Detect:**
```sql
SELECT 
  summary_date,
  total_spend,
  jsonb_array_length(campaign_data) as campaign_count
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

Result: campaign_count = 0 or NULL (PROBLEM)
Expected: campaign_count = 5-20 (GOOD)
```

---

### Issue #3: No 2024 Data

**Symptom:**
- Year-over-year comparisons show "N/A"
- Can't compare 2025 with 2024
- Previous year section empty

**Root Cause:**
- System only started collecting data in 2025
- No historical backfill done
- 2024 data never collected

**How to Detect:**
```sql
SELECT MIN(summary_date) FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

Result: 2025-01-01 or later (PROBLEM)
Expected: 2024-11-01 or earlier (GOOD)
```

---

### Issue #4: Fetching Wrong Strategy

**Symptom:**
- All requests are slow (10-20 seconds)
- Even historical periods hitting Meta API
- No speed improvement for past data

**Root Cause:**
- Period classification logic broken
- Historical periods incorrectly detected as "current"
- Database-first strategy not being used

**How to Detect:**
Check server logs when requesting October 2024:
```
❌ BAD LOG: "CURRENT PERIOD: Using smart cache"
✅ GOOD LOG: "HISTORICAL PERIOD: Checking campaign_summaries FIRST"
```

---

## 📊 EXPECTED HEALTHY STATE

For a properly functioning system with Belmonte:

### Database Content:
```
campaign_summaries table:
├─ 13 monthly Meta records (Nov 2024 - Nov 2025)
├─ 13 monthly Google records (Nov 2024 - Nov 2025)
├─ 52 weekly Meta records (last 52 weeks)
└─ 52 weekly Google records (last 52 weeks)

Total: 130 records minimum
```

### Data Quality:
```
✅ All records have total_spend > 0 (for active periods)
✅ All campaign_data fields populated with 5-20 campaigns
✅ All conversion metrics present (reservations, booking steps)
✅ No gaps in date coverage (continuous from Nov 2024 to now)
✅ Both platforms (Meta & Google) have equal coverage
```

### Performance:
```
✅ Historical requests: < 2 seconds (database)
✅ Current requests: 1-3 seconds (cache hit)
✅ Current requests: 10-20 seconds (cache miss, API fetch)
```

### Year-over-Year:
```
✅ Can compare any 2025 month with same 2024 month
✅ Both years have complete data
✅ Metrics show proper % changes
```

---

## 🚀 HOW TO RUN THE AUDIT

### Option 1: Quick One-Liner (Basic Check)

```bash
psql $DATABASE_URL -c "
SELECT 
  COUNT(*) as records,
  MIN(summary_date) as earliest,
  MAX(summary_date) as latest,
  SUM(total_spend) as spend
FROM campaign_summaries 
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
"
```

**Healthy Result:**
```
records | earliest   | latest     | spend
--------|------------|------------|------------
26      | 2024-01-01 | 2025-11-01 | 500000.00
```

---

### Option 2: Full Comprehensive Audit

```bash
psql $DATABASE_URL -f BELMONTE_HISTORICAL_DATA_AUDIT.sql > results.txt
cat results.txt
```

**Returns:**
- 10 detailed analysis sections
- Executive summary
- Issue identification
- Test query results

---

## 🎯 WHAT TO DO WITH RESULTS

### Scenario A: All Green ✅

```
Meta months: 13 ✅
Google months: 13 ✅
Earliest: 2024-XX-XX ✅
Zero records: 0 ✅
Empty campaigns: 0 ✅
```

**Action:** Nothing! System is working perfectly.

---

### Scenario B: Some Issues 🟡

```
Meta months: 8 ⚠️ (missing 5 months)
Google months: 13 ✅
Zero records: 2 ⚠️
Empty campaigns: 3 ⚠️
```

**Action:**
1. Run data collector for missing periods
2. Investigate zero records (API issues?)
3. Fix empty campaign data storage
4. Re-run audit to verify

---

### Scenario C: Critical Problems 🔴

```
Meta months: 0 ❌
Google months: 0 ❌
Zero records: N/A ❌
Empty campaigns: N/A ❌
```

**Action:**
1. **URGENT:** Background collector not running
2. Check cron jobs / scheduled tasks
3. Manually trigger data collection
4. Verify Meta API credentials
5. Check database permissions
6. Re-run collector for all periods
7. Verify data appears in database

---

## 📚 COMPLETE DOCUMENTATION PACKAGE

I've prepared a complete audit package for you:

### 1. Execution Files
- ✅ `BELMONTE_HISTORICAL_DATA_AUDIT.sql` - SQL queries
- ✅ `RUN_BELMONTE_AUDIT.md` - Execution guide

### 2. Analysis Documents
- ✅ `BELMONTE_PAST_PERIOD_AUDIT_REPORT.md` - Technical analysis
- ✅ `BELMONTE_AUDIT_SUMMARY.md` - This file

### 3. Related Documentation
- 📄 `BELMONTE_DATA_FETCHING_COMPREHENSIVE_AUDIT.md` (existing)
- 📄 `BELMONTE_AUDIT_EXECUTIVE_SUMMARY.md` (existing)
- 📄 `DATA_FETCHING_PAST_VS_CURRENT_AUDIT.md` (existing)

---

## 🔧 TROUBLESHOOTING QUICK REFERENCE

### "No data in database"
→ Run background collector
→ Check `src/lib/background-data-collector.ts`

### "campaign_data empty"
→ Fix storage logic to include campaign details
→ Re-collect data

### "No 2024 data"
→ Backfill from Meta API
→ Or wait 12 months for natural accumulation

### "Slow fetches for past data"
→ Fix period classification
→ Check `src/lib/standardized-data-fetcher.ts:199-247`

### "Zero conversions"
→ Check Meta API conversion tracking
→ Verify permissions include conversion actions

---

## ✅ NEXT STEPS

### Immediate (Now):

1. **Run the audit SQL**
   ```bash
   psql $DATABASE_URL -f BELMONTE_HISTORICAL_DATA_AUDIT.sql
   ```

2. **Review the executive summary section** (last query)
   - Look for red flags
   - Note any zero counts
   - Check date coverage

3. **Test a historical fetch** in browser
   - Go to reports page
   - Select October 2024
   - Check server logs for "HISTORICAL PERIOD"
   - Confirm response < 2 seconds

### Follow-up (After Results):

4. **If issues found:** Follow troubleshooting guide in report

5. **If healthy:** Document findings and set up monitoring

6. **If uncertain:** Share audit results for analysis

---

## 🎁 BONUS: Quick Diagnostic Commands

```bash
# Check if Belmonte exists
psql $DATABASE_URL -c "SELECT id, name, email FROM clients WHERE name ILIKE '%belmonte%';"

# Count historical records
psql $DATABASE_URL -c "SELECT COUNT(*) FROM campaign_summaries WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';"

# Check date range
psql $DATABASE_URL -c "SELECT MIN(summary_date), MAX(summary_date) FROM campaign_summaries WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';"

# Sample recent record
psql $DATABASE_URL -c "SELECT summary_date, platform, total_spend, jsonb_array_length(campaign_data) as campaigns FROM campaign_summaries WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa' ORDER BY summary_date DESC LIMIT 5;"
```

---

## 📞 NEED HELP?

If you encounter any issues running the audit or interpreting results:

1. Check `RUN_BELMONTE_AUDIT.md` for detailed execution steps
2. Review `BELMONTE_PAST_PERIOD_AUDIT_REPORT.md` for technical details
3. Look at existing audits for context
4. Share audit output for analysis

---

## 🎯 SUCCESS CRITERIA

**Audit is successful when:**
- ✅ All 10 SQL queries execute without errors
- ✅ Results clearly show data status
- ✅ Issues identified (if any)
- ✅ Root causes understood
- ✅ Fix path is clear

**System is healthy when:**
- ✅ 13+ months of data stored
- ✅ No gaps in coverage
- ✅ All fields populated
- ✅ Historical fetches use database
- ✅ Year-over-year works

---

**Ready to audit?**

```bash
# Run the complete audit now
psql $DATABASE_URL -f BELMONTE_HISTORICAL_DATA_AUDIT.sql > belmonte_audit_$(date +%Y%m%d).txt

# View results
cat belmonte_audit_$(date +%Y%m%d).txt
```

---

**Created:** November 6, 2025  
**For:** Belmonte Hotel (Permanent Token Client)  
**Purpose:** Comprehensive past period data audit and diagnosis




