# 🔍 Google Ads CTR & CPC Fetching Explanation

## How We Fetch CTR and CPC

### From Google Ads API (lines 692-695):

```typescript
// ✅ FIX: Calculate CTR and CPC from aggregated values
ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
cpc: clicks > 0 ? spend / clicks : 0,
```

### What We Request from Google Ads API (line 495-498):

```sql
metrics.clicks,
metrics.impressions,  
metrics.cost_micros,
metrics.ctr,  -- NOT USED (we recalculate)
metrics.average_cpc,  -- NOT USED (we recalculate)
```

---

## Why We Recalculate Instead of Using API Values

### The Problem:
- Google Ads API returns **per-day** CTR and CPC values
- When aggregating multiple days, you **CANNOT simply average** CTR/CPC
- Must recalculate from **total clicks, impressions, and spend**

### Example (Why Averaging Fails):

**Day 1:**
- 1,000 impressions, 10 clicks = 1.0% CTR
- Spend: 10 zł, CPC: 1.00 zł

**Day 2:**
- 100 impressions, 5 clicks = 5.0% CTR  
- Spend: 25 zł, CPC: 5.00 zł

**WRONG (if we average):**
- Average CTR = (1.0% + 5.0%) / 2 = **3.0%** ❌

**CORRECT (recalculate):**
- Total: 1,100 impressions, 15 clicks
- CTR = (15 / 1,100) * 100 = **1.36%** ✅

---

## What Might Cause Differences

### 1. Date Range Mismatch
**In our app:** We show the full month (e.g., December 1-31)
**In Google Ads:** You might be viewing a different date range

**Solution:** Check the date range in Google Ads matches your report period

---

### 2. Time Zone Differences
**In our app:** We use the client's timezone or UTC
**In Google Ads:** Uses account timezone

**Example:**
- Google Ads (Warsaw time): December 1, 00:00 - December 31, 23:59
- Our app (UTC): November 30, 23:00 - December 31, 22:59
- **Result:** Slight differences in included data

---

### 3. Attribution Window
**Google Ads has different conversion attribution:**
- `metrics.clicks` - Actual clicks
- `metrics.interactions` - Clicks + other interactions (calls, directions, etc.)

**We use:** `metrics.clicks` only

**If Google Ads shows:**
- "Kliknięcia" (Clicks) - should match ours
- "Interakcje" (Interactions) - will be higher than our clicks

---

### 4. Aggregation Level
**In our app:** 
- We aggregate **all campaigns** for the period
- CTR = Total Clicks / Total Impressions

**In Google Ads:**
- If viewing individual campaigns, each has its own CTR
- **Total row** should match our value

---

### 5. Filters Applied
**In Google Ads:** You might have filters active:
- Status filter (Active only vs All)
- Campaign type filter
- Network filter (Search only vs Display + Search)

**Our app:** Fetches ALL campaigns regardless of status by default

---

## How to Compare Accurately

### Step 1: Check Date Range
```
✅ In Google Ads: Set date range to match your report
   Example: December 1, 2025 - December 31, 2025
```

### Step 2: Remove All Filters
```
✅ In Google Ads: Click "Filter" and remove all filters
   Or select "All campaigns" view
```

### Step 3: Check Total Row
```
✅ In Google Ads: Look at the TOTAL row at the bottom
   Not individual campaigns
```

### Step 4: Verify Columns
```
✅ Compare these exact columns:
   - Kliknięcia (Clicks) - should match
   - Wyświetlenia (Impressions) - should match  
   - Koszt (Cost) - should match
   - CTR (Click-through rate) - recalculated from above
   - Średni CPC (Avg. CPC) - recalculated from above
```

---

## Screenshot Analysis

From your screenshot showing:
- **Śr. CPC: 1,17 zł**
- **CTR widocznych reklam: 0,86%**

### Potential Issues:

1. **"CTR widocznych reklam"** = "Viewable CTR"
   - This is **NOT the same as regular CTR**!
   - Viewable CTR = Clicks / Viewable Impressions (subset of total impressions)
   - **We use:** Regular CTR = Clicks / All Impressions

2. **Different metric selected**
   - You might be viewing "CTR widocznych" instead of regular "CTR"
   - Change column to show "CTR" (not "CTR widocznych reklam")

---

## Which CTR to Use

**In Google Ads, there are multiple CTR metrics:**

| Metric | Formula | When to Use |
|--------|---------|-------------|
| **CTR** | Clicks / Impressions | ✅ Standard metric (what we use) |
| **CTR widocznych reklam** | Clicks / Viewable Impressions | Display campaigns only |
| **CTR interakcji** | Interactions / Impressions | Includes non-click interactions |

**Our app uses: Standard CTR** (Clicks / Impressions)

---

## How to Get Matching Values

### In Google Ads:
1. Go to Campaigns
2. Set date range to match your report
3. Remove all filters
4. Add columns:
   - **Kliknięcia** (not "Interakcje")
   - **Wyświetlenia** (not "Wyświetlenia widoczne")
   - **Koszt**
   - **CTR** (not "CTR widocznych reklam" or "Współczynnik interakcji")
   - **Średni CPC** (not "Śr. CPM" or other metrics)
5. Look at the **TOTAL row** at the bottom
6. These should match our app values

---

## Debug: What Exact Values Do You See?

To help debug, please share:

**In Google Ads (from TOTAL row):**
- Date range: ?
- Kliknięcia: ?
- Wyświetlenia: ?
- Koszt: ?
- CTR: ?
- Średni CPC: ?

**In our app:**
- Period: ?
- Clicks: ?
- Impressions: ?
- Spend: ?
- CTR: ?
- CPC: ?

Then I can identify the exact discrepancy!

---

## Code Reference

**File:** `src/lib/google-ads-api.ts`
**Lines 692-695:** CTR/CPC calculation
**Lines 495-523:** Google Ads API query

We fetch:
- ✅ `metrics.clicks`
- ✅ `metrics.impressions`
- ✅ `metrics.cost_micros`

We calculate:
- CTR = (clicks / impressions) * 100
- CPC = spend / clicks

This matches Google Ads' standard CTR and CPC calculation.

