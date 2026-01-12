# Backfill Missing Google Ads Weeks - Complete Guide

## 🎯 Goal
Backfill all missing Google Ads weekly data for all clients.

## 📊 Step 1: Identify Missing Weeks

### Option A: SQL Query (Fastest)
Run in Supabase SQL Editor:
```sql
-- scripts/identify-missing-google-ads-weeks.sql
```

This shows:
- Which weeks are missing for each client
- Summary of completion status
- Total missing weeks count

### Option B: TypeScript Script
```bash
# Will be created if needed
```

## 🔄 Step 2: Backfill Missing Weeks

### Option A: Direct Collection (Recommended)
**Use this if you want to collect specific missing weeks:**

```bash
npx tsx scripts/backfill-all-missing-google-ads-weeks.ts
```

**What it does:**
- ✅ Identifies missing weeks for each client
- ✅ Collects only missing weeks (skips existing)
- ✅ Uses proper API method (booking steps from API)
- ✅ Stores with correct structure
- ✅ Shows progress for each week

**Time:** ~5-10 minutes per client (depending on missing weeks)

### Option B: Via API Endpoint (Simpler)
**Use this if you want to trigger full collection:**

```bash
npx tsx scripts/backfill-missing-weeks-via-api.ts
```

**What it does:**
- ✅ Triggers weekly collection API for each client
- ✅ Collects last 53 weeks (may include existing)
- ✅ Uses background collector logic
- ✅ Runs in background

**Time:** ~5-15 minutes per client (full 53 weeks)

### Option C: Quick Shell Script
```bash
./scripts/quick-backfill-missing-weeks.sh
```

## 📈 Step 3: Monitor Progress

```bash
npx tsx scripts/monitor-google-ads-weekly-collection.ts
```

Or check SQL:
```sql
SELECT 
  c.name,
  COUNT(DISTINCT cs.summary_date) as weeks_collected,
  MIN(cs.summary_date) as oldest_week,
  MAX(cs.summary_date) as newest_week
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id 
  AND cs.platform = 'google' 
  AND cs.summary_type = 'weekly'
WHERE c.google_ads_customer_id IS NOT NULL
GROUP BY c.id, c.name
ORDER BY weeks_collected DESC;
```

## ✅ Expected Results

After backfill:
- ✅ All clients should have 53 weeks (or close to it)
- ✅ All weeks should have booking steps from API
- ✅ No missing weeks in the last 53 weeks
- ✅ Data stored with `platform='google'` and `summary_type='weekly'`

## 🔍 Verification

Check if backfill worked:
```sql
-- Should show 53 weeks for each client
SELECT 
  c.name,
  COUNT(*) as weeks,
  MIN(cs.summary_date) as oldest,
  MAX(cs.summary_date) as newest
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'weekly'
GROUP BY c.id, c.name
ORDER BY weeks DESC;
```

## ⚠️ Troubleshooting

### Issue: Some weeks still missing
**Solution:** Run the direct collection script again - it will only collect missing weeks

### Issue: Booking steps are 0
**Solution:** This is expected if there were no conversions. Check if spend > 0 but steps = 0 (this is correct if no conversions happened)

### Issue: Script times out
**Solution:** Run for one client at a time, or use the API endpoint method which runs in background

## 📝 Notes

- **Booking Steps:** Always from API (not daily_kpi_data)
- **Date Range:** Each week is Monday to Sunday (ISO 8601)
- **Storage:** `summary_date` = Monday of the week
- **Platform:** Always `platform='google'` for Google Ads
- **Type:** Always `summary_type='weekly'` for weekly data

