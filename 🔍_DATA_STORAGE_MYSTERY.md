# 🔍 Data Storage Mystery - Investigation

## Problem
- **Collection log shows**: Weeks 0-5 (Nov 2025) were stored successfully
- **Database shows**: Latest week is 2025-09-01 (September)
- **All records created**: 2025-11-18 (today)

## Evidence

### Collection Log
```
[INFO] 📅 Week 0: 2025-11-10 to 2025-11-16 (COMPLETED)
[INFO] 💾 Stored COMPLETED WEEK summary with enhanced conversion metrics: 72 reservations, 292500 value
[INFO] ✅ Stored COMPLETED weekly summary for Belmonte Hotel week 0
```

### Database Query Results
- Latest week: 2025-09-01
- All records created: 2025-11-18
- Week 2025-09-01 has: 72 reservations (same as week 0 in log!)

## Possible Causes

### 1. **Date Format Mismatch** ⭐⭐⭐
The `summary_date` being stored might not match what we expect.

**Check**: Run `scripts/check-exact-storage-query.sql` to see if data exists with exact parameters.

### 2. **Transaction Rollback** ⭐⭐
The upsert might succeed but then roll back due to a constraint violation or error.

**Check**: Look for any database errors or constraint violations in Supabase logs.

### 3. **Wrong Database/Connection** ⭐
The collection script might be writing to a different database than what the queries are reading from.

**Check**: Verify the Supabase connection strings match.

### 4. **UNIQUE Constraint Issue** ⭐
The upsert might be updating the wrong record due to a constraint mismatch.

**Check**: Verify the UNIQUE constraint `(client_id, summary_type, summary_date, platform)` is working correctly.

### 5. **Date Calculation Bug** ⭐⭐
The `weekData.startDate` might be calculated incorrectly, causing it to match an existing record.

**Check**: Add logging to see the exact `summary_date` value being stored.

## Next Steps

1. **Run diagnostic SQL**: `scripts/check-exact-storage-query.sql`
   - Check if data exists for 2025-11-10
   - Check if ANY November data exists
   - Check records created today

2. **Add detailed logging**: Add a log statement right before the upsert to show:
   ```typescript
   logger.info(`🔍 About to upsert:`, {
     client_id: clientId,
     summary_date: data.summary_date,
     summary_type: 'weekly',
     platform: 'meta',
     totals: data.totals
   });
   ```

3. **Check Supabase logs**: Look for any errors or warnings during the collection period.

4. **Verify connection**: Ensure the collection script and queries use the same Supabase project.

## SQL Queries to Run

```sql
-- Check exact match
SELECT * FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
  AND platform = 'meta'
  AND summary_date = '2025-11-10';

-- Check all November data
SELECT * FROM campaign_summaries
WHERE summary_date >= '2025-11-01'
  AND summary_date <= '2025-11-30'
  AND summary_type = 'weekly'
ORDER BY summary_date DESC;

-- Check records created today
SELECT * FROM campaign_summaries
WHERE DATE(created_at) = '2025-11-18'
  AND summary_type = 'weekly'
ORDER BY created_at DESC
LIMIT 50;
```



