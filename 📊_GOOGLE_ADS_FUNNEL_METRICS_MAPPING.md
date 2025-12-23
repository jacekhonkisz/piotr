# 📊 Google Ads Funnel Metrics - Complete Mapping

## Overview

Google Ads funnel metrics are tracked through **conversion action names** that are mapped to specific funnel steps. The system uses pattern matching to identify which conversion actions belong to which funnel step.

## Funnel Structure

### 1. **Telefon (Phone)** - `click_to_call`
**Google Ads Conversion Names Matched:**
- "phone"
- "telefon"
- "call"
- "dzwonienie"
- "click_to_call"
- "call_conversion"
- "phone_click"
- "telephone"
- "call_extension"
- "call_tracking"
- "phone_number_click"

**What it tracks:** Phone call conversions from ads

---

### 2. **Email** - `email_contacts`
**Google Ads Conversion Names Matched:**
- "email"
- "e-mail"
- "mail"
- "contact"
- "kontakt"
- "formularz"
- "contact_form"
- "email_click"
- "mailto"
- "form_submit"
- "lead_form"
- "contact_us"
- "inquiry"
- "request_info"
- "kliknięcie w e-mail"
- "kliknięcie w adres e-mail"

**What it tracks:** Email contact form submissions and email clicks

---

### 3. **Krok 1 w BE** - `booking_step_1`
**Google Ads Conversion Names Matched:**
- "step 1 w be"
- "step 1"
- "step1"
- "krok 1"
- "booking_step_1"
- "engaged user"
- "kliknięcia linków na podstronie biznesowej"
- "[mice] - wejście na stronę biznesową"
- "search"
- "page_view"
- "view_item"
- "begin_checkout"
- "initiate_checkout"
- "start_checkout"
- "checkout_started"
- "website_visit"
- "landing_page_view"
- "page_visit"

**What it tracks:** Initial booking engine engagement (first step in booking funnel)

---

### 4. **Krok 2 w BE** - `booking_step_2`
**Google Ads Conversion Names Matched:**
- "step 2 w be"
- "step 2"
- "step2"
- "krok 2"
- "booking_step_2"
- "pobranie oferty mice"
- "form_submit"
- "form_submit_success"
- "view_content"
- "add_to_cart"
- "add_payment_info"
- "payment_info"
- "checkout_progress"
- "form_completion"
- "download"
- "file_download"
- "offer_download"

**What it tracks:** Second step in booking engine (viewing details, form submissions)

---

### 5. **Krok 3 w BE** - `booking_step_3`
**Google Ads Conversion Names Matched:**
- "step 3 w be"
- "step 3"
- "step3"
- "krok 3"
- "booking_step_3"
- "micro-marco conwersje"
- "micro_conversion"
- "micro_conversions"
- "rezerwacja" (but NOT if it includes "krok" or "step")
- "initiate_checkout"
- "complete_checkout"
- "checkout_complete"
- "purchase_initiated"
- "conversion" (generic)

**What it tracks:** Third step in booking engine (checkout initiation, micro-conversions)

---

### 6. **Rezerwacje** - `reservations`
**Google Ads Conversion Names Matched:**
- "rezerwacja" (ONLY if it DOESN'T include "krok" or "step" or "booking engine")
- "reservation"
- "zakup"
- "purchase"
- "complete"
- "booking" (careful - excludes "booking engine" steps)
- "purchase_conversion"
- "sale"
- "transaction"
- "order"
- "completed_purchase"
- "purchase_complete"
- "booking_complete"
- "reservation_complete"

**What it tracks:** Final completed reservations/purchases

⚠️ **Critical Note:** The system carefully excludes "booking engine" step conversions from being counted as reservations, even if they contain words like "rezerwacja" or "booking".

---

### 7. **Wartość Rezerwacji** - `reservation_value`
**Source:** `metrics.conversions_value` from Google Ads API
**What it tracks:** Monetary value of completed reservations

This is ONLY calculated from conversion actions that match the "reservations" pattern above AND have a conversion value attached.

---

## Key Differences from Meta Ads

### Meta Ads Funnel:
- **Krok 1**: `link_click` (ad click to website)
- **Krok 2**: `omni_view_content` (booking engine view details)
- **Krok 3**: `omni_initiated_checkout` (booking engine begin booking)

### Google Ads Funnel:
- **Krok 1**: Custom conversion "Step 1 w BE" or similar patterns
- **Krok 2**: Custom conversion "Step 2 w BE" or similar patterns
- **Krok 3**: Custom conversion "Step 3 w BE" or similar patterns

**Important:** Google Ads relies on **manually created conversion actions** in the Google Ads account, while Meta Ads uses **standard pixel events** that are automatically tracked.

---

## How It Works

1. **Conversion Actions Setup:** Each client must set up conversion actions in their Google Ads account with names like "Step 1 w BE", "Step 2 w BE", etc.

2. **API Fetch:** The system fetches all conversion actions via the Google Ads API:
   ```
   segments.conversion_action_name
   metrics.conversions
   metrics.conversions_value
   ```

3. **Pattern Matching:** Each conversion action name is checked against the patterns above using `.includes()` matching (case-insensitive).

4. **Aggregation:** Conversions are summed by funnel step across all campaigns.

5. **Validation:** The system checks for funnel inversions (Step 2 > Step 1, etc.) and logs warnings.

---

## Parser Location

The Google Ads conversion parsing logic is located in:
- **Main Parser:** `src/lib/google-ads-actions-parser.ts`
- **API Integration:** `src/lib/google-ads-api.ts` (lines 840-883 for `conversionMapping`)

---

## Example Conversion Flow

For a campaign with these Google Ads conversion actions:
- "Step 1 w BE" → 500 conversions → `booking_step_1: 500`
- "Step 2 w BE" → 200 conversions → `booking_step_2: 200`
- "Step 3 w BE" → 50 conversions → `booking_step_3: 50`
- "PBM - Rezerwacja" → 10 conversions (value: 5000 PLN) → `reservations: 10, reservation_value: 5000`
- "Telefon" → 15 conversions → `click_to_call: 15`

**Result:**
```
click_to_call: 15
email_contacts: 0
booking_step_1: 500
booking_step_2: 200
booking_step_3: 50
reservations: 10
reservation_value: 5000
```

---

## Important Notes

1. **Case-Insensitive:** All matching is done in lowercase
2. **Partial Matching:** Uses `.includes()` so "Step 1 w BE" matches "step 1"
3. **Rounding:** All conversion counts are rounded to integers (Google Ads can return fractional conversions due to attribution models)
4. **Value Precision:** Monetary values are rounded to 2 decimal places
5. **Exclusion Logic:** Reservations explicitly exclude booking step patterns to avoid double-counting

---

## Current Status

✅ **All Google Ads funnel metrics are correctly mapped and tracked**
✅ **Pattern matching includes Polish and English conversion names**
✅ **System validates funnel progression and logs warnings for inversions**

