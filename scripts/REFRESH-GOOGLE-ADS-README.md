# Google Ads Data Refresh Script

## ⚠️ WARNING: DESTRUCTIVE OPERATION

This script will **DELETE ALL** existing Google Ads data and re-fetch everything from the API.

## What It Does

1. **Backs up** existing Google Ads data to `backups/google-ads-backup-{timestamp}.json`
2. **Deletes** all Google Ads records from `campaign_summaries` table
3. **Re-fetches** fresh data from Google Ads API:
   - **Monthly summaries**: Last 12 complete months
   - **Weekly summaries**: Last 53 complete weeks
4. **Stores** fresh data for ALL clients

## When To Use This

- ✅ Historical data is stale/incomplete
- ✅ Discrepancies between database and live API
- ✅ After fixing bugs in data collection logic
- ✅ Monthly summaries were collected mid-month

## Prerequisites

- `.env.local` file with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Valid Google Ads manager refresh token in `system_settings`
- All clients must have `google_ads_enabled=true` and `google_ads_customer_id` set

## Usage

### 1. Dry Run (Test Mode - Recommended First!)

```bash
./scripts/run-google-ads-refresh.sh --dry-run
```

This will:
- Show exactly what would be done
- Test API connections
- No data will be modified
- No backup needed

### 2. Live Run (DESTRUCTIVE!)

```bash
./scripts/run-google-ads-refresh.sh
```

You will be prompted to confirm. Type `yes` to proceed.

### 3. Skip Backup (Not Recommended)

```bash
./scripts/run-google-ads-refresh.sh --skip-backup
```

## What To Expect

### Performance
- **Time**: ~5-10 minutes per client (due to rate limits)
- **API calls**: ~65 per client (12 months + 53 weeks)
- **Rate limiting**: Built-in delays between requests

### Output
```
📋 Step 1: Fetching Google Ads clients...
✅ Found 5 Google Ads clients

🔑 Step 2: Checking Google Ads authentication...
✅ Manager refresh token found

💾 Step 3: Backing up existing Google Ads data...
✅ Backed up 325 records to: backups/google-ads-backup-2025-12-30T12-00-00-000Z.json

🗑️  Step 4: Deleting existing Google Ads summaries...
✅ Deleted all existing Google Ads summaries

🔄 Step 5: Re-fetching fresh data from Google Ads API...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Client 1/5: Havet
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Collecting monthly summaries (last 12 months)...
   📅 2024-11... ✅ 10 campaigns, 15234.50 zł
   📅 2024-10... ✅ 12 campaigns, 18456.75 zł
   ...
✅ Collected 12 monthly summaries

📅 Collecting weekly summaries (last 53 weeks)...
   📅 Week 1/53 (2024-12-23)... ✅ 10 campaigns, 3456.25 zł
   ...
✅ Collected 53 weekly summaries

...

═══════════════════════════════════════════════════════════
🎉 DATA REFRESH COMPLETE!
═══════════════════════════════════════════════════════════

✅ Successfully processed: 5/5 clients
📊 Total monthly summaries: 60
📊 Total weekly summaries: 265
⏱️  Total time: 342.5s
```

## Recovery

If something goes wrong, restore from backup:

```sql
-- In Supabase SQL Editor
-- 1. Copy content from backup JSON file
-- 2. Run:
INSERT INTO campaign_summaries
SELECT * FROM json_populate_recordset(NULL::campaign_summaries, '[
  -- paste backup JSON here
]');
```

## Troubleshooting

### Error: "No manager refresh token found"
**Solution**: Run `node scripts/generate-new-refresh-token.js` first

### Error: "Failed to collect data for {client}"
**Cause**: Invalid customer ID or API access issue
**Solution**: Check `google_ads_customer_id` in clients table

### Error: "Rate limit exceeded"
**Cause**: Too many API calls
**Solution**: Script has built-in delays, but wait 5 minutes and retry

## Technical Details

### Data Sources
- **Source**: Google Ads API (live data only)
- **Stored in**: `campaign_summaries` table with `platform='google'`
- **Metrics**: All conversion actions, spend, impressions, clicks, CTR, CPC, ROAS

### Conversion Logic
The script uses `metrics.all_conversions` (includes view-through, cross-device) instead of `metrics.conversions` (cross-platform only), which can result in higher conversion numbers than the Google Ads UI default view.

### Rate Limiting
- 100ms delay between weeks
- 2s delay between clients
- Respects Google Ads API quotas

## Files Modified
- `campaign_summaries` table (deleted and re-populated)
- `backups/google-ads-backup-{timestamp}.json` (created)

## Files NOT Modified
- `google_ads_current_month_cache` (kept as-is)
- `google_ads_current_week_cache` (kept as-is)
- `daily_kpi_data` (kept as-is)
- Individual client settings

## Next Steps After Running

1. **Verify data**: Check dashboard for historical periods
2. **Compare**: Check if discrepancies are resolved
3. **Monitor**: Ensure automated collection continues working
4. **Clean up**: Delete test files if any were created

## Support

If issues persist after running this script, check:
1. Google Ads API access and permissions
2. Manager account access to all client accounts
3. System settings for correct credentials
4. Supabase logs for database errors

