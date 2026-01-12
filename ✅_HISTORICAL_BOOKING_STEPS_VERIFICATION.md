# ✅ Historical Booking Steps Verification

## How Historical Data Is Fetched

### For Past Months (e.g., December 2025)

```
User Views December 2025
    ↓
fetch-google-ads-live-data/route.ts
    ↓
loadFromDatabase(clientId, '2025-12-01', '2025-12-31')
    ↓
SELECT * FROM campaign_summaries
WHERE client_id = X
  AND platform = 'google'
  AND summary_date = '2025-12-01'
  AND summary_type = 'monthly'
    ↓
Read booking_step_1, booking_step_2, booking_step_3 columns
    ↓
Display in ConversionFunnel with "Booking step 1/2/3" labels
```

### Code Location

**File:** `src/app/api/fetch-google-ads-live-data/route.ts`

**Lines 256-274:** Reads booking steps from `campaign_summaries` columns
```typescript
if (storedSummary.booking_step_1 !== null) {
  conversionMetrics = {
    booking_step_1: Math.round(storedSummary.booking_step_1 || 0),
    booking_step_2: Math.round(storedSummary.booking_step_2 || 0),
    booking_step_3: Math.round(storedSummary.booking_step_3 || 0),
    // ...
  };
}
```

**Lines 283-295:** Fallback - aggregates from `campaign_data` JSONB
```typescript
else {
  conversionMetrics = {
    booking_step_1: Math.round(campaigns.reduce((sum, c) => 
      sum + (c.booking_step_1 || 0), 0)),
    booking_step_2: Math.round(campaigns.reduce((sum, c) => 
      sum + (c.booking_step_2 || 0), 0)),
    booking_step_3: Math.round(campaigns.reduce((sum, c) => 
      sum + (c.booking_step_3 || 0), 0)),
    // ...
  };
}
```

### Priority Order

1. **PRIORITY 1:** Read from `campaign_summaries` aggregated columns
   - `booking_step_1`, `booking_step_2`, `booking_step_3`
   - Fast, direct read
   
2. **FALLBACK:** Calculate from `campaign_data` JSONB
   - Sums `booking_step_1/2/3` from each campaign in the JSONB array
   - Slower but works if columns are null/missing

---

## The Problem with December 2025

Based on previous diagnostics:
- December 2025 has `booking_step_1 = 0`, `booking_step_2 = 0`, `booking_step_3 = 0` in `campaign_summaries`
- The `campaign_data` JSONB also has zeros (checked in previous SQL)
- Both sources have zeros because data was never collected (missing refresh token)

### What the UI Shows

When you view December 2025 Google Ads data:
1. API reads `campaign_summaries` for December
2. Finds `booking_step_1 = 0`, `booking_step_2 = 0`, `booking_step_3 = 0`
3. Displays zeros in the funnel
4. Shows "Booking step 1", "Booking step 2", "Booking step 3" labels (✅ correct)

---

## Verification Diagnostic

Run `DIAGNOSTIC_HISTORICAL_BOOKING_STEPS.sql` to check:

### What it checks:
1. **Step 1:** What's in `campaign_summaries` columns for December?
2. **Step 2:** What's in `campaign_data` JSONB for December?
3. **Step 3:** Are they consistent?
4. **Step 4:** What will the API actually show users?
5. **Step 5:** How does January compare? (should have data if token is working)
6. **Step 6:** Final diagnosis with totals

### Expected Results (Before Fix):

```
6️⃣ FINAL DIAGNOSIS
  december_records: 12
  records_with_step1: 0
  records_with_step2: 0
  records_with_step3: 0
  total_step1: 0
  total_step2: 0
  total_step3: 0
  conclusion: "❌ December has NO booking steps - need to run fetch script + backfill"
```

### Expected Results (After Fix):

```
6️⃣ FINAL DIAGNOSIS
  december_records: 12
  records_with_step1: 12
  records_with_step2: 12
  records_with_step3: 12
  total_step1: >0
  total_step2: >0
  total_step3: >0
  conclusion: "✅ December has booking steps in campaign_summaries"
```

---

## The Fix

### Why December Shows Zeros

```
December 2025:
  Token was missing → API couldn't fetch → Data never collected
  ↓
  google_ads_campaigns table: booking_step_1/2/3 = 0
  ↓
  campaign_summaries table: booking_step_1/2/3 = 0
  ↓
  UI shows: "Booking step 1: 0", "Booking step 2: 0", "Booking step 3: 0"
```

### How to Fix

```bash
# Step 1: Fetch December data from Google Ads API (has historical data)
npx tsx scripts/fetch-december-2025-google-ads.ts

# Step 2: Backfill campaign_summaries from the fetched data
# Run BACKFILL_ALL_CLIENTS_DECEMBER_COMPLETE.sql in Supabase
```

After running these:
```
December 2025:
  Google Ads API → Fetch historical data with booking steps
  ↓
  google_ads_campaigns table: booking_step_1/2/3 = REAL VALUES
  ↓
  Backfill SQL updates campaign_summaries: booking_step_1/2/3 = REAL VALUES
  ↓
  UI shows: "Booking step 1: 1234", "Booking step 2: 567", "Booking step 3: 89"
```

---

## Summary

### ✅ Confirmed: Historical data DOES fetch booking steps

**Code verification:**
- Line 267: `booking_step_1: Math.round(storedSummary.booking_step_1 || 0)`
- Line 270: `booking_step_2: Math.round(storedSummary.booking_step_2 || 0)`
- Line 271: `booking_step_3: Math.round(storedSummary.booking_step_3 || 0)`

**Fallback verification:**
- Line 286: Aggregates `booking_step_1` from `campaign_data` JSONB
- Line 289: Aggregates `booking_step_2` from `campaign_data` JSONB
- Line 290: Aggregates `booking_step_3` from `campaign_data` JSONB

### ✅ Confirmed: Labels are correct

- Google Ads: "Booking step 1", "Booking step 2", "Booking step 3"
- Meta Ads: "Wyszukiwania", "Wyświetlenia zawartości", "Zainicjowane przejścia do kasy"

### ❌ Problem: December has zeros

- The code works correctly
- December data just doesn't exist (wasn't collected)
- Need to fetch from API and backfill

---

## Run the Diagnostic

Execute `DIAGNOSTIC_HISTORICAL_BOOKING_STEPS.sql` to verify the current state and confirm what needs to be fixed.

