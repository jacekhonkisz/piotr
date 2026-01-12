# ✅ Historical CTR/CPC Backfill - All Clients

## Script Created

**File**: `scripts/backfill-historical-ctr-cpc-all-clients.ts`

This script updates all historical Meta Ads CTR/CPC values in the `campaign_summaries` table to use account-level insights from Meta API.

---

## What It Does

1. **Finds All Clients**: Gets all clients with Meta Ads configured (13 clients found)
2. **Finds All Historical Summaries**: Gets all Meta Ads summaries from `campaign_summaries` (865 summaries found)
3. **Fetches API Values**: For each summary, fetches account-level insights from Meta API
4. **Updates Database**: Updates `average_ctr` and `average_cpc` columns with API values
5. **Skips If Same**: Only updates if values differ by more than 0.01% or 0.01 zł

---

## How to Run

```bash
npx tsx scripts/backfill-historical-ctr-cpc-all-clients.ts
```

**Note**: This may take 10-30 minutes depending on:
- Number of summaries (865 found)
- Number of clients (13 found)
- API rate limiting (100ms delay between calls)

---

## Progress Monitoring

The script shows:
- ✅ **Updated**: Successfully updated with new API values
- ⏭️ **Skipped**: Values already match or no data
- ❌ **Errors**: Failed to fetch or update

**Example Output**:
```
✅ Updated monthly 2024-06-01:
   CTR: 0.00% → 1.52% (diff: 1.52%)
   CPC: 0.00 zł → 0.70 zł (diff: 0.70 zł)
```

---

## Database Updates

The script updates the `campaign_summaries` table:

```sql
UPDATE campaign_summaries
SET 
  average_ctr = <api_value>,
  average_cpc = <api_value>,
  last_updated = NOW()
WHERE id = <summary_id>
```

---

## Verification Query

After the script completes, verify updates:

```sql
-- Check how many summaries were updated recently
SELECT 
  COUNT(*) as total_summaries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '1 hour' THEN 1 END) as recently_updated,
  COUNT(CASE WHEN average_ctr > 0 THEN 1 END) as has_ctr,
  COUNT(CASE WHEN average_cpc > 0 THEN 1 END) as has_cpc
FROM campaign_summaries
WHERE platform = 'meta';
```

---

## Expected Results

- **All historical summaries** will have API values for CTR/CPC
- **Values will match** Meta Business Suite exactly
- **Consistent across** all periods and all clients
- **Formatted** with 2 decimal places in display

---

## Safety Features

1. **Rate Limiting**: 100ms delay between API calls
2. **Error Handling**: Continues processing even if one summary fails
3. **Skip Logic**: Only updates if values actually differ
4. **No Data Skip**: Skips summaries with zero spend/impressions

---

## Status

✅ **Script Created and Ready**
✅ **All Collection Systems Updated** (future data will use API values)
🔄 **Historical Backfill**: Run the script to update existing data

---

## Next Steps

1. **Run the script** to backfill all historical data
2. **Monitor progress** in the console output
3. **Verify results** using the verification query
4. **Check reports** to confirm values match Meta Business Suite

