# 📊 Meta & Google Ads Metrics Fetching - Production Audit Report

**Date:** December 18, 2025  
**Auditor:** Senior System Auditor  
**Scope:** Complete audit of Meta Ads and Google Ads data fetching systems

---

## 🎯 Executive Summary

| Platform | Production Readiness | Overall Score |
|----------|---------------------|---------------|
| **Meta Ads** | ⚠️ **PARTIALLY READY** | 7/10 |
| **Google Ads** | ⚠️ **PARTIALLY READY** | 6.5/10 |

### Key Findings:
- ✅ Core metrics (spend, impressions, clicks) are properly fetched
- ⚠️ Some conversion metrics may be incomplete or estimated
- ⚠️ Fallback mechanisms use estimates instead of real data
- ❌ Demographics not available for Google Ads (API limitation)
- ⚠️ `reach` metric may not be consistently fetched for Meta

---

## 📱 META ADS AUDIT

### Architecture Overview
```
MetaAPIServiceOptimized
       ↓
  Graph API v18.0
       ↓
  MemoryManagedCache (5 min TTL, 50MB max)
       ↓
  meta-actions-parser (conversion extraction)
```

### ✅ Metrics Properly Fetched

| Metric | Status | Source | Notes |
|--------|--------|--------|-------|
| `spend` | ✅ Working | getCampaignInsights | Direct from API |
| `impressions` | ✅ Working | getCampaignInsights | Direct from API |
| `clicks` | ✅ Working | getCampaignInsights | Direct from API |
| `ctr` | ✅ Working | getCampaignInsights | Direct from API |
| `cpc` | ✅ Working | getCampaignInsights | Direct from API |
| `cpm` | ✅ Working | getCampaignInsights | Direct from API |
| `conversions` | ✅ Working | getCampaignInsights | From actions array |
| `actions` | ✅ Working | getCampaignInsights | Raw conversion data |
| `action_values` | ✅ Working | getCampaignInsights | Monetary values |

### ⚠️ Metrics with Issues

| Metric | Status | Issue |
|--------|--------|-------|
| `reach` | ⚠️ Inconsistent | Not always included in campaign insights fields |
| `frequency` | ⚠️ Inconsistent | Calculated but may be 0 |
| `booking_step_3` | ⚠️ Parser Dependent | Relies on action_type matching `initiate_checkout` |

### 🔴 Critical Issues Found

#### Issue 1: Missing `reach` in API Fields
**Location:** `src/lib/meta-api-optimized.ts:401`
```typescript
const params = `level=campaign&time_range={"since":"${dateStart}","until":"${dateEnd}"}...
&fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,cpp,reach,frequency,...`;
```
**Status:** `reach` IS included in fields ✅

#### Issue 2: Conversion Fallback to Estimates
**Location:** `src/lib/smart-cache-helper.ts:293-338`
```typescript
// When no real data, falls back to estimates:
click_to_call: Math.round(metaTotalConversions * 0.15), // 15% estimate
email_contacts: Math.round(metaTotalConversions * 0.10), // 10% estimate
booking_step_1: Math.round(metaTotalConversions * 0.75), // 75% estimate
```
**Impact:** When `daily_kpi_data` is empty and Meta API doesn't return parsed actions, conversion metrics will be ESTIMATED, not real.

#### Issue 3: Action Type Parser May Miss Custom Conversions
**Location:** `src/lib/meta-actions-parser.ts:72-141`

The parser looks for specific patterns:
- `click_to_call`, `phone_number_clicks` → click_to_call
- `contact`, `email`, `lead` → email_contacts
- `search`, `omni_search` → booking_step_1
- `view_content` → booking_step_2
- `initiate_checkout` → booking_step_3
- `purchase`, `fb_pixel_purchase` → reservations

**Risk:** Custom conversion action types may be missed.

### Meta Ads API Fields Requested

```typescript:401:401:src/lib/meta-api-optimized.ts
fields=campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,cpp,reach,frequency,conversions,actions,action_values,cost_per_action_type
```

### Meta Tables Data (Breakdown Reports)

| Table | Status | API Method |
|-------|--------|------------|
| Placement Performance | ✅ Working | getPlacementPerformance() |
| Demographic Performance | ✅ Working | getDemographicPerformance() |
| Ad Relevance Results | ✅ Working | getAdRelevanceResults() |

---

## 📈 GOOGLE ADS AUDIT

### Architecture Overview
```
GoogleAdsAPIService
       ↓
  google-ads-api library
       ↓
  RateLimiter (25 calls/min, 2s delay)
       ↓
  google-ads-actions-parser (conversion extraction)
```

### ✅ Metrics Properly Fetched

| Metric | Status | Source | Notes |
|--------|--------|--------|-------|
| `cost_micros` → `spend` | ✅ Working | getCampaignData | Converted from micros |
| `impressions` | ✅ Working | getCampaignData | Direct from API |
| `clicks` | ✅ Working | getCampaignData | Direct from API |
| `ctr` | ✅ Working | getCampaignData | Direct from API |
| `average_cpc` | ✅ Working | getCampaignData | Converted from micros |
| `conversions` | ⚠️ Capped | getCampaignData | Capped at interactions |
| `conversions_value` | ✅ Working | getCampaignData | Direct from API |

### ⚠️ Metrics with Issues

| Metric | Status | Issue |
|--------|--------|-------|
| `conversions` | ⚠️ Capped | Artificially capped at interactions count |
| `click_to_call` | ⚠️ Dynamic | Falls back to estimated 30% of clicks |
| `email_contacts` | ⚠️ Dynamic | Falls back to estimated 40% of clicks |
| `booking_step_*` | ⚠️ Dynamic | Falls back to estimated percentages |
| `reservations` | ⚠️ Capped | Capped at clicks count |

### 🔴 Critical Issues Found

#### Issue 1: Conversions Capping Logic
**Location:** `src/lib/google-ads-api.ts:539-545`
```typescript
// ✅ CRITICAL FIX: Cap conversions at interactions (can't have more conversions than interactions)
if (conversions > interactions) {
  logger.info(`⚠️  Campaign ${campaign.name}: Capping conversions from ${conversions.toFixed(0)} to ${interactions} (interactions)`);
  conversions = interactions;
}
```
**Impact:** View-through conversions may be incorrectly excluded.

#### Issue 2: Dynamic Tracking Fallback (Estimated Data)
**Location:** `src/lib/google-ads-api.ts:569-615`
```typescript
// Dynamic tracking using real available data
const clickToCall = Math.round(campaignClicks * 0.3); // 30% of clicks show phone interest
const emailContacts = Math.round(campaignClicks * 0.4); // 40% of clicks are contact interest
const bookingStep1 = campaignClicks; // All clicks are potential booking starts
// ...
const reservationValue = campaignSpend * 3; // 3x return on ad spend (ASSUMED!)
```
**Impact:** When no conversion breakdown data exists, the system uses HARDCODED estimates which are NOT real data.

#### Issue 3: Demographics NOT Available
**Location:** `src/lib/google-ads-api.ts:1497-1547`
```typescript
// Note: Demographics removed as it's not available through Google Ads API
const results = await Promise.allSettled([
  networkPromise,
  qualityPromise,
  devicePromise,
  keywordPromise,
  searchTermPromise
  // NO demographics!
]);
```
**Impact:** Google Ads cannot provide demographic breakdown data like Meta.

#### Issue 4: Conversion Action Name Matching (Polish-Specific)
**Location:** `src/lib/google-ads-actions-parser.ts:88-128`

The parser only recognizes specific patterns:
- `step 1`, `krok 1` → booking_step_1
- `step 2`, `krok 2` → booking_step_2
- `step 3`, `krok 3` → booking_step_3
- `rezerwacja`, `zakup`, `purchase` → reservations

**Risk:** Conversion actions with different names will be missed.

### Google Ads Tables Data (Breakdown Reports)

| Table | Status | API Method |
|-------|--------|------------|
| Network Performance | ✅ Working | getNetworkPerformance() |
| Device Performance | ✅ Working | getDevicePerformance() |
| Quality Metrics | ⚠️ Limited | getQualityScoreMetrics() - simplified |
| Keyword Performance | ✅ Working | getKeywordPerformance() |
| Search Term Performance | ✅ Working | getSearchTermPerformance() |
| **Demographic Performance** | ❌ NOT AVAILABLE | API Limitation |

---

## 🔄 STANDARDIZED DATA FETCHER AUDIT

### Data Source Priority

```
1. Smart Cache (current period) → 3-hour TTL
2. Database (campaign_summaries) → Historical periods
3. daily_kpi_data → Aggregated daily metrics
4. Live API → Last resort
```

### ⚠️ Potential Data Inconsistency Points

1. **Current Month**: Uses smart cache (may be up to 3 hours stale)
2. **Current Week**: Uses weekly cache (may be up to 3 hours stale)
3. **Historical**: Uses campaign_summaries database (should be accurate)
4. **Fallback**: May mix sources in complex scenarios

---

## 📋 DETAILED ISSUES LIST

### 🔴 HIGH PRIORITY

| # | Issue | Platform | Impact | Recommended Fix |
|---|-------|----------|--------|-----------------|
| 1 | Dynamic tracking uses hardcoded estimates (30%, 40%, etc.) | Google | Conversion metrics may be fake | Fetch real conversion action breakdown |
| 2 | Conversions capped at interactions | Google | May lose view-through conversions | Remove or make capping optional |
| 3 | Conversion action parsers miss custom conversions | Both | Some conversions not counted | Add configurable conversion mapping |

### 🟡 MEDIUM PRIORITY

| # | Issue | Platform | Impact | Recommended Fix |
|---|-------|----------|--------|-----------------|
| 4 | Demographics not available | Google | Missing demographic insights | Document as platform limitation |
| 5 | Fallback to percentage estimates | Meta | Inaccurate when no daily_kpi_data | Ensure daily collection runs |
| 6 | booking_step_3 relies on action type matching | Both | May miss if action name differs | Add more pattern matching |

### 🟢 LOW PRIORITY

| # | Issue | Platform | Impact | Recommended Fix |
|---|-------|----------|--------|-----------------|
| 7 | Cache staleness (3 hours) | Both | Data up to 3 hours old | Acceptable for dashboards |
| 8 | Complex routing logic | Both | Hard to debug | Consider simplification |

---

## ✅ PRODUCTION READINESS CHECKLIST

### Meta Ads

| Check | Status |
|-------|--------|
| Core metrics (spend, impressions, clicks, CTR, CPC) | ✅ PASS |
| Conversion metrics from actions array | ✅ PASS |
| Placement breakdown data | ✅ PASS |
| Demographic breakdown data | ✅ PASS |
| Ad relevance data | ✅ PASS |
| Error handling | ✅ PASS |
| Rate limiting | ✅ PASS |
| Token validation | ✅ PASS |
| Caching mechanism | ✅ PASS |
| Fallback handling | ⚠️ USES ESTIMATES |

**Meta Ads Score: 7/10** ⚠️

### Google Ads

| Check | Status |
|-------|--------|
| Core metrics (spend, impressions, clicks, CTR, CPC) | ✅ PASS |
| Conversion metrics from API | ⚠️ MAY BE ESTIMATED |
| Network breakdown data | ✅ PASS |
| Device breakdown data | ✅ PASS |
| Keyword performance | ✅ PASS |
| Search term performance | ✅ PASS |
| Demographic breakdown data | ❌ NOT AVAILABLE |
| Error handling | ✅ PASS |
| Rate limiting | ✅ PASS |
| Token refresh | ✅ PASS |
| Caching mechanism | ✅ PASS |
| Conversion capping logic | ⚠️ MAY LOSE DATA |

**Google Ads Score: 6.5/10** ⚠️

---

## 🎯 RECOMMENDATIONS

### Immediate Actions (Before Production)

1. **Review Conversion Estimates** - Verify that `daily_kpi_data` is being populated correctly for both platforms. If it's empty, all conversion metrics will be estimates.

2. **Add Conversion Action Logging** - Log unmatched conversion action names to identify missing patterns:
   ```typescript
   logger.warn(`Unmapped conversion action: ${actionName}`);
   ```

3. **Consider Removing Conversion Capping** - The capping at interactions may exclude legitimate view-through conversions for Google Ads.

### Short-Term Improvements

1. **Configurable Conversion Mapping** - Allow admin to configure which action types map to which funnel metrics.

2. **Data Validation Layer** - Add validation to ensure all required metrics are present before caching/storing.

3. **Alerting for Zero Data** - Alert when core metrics return 0 unexpectedly.

### Long-Term Improvements

1. **Simplify StandardizedDataFetcher** - The current routing logic is complex and has many edge cases.

2. **Real-Time Dashboards** - Consider shorter cache TTL for real-time monitoring needs.

3. **Platform Parity** - Document the differences between Meta and Google capabilities clearly in UI.

---

## 📊 FINAL VERDICT

### Is the system production-ready?

**YES, with caveats:**

1. ✅ Core metrics (spend, impressions, clicks, CTR, CPC) are reliably fetched
2. ⚠️ Conversion funnel metrics may be estimates if daily collection is not running
3. ⚠️ Google Ads conversions may be artificially capped
4. ❌ Google Ads demographics are not available (API limitation)

### Recommended Before Going Live:

1. Ensure `daily_kpi_data` collection cron job is active and running
2. Verify conversion action names match the parser patterns for your accounts
3. Test with real account data and validate against platform dashboards
4. Document the known limitations for stakeholders

---

*Report generated by Senior Auditor on December 18, 2025*


