# Meta Ads CTR/CPC Backfill - Fixed Script

## Issue Fixed

The script was trying to insert columns that don't exist in the `campaigns` table:
- ❌ `cpm` (doesn't exist)
- ❌ `email_contacts` (doesn't exist)
- ❌ `reservations` (doesn't exist - uses `purchase` instead)
- ❌ `reservation_value` (doesn't exist - uses `purchase_value` instead)
- ❌ `platform` (doesn't exist in unique constraint)

## Fixed Mapping

Now uses correct column names from the `campaigns` table schema:
- ✅ `purchase` (stores reservations count)
- ✅ `purchase_value` (stores reservation value)
- ✅ `cpp` (cost per 1000 people)
- ✅ `ctr`, `cpc` (using API values directly)
- ✅ `booking_step_1`, `booking_step_2`, `booking_step_3`
- ✅ `click_to_call`
- ✅ `roas`, `cost_per_reservation`

## How to Run

```bash
# Run the fixed backfill script
npx tsx scripts/backfill-all-meta-ctr-cpc.ts
```

This will:
1. Fetch fresh data from Meta API for all historical months
2. Use `inline_link_click_ctr` and `cost_per_inline_link_click` directly from API
3. Update campaigns table with correct CTR/CPC values
4. Update campaign_summaries with aggregated totals

## Expected Result

After completion:
- All historical campaign CTR/CPC values will match Meta Business Suite
- Individual campaigns show API values directly
- Summary cards recalculate from totals

