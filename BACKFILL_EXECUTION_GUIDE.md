# 🚀 Data Backfill Execution Guide

**Date:** October 1, 2025  
**Purpose:** Complete guide to audit and backfill all missing client data  
**Estimated Time:** 15-30 minutes

---

## 📋 Overview

This guide will help you:
1. Audit all client data to identify gaps
2. Execute comprehensive backfill for all clients
3. Verify data completeness
4. Monitor the process

---

## 🔍 STEP 1: Run Comprehensive Audit (5 minutes)

### Option A: Via Database (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the entire contents of: `COMPREHENSIVE_DATA_AUDIT.sql`
3. Click **"Run"**
4. Review the output to see:
   - Which clients have missing data
   - Which months are missing
   - Data completeness percentage
   - Priority recommendations

### Option B: Via Terminal

```bash
psql $DATABASE_URL -f COMPREHENSIVE_DATA_AUDIT.sql
```

### Expected Output:

```
============================================
🔍 COMPREHENSIVE DATA AUDIT - ALL CLIENTS
============================================

📊 STEP 1: CLIENT OVERVIEW
============================================
3 clients found
✅ 2 with Meta tokens
✅ 1 with Google tokens

📊 STEP 2: MONTHLY DATA AVAILABILITY
============================================
Client X: 8/12 months available (67%)
Client Y: 3/12 months available (25%)
Client Z: 0/12 months available (0%)

📋 SUMMARY
============================================
🔴 CRITICAL: Major data gaps, immediate backfill required
```

---

## 🔄 STEP 2: Execute Backfill (10-20 minutes)

### Option A: Backfill All Clients, All Platforms, Last 12 Months (Recommended)

```bash
curl -X POST https://your-domain.com/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{
    "monthsToBackfill": 12,
    "clientIds": [],
    "platform": "all",
    "forceRefresh": false
  }'
```

### Option B: Backfill Specific Months Only

```bash
# Last 6 months only
curl -X POST https://your-domain.com/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{
    "monthsToBackfill": 6,
    "platform": "all"
  }'
```

### Option C: Backfill Specific Clients

```bash
curl -X POST https://your-domain.com/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{
    "monthsToBackfill": 12,
    "clientIds": ["client-uuid-1", "client-uuid-2"],
    "platform": "all"
  }'
```

### Option D: Force Refresh Existing Data

```bash
# Re-fetch even if data already exists
curl -X POST https://your-domain.com/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{
    "monthsToBackfill": 12,
    "platform": "all",
    "forceRefresh": true
  }'
```

### Option E: Meta Ads Only

```bash
curl -X POST https://your-domain.com/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{
    "monthsToBackfill": 12,
    "platform": "meta"
  }'
```

### Option F: Google Ads Only

```bash
curl -X POST https://your-domain.com/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{
    "monthsToBackfill": 12,
    "platform": "google"
  }'
```

---

## 📊 STEP 3: Monitor Progress

The backfill endpoint will return real-time progress:

```json
{
  "success": true,
  "summary": {
    "totalClients": 3,
    "totalMonths": 12,
    "totalAttempts": 72,
    "successCount": 68,
    "failedCount": 2,
    "skippedCount": 2,
    "executionTimeMs": 180000,
    "executionTimeReadable": "3m 0s"
  },
  "results": [
    {
      "clientId": "uuid",
      "clientName": "Client Name",
      "month": "2025-09",
      "platform": "meta",
      "status": "success",
      "metrics": {
        "spend": 12500.50,
        "impressions": 150000,
        "clicks": 3200,
        "conversions": 45
      }
    },
    // ... more results
  ]
}
```

### Status Indicators:

- ✅ **success**: Data fetched and stored successfully
- ❌ **failed**: Error occurred (check reason field)
- ⏭️ **skipped**: Data already exists (unless forceRefresh=true)

---

## ✅ STEP 4: Verify Data Completeness

### Option A: Via Reports UI (Easiest)

1. Go to: `/reports` page
2. Select different months from dropdown
3. Verify data appears for all months
4. Check that metrics are populated (not zero)

### Option B: Run Audit Again

```bash
# Re-run the audit script to see updated completeness
psql $DATABASE_URL -f COMPREHENSIVE_DATA_AUDIT.sql
```

Should now show:

```
📊 Data Completeness: 100%
✅ EXCELLENT: Data coverage is very good
```

### Option C: Quick Database Check

```sql
-- Count available months per client
SELECT 
  c.name,
  COUNT(DISTINCT cs.summary_date) as months_available
FROM clients c
LEFT JOIN campaign_summaries cs 
  ON cs.client_id = c.id 
  AND cs.summary_type = 'monthly'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
GROUP BY c.name
ORDER BY months_available DESC;
```

Expected: Each client should have 12 months of data.

---

## 🚨 Troubleshooting

### Issue: "Failed to fetch clients"

**Cause:** Database connection error

**Solution:**
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY  # Should NOT be empty

# Restart dev server
npm run dev
```

---

### Issue: API returns many "failed" statuses

**Cause:** Invalid or expired API tokens

**Solution:**
1. Check client API status:
   ```sql
   SELECT name, api_status, last_token_validation 
   FROM clients;
   ```
2. Update expired tokens in `/admin/clients` page
3. Re-run backfill for those specific clients

---

### Issue: "Rate limit exceeded" errors

**Cause:** Too many API calls in short time

**Solution:**
- The backfill automatically includes delays (1 second between requests)
- If errors persist, run backfill for fewer months:
  ```json
  { "monthsToBackfill": 3 }
  ```
- Wait 1 hour and run again for next batch

---

### Issue: Backfill takes too long (>10 minutes)

**Expected Behavior:**
- 3 clients × 12 months × 2 platforms = 72 requests
- Each request takes ~2-3 seconds
- Total time: ~4-6 minutes

**If slower:**
- Check network connection
- Check Meta/Google Ads API response times
- Consider backfilling fewer months at once

---

### Issue: Some months show $0 spend

**Possible Causes:**
1. Client genuinely had no campaigns that month
2. API token doesn't have permission to access that date range
3. Data doesn't exist in Meta/Google Ads for that period

**Verification:**
```bash
# Check Meta Ads Manager for that month
# If data exists there but not in your system:
# Re-run with forceRefresh: true
```

---

## 📊 Performance Expectations

| Scenario | Expected Time | API Calls |
|----------|--------------|-----------|
| 1 client, 12 months, both platforms | 1-2 minutes | 24 calls |
| 5 clients, 12 months, both platforms | 5-10 minutes | 120 calls |
| 10 clients, 12 months, both platforms | 10-20 minutes | 240 calls |
| 20 clients, 12 months, both platforms | 20-40 minutes | 480 calls |

---

## 🔧 Advanced Usage

### Backfill Single Month for All Clients

```bash
# Use monthly-aggregation endpoint instead
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{
    "year": 2025,
    "month": 9
  }'
```

### Backfill with Custom Date Range

Currently not supported directly, but you can:
1. Run backfill for 12 months
2. Data older than 13 months auto-deletes (by design)
3. If you need older data, modify `monthsToBackfill` parameter

### Run Backfill via Admin UI (Coming Soon)

Future enhancement: Add backfill button to `/admin/data-lifecycle` page

---

## 🎯 Recommended Workflow

### First Time Setup:
```bash
# 1. Run audit
psql $DATABASE_URL -f COMPREHENSIVE_DATA_AUDIT.sql

# 2. Backfill all clients, all data
curl -X POST https://your-domain.com/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{"monthsToBackfill": 12, "platform": "all"}'

# 3. Verify in UI
# Open /reports and check all months
```

### Monthly Maintenance:
```bash
# Should happen automatically via cron
# But can manually trigger if needed:
curl -X POST https://your-domain.com/api/automated/archive-completed-months
```

### Fixing Gaps:
```bash
# 1. Identify gaps with audit
psql $DATABASE_URL -f COMPREHENSIVE_DATA_AUDIT.sql

# 2. Backfill only missing data
curl -X POST https://your-domain.com/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{"monthsToBackfill": 6, "forceRefresh": false}'
```

---

## 📞 Next Steps

After successful backfill:

1. ✅ **Verify Reports Page**
   - All months should show data
   - Metrics should be populated
   - No "Brak Kampanii" messages

2. ✅ **Set Up Monitoring**
   - Enable Vercel cron jobs
   - Set up monthly archival alerts
   - Monitor data completeness weekly

3. ✅ **Enable Automated Archival**
   - Ensure cron job runs on 1st of month
   - Check logs for successful execution
   - Set up email alerts for failures

4. ✅ **Document for Team**
   - Share this guide with team
   - Add to internal documentation
   - Train admins on backfill process

---

## 📋 Quick Reference Commands

```bash
# Audit data
psql $DATABASE_URL -f COMPREHENSIVE_DATA_AUDIT.sql

# Backfill everything
curl -X POST https://your-domain.com/api/backfill-all-client-data \
  -H "Content-Type: application/json" \
  -d '{"monthsToBackfill": 12}'

# Backfill single month
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 9}'

# Check completeness
SELECT name, COUNT(*) as months 
FROM clients c 
JOIN campaign_summaries cs ON cs.client_id = c.id 
WHERE cs.summary_type = 'monthly' 
GROUP BY name;
```

---

## ✅ Success Criteria

Backfill is complete when:

- ✅ Audit shows 100% (or near 100%) completeness
- ✅ Reports page displays all months correctly
- ✅ All metrics are populated (not zero, unless legitimately zero)
- ✅ No error messages in logs
- ✅ Clients can view their historical data

---

**Priority:** 🔴 **HIGH - Data Integrity**  
**Estimated Time:** 15-30 minutes  
**Risk:** Low (read-heavy operation, safe retries)

**Ready to start?** Run the audit first to understand the scope! 🚀

