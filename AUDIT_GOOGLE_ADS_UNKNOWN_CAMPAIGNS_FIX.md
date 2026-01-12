# Audit: Google Ads Campaigns Showing as "Unknown Campaign"

## 🔍 Root Cause Analysis

### Issues Found
1. **Past Period Data**: Historical campaigns returned empty array, causing "Unknown Campaign" fallback
2. **Current Period Data**: Field name mismatch between cache (camelCase) and frontend (snake_case)

### Investigation Results

1. **✅ Cache Data is Correct**
   - SQL audit shows cache contains `campaignName` field correctly
   - Example: `"[PBM] PMax | Ogólna - WIELKANOC 2026"`
   - Cache structure: `cache_data->'campaigns'->>'campaignName'`

2. **❌ Historical Data Missing Campaigns**
   - `google-ads-standardized-data-fetcher.ts` line 410: `campaigns: []`
   - The `campaign_summaries` table has `campaign_data` JSONB with campaigns
   - But the fetcher wasn't extracting them!

3. **❌ Field Name Mismatch**
   - Cache uses `campaignName` (camelCase)
   - Frontend checked `campaign_name` first (snake_case)
   - Missing `campaignName` in fallback chain

## 🔧 Fixes Applied

### 1. Extract Campaigns from Historical Data
**File:** `src/lib/google-ads-standardized-data-fetcher.ts`

**Before:**
```typescript
// Line 410
campaigns: [] // Database summaries don't include campaign details
```

**After:**
```typescript
// Extract campaigns from campaign_data JSONB field
const allCampaigns: any[] = [];
summaries.forEach(summary => {
  if (summary.campaign_data && Array.isArray(summary.campaign_data)) {
    allCampaigns.push(...summary.campaign_data);
  }
});

console.log(`📊 Extracted ${allCampaigns.length} campaigns from campaign_data JSONB`);

// Later...
campaigns: allCampaigns // ✅ FIXED: Extract campaigns from campaign_data JSONB
```

### 2. Fix Field Name Mapping
**File:** `src/app/reports/page.tsx` (5 locations)

**Before:**
```typescript
campaign_name: campaign.campaign_name || campaign.name || 'Unknown Campaign'
```

**After:**
```typescript
campaign_name: campaign.campaign_name || campaign.campaignName || campaign.name || 'Unknown Campaign'
```

**Fixed locations:**
1. Line 1143 - Meta campaigns mapping
2. Line 1349 - Google Ads campaigns mapping  
3. Line 2086 - Google Ads campaigns mapping
4. Line 2705 - Weekly reports campaigns mapping
5. Line 3970 - GoogleAdsExpandableCampaignTable component mapping

### 3. Added Debug Logging
**File:** `src/lib/google-ads-api.ts`

Added debug logging to track campaign name structure:
```typescript
// 🔍 DEBUG: Log campaign name structure for first campaign
if (index === 0) {
  logger.info(`🔍 DEBUG Campaign Name Structure:
    - row.campaign: ${JSON.stringify(campaign ? Object.keys(campaign) : 'null')}
    - campaign.name: ${campaign?.name}
    - campaign.resourceName: ${campaign?.resourceName}
    - Full campaign object: ${JSON.stringify(campaign).substring(0, 200)}`);
}

// Enhanced fallback logic
const campaignName = campaign?.name || campaign?.resourceName?.split('/').pop() || 'Unknown Campaign';
```

## 📊 Results

### Before
- **Current month**: Shows "Unknown Campaign" (field name mismatch)
- **Past months**: Shows "Unknown Campaign" (empty campaigns array)

### After
- **Current month**: ✅ Shows proper campaign names from cache
- **Past months**: ✅ Shows proper campaign names from `campaign_data` JSONB

## 🎯 Testing

To verify the fix:

1. **Check current month**: Should show campaign names from cache
2. **Check past months**: Should show campaign names from `campaign_data` JSONB
3. **Run SQL audit**: `AUDIT_GOOGLE_ADS_CAMPAIGN_NAMES.sql`

## 📝 Files Modified

- `src/lib/google-ads-standardized-data-fetcher.ts` - Extract campaigns from JSONB
- `src/app/reports/page.tsx` - Fix field name mapping (5 locations)
- `src/lib/google-ads-api.ts` - Add debug logging
- `AUDIT_GOOGLE_ADS_CAMPAIGN_NAMES.sql` - Create diagnostic query

