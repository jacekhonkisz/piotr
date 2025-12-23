# 🔍 META FUNNEL DATA COLLECTION - COMPLETE AUDIT

**Date:** December 23, 2025  
**Issue:** Historical data shows 0 for booking_step_2 and booking_step_3

---

## ✅ HOW THE SYSTEM CURRENTLY COUNTS FUNNEL STEPS

### 1. Data Collection Flow

**File:** `src/lib/background-data-collector.ts`

```typescript
// Step 1: Fetch raw campaign insights from Meta API
const rawCampaignInsights = await metaService.getCampaignInsights(
  adAccountId,
  startDate,
  endDate,
  0  // timeIncrement = 0 for period totals
);

// Step 2: Parse actions array to extract conversion metrics
const campaignInsights = enhanceCampaignsWithConversions(rawCampaignInsights);

// Step 3: Aggregate metrics from all campaigns
const totals = this.calculateTotals(campaignInsights);

// Step 4: Store in database
await this.storeMonthlySummary(client.id, {
  summary_date: monthData.startDate,
  campaigns: campaignInsights,
  totals,
  metaTables,
  activeCampaignCount
});
```

### 2. Meta Actions Parser

**File:** `src/lib/meta-actions-parser.ts` (lines 127-166)

The parser correctly maps Meta API action types to funnel steps:

```typescript
// ✅ BOOKING STEP 1 - Search (Wyszukiwania)
if (actionType === 'omni_search') {
  metrics.booking_step_1 = value;
}

// ✅ BOOKING STEP 2 - View Content (Wyświetlenia zawartości)
if (actionType === 'omni_view_content') {
  metrics.booking_step_2 = value;
}

// ✅ BOOKING STEP 3 - Initiate Checkout (Zainicjowane przejścia do kasy)
if (actionType === 'omni_initiated_checkout') {
  metrics.booking_step_3 = value;
}

// ✅ RESERVATIONS - Purchase (Zakupy w witrynie)
if (actionType === 'omni_purchase') {
  metrics.reservations = value;
}
```

### 3. Storage in Database

**File:** `src/lib/background-data-collector.ts` (lines 857-950)

```typescript
private async storeMonthlySummary(clientId: string, data: any): Promise<void> {
  // Aggregate conversion metrics from campaigns
  const conversionTotals = campaigns.reduce((acc: any, campaign: any) => ({
    booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
    booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
    booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
    reservations: acc.reservations + (campaign.reservations || 0),
    reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
    // ... other metrics
  }), { /* initial values */ });
  
  // Store in campaign_summaries table
  await supabase.from('campaign_summaries').upsert({
    client_id: clientId,
    summary_date: data.summary_date,
    summary_type: 'monthly',
    platform: 'meta',
    booking_step_1: enhancedConversionMetrics.booking_step_1,
    booking_step_2: enhancedConversionMetrics.booking_step_2,
    booking_step_3: enhancedConversionMetrics.booking_step_3,
    reservations: enhancedConversionMetrics.reservations,
    reservation_value: enhancedConversionMetrics.reservation_value,
    // ... other fields
  });
}
```

---

## 📊 CURRENT STATE

### December 2025 (Current Period) - ✅ WORKING CORRECTLY

| Metric | Value | Status |
|--------|-------|--------|
| `booking_step_1` (Wyszukiwania) | 1,684 | ✅ |
| `booking_step_2` (Wyświetlenia zawartości) | 173 | ✅ |
| `booking_step_3` (Zainicjowane przejścia do kasy) | 52 | ✅ |
| `reservations` (Zakupy w witrynie) | 7 | ✅ |
| `reservation_value` | 35,475 zł | ✅ |

**Parser is working correctly!** Current period data shows proper funnel progression.

### December 2024 (Historical Period) - ❌ BROKEN

| Metric | Value | Status |
|--------|-------|--------|
| `booking_step_1` | 363 | ✅ |
| `booking_step_2` | **0** | ❌ **WRONG** |
| `booking_step_3` | **0** | ❌ **WRONG** |
| `reservations` | 36 | ✅ |
| `reservation_value` | 136,414 zł | ✅ |

**Why is it broken?**
- Last updated: **August 18, 2025**
- Data collected **before parser fixes** were implemented
- Raw `actions` array **not stored** in database
- Cannot be recalculated without re-fetching from Meta API

---

## 🔧 ROOT CAUSE

1. **Historical data was collected with an old/incomplete parser**
   - The parser may not have been looking for `omni_view_content` and `omni_initiated_checkout`
   - Or these actions weren't being returned by Meta API at that time
   - Or there was a bug in the aggregation logic

2. **Raw actions array is NOT stored in database**
   - Database only stores the **final parsed values** (`booking_step_1`, `booking_step_2`, etc.)
   - Does NOT store the raw `actions` array from Meta API
   - This means historical data cannot be re-parsed without re-fetching

3. **Current parser is correct**
   - December 2025 data proves the parser works
   - All funnel steps are being captured correctly
   - The code is sound

---

## ✅ SOLUTION

### Option 1: Re-fetch Historical Data (Recommended)

Run the background data collector to re-fetch December 2024 data from Meta API:

```bash
# This will re-fetch and re-parse all historical months
cd /Users/macbook/piotr
npx tsx scripts/collect-all-monthly-data.ts
```

This will:
1. Fetch fresh data from Meta API with the **correct parser**
2. Store updated values with `booking_step_2` and `booking_step_3`
3. Overwrite the old incorrect data

### Option 2: Manual Backfill Script

Use the backfill script I created:

```bash
cd /Users/macbook/piotr
npx tsx scripts/backfill-meta-historical-funnel.ts --client=havet --dry-run
```

This will:
1. Check which months have 0 for step2/step3
2. Re-fetch from Meta API for those months only
3. Update the database with correct values

---

## 📋 VERIFICATION

After running the backfill, verify December 2024 data:

```sql
SELECT 
  summary_date,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  last_updated
FROM campaign_summaries
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND summary_date = '2024-12-01'
  AND platform = 'meta'
  AND summary_type = 'monthly';
```

Expected result:
- `booking_step_2` > 0 (should have value from `omni_view_content`)
- `booking_step_3` > 0 (should have value from `omni_initiated_checkout`)
- `last_updated` = current timestamp

---

## 🎯 KEY TAKEAWAYS

1. **Current system is working correctly** - parser is properly configured
2. **Historical data was collected with old/incomplete parser**
3. **Raw actions are not stored** - must re-fetch to fix
4. **Solution: Re-run data collection** for December 2024

---

**Status:** ✅ Parser is correct, historical data needs to be re-collected from Meta API.

