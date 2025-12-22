# Email Preview Unified Data Fetching - Final Fix

## Problem Identified

The calendar email preview showed **zeros** even when `/reports` page showed real data for the same client and period.

### Root Cause

1. **`/reports` page** uses:
   - `StandardizedDataFetcher` (for Meta Ads)
   - `GoogleAdsStandardizedDataFetcher` (for Google Ads)
   - These fetch LIVE data from APIs and cache it

2. **Calendar email preview** was using:
   - Direct Supabase queries to `daily_kpi_data` table
   - This table might be empty or outdated
   - Different data source = different results ❌

## Solution Implemented

✅ **Unified Data Fetching**: Calendar email preview now uses **THE EXACT SAME** data fetchers as `/reports` page!

### Changes Made

**File**: `src/components/CalendarEmailPreviewModal.tsx`

**Before** (lines 196-245):
```typescript
// Direct database query
const [metaResult, googleResult] = await Promise.all([
  supabase.from('daily_kpi_data')
    .select('*')
    .eq('platform', 'meta')
    // ...
]);
```

**After** (lines 196-212):
```typescript
// Use the SAME data fetchers as /reports
const { StandardizedDataFetcher } = await import('../lib/standardized-data-fetcher');
const { GoogleAdsStandardizedDataFetcher } = await import('../lib/google-ads-standardized-data-fetcher');

const [metaResult, googleResult] = await Promise.all([
  StandardizedDataFetcher.fetchData({
    clientId: report.client_id,
    dateRange,
    platform: 'meta',
    reason: 'email-preview-calendar'
  }),
  GoogleAdsStandardizedDataFetcher.fetchData({
    clientId: report.client_id,
    dateRange,
    reason: 'email-preview-calendar'
  })
]);
```

**Result Processing** (lines 214-266):
- Transformed standardized API results into the format expected by `EmailPreviewModal`
- Extracts `stats` (spend, impressions, clicks, etc.)
- Extracts `conversionMetrics` (reservations, booking steps, etc.)
- Builds `campaignsData` array with both Meta and Google data

## Benefits

✅ **Single Source of Truth**: Email preview and /reports now use identical data fetching logic
✅ **Always Fresh Data**: Fetches live data from Meta/Google APIs when needed
✅ **Smart Caching**: Leverages the existing smart cache system
✅ **Client-Specific Data**: Each client gets their own real, dynamic data
✅ **No More Zeros**: If `/reports` shows data, email preview will too!

## Testing

To verify the fix:

1. **Refresh browser** (Cmd+R / Ctrl+R)
2. Open `/admin/calendar`
3. Click "Podgląd Email" for any scheduled report
4. Check console for:
```
📊 UNIFIED FETCH RESULTS: {
  metaSuccess: true,
  googleSuccess: true,
  metaSpend: [real amount],
  googleSpend: [real amount],
  metaSource: 'live-api' or 'smart-cache',
  googleSource: 'live-api' or 'smart-cache'
}
```
5. Verify email preview shows **real numbers**, not zeros
6. Compare with `/reports` page for same client/period - should match!

## System Architecture

```
┌─────────────────┐
│  /reports Page  │
└────────┬────────┘
         │
         ├── StandardizedDataFetcher (Meta)
         │   └── Fetches from Meta API
         │       └── Caches to daily_kpi_data
         │
         └── GoogleAdsStandardizedDataFetcher (Google)
             └── Fetches from Google Ads API
                 └── Caches to daily_kpi_data

┌─────────────────────────┐
│  Calendar Email Preview │  ✅ NOW USES SAME FETCHERS!
└────────┬────────────────┘
         │
         ├── StandardizedDataFetcher (Meta)
         │   └── Same logic as /reports ✅
         │
         └── GoogleAdsStandardizedDataFetcher (Google)
             └── Same logic as /reports ✅
```

## Related Files

- ✅ `/src/components/CalendarEmailPreviewModal.tsx` - Updated to use unified data fetchers
- ✅ `/src/lib/standardized-data-fetcher.ts` - Meta Ads data fetching (unchanged)
- ✅ `/src/lib/google-ads-standardized-data-fetcher.ts` - Google Ads data fetching (unchanged)
- ✅ `/src/app/reports/page.tsx` - Reports page (unchanged, but used as reference)

## Notes

- The old direct database query code was completely replaced
- Debug logging shows data source (`live-api`, `smart-cache`, or `campaign_summaries`)
- Each client will see their own customized email with their own real-time data
- The fix ensures consistency across the entire application

---

**Date Fixed**: November 17, 2025
**Issue**: Email preview showing zeros while /reports showed real data
**Solution**: Unified data fetching using StandardizedDataFetcher for both




