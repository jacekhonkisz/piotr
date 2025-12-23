# 🎯 DATA RELIABILITY ACTION PLAN

**Created:** December 23, 2025  
**Status:** IN PROGRESS  
**Priority:** HIGH

---

## 📊 EXECUTIVE SUMMARY

After comprehensive audits of all client data, we've identified the following critical issues:

| Issue | Severity | Affected | Status |
|-------|----------|----------|--------|
| Google Ads Missing Historical Data | 🔴 CRITICAL | 11/12 clients | Needs Manual Setup |
| Funnel Metrics Unreliable | 🔴 CRITICAL | 6 clients | Needs Investigation |
| Sandra SPA Karpacz Tracking Failure | 🔴 CRITICAL | 1 client | Needs Urgent Fix |
| Zero-Data Anomalies | ⚠️ MEDIUM | 161 records | Ready to Clean |
| December 2024 Meta Data | ✅ OK | All clients | Complete |

---

## 🔴 CRITICAL ISSUE #1: Google Ads Historical Data Missing

### Problem:
- Most clients (11/12) are missing Google Ads data from December 2024 through September 2025
- Only **Belmonte Hotel** has complete Google Ads history
- API errors when trying to backfill for other clients

### Root Cause Analysis:
Looking at the backfill attempt output:
- **Belmonte Hotel**: ✅ All months exist (2024-12 through 2025-12)
- **Other clients**: ❌ API errors - "Unexpected token '<', <!DOCTYPE..." 

This indicates:
1. Belmonte's Google Ads account IS properly connected to the manager account
2. Other clients' accounts may NOT be linked to the manager account
3. The Google Ads customer IDs may be incorrect or have permission issues

### Required Actions:

#### Step 1: Verify Manager Account Access (MANUAL)
```
For each client with missing Google Ads data:
1. Log into Google Ads Manager Account
2. Verify the client account is linked
3. Confirm the customer ID matches what's in the database
4. Grant proper API access permissions
```

**Clients needing verification:**
- Arche Dwór Uphagena Gdańsk (555-410-8762)
- Cesarskie Ogrody (788-509-8406)
- Havet (733-667-6488)
- Hotel Artis Loft (175-337-8268)
- Hotel Diva SPA Kołobrzeg (424-085-9248)
- Hotel Lambert Ustronie Morskie (894-139-3916)
- Hotel Tobaco Łódź (197-883-5824)
- Hotel Zalewski Mrzeżyno (721-984-0096)
- Młyn Klekotki (375-477-3598)
- Nickel Resort Grzybowo (116-432-1699)
- Sandra SPA Karpacz (859-901-9750)

#### Step 2: After Manager Access Fixed
```bash
# Re-run the backfill script
npx tsx scripts/backfill-google-ads-full-history.ts
```

---

## 🔴 CRITICAL ISSUE #2: Funnel Metrics Unreliable

### Problem:
- 240 total funnel tracking issues found
- 32 critical issues (significant spend but ZERO conversions tracked)
- 6 clients have reliability scores below 60/100

### Clients with Poor Funnel Reliability:

| Client | Platform | Score | Main Issue |
|--------|----------|-------|------------|
| Sandra SPA Karpacz | Meta | 0.0/100 | 84% illogical funnels |
| Sandra SPA Karpacz | Google | 0.0/100 | 87% illogical funnels |
| Nickel Resort Grzybowo | Google | 22.7/100 | 24% missing + 27% illogical |
| Młyn Klekotki | Google | 33.3/100 | 50% illogical funnels |
| Apartamenty Lambert | Meta | 46.9/100 | 16% missing + 19% illogical |
| Belmonte Hotel | Google | 56.9/100 | 37% missing funnel data |

### Root Cause Analysis:

1. **"Illogical Funnel Sequences"** - Reservations appear without prior steps
   - This suggests attribution window mismatch
   - Or conversion tracking not capturing all micro-conversions
   - Possible offline conversion imports

2. **"Missing Funnel Data"** - Significant spend but zero conversions
   - Conversion tracking may not be set up
   - API may not be returning conversion data
   - Conversion action IDs may be wrong

### Required Actions:

#### For Sandra SPA Karpacz (URGENT):
```
1. Audit Meta Pixel setup:
   - Check if pixel is firing on website
   - Verify all conversion events are configured
   - Test event firing with Facebook Pixel Helper
   
2. Audit Google Ads conversion setup:
   - Check conversion action IDs in Google Ads account
   - Verify conversion tracking tag is installed
   - Test with Google Tag Assistant
```

#### For All Affected Clients:
```
1. Review conversion event mapping in code:
   - src/lib/google-ads-api.ts (parseGoogleAdsConversions)
   - src/lib/meta-api-service.ts (conversion parsing)
   
2. Verify API is returning conversion data:
   - Add logging to see raw API responses
   - Compare API response vs. Google Ads/Meta UI values
```

---

## ⚠️ MEDIUM ISSUE: Zero-Data Anomalies

### Problem:
- 161 records in database with zero spend, impressions, and clicks
- Split: 78 Meta (48.4%), 83 Google (51.6%)
- Most are weekly records (145/161)

### Top Affected Clients:
| Client | Total | Meta | Google |
|--------|-------|------|--------|
| Nickel Resort Grzybowo | 63 | 30 | 33 |
| Hotel Tobaco Łódź | 33 | 21 | 12 |
| Belmonte Hotel | 28 | 0 | 28 |
| Hotel Diva SPA Kołobrzeg | 10 | 6 | 4 |
| Sandra SPA Karpacz | 7 | 6 | 1 |

### Time Distribution:
- Most zero-data in Q1 2025 (Jan-Mar): 69 records
- December 2024: 20 records
- Likely represents: paused campaigns OR data collection failures

### Recommended Action:

**Option A: Delete zero-data records** (Recommended if cleaning up)
```bash
npx tsx scripts/cleanup-zero-data-anomalies.ts --delete
```

**Option B: Keep as audit trail**
- No action needed
- Records show historical account state
- Useful for understanding campaign activity patterns

**My recommendation:** Delete the records to clean up the database and improve query performance. These zeros don't provide value and may confuse reports.

---

## ✅ COMPLETED: December 2024 Meta Ads Data

### Status: COMPLETE ✅

All 13 clients have proper December 2024 Meta Ads data:
- Total spend tracked: 81,347.46 PLN
- All conversion metrics captured
- No data quality issues

---

## 📋 ACTION CHECKLIST

### Immediate (Today):

- [ ] **Clean up zero-data records:**
  ```bash
  npx tsx scripts/cleanup-zero-data-anomalies.ts --delete
  ```

- [ ] **Review Sandra SPA Karpacz conversion setup:**
  - Check Meta Business Suite for pixel status
  - Check Google Ads for conversion action setup

### This Week:

- [ ] **Verify Google Ads Manager Account Links:**
  - Log into Google Ads Manager
  - Check each client account is properly linked
  - Verify customer IDs match database

- [ ] **Investigate Funnel Tracking Code:**
  - Review `src/lib/google-ads-api.ts`
  - Review conversion parsing logic
  - Add logging to debug missing conversions

### After Manager Access Fixed:

- [ ] **Run Google Ads Historical Backfill:**
  ```bash
  npx tsx scripts/backfill-google-ads-full-history.ts
  ```

- [ ] **Re-run Audit to Verify:**
  ```bash
  npx tsx scripts/compare-all-clients-year-data.ts
  npx tsx scripts/audit-funnel-metrics-reliability.ts
  ```

---

## 🔧 AVAILABLE SCRIPTS

| Script | Purpose | Command |
|--------|---------|---------|
| Year-over-year comparison | Check all client data completeness | `npx tsx scripts/compare-all-clients-year-data.ts` |
| Funnel metrics audit | Check conversion tracking reliability | `npx tsx scripts/audit-funnel-metrics-reliability.ts` |
| Google Ads backfill | Backfill missing Google Ads data | `npx tsx scripts/backfill-google-ads-full-history.ts` |
| Zero-data cleanup | Remove/analyze zero-data records | `npx tsx scripts/cleanup-zero-data-anomalies.ts` |

---

## 📊 SUCCESS METRICS

After completing all actions, these should be true:

1. **Data Completeness:**
   - [ ] All clients have 13+ months of Google Ads data
   - [ ] December 2024 data exists for all platforms
   - [ ] Zero-data records reduced to <20 (legitimate paused campaigns only)

2. **Funnel Reliability:**
   - [ ] All clients have reliability score >70/100
   - [ ] Sandra SPA Karpacz improved from 0/100 to >80/100
   - [ ] Illogical funnel sequences <10% of records

3. **Automated Collection:**
   - [ ] Weekly automated collection running without errors
   - [ ] Monthly summaries generated correctly
   - [ ] No new data gaps appearing

---

## 📞 ESCALATION

If Google Ads Manager access issues persist, consider:

1. **Contact Google Ads Support:**
   - Report API access issues
   - Request account linking assistance

2. **Alternative Data Collection:**
   - Manual export from Google Ads UI
   - Import CSV data as backup

3. **Code Review:**
   - Review `src/lib/google-ads-api.ts` for auth issues
   - Check `system_settings` table for correct credentials

---

## 📝 NOTES

- **Belmonte Hotel** is the "gold standard" - has complete data on both platforms
- Use Belmonte as reference when debugging other clients
- Google Ads API has daily quota limits - backfill may need multiple runs
- Consider implementing automated data quality checks to catch issues earlier

---

**Document Updated:** December 23, 2025

