# 🚀 HOW TO RUN BELMONTE PAST PERIOD AUDIT

## Quick Start

### Option 1: Using Supabase CLI (Recommended)

```bash
# 1. Install Supabase CLI if not already installed
npm install -g supabase

# 2. Link to your project (if not already linked)
supabase link --project-ref <your-project-ref>

# 3. Run the audit SQL file
supabase db reset --linked
psql $(supabase status | grep 'DB URL' | awk '{print $3}') -f BELMONTE_HISTORICAL_DATA_AUDIT.sql
```

### Option 2: Using psql Directly

```bash
# Replace with your actual database connection string
psql "postgresql://postgres:[password]@[host]:[port]/postgres" \
  -f BELMONTE_HISTORICAL_DATA_AUDIT.sql \
  > belmonte_audit_results.txt

# View results
cat belmonte_audit_results.txt
```

### Option 3: Using Supabase Dashboard (Manual)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy contents of `BELMONTE_HISTORICAL_DATA_AUDIT.sql`
5. Paste and execute
6. Review results in dashboard

### Option 4: Using Node.js Script

```javascript
// create file: run-belmonte-audit.js
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runAudit() {
  const sqlFile = fs.readFileSync('BELMONTE_HISTORICAL_DATA_AUDIT.sql', 'utf8');
  
  // Split by SELECT statements and run each query
  const queries = sqlFile.split(';').filter(q => q.trim().startsWith('SELECT'));
  
  for (const query of queries) {
    console.log('\n=== Running Query ===');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: query });
    if (error) {
      console.error('Error:', error);
    } else {
      console.table(data);
    }
  }
}

runAudit();
```

Then run:
```bash
node run-belmonte-audit.js > audit_results.txt
```

---

## 📋 Expected Output Sections

The audit will produce 10 sections:

### 1. Client Info
- Verify Belmonte has permanent token ✅
- Check Google Ads enabled status

### 2. Stored Periods Overview
```
Platform | Type    | Count | Earliest   | Latest     | Total Spend
---------|---------|-------|------------|------------|-------------
meta     | monthly | 13    | 2024-10-01 | 2025-10-01 | 250,000 PLN
google   | monthly | 13    | 2024-10-01 | 2025-10-01 | 180,000 PLN
```

### 3. Monthly Data Detail (Meta)
- Last 12 months, one row per month
- Shows spend, conversions, campaign data status

### 4. Monthly Data Detail (Google)
- Last 12 months, one row per month
- Shows spend, conversions, campaign data status

### 5. Weekly Data
- Last 3 months of weekly periods
- Both platforms

### 6. Past Year Data (2024)
- For year-over-year comparisons
- Should show all 12 months of 2024

### 7. Data Quality Issues
- Zero spend records
- Missing conversions
- Empty campaign_data

### 8. Daily KPI Data
- Last 90 days granular metrics
- Both platforms

### 9. Current Cache Status
- current_month_cache freshness
- current_week_cache freshness

### 10. Executive Summary
```
Client: Belmonte Hotel
Meta months stored: 13
Google months stored: 13
Earliest data: 2024-01-01
Latest data: 2025-11-01
Zero spend records: 0
Empty campaign data: 0
```

---

## 🔍 What to Look For

### ✅ GOOD SIGNS (Healthy System)

```
✅ Meta months stored: 12-13
✅ Google months stored: 12-13
✅ Earliest data: 2024-XX-XX or earlier
✅ Zero spend records: 0
✅ Empty campaign data: 0
✅ All periods have conversions > 0
✅ Cache updated < 3 hours ago
```

### 🟡 WARNING SIGNS (Needs Attention)

```
⚠️ Meta months stored: 6-11 (incomplete)
⚠️ Some zero spend records (1-5)
⚠️ Some empty campaign data (1-5)
⚠️ Gaps in date coverage
⚠️ Cache updated 3-24 hours ago
```

### 🔴 CRITICAL ISSUES (Requires Immediate Fix)

```
❌ Meta months stored: 0-5 (critical gap)
❌ Many zero spend records (>5)
❌ All campaign data empty
❌ No 2024 data (can't do YoY)
❌ Cache updated >24 hours ago
❌ All conversions = 0
```

---

## 🛠️ Interpreting Results

### Issue #1: No Historical Data

**Result Shows:**
```
Meta months stored: 0
Google months stored: 0
```

**Diagnosis:** Database is empty, no historical data collected

**Fix:**
```bash
# Run background data collector manually
node scripts/collect-historical-data.js
```

---

### Issue #2: Missing Campaign Details

**Result Shows:**
```
Empty campaign data: 13 (all records)
Campaign data status: ❌ EMPTY ARRAY
```

**Diagnosis:** Aggregate metrics stored, but campaign details not saved

**Fix:**
1. Check `src/lib/background-data-collector.ts`
2. Ensure `campaign_data` JSONB field populated
3. Re-run collector to fix

---

### Issue #3: No 2024 Data

**Result Shows:**
```
Earliest data: 2025-01-01
Past year data (2024): 0 records
```

**Diagnosis:** Can't do year-over-year comparisons (no previous year)

**Fix Options:**
A. Backfill from Meta API (if data available)
B. Disable YoY feature until 12+ months collected
C. Generate test data for development

---

### Issue #4: Data Fetch Not Using Database

**Server Logs Show:**
```
⚠️ CURRENT PERIOD: Using smart cache for 2024-10-01
```

**Should Show:**
```
✅ HISTORICAL PERIOD: Checking campaign_summaries FIRST
```

**Diagnosis:** Period classification logic broken

**Fix:**
1. Check `src/lib/standardized-data-fetcher.ts` lines 199-247
2. Verify date comparison logic
3. Ensure historical periods detected correctly

---

## 📊 Sample Healthy Output

```sql
=== EXECUTIVE SUMMARY ===

client          : 🏨 Belmonte Hotel
meta_months     : 13
google_months   : 13
earliest_data   : 2024-01-01
latest_data     : 2025-11-01
zero_spend      : 0
empty_campaigns : 0

✅ ALL CHECKS PASSED - System is healthy!
```

---

## 🚨 Sample Problem Output

```sql
=== EXECUTIVE SUMMARY ===

client          : 🏨 Belmonte Hotel
meta_months     : 3 ❌
google_months   : 0 ❌
earliest_data   : 2025-09-01 ⚠️
latest_data     : 2025-11-01 ✅
zero_spend      : 10 ❌
empty_campaigns : 3 ⚠️

❌ CRITICAL ISSUES DETECTED!
```

**Interpretation:**
- Only 3 months of Meta data (need 13)
- No Google data at all
- No historical data before Sept 2025
- 10 records with zero spend
- 3 records with empty campaign details

**Action Required:**
1. Run background data collector
2. Backfill missing months
3. Check Google Ads integration
4. Verify Meta API permissions

---

## 🎯 Next Steps After Audit

### If System is Healthy ✅

1. Document findings
2. Set up monitoring alerts
3. Schedule regular audits (monthly)
4. No action needed

### If Issues Found 🔴

1. **Create issue ticket** with audit results
2. **Prioritize fixes**:
   - Critical: No data / All zeros
   - High: Missing periods / YoY not working
   - Medium: Some empty records
   - Low: Cache slightly stale
3. **Apply fixes** from audit report
4. **Re-run audit** to verify fix
5. **Test frontend** to confirm working

---

## 📞 Support Resources

### Documentation
- `BELMONTE_PAST_PERIOD_AUDIT_REPORT.md` - Full analysis
- `BELMONTE_DATA_FETCHING_COMPREHENSIVE_AUDIT.md` - System deep dive
- `DATA_FETCHING_PAST_VS_CURRENT_AUDIT.md` - Period comparison

### Code References
- `src/lib/standardized-data-fetcher.ts` - Fetching logic
- `src/lib/background-data-collector.ts` - Data collection
- `src/app/api/fetch-live-data/route.ts` - API endpoint

### SQL Files
- `BELMONTE_HISTORICAL_DATA_AUDIT.sql` - This audit
- `BELMONTE_DATA_INVESTIGATION.sql` - Manual investigation
- `DATABASE_SCHEMA_EMERGENCY_FIX.sql` - Schema reference

---

## ⚡ Quick Troubleshooting

### "Permission denied" error

```bash
# Make sure you're using service role key, not anon key
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### "Table does not exist" error

```bash
# Verify campaign_summaries table exists
psql $DATABASE_URL -c "\dt campaign_summaries"

# If missing, run migrations
supabase db reset --linked
```

### "No data returned" for all queries

```bash
# Check if Belmonte client exists
psql $DATABASE_URL -c "SELECT id, name FROM clients WHERE name ILIKE '%belmonte%';"

# If different ID, update SQL file with correct UUID
```

---

## 🎁 Bonus: One-Line Health Check

```bash
# Quick health check without full audit
psql $DATABASE_URL -c "
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT summary_date) as unique_periods,
  MIN(summary_date) as earliest,
  MAX(summary_date) as latest,
  SUM(total_spend) as total_spend
FROM campaign_summaries 
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';
"
```

**Expected Healthy Output:**
```
total_records | unique_periods | earliest   | latest     | total_spend
-------------|----------------|------------|------------|-------------
26           | 13             | 2024-01-01 | 2025-11-01 | 500000.00
```

---

**Ready to run the audit?**

```bash
# Execute the comprehensive audit now
psql $DATABASE_URL -f BELMONTE_HISTORICAL_DATA_AUDIT.sql > results.txt
cat results.txt
```

Good luck! 🚀




