# 📋 Data Reliability Audit - Findings & Next Steps

**Date:** December 23, 2025  
**Auditor:** AI Assistant

---

## 🔍 Executive Summary

### What Was Analyzed
- **All clients** for the past year (December 2024 - December 2025)
- **Both platforms:** Meta Ads + Google Ads  
- **Both periods:** Weekly + Monthly summaries
- **Focus:** Funnel metrics reliability (not main metrics like spend/impressions)

### Key Findings

| Metric | Value |
|--------|-------|
| Total Issues Found | 236 |
| **Critical Issues** | **32** |
| Excellent Reliability (80-100) | 16 client-platforms |
| Fair Reliability (60-79) | 3 client-platforms |
| Poor Reliability (<60) | **6 client-platforms** |

---

## 🚨 Critical Problems Identified

### 1. Google Ads Backfill Script Failed (572 errors)

**Root Cause:** The backfill script was using direct REST API calls to `googleads.googleapis.com`, which returns HTML error pages. Google Ads API **requires** the official `google-ads-api` npm library.

**Status:** ✅ Fixed - Created new script `scripts/backfill-google-ads-using-collector.ts`

**How it works now:**
```
❌ OLD (Broken):
fetch('https://googleads.googleapis.com/v16/customers/...')
→ Returns HTML error page

✅ NEW (Fixed):
GoogleAdsAPIService.getCampaignData(startDate, endDate)
→ Uses official library, works correctly
```

### 2. Sandra SPA Karpacz - Most Critical Client

| Platform | Reliability Score | Illogical Funnel Rate |
|----------|-------------------|----------------------|
| Meta Ads | 0/100 | 84.4% |
| Google Ads | 0/100 | 89.7% |

**Problem:** Reservations being recorded without any lead generation actions (no clicks to call, emails, or booking steps).

**Root Cause:** Likely conversion tracking misconfiguration - only final "Purchase" events are tracked, but not the funnel steps leading to them.

### 3. Other Problem Clients

| Client | Platform | Score | Issue |
|--------|----------|-------|-------|
| Nickel Resort | Google | 8/100 | 28% missing + 32% illogical |
| Hotel Tobaco Łódź | Google | 76/100 | 24.1% missing funnel data |
| Młyn Klekotki | Google | 0/100 | Reservation value without reservation count |
| Belmonte Hotel | Meta | 56/100 | 10 critical periods with zero funnel data |

---

## ✅ What Was Fixed Already

1. **Zero-Data Anomaly Cleanup:** Deleted 161 records with zero spend/impressions
2. **Fixed Backfill Script:** New script uses the correct API implementation
3. **Generated Reports:** 
   - `FUNNEL_METRICS_AUDIT_2025-12-23T17-12-49.md`
   - `🔍_SANDRA_SPA_KARPACZ_CONVERSION_AUDIT.md`
   - `🎯_DATA_RELIABILITY_ACTION_PLAN.md`

---

## 📝 Recommended Next Steps

### Priority 1: Run Fixed Google Ads Backfill (IMPORTANT)
```bash
# Dry run first to see what would be collected
npx tsx scripts/backfill-google-ads-using-collector.ts --dry-run

# Then run for real
npx tsx scripts/backfill-google-ads-using-collector.ts
```

### Priority 2: Fix Sandra SPA Karpacz Tracking
This client has **critical** reliability issues on BOTH platforms. You need to:

1. **Meta Ads:** Check Facebook Pixel implementation
   - Verify "Lead" events are firing for booking steps
   - Verify funnel events (ViewContent → AddToCart → InitiateCheckout → Purchase)
   
2. **Google Ads:** Check conversion tracking setup
   - Verify conversion actions are properly configured
   - Check if funnel steps (click_to_call, email, booking_steps) are being tracked
   - Current tracking only records final "Rezerwacja" (Purchase) events

### Priority 3: Verify Other Problem Clients
Run the audit again after backfill to see updated reliability scores:

```bash
npx tsx scripts/audit-funnel-metrics-reliability.ts
```

---

## 📊 Client Reliability Scoreboard

### ✅ Excellent (Score 80-100) - No Action Needed
- Hotel Artis Loft (Meta: 100, Google: 100)
- Hotel Diva SPA Kołobrzeg (Meta: 100, Google: 100)
- Havet (Meta: 97, Google: 100)
- Hotel Zalewski Mrzeżyno (Meta: 97, Google: 100)
- Cesarskie Ogrody (Meta: 97)
- Hotel Tobaco Łódź (Meta: 97)
- Nickel Resort (Meta: 97)
- Hotel Lambert Ustronie Morskie (Meta: 100, Google: 66 - watch)

### ⚠️ Fair (Score 60-79) - Monitor
- Cesarskie Ogrody (Google: 66)
- Hotel Lambert Ustronie Morskie (Google: 66)
- Hotel Tobaco Łódź (Google: 76)

### 🔴 Poor (Score <60) - Action Required
- **Sandra SPA Karpacz** (Meta: 0, Google: 0) ← CRITICAL
- **Nickel Resort** (Google: 8)
- **Młyn Klekotki** (Google: 0, but low sample size)
- **Belmonte Hotel** (Meta: 56)

---

## 📁 Generated Files

| File | Purpose |
|------|---------|
| `client-data-comparison-*.csv` | Raw data for all periods |
| `CLIENT_DATA_COMPARISON_*.md` | Human-readable comparison report |
| `FUNNEL_METRICS_AUDIT_*.md` | Detailed funnel reliability audit |
| `🔍_DECEMBER_2024_DATA_AUDIT_SUMMARY.md` | December 2024 specific analysis |
| `🔍_SANDRA_SPA_KARPACZ_CONVERSION_AUDIT.md` | Sandra SPA deep dive |
| `🎯_DATA_RELIABILITY_ACTION_PLAN.md` | Structured action plan |
| `scripts/backfill-google-ads-using-collector.ts` | Fixed backfill script |

---

## 🔧 Technical Notes

### Why REST API Calls Failed

The Google Ads REST API is not publicly accessible like other Google APIs. It requires:
1. The official `google-ads-api` npm library
2. Proper OAuth2 token flow
3. Developer token with appropriate access level

The error `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` indicates HTML was returned instead of JSON - typically an authentication or API access issue.

### Current Working Implementation

Location: `src/lib/google-ads-api.ts`

Key methods:
- `getCampaignData(dateStart, dateEnd)` - Main campaign metrics
- `getConversionBreakdown(dateStart, dateEnd)` - Funnel metrics breakdown
- `getGoogleAdsTables(dateStart, dateEnd)` - Additional tables (device, network, keywords)

