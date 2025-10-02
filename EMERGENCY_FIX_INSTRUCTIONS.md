# 🚨 EMERGENCY DATABASE FIX INSTRUCTIONS

**Date:** October 1, 2025  
**Critical Issue:** `campaign_summaries` table DOES NOT EXIST  
**Impact:** Complete failure of reports system, ALL historical data inaccessible  
**Priority:** 🔴 **IMMEDIATE ACTION REQUIRED**

---

## 🎯 **WHAT HAPPENED**

The `campaign_summaries` table, which is the **foundation** of your entire data persistence system, was **NEVER CREATED** in your production database. This means:

- ❌ **NO historical data has been saved** (not just September)
- ❌ **All months before October are lost** (never stored)
- ❌ **Archival system has been silently failing** for months
- ❌ **Reports page cannot load any historical periods**

This is not a "September didn't save" issue - this is a **"nothing has ever been saved"** catastrophe.

---

## 🔥 **IMMEDIATE FIX PROCEDURE**

### **Step 1: Run the Emergency Schema Fix** ⏰ **DO THIS NOW**

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Navigate to: **SQL Editor**

2. **Copy and paste the ENTIRE contents of:** `DATABASE_SCHEMA_EMERGENCY_FIX.sql`

3. **Click "Run"**

4. **Verify success:**
   - You should see: `✅ All critical tables exist!`
   - Check table counts at the bottom of the output

**Expected output:**
```
NOTICE: ✅ All critical tables exist!

table_name          | row_count
--------------------|----------
campaign_summaries  | 0
current_month_cache | 1-3
current_week_cache  | 1-3
daily_kpi_data      | 0-90
```

---

### **Step 2: Verify Tables Now Exist**

Run this query in Supabase SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'campaign_summaries',
    'current_month_cache', 
    'current_week_cache',
    'daily_kpi_data'
  )
ORDER BY table_name;
```

**Expected result:** 4 rows showing all 4 tables

If you see all 4 tables → ✅ **Schema fix successful!**

---

### **Step 3: Check What Data You Currently Have**

Run these queries:

```sql
-- Check current month cache (October 2025)
SELECT 
  client_id,
  period_id,
  last_refreshed,
  EXTRACT(EPOCH FROM (NOW() - last_refreshed)) / 3600 as hours_old
FROM current_month_cache
ORDER BY last_refreshed DESC;
```

**If you have October cache data** → This can be preserved for October reports ✅

```sql
-- Check daily KPI data (may have recent days)
SELECT 
  date,
  SUM(total_spend) as spend,
  SUM(total_impressions) as impressions
FROM daily_kpi_data
WHERE date >= '2025-09-01'
GROUP BY date
ORDER BY date DESC;
```

**If you have September daily data** → We can reconstruct September from this! ✅

---

## 📊 **DATA RECOVERY OPTIONS**

### **Option A: Recover September 2025 from Daily Data** (If available)

If Step 3 showed daily_kpi_data for September, you can aggregate it:

1. **Go to your app:** `https://your-domain.com/admin/data-lifecycle`

2. **Or run this API call:**
```bash
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "month": 9
  }'
```

This will:
- Aggregate all daily records for September
- Create a monthly summary in `campaign_summaries`
- Make September appear in reports

---

### **Option B: Fetch September from Meta/Google Ads API** (If no daily data)

If daily data doesn't exist, fetch directly from APIs:

```bash
curl -X POST https://your-domain.com/api/generate-report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY" \
  -d '{
    "clientId": "YOUR_CLIENT_UUID",
    "dateRange": {
      "start": "2025-09-01",
      "end": "2025-09-30"
    }
  }'
```

**⚠️ Important:**
- Replace `YOUR_CLIENT_UUID` with actual client ID
- Get client IDs: `SELECT id, name, email FROM clients;`
- This will fetch September data and save to database
- Repeat for each client

---

### **Option C: Fetch Multiple Past Months** (If you need historical data)

For each month you want to recover (August, July, June, etc.):

```bash
# August 2025
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 8}'

# July 2025
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 7}'

# June 2025
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 6}'
```

**⚠️ Limitations:**
- Meta/Google Ads API has data retention limits (~90 days for detailed data)
- Older data may have limited granularity
- This counts against API rate limits

---

## ✅ **VERIFY THE FIX**

### **1. Check campaign_summaries has data:**

```sql
SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  COUNT(*) as records,
  SUM(total_spend) as total_spend
FROM campaign_summaries
GROUP BY month, summary_type
ORDER BY month DESC, summary_type;
```

**Expected result:**
- At least September 2025 monthly records
- If you recovered more months, they should appear here

---

### **2. Test Reports Page:**

1. Go to: `https://your-domain.com/reports`
2. Change dropdown to: **September 2025**
3. Data should load successfully ✅

If September shows data → **FIX SUCCESSFUL!** 🎉

---

## 🔧 **ROOT CAUSE: Why Was The Table Missing?**

### **Likely Causes:**

1. **Migration Never Ran in Production**
   - The file `013_add_campaign_summaries.sql` exists in codebase
   - But Supabase never executed it
   - Possibly:
     - Migration files not synced to Supabase
     - Manual migration required but not done
     - Supabase CLI not used for deployment

2. **Database Was Reset/Recreated**
   - Production database was wiped and recreated
   - Only base schema (from first migration) was restored
   - Later migrations not re-applied

3. **Manual Table Deletion**
   - Table was accidentally dropped
   - No backup/recovery performed

---

## 🛠️ **PREVENT THIS FROM HAPPENING AGAIN**

### **1. Set Up Migration Monitoring**

Create a cron job to verify critical tables exist:

```sql
-- Run this weekly
CREATE OR REPLACE FUNCTION check_critical_tables()
RETURNS TABLE(table_name TEXT, exists BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.name::TEXT,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = t.name)
  FROM (VALUES 
    ('campaign_summaries'),
    ('current_month_cache'),
    ('current_week_cache'),
    ('daily_kpi_data'),
    ('clients'),
    ('profiles')
  ) AS t(name);
END;
$$ LANGUAGE plpgsql;
```

---

### **2. Add Admin Health Check Page**

Create: `/admin/system-health` that checks:
- [ ] All critical tables exist
- [ ] Last archival ran successfully  
- [ ] Current month cache is fresh (<4 hours old)
- [ ] No gaps in monthly data for last 13 months

---

### **3. Set Up Daily Data Verification**

**Cron job: Every day at 9 AM**
```typescript
// /api/automated/verify-database-health
export async function GET() {
  const missingTables = await checkForMissingTables();
  
  if (missingTables.length > 0) {
    await sendAlertEmail({
      subject: '🚨 CRITICAL: Database tables missing!',
      body: `Missing tables: ${missingTables.join(', ')}`,
      to: 'admin@yourdomain.com'
    });
  }
  
  const dataGaps = await checkForDataGaps();
  
  if (dataGaps.length > 0) {
    await sendAlertEmail({
      subject: '⚠️ WARNING: Data gaps detected',
      body: `Missing data for periods: ${dataGaps.join(', ')}`,
      to: 'admin@yourdomain.com'
    });
  }
}
```

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/automated/verify-database-health",
      "schedule": "0 9 * * *"
    }
  ]
}
```

---

### **4. Enable Supabase Database Backups**

1. Go to: **Supabase Dashboard** → **Settings** → **Database**
2. Enable **Daily Backups**
3. Set retention: **30 days**
4. Enable **Point-in-Time Recovery** (if on Pro plan)

---

## 📝 **POST-FIX CHECKLIST**

- [ ] **STEP 1:** Run `DATABASE_SCHEMA_EMERGENCY_FIX.sql` in Supabase
- [ ] **STEP 2:** Verify all 4 critical tables exist
- [ ] **STEP 3:** Check what current data you have (cache + daily)
- [ ] **STEP 4:** Recover September 2025 data
- [ ] **STEP 5:** Test reports page shows September
- [ ] **STEP 6:** (Optional) Recover older months if needed
- [ ] **STEP 7:** Set up monitoring to prevent recurrence
- [ ] **STEP 8:** Enable database backups
- [ ] **STEP 9:** Document migration process for team
- [ ] **STEP 10:** Schedule monthly data audits

---

## 🆘 **IF SOMETHING GOES WRONG**

### **Error: "relation already exists"**
- **Cause:** Table exists but wasn't detected
- **Fix:** The script uses `CREATE TABLE IF NOT EXISTS` so it's safe to re-run

### **Error: "foreign key violation"**
- **Cause:** `clients` table doesn't exist
- **Fix:** Run initial schema migration first: `001_initial_schema.sql`

### **Error: "permission denied"**
- **Cause:** Not using service role key
- **Fix:** Use Supabase service role key (not anon key)

### **Reports still show no data**
- **Cause:** Tables exist but are empty
- **Fix:** Run data recovery (Option A or B above)

### **Cron jobs still not working**
- **Cause:** Vercel cron not enabled or misconfigured
- **Fix:** Check Vercel dashboard → Cron Jobs → Ensure enabled in production

---

## 📞 **SUPPORT**

If you need help:

1. **Check what tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

2. **Check for errors in logs:**
   - Vercel: Dashboard → Logs → Filter by "error"
   - Supabase: Dashboard → Logs → API logs

3. **Share this information:**
   - Which tables exist
   - What errors appear in logs
   - Output from verification queries

---

## 🎯 **EXPECTED TIMELINE**

- **Step 1-2 (Create tables):** 2 minutes
- **Step 3-4 (Verify data):** 5 minutes
- **Step 5 (Recover September):** 5-10 minutes
- **Step 6 (Test):** 2 minutes
- **Step 7+ (Prevention):** 30-60 minutes

**Total time to restore functionality:** ~15-20 minutes  
**Total time including prevention:** ~1-2 hours

---

## ✅ **SUCCESS CRITERIA**

Fix is complete when:

1. ✅ All 4 critical tables exist in database
2. ✅ `campaign_summaries` has at least September 2025 data
3. ✅ Reports page successfully loads September 2025
4. ✅ No errors in browser console when viewing reports
5. ✅ Monitoring system in place to prevent recurrence

---

**PRIORITY:** 🔴 **CRITICAL - START IMMEDIATELY**

This is a production outage. Your entire reports system is non-functional until this is fixed.

Good news: The fix is straightforward, and you can recover recent data. But you need to act **NOW** before more data is lost.

