# ✅ Google Ads Funnel Labels & December Data Fix

## Summary

### Changes Made

1. **Funnel Labels Updated for Google Ads** ✅
   - Google Ads now shows: "Booking step 1", "Booking step 2", "Booking step 3"
   - Meta Ads keeps: "Wyszukiwania", "Wyświetlenia zawartości", "Zainicjowane przejścia do kasy"
   - Labels change based on `platform` prop in `ConversionFunnel` component

2. **December 2025 Data Fetch Script Created** ✅
   - Script: `scripts/fetch-december-2025-google-ads.ts`
   - Fetches December 2025 data from Google Ads API
   - Stores it in `google_ads_campaigns` table with proper booking_step values

3. **Backfill SQL Updated** ✅
   - `BACKFILL_ALL_CLIENTS_DECEMBER_COMPLETE.sql` now prioritizes `google_ads_campaigns` for booking steps
   - Matches the live fetch behavior

---

## How Google Ads Booking Steps Are Fetched

### Live Fetch Flow

```
User Views Google Ads Data
    ↓
google-ads-smart-cache-helper.ts
    ↓
googleAdsService.getCampaignData(dateStart, dateEnd)
    ↓
googleAdsService.getConversionBreakdown(dateStart, dateEnd)
    ↓
Parses Google Ads conversion action names:
  - "PBM - Booking Engine - krok 1" → booking_step_1
  - "PBM - Booking Engine - krok 2" → booking_step_2
  - "PBM - Booking Engine - krok 3" → booking_step_3
  - "Step 1 w BE", "step1", "krok 1" → booking_step_1
  - (same patterns for step 2 and 3)
    ↓
Returns campaigns with booking_step_1/2/3 values
    ↓
Aggregated and displayed in ConversionFunnel component
    ↓
Shows "Booking step 1", "Booking step 2", "Booking step 3"
```

### Parser Location

**File:** `src/lib/google-ads-api.ts`
- **Line 751-834:** `getConversionBreakdown()` - fetches conversion actions
- **Line 835-883:** Conversion mapping logic
- **Line 704-716:** Maps parsed conversions to campaign object

**Patterns Matched (Case-insensitive):**
```typescript
booking_step_1: [
  'step 1', 'step1', 'krok 1', 'booking_step_1',
  'pbm - booking engine - krok 1'
]

booking_step_2: [
  'step 2', 'step2', 'krok 2', 'booking_step_2',
  'pbm - booking engine - krok 2'
]

booking_step_3: [
  'step 3', 'step3', 'krok 3', 'booking_step_3',
  'pbm - booking engine - krok 3'
]
```

---

## December 2025 Issue & Fix

### The Problem
- December 2025 data shows zeros for `booking_step_1/2/3` in `campaign_summaries`
- The data was never collected during December (refresh token was missing)
- Both `google_ads_campaigns` and `daily_kpi_data` tables have zeros
- Backfill SQL can only use what exists in the database

### The Solution
1. **Fetch December 2025 data from Google Ads API** (historical data is available)
2. **Store it in `google_ads_campaigns`** with proper booking_step values
3. **Re-run backfill SQL** to update `campaign_summaries`

### Steps to Fix December Data

#### Step 1: Run fetch script (dry run)
```bash
npx tsx scripts/fetch-december-2025-google-ads.ts --dry-run
```

#### Step 2: Run fetch script (live)
```bash
npx tsx scripts/fetch-december-2025-google-ads.ts
```

#### Step 3: Run backfill SQL
Run `BACKFILL_ALL_CLIENTS_DECEMBER_COMPLETE.sql` in Supabase SQL Editor

---

## Files Modified

### 1. `src/components/ConversionFunnel.tsx`
**Change:** Added platform-specific labels for funnel steps

```typescript
// Before (same labels for all platforms)
label: "Wyszukiwania"

// After (Google Ads gets specific labels)
const step1Label = platform === 'google' ? "Booking step 1" : "Wyszukiwania";
```

**Result:**
- Google Ads: "Booking step 1", "Booking step 2", "Booking step 3"
- Meta Ads: "Wyszukiwania", "Wyświetlenia zawartości", "Zainicjowane przejścia do kasy"

### 2. `BACKFILL_ALL_CLIENTS_DECEMBER_COMPLETE.sql`
**Change:** Prioritizes `google_ads_campaigns` for booking steps

```sql
-- Before
COALESCE(conv.booking_step_1, cc.booking_step_1_campaigns, 0)

-- After  
COALESCE(cc.booking_step_1_campaigns, conv.booking_step_1, 0)
```

**Reason:** `google_ads_campaigns` is where booking steps are stored (from API fetch)

### 3. `scripts/fetch-december-2025-google-ads.ts` (NEW)
**Purpose:** Fetches December 2025 data from Google Ads API

**What it does:**
- Connects to Google Ads API
- Fetches campaign data for December 2025
- Parses conversion actions to extract booking_step_1/2/3
- Stores in `google_ads_campaigns` table
- Works for all 12 clients automatically

---

## Verification

### Check if booking steps are being fetched

1. **View current month Google Ads data** in the app
2. **Open browser console** (F12)
3. **Look for logs:**
   ```
   📊 Aggregated conversion metrics from Google Ads API:
   {
     booking_step_1: 1234,
     booking_step_2: 567,
     booking_step_3: 89,
     ...
   }
   ```
4. **Check the funnel** - should show "Booking step 1", "Booking step 2", "Booking step 3" labels

### Check if December data can be fetched

Run the fetch script with `--dry-run` flag and check the output:
```bash
npx tsx scripts/fetch-december-2025-google-ads.ts --dry-run
```

Look for:
```
📊 Booking steps found: Step1=X, Step2=Y, Step3=Z
```

If you see zeros, it means Google Ads API doesn't have historical conversion data for December.

---

## Important Notes

### About Conversion Data Availability

Google Ads API can only return historical conversion data if:
1. Conversion actions were set up in Google Ads account during that period
2. The conversion tracking was active during that period
3. Google still has that data available (typically 13+ months back)

If December conversion actions weren't tracked, the API will return zeros.

### About Funnel Labels

- **Meta Ads:** Uses generic Polish funnel labels (standard for Meta Ads)
- **Google Ads:** Uses "Booking step" labels that match the conversion action names
- **Combined View:** Falls back to generic labels (same as Meta)

This makes it clear which platform's data you're viewing.

---

## Next Steps

1. ✅ **Funnel labels updated** - Google Ads now shows "Booking step 1/2/3"
2. ⏳ **Run fetch script** - Get December 2025 data from API
3. ⏳ **Run backfill SQL** - Update campaign_summaries with real data

The funnel will display the correct labels immediately. December data will be fixed after running the fetch script + backfill SQL.

