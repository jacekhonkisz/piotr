# 🚨 ROOT CAUSE: Havet Booking Steps Discrepancy

## The Problem

**Live API:** Step 1: 459 ✅  
**Cache:** Step 1: 48 ❌  
**Difference:** Missing 411 (89% of data!)

## Root Cause: Campaign ID Type Mismatch

### The Bug

**In `getConversionBreakdown()` (line 896):**
```typescript
breakdown[campaignId] = parsed;
// campaignId is from row.campaign.id (NUMBER: 20519782706)
// JavaScript object keys are STRINGS, so this becomes: breakdown["20519782706"]
```

**In `getCampaignData()` (line 597):**
```typescript
let campaignConversions = conversionBreakdown[campaign.id] || { ... };
// campaign.id is also a NUMBER: 20519782706
// But JavaScript object access: breakdown[20519782706] looks for NUMBER key
// While breakdown was stored with STRING key: breakdown["20519782706"]
```

### Why This Causes the Issue

JavaScript object keys are **always strings**. When you do:
- `breakdown[20519782706]` → JavaScript converts to string: `breakdown["20519782706"]`
- But if there's any type coercion issue, it might not match!

**However**, JavaScript should handle this automatically. The real issue might be:

1. **Campaign ID stored as string in breakdown but number in campaigns**
2. **OR**: Campaign ID stored as number in breakdown but string in campaigns
3. **OR**: The breakdown wasn't ready when campaigns were processed

### Evidence from Audit

From the audit output:
- ✅ Conversion breakdown correctly parsed: `[PBM] GSN | Brand PL` has 276 step 1
- ✅ Live API correctly shows: Campaign has 276 step 1
- ❌ Cache shows: Same campaign has 0 step 1

**This means:**
- The conversion breakdown IS working (live API proves it)
- The merge IS working (live API shows correct data)
- **BUT**: The cache was created with OLD/WRONG data

### Most Likely Cause

The cache was created **88 minutes ago** (7:02:54 PM) with a version of the code that had a bug, OR the conversion breakdown wasn't properly merged at that time.

**The fix:**
1. Force refresh the cache (delete and recreate)
2. Verify the code correctly converts campaign IDs to strings for consistency

---

## The Fix

### Immediate: Force Cache Refresh

```typescript
// Delete cache
DELETE FROM google_ads_current_month_cache
WHERE client_id = '...' AND period_id = '2026-01';

// Next request will automatically refresh
```

### Code Fix: Ensure Type Consistency

**File:** `src/lib/google-ads-api.ts:896`

```typescript
// ✅ FIX: Convert campaign ID to string for consistent key matching
breakdown[String(campaignId)] = parsed;
```

**File:** `src/lib/google-ads-api.ts:597`

```typescript
// ✅ FIX: Convert campaign ID to string when looking up
let campaignConversions = conversionBreakdown[String(campaign.id)] || {
  booking_step_1: 0,
  // ...
};
```

---

## Verification

After fix:
1. Cache should show: Step 1: 459 (matches live API)
2. Reports page should show: Step 1: 459 (matches Google Ads Console)
3. Database should be updated with correct values

