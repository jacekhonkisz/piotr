# 🔍 Google Ads Data Comparison Audit: Havet Client

## 📊 **Executive Summary**

**Audit Date**: December 19, 2025  
**Client**: Havet  
**Data Source**: Real Google Ads console export (JSON) vs. Application fetching logic  
**Period**: December 1-19, 2025

---

## 📈 **Real Data from Google Cloud Console (JSON)**

### **Total Account Metrics (Dec 1-19, 2025)**

| Metric (Polish) | Metric (English) | Value |
|-----------------|------------------|-------|
| Wyświetlenia | Impressions | **219,637** |
| Interakcje | Interactions | **10,288** |
| Koszt | Cost | **9,543.84 PLN** |
| Śr. CPM | Avg CPM | **43.45 PLN** |
| Współczynnik interakcji | Interaction Rate | **4.68%** |
| Śr. koszt | Avg Cost | **0.93 PLN** |
| Konwersje | Conversions | **0** |

### **Network Breakdown (Totals from JSON)**

| Network Type | Impressions | Interactions | Cost (PLN) |
|--------------|-------------|--------------|------------|
| Sieć reklamowa (Display) | 170,641 | 2,667 | 1,613.23 |
| Wyszukiwarka (Search) | 21,703 | 4,136 | 5,760.23 |
| Kampania inteligentna (Smart) | 11,262 | 1,196 | 388.01 |
| Performance Max | 16,031 | 2,289 | 1,782.38 |
| Wideo (Video) | 0 | 0 | 0 |
| Generowanie popytu (Demand Gen) | 0 | 0 | 0 |

---

## 🎯 **Active Campaigns with Data (Non-Zero Spend)**

| Campaign Name | Impressions | Clicks/Interactions | Cost (PLN) | Type |
|--------------|-------------|---------------------|------------|------|
| [PBM] GSN \| Brand PL | 7,214 | 2,585 | 2,508.96 | Search |
| [PBM] PMax \| Pakiety pobytowe - Ferie Zimowe 2026 | 10,113 | 1,103 | 1,424.95 | PMax |
| [PBM] GSN \| Brand \| DE | 2,000 | 505 | 1,281.04 | Search |
| [PBM] GDN \| Hot \| Remarketing | 145,894 | 2,364 | 1,033.32 | Display |
| [PBM] GDN \| Hot \| Remarketing dynamiczny | 24,758 | 303 | 579.91 | Display |
| [PBM] Inteligenta \| Ogólna | 11,262 | 1,196 | 388.01 | Smart |
| [PBM] GSN \| Cold \| Frazy Lokalne - Dźwirzyno | 2,456 | 277 | 377.58 | Search |
| [PBM] GSN \| Frazy lokalne \| DE | 1,603 | 150 | 372.30 | Search |
| [PBM] GSN \| DSA PL | 3,461 | 177 | 279.98 | Search |
| [PBM] PMax \| Boże Narodzenie | 4,006 | 1,011 | 211.84 | PMax |
| [PBM] GSN \| Cold \| Frazy Lokalne - Wypoczynek nad morzem | 1,618 | 96 | 189.74 | Search |
| [PBM] GSN \| Cold \| Frazy Lokalne - hotel nad morzem \| RLSA | 799 | 67 | 182.64 | Search |
| [PBM] GSN \| Cold \| z psem nad morzem | 738 | 75 | 168.09 | Search |
| [PBM] PMax \| Sylwester | 1,912 | 175 | 145.60 | PMax |
| [PBM] GSN \| Boże Narodzenie nad morzem | 465 | 61 | 106.41 | Search |
| [PBM] GSN \| Boże Narodzenie | 466 | 61 | 104.20 | Search |
| [PBM] GSN \| Cold \| Apartamanet z jacuzzi nad morzem | 479 | 40 | 95.37 | Search |
| [PBM] GSN \| Cold \| Frazy Lokalne - 5-gwiazdkowy hotel nad morzem | 404 | 42 | 93.92 | Search |

**Total Active Campaigns**: 18 (out of 100+ total campaigns, many paused/ended)

---

## 🔴 **CRITICAL INCONSISTENCIES FOUND**

### **1. ⚠️ CRITICAL: Two Different Conversion Metrics!**

**Discovery**: There are TWO types of conversions in Google Ads:

| Metric | Polish Name | Campaign Report | Time Series Report |
|--------|-------------|-----------------|-------------------|
| `metrics.conversions` | Konw. (porównywalne na różnych platformach) | **0** | ~194 total |
| `metrics.all_conversions` | Wszystkie konwersje | Not shown | **~998 total** |

**Time Series Data (Dec 1-19, 2025)**:
```
Date        | Konwersje | Konwersje.1 | Wartość konw. | Cost
------------|-----------|-------------|---------------|--------
Dec 1       | 9.68      | 55.89       | 6,398.80      | 539.88
Dec 2       | 10.53     | 49.91       | 5,618.34      | 550.24
Dec 3       | 5.13      | 29.20       | 16,941.92     | 484.42
Dec 7       | 22.31     | 64.00       | 9,549.56      | 736.07
Dec 11      | 19.49     | 65.86       | 10,744.39     | 530.07
Dec 15      | 9.81      | 67.90       | 12,625.53     | 491.07
...
TOTALS:     | ~194      | ~998        | ~86,000+      | 9,544
```

**The Issue**: 
- Campaign report shows `Konw. (porównywalne na różnych platformach)` = **0**
- Time series shows `Konwersje` = **~194** and `Konwersje.1` = **~998**
- These are DIFFERENT conversion attribution models!

**Why Campaign Report Shows 0**:
- "Porównywalne na różnych platformach" = Cross-platform comparable conversions
- This is a STRICTER attribution model that may not count view-through or cross-device conversions
- The actual conversions ARE being tracked, just not in that specific column

### **2. "Interactions" vs "Clicks" Terminology**

**Issue**: JSON uses **"Interakcje"** (Interactions), but app uses **"Clicks"**.

| Source | Term Used | Total Count |
|--------|-----------|-------------|
| JSON Export | Interakcje (Interactions) | 10,288 |
| App Fetcher | Clicks | Should be same |

**Note**: For Search campaigns, Interactions ≈ Clicks. For Display/Video, Interactions can include video views, engagements, etc.

**Parsing Code** (`google-ads-api.ts`):
```typescript
// Current code:
const clicks = metrics.clicks || 0;

// Should also consider:
const interactions = metrics.interactions || clicks;
```

### **3. Status Translation Issues**

**JSON Status Values (Polish → English)**:
| Polish | English | Count |
|--------|---------|-------|
| Włączona | Enabled | 18 active |
| Wstrzymana | Paused | ~80+ |
| Zakończony | Ended | ~5 |

**App Status Mapping**: Should correctly map `campaign.status` enum values.

### **4. Campaign Type Mapping**

**JSON Types (Polish → Standard)**:
| Polish | Standard Google Ads |
|--------|---------------------|
| Wyszukiwarka | SEARCH |
| Sieć reklamowa | DISPLAY |
| Performance Max | PERFORMANCE_MAX |
| Kampania inteligentna | SMART |
| Wideo | VIDEO |
| Generowanie popytu | DEMAND_GEN |

---

## 📈 **REAL Conversion Data (Time Series Export)**

### **Daily Breakdown (Dec 1-19, 2025)**

| Date | Impressions | Conversions (Cross-Platform) | All Conversions | Conv. Value | Cost |
|------|-------------|------------------------------|-----------------|-------------|------|
| Dec 1 | 16,331 | 9.68 | 55.89 | 6,398.80 | 539.88 |
| Dec 2 | 13,438 | 10.53 | 49.91 | 5,618.34 | 550.24 |
| Dec 3 | 18,484 | 5.13 | 29.20 | 16,941.92 | 484.42 |
| Dec 4 | 21,158 | - | 33.88 | - | 392.70 |
| Dec 5 | 8,113 | 5.23 | 43.65 | 8,078.97 | 639.63 |
| Dec 6 | 10,661 | 14.52 | 44.26 | - | 651.69 |
| Dec 7 | 10,856 | 22.31 | 64.00 | 9,549.56 | 736.07 |
| Dec 8 | 7,714 | 13.27 | 83.21 | - | 542.07 |
| Dec 9 | 14,293 | 12.21 | 58.77 | - | 483.55 |
| Dec 10 | 8,104 | 10.46 | 62.06 | 10,003.47 | 504.06 |
| Dec 11 | 7,365 | 19.49 | 65.86 | 10,744.39 | 530.07 |
| Dec 12 | 8,515 | 14.81 | 40.33 | 417.56 | 422.85 |
| Dec 13 | 17,304 | 7.93 | 52.48 | - | 437.66 |
| Dec 14 | 10,440 | - | 69.40 | - | 497.73 |
| Dec 15 | 9,733 | 9.81 | 67.90 | 12,625.53 | 491.07 |
| Dec 16 | 7,857 | 7.26 | 70.58 | 2,687.29 | 466.21 |
| Dec 17 | 6,714 | 10.21 | 48.38 | 1,187.43 | 433.61 |
| Dec 18 | 12,599 | 12.22 | 43.84 | 1,537.02 | 448.10 |
| Dec 19 | 10,036 | 9.23 | 14.05 | - | 293.33 |

### **Totals (Dec 1-19, 2025)**

| Metric | Value |
|--------|-------|
| **Impressions** | ~219,715 |
| **Cross-Platform Conversions** | ~194.30 |
| **All Conversions** | ~997.65 |
| **Conversion Value** | ~86,000+ PLN |
| **Total Cost** | ~9,544 PLN |
| **ROAS (All Conv.)** | ~9.0x |

---

## ✅ **What the App is Doing Correctly**

### **1. Core Metrics Fetching**
The GAQL query in `google-ads-api.ts` correctly fetches:
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.cost_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.average_cpc,
  metrics.conversions,
  metrics.conversions_value,
  ...
```

### **2. Cost Conversion**
Correctly converts from micros:
```typescript
const spend = (metrics.cost_micros || 0) / 1000000;
```

### **3. Rate Limiting & Error Handling**
✅ Implements rate limiting (25 calls/minute)
✅ Exponential backoff for retries
✅ Token refresh handling

---

## 🔧 **RECOMMENDED FIXES**

### **Fix 1: ⚠️ CRITICAL - Use `all_conversions` Instead of `conversions`**

The app is fetching `metrics.conversions` which returns **cross-platform comparable** conversions (often 0).

**Current code in `google-ads-api.ts`**:
```typescript
// ❌ PROBLEM: This returns 0 for cross-platform comparable conversions
const conversions = metrics.conversions || 0;
```

**FIX - Use `all_conversions`**:
```typescript
// ✅ FIX: Use all_conversions which includes ALL conversion types
const conversions = metrics.all_conversions || metrics.conversions || 0;
const conversionValue = metrics.all_conversions_value || metrics.conversions_value || 0;
```

**Expected Results After Fix**:
- Cross-platform conversions: ~194 (currently shown as 0)
- All conversions: **~998** (what should be displayed)
- Conversion value: **~86,000 PLN**

### **Fix 2: Update GAQL Query**

Add `all_conversions` to the query in `google-ads-api.ts`:

```sql
SELECT
  campaign.id,
  campaign.name,
  metrics.cost_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.conversions,           -- Cross-platform (may be 0)
  metrics.all_conversions,       -- ✅ ADD THIS - All conversions
  metrics.conversions_value,
  metrics.all_conversions_value, -- ✅ ADD THIS - All conversion value
  ...
```

### **Fix 3: Remove Fake Conversion Estimates**

Once using real `all_conversions`, remove fallback estimation:

```typescript
// ❌ REMOVE estimation code - use real data instead
campaignConversions = {
  reservations: Math.round(allConversions), // Use real all_conversions
  reservation_value: allConversionsValue    // Use real value
};
```

### **Fix 3: Display Network Performance from JSON**

The JSON shows clear network breakdown that should be displayed:

| Network | Impressions | Cost | CTR |
|---------|-------------|------|-----|
| Display (GDN) | 170,641 | 1,613.23 | 0.0156 |
| Search | 21,703 | 5,760.23 | 0.1906 |
| PMax | 16,031 | 1,782.38 | 0.1428 |
| Smart | 11,262 | 388.01 | 0.1062 |

### **Fix 4: Show Paused Campaign Count**

Add UI indicator:
```
✅ 18 Active Campaigns | ⏸️ 82 Paused Campaigns
Total Spend: 9,543.84 PLN
```

---

## 📋 **Data Mapping Reference**

### **JSON Column to Metric Mapping**

| JSON Column | Polish Name | English Name | Unit |
|-------------|-------------|--------------|------|
| Raport kampanii | Stan kampanii | Campaign Status | - |
| Unnamed: 1 | Kampania | Campaign Name | - |
| Unnamed: 2 | Budżet | Budget | PLN/day |
| Unnamed: 8 | Typ kampanii | Campaign Type | - |
| Unnamed: 9 | Kod waluty | Currency | PLN |
| Unnamed: 10 | Śr. CPV TrueView | Avg CPV TrueView | PLN |
| Unnamed: 11 | Śr. CPM | Avg CPM | PLN |
| Unnamed: 12 | Wyświetlenia | Impressions | count |
| Unnamed: 13 | Interakcje | Interactions | count |
| Unnamed: 14 | Współczynnik interakcji | Interaction Rate | % |
| Unnamed: 15 | Śr. koszt | Avg Cost | PLN |
| Unnamed: 16 | Koszt | Cost/Spend | PLN |
| Unnamed: 17 | Konw. | Conversions | count |
| Unnamed: 18 | Koszt / konw. | Cost per Conversion | PLN |
| Unnamed: 19 | Wartość konw. / koszt | ROAS | ratio |

---

## 🎯 **Summary: Expected vs Actual**

### **For December 1-19, 2025 (Havet)**

| Metric | Campaign Report | Time Series | App Should Show | Status |
|--------|-----------------|-------------|-----------------|--------|
| Total Spend | 9,543.84 PLN | ~9,544 PLN | ~9,544 PLN | ✅ Matches |
| Total Impressions | 219,637 | ~219,715 | ~220k | ✅ Matches |
| Total Clicks | 10,288 | - | ~10,288 | ✅ Matches |
| **Cross-Platform Conv.** | **0** | **~194** | ~194 | 🔴 **BUG** |
| **All Conversions** | Not shown | **~998** | **~998** | 🔴 **Missing** |
| **Conversion Value** | 0 | **~86,000 PLN** | ~86,000 PLN | 🔴 **BUG** |
| **ROAS** | 0 | **~9.0x** | ~9.0x | 🔴 **BUG** |

---

## 🔑 **Key Takeaways**

1. **🔴 CRITICAL BUG**: App uses `metrics.conversions` (cross-platform) which is **0**, instead of `metrics.all_conversions` which is **~998**!

2. **✅ GOOD**: Core metrics (spend, impressions, clicks) are fetched correctly

3. **🔧 IMMEDIATE FIX NEEDED**: 
   - Change from `metrics.conversions` → `metrics.all_conversions`
   - Change from `metrics.conversions_value` → `metrics.all_conversions_value`
   - Expected result: **~998 conversions, ~86,000 PLN value, ~9x ROAS**

4. **📊 Data Sources**:
   - Campaign Report: Shows per-campaign breakdown but uses strict attribution
   - Time Series: Shows daily totals with ALL conversions (correct data!)

5. **⚠️ Attribution Difference**:
   - `conversions` = Cross-platform comparable (stricter, often lower/zero)
   - `all_conversions` = All conversion types including view-through, cross-device

---

## ✅ **FIX APPLIED**

### **Changes Made to `src/lib/google-ads-api.ts`**:

1. **Main campaign fetcher (`getCampaignData`)**: 
   - Changed from `let conversions = reportedConversions;` to `let conversions = allConversions > 0 ? allConversions : reportedConversions;`
   - Now uses `all_conversions_value` instead of `conversions_value` when available

2. **Daily data fetcher (`getCampaignDataWithDateSegments`)**:
   - Added `metrics.all_conversions` and `metrics.all_conversions_value` to GAQL query
   - Updated transformation to prefer `all_conversions` over `conversions`

### **Expected Results After Fix**:

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Total Conversions | 0 | **~998** |
| Conversion Value | 0 | **~86,000 PLN** |
| ROAS | 0 | **~9.0x** |
| Reservations | 0 | **~998** |

---

*Report generated: December 19, 2025*
*Source files:*
- `/Users/macbook/Downloads/Raport_kampanii.json` (Campaign report - shows 0 cross-platform conversions)
- `/Users/macbook/Downloads/Wykres_z_seria_czasowa_2025-12-01_2025-12-19_v2.json` (Time series - shows ~998 all conversions)

