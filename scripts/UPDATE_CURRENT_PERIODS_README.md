# Update Current Periods with API Values

## Purpose

This script updates the current month and current week data with proper values fetched directly from API:

- **Meta Ads**: Updates CPC/CTR from API (not calculated from totals)
- **Google Ads**: Updates booking steps from API (not from `daily_kpi_data`)

## What It Does

1. **For Meta Ads Clients**:
   - Fetches fresh data from Meta API for current month and current week
   - Gets account-level CPC/CTR from API (or weighted average from campaigns)
   - Updates:
     - `current_month_cache` table
     - `current_week_cache` table
     - `campaign_summaries` table (for current month/week)

2. **For Google Ads Clients**:
   - Fetches fresh data from Google Ads API for current month and current week
   - Gets booking steps directly from API campaigns
   - Updates:
     - `google_ads_current_month_cache` table
     - `campaign_summaries` table (for current month/week)

## Usage

```bash
# Make sure you have the environment variables set:
# - NEXT_PUBLIC_SUPABASE_URL
# - SUPABASE_SERVICE_ROLE_KEY
# - GOOGLE_ADS_CLIENT_ID (if using Google Ads)
# - GOOGLE_ADS_CLIENT_SECRET (if using Google Ads)

# Run the script
npx tsx scripts/update-current-periods-with-api-values.ts
```

## What Gets Updated

### Meta Ads
- `average_ctr` - From account-level API insights or weighted average from campaigns
- `average_cpc` - From account-level API insights or weighted average from campaigns

### Google Ads
- `booking_step_1` - From API campaigns (aggregated)
- `booking_step_2` - From API campaigns (aggregated)
- `booking_step_3` - From API campaigns (aggregated)
- `reservations` - From API campaigns (aggregated)
- `reservation_value` - From API campaigns (aggregated)

## Important Notes

1. **Only Updates Existing Records**: The script only updates records that already exist in the database. It doesn't create new records.

2. **Current Periods Only**: Only updates the current month and current week. Historical periods are not affected.

3. **API Rate Limits**: The script includes a 1-second delay between clients to avoid hitting API rate limits.

4. **Error Handling**: If a client fails, the script continues with the next client and reports all failures at the end.

## Output

The script provides detailed console output showing:
- Which clients are being processed
- What data is being fetched from API
- What values are being updated
- Summary of successful and failed updates

## When to Run

Run this script:
- After deploying the fixes for Meta CPC/CTR and Google Ads booking steps
- When you notice incorrect values in current periods
- As part of a data correction process
- After fixing API integration issues

## Example Output

```
🚀 Starting update of current periods with API values...

📅 Current Periods:
   Month: 2026-01 (2026-01-01 to 2026-01-31)
   Week: 2026-W03 (2026-01-13 to 2026-01-19)

📊 Found 5 active clients

============================================================
📱 Processing: Client Name (client-id)
============================================================

🔵 META ADS:
   📅 Updating current month: 2026-01
   🔄 Fetching fresh data from Meta API...
   ✅ Using account-level API values: CTR=1.23%, CPC=0.98
   ✅ Updated current_month_cache
   ✅ Updated campaign_summaries (monthly)

   📅 Updating current week: 2026-W03
   🔄 Fetching fresh data from Meta API...
   ✅ Using weighted average from campaigns: CTR=1.25%, CPC=0.99
   ✅ Updated current_week_cache
   ✅ Updated campaign_summaries (weekly)

🔴 GOOGLE ADS:
   📅 Updating current month: 2026-01
   🔄 Fetching fresh data from Google Ads API...
   ✅ Booking steps from API: Step1=150, Step2=120, Step3=100, Reservations=80
   ✅ Updated google_ads_current_month_cache
   ✅ Updated campaign_summaries (monthly)

============================================================
📊 UPDATE SUMMARY
============================================================
✅ Successful: 8
❌ Failed: 0
📊 Total: 8

✅ Update complete!
```

