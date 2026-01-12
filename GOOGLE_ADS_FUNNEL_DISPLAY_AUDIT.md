# 🔍 Google Ads Funnel Display Values - Complete Audit

## Overview
This document audits what values are being displayed in the Google Ads funnel component (`ConversionFunnel`).

---

## 📊 Funnel Steps Displayed

### 1. **Step 1: "Wyszukiwania" (Searches)**
- **Data Source**: `googleData.conversionMetrics.booking_step_1`
- **Component Display**: `step1` prop in `ConversionFunnel`
- **What it represents**: Booking Engine Step 1 conversions
- **Google Ads Conversion Names Matched**:
  - **"PBM - Booking Engine - krok 1"** (Primary pattern)
  - "Step 1 w BE"
  - "step 1 w be"
  - "booking_step_1"
  - "krok 1"
  - "step1"
- **Parser Location**: `src/lib/google-ads-actions-parser.ts` (lines 90-97)
- **Display Format**: Full number (e.g., `9,864` not `9.9K`)

### 2. **Step 2: "Wyświetlenia zawartości" (Content Views)**
- **Data Source**: `googleData.conversionMetrics.booking_step_2`
- **Component Display**: `step2` prop in `ConversionFunnel`
- **What it represents**: Booking Engine Step 2 conversions
- **Google Ads Conversion Names Matched**:
  - **"PBM - Booking Engine - krok 2"** (Primary pattern)
  - "Step 2 w BE"
  - "step 2 w be"
  - "booking_step_2"
  - "krok 2"
  - "step2"
- **Parser Location**: `src/lib/google-ads-actions-parser.ts` (lines 99-106)
- **Display Format**: Full number (e.g., `991` not `1.0K`)
- **Conversion Rate**: Calculated as `(step2 / step1) * 100` (percentage from Step 1)

### 3. **Step 3: "Zainicjowane przejścia do kasy" (Initiated Checkouts)**
- **Data Source**: `googleData.conversionMetrics.booking_step_3`
- **Component Display**: `step3` prop in `ConversionFunnel`
- **What it represents**: Booking Engine Step 3 conversions
- **Google Ads Conversion Names Matched**:
  - **"PBM - Booking Engine - krok 3"** (Primary pattern)
  - "Step 3 w BE"
  - "step 3 w be"
  - "booking_step_3"
  - "krok 3"
  - "step3"
- **Parser Location**: `src/lib/google-ads-actions-parser.ts` (lines 108-115)
- **Display Format**: Full number (e.g., `310` not `0.3K`)
- **Conversion Rate**: Calculated as `(step3 / step2) * 100` (percentage from Step 2)

### 4. **Reservations: "Ilość rezerwacji" (Number of Reservations)**
- **Data Source**: `googleData.conversionMetrics.reservations`
- **Component Display**: `reservations` prop in `ConversionFunnel`
- **What it represents**: Final completed reservations/purchases
- **Google Ads Conversion Names Matched**:
  - **"PBM - Rezerwacja"** (Primary pattern)
  - "Rezerwacja" (ONLY if it doesn't include "krok" or "step" or "booking engine")
  - "reservation"
  - "zakup"
  - "purchase"
  - "complete"
  - "booking" (excludes "booking engine" steps)
- **Parser Location**: `src/lib/google-ads-actions-parser.ts` (lines 117-144)
- **Display Format**: Full number (e.g., `52` not `0.1K`)
- **Conversion Rate**: Calculated as `(reservations / step3) * 100` (percentage from Step 3)
- **⚠️ Critical**: System excludes "booking engine" step conversions from being counted as reservations

---

## 💰 Value Metrics Displayed

### 1. **"Łączna wartość rezerwacji" (Total Reservation Value)**
- **Data Source**: `googleData.conversionMetrics.total_conversion_value`
- **Component Display**: `totalConversionValue` prop in `ConversionFunnel`
- **Fallback**: If `totalConversionValue` is undefined, falls back to `conversionValue`, then `reservationValue`
- **What it represents**: `all_conversions_value` from Google Ads API (specifically from "PBM - Rezerwacja" conversion action)
  - Includes view-through conversions
  - Includes cross-device conversions
  - Total value of all reservation conversions
- **Google Ads API Field**: `all_conversions_value`
- **Display Format**: Polish locale with 2 decimal places (e.g., `110,302.00 zł`)
- **Label**: "Łączna wartość rezerwacji" (when `platform="google"`)

### 2. **"Wartość konwersji" (Conversion Value) - Optional**
- **Data Source**: `googleData.conversionMetrics.conversion_value`
- **Component Display**: `conversionValue` prop in `ConversionFunnel`
- **What it represents**: `conversions_value` from Google Ads API
  - Cross-platform comparable metric
  - Standard conversion value (excludes view-through)
- **Google Ads API Field**: `conversions_value`
- **Used For**: Fallback if `totalConversionValue` is not available

### 3. **"Wartość rezerwacji" (Reservation Value) - Fallback**
- **Data Source**: `googleData.conversionMetrics.reservation_value`
- **Component Display**: `reservationValue` prop in `ConversionFunnel`
- **What it represents**: Monetary value of completed reservations only
- **Source**: Only from conversion actions that match the "reservations" pattern AND have a conversion value attached
- **Parser Location**: `src/lib/google-ads-actions-parser.ts` (lines 140-143)
- **Used For**: Final fallback if both `totalConversionValue` and `conversionValue` are unavailable

### 4. **ROAS (Return on Ad Spend)**
- **Data Source**: `googleData.conversionMetrics.roas`
- **Component Display**: `roas` prop in `ConversionFunnel`
- **Calculation**: `total_conversion_value / spend` (if spend > 0)
- **Display Format**: `X.XXx` (e.g., `2.45x`)
- **Label**: "ROAS"

---

## 🔄 Data Flow

### 1. **API Layer** (`src/lib/google-ads-api.ts`)
- Fetches campaign data from Google Ads API
- Parses conversions using `parseGoogleAdsConversions()` from `google-ads-actions-parser.ts`
- Calculates:
  - `conversion_value` = `conversions_value` from API
  - `total_conversion_value` = `all_conversions_value` from API
  - `roas` = `allConversionsValue / spend`
- **Location**: Lines 707-714

### 2. **Parser Layer** (`src/lib/google-ads-actions-parser.ts`)
- Parses Google Ads conversion actions into structured metrics
- Maps conversion names to funnel steps using pattern matching
- Rounds all conversion counts to integers
- **Location**: Lines 38-181

### 3. **API Route** (`src/app/api/platform-separated-metrics/route.ts`)
- Aggregates conversion metrics from `daily_kpi_data` table
- Sums up daily values for the date range
- Calculates ROAS and cost per reservation
- **Location**: Lines 234-247

### 4. **Component Layer** (`src/components/ConversionFunnel.tsx`)
- Receives props from parent component
- Displays funnel steps with conversion rates
- Shows conversion value and ROAS in bottom cards
- **Location**: Lines 336-347 (PlatformSeparatedMetrics usage)

---

## 📍 Where Google Ads Funnel is Used

### 1. **PlatformSeparatedMetrics Component**
- **File**: `src/components/PlatformSeparatedMetrics.tsx`
- **Location**: Lines 335-347
- **Props Passed**:
  ```typescript
  <ConversionFunnel
    step1={googleData.conversionMetrics.booking_step_1}
    step2={googleData.conversionMetrics.booking_step_2}
    step3={googleData.conversionMetrics.booking_step_3}
    reservations={googleData.conversionMetrics.reservations}
    reservationValue={googleData.conversionMetrics.reservation_value}
    conversionValue={googleData.conversionMetrics.conversion_value}
    totalConversionValue={googleData.conversionMetrics.total_conversion_value}
    roas={googleData.conversionMetrics.roas}
    platform="google"
  />
  ```

### 2. **WeeklyReportView Component**
- **File**: `src/components/WeeklyReportView.tsx`
- **Location**: Lines 933-959
- **Uses**: `getConversionMetric()` helper function to extract values from report data

---

## 🎯 Display Logic in ConversionFunnel Component

### Conversion Value Display Priority:
1. **`totalConversionValue`** (if provided) → "Łączna wartość konwersji"
2. **`conversionValue`** (if `totalConversionValue` not available) → "Wartość konwersji"
3. **`reservationValue`** (final fallback) → "Wartość rezerwacji"

**Code Location**: `src/components/ConversionFunnel.tsx` lines 71-74

```typescript
const displayConversionValue = conversionValue !== undefined ? conversionValue : reservationValue;
const displayTotalConversionValue = totalConversionValue !== undefined ? totalConversionValue : displayConversionValue;
```

### Platform-Specific Labels:
- **Google**: "Łączna wartość rezerwacji" (Total Reservation Value from "PBM - Rezerwacja" action)
- **Meta**: "Wartość rezerwacji (zakupy w witrynie)" (Reservation Value - Website Purchases)

**Code Location**: `src/components/ConversionFunnel.tsx` lines 85-87

---

## ⚠️ Important Notes

1. **Number Formatting**: All numbers are displayed in full format (no abbreviations like "K" or "M")
   - Uses `toLocaleString('pl-PL')` for Polish locale formatting
   - Example: `1,234` not `1.2K`

2. **Conversion Rounding**: All conversion counts are rounded to integers
   - Google Ads uses attribution models that can assign fractional conversions (e.g., 0.5)
   - Parser rounds to whole numbers for display
   - **Location**: `src/lib/google-ads-actions-parser.ts` lines 155-165

3. **Funnel Validation**: System warns about funnel inversions
   - If Step 2 > Step 1, logs warning
   - If Step 3 > Step 2, logs warning
   - If Reservations > Step 3, logs warning
   - **Location**: `src/lib/google-ads-actions-parser.ts` lines 167-178

4. **Reservation Value**: Only includes monetary value from conversion actions that:
   - Match the "reservations" pattern (rezerwacja, zakup, purchase, etc.)
   - Do NOT include "krok", "step", or "booking engine" in the name
   - Have a `conversion_value` attached

5. **ROAS Calculation**: Uses `total_conversion_value` (all_conversions_value) divided by spend
   - This includes view-through and cross-device conversions
   - More comprehensive than using just `conversion_value`

---

## 📋 Summary

**Google Ads Funnel displays:**
1. ✅ **Step 1** (Wyszukiwania) - from `booking_step_1`
2. ✅ **Step 2** (Wyświetlenia zawartości) - from `booking_step_2`
3. ✅ **Step 3** (Zainicjowane przejścia do kasy) - from `booking_step_3`
4. ✅ **Reservations** (Ilość rezerwacji) - from `reservations`
5. ✅ **Total Reservation Value** (Łączna wartość rezerwacji) - from `total_conversion_value` (from "PBM - Rezerwacja" action) or `conversion_value` or `reservation_value`
6. ✅ **ROAS** - from `roas` (calculated as `total_conversion_value / spend`)

**All values are displayed as full numbers (no abbreviations) with Polish locale formatting.**

