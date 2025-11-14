# 🎯 BOOKING ENGINE FUNNEL MAPPING REFERENCE

**Last Updated:** November 14, 2025  
**Status:** Authoritative mapping for all platforms

---

## 📊 META ADS MAPPING (CONFIRMED)

### Booking Engine Step 1: **Search**
**Meta Column:** `search`

**Action Types Tracked:**
- `search`
- `omni_search`
- `offsite_conversion.fb_pixel_search`
- Custom conversions labeled as "booking_step_1"

**Business Meaning:** User searches for availability/dates in the booking engine

**Example from Real Data:**
```json
{
  "action_type": "omni_search",
  "value": "400"
}
```

---

### Booking Engine Step 2: **View Content**
**Meta Column:** `view content`

**Action Types Tracked:**
- `view_content`
- `omni_view_content`
- `offsite_conversion.fb_pixel_view_content`
- `onsite_web_view_content`
- `onsite_web_app_view_content`
- Custom: `offsite_conversion.custom.1150356839010935`
- Custom conversions labeled as "booking_step_2"

**Business Meaning:** User views room details/pricing in the booking engine

**Example from Real Data:**
```json
{
  "action_type": "view_content",
  "value": "123"
}
```

---

### Booking Engine Step 3: **Initiate Checkout**
**Meta Column:** `initiate checkout`

**Action Types Tracked:**
- `initiate_checkout`
- `omni_initiated_checkout`
- `offsite_conversion.fb_pixel_initiate_checkout`
- `onsite_web_initiate_checkout`
- Custom: `offsite_conversion.custom.3490904591193350`
- Custom conversions labeled as "booking_step_3"

**Business Meaning:** User begins the checkout/booking process

**Example from Real Data:**
```json
{
  "action_type": "initiate_checkout",
  "value": "28"
}
```

---

### Reservations (Final Step): **Purchase**
**Meta Column:** `purchase`

**Action Types Tracked:**
- `purchase`
- `omni_purchase`
- `offsite_conversion.fb_pixel_purchase`
- `onsite_web_purchase`
- `onsite_web_app_purchase`
- `web_in_store_purchase`
- `web_app_in_store_purchase`
- `complete_registration`

**Business Meaning:** Completed reservation/booking

**Reservation Value Sources:**
- Same action types from `action_values` array (monetary value)

---

## 📊 GOOGLE ADS MAPPING (CONFIRMED)

### Booking Engine Step 1: **Step 1 w BE**
**Google Ads Conversion Name:** `Step 1 w BE` (Booking Engine Step 1)

**Variations Detected:**
- `Step 1 w BE`
- `step 1 w be`
- `booking_step_1`
- `Krok 1` (Polish)

**Business Meaning:** User initiates booking engine interaction (first step of booking funnel)

**Example from Real Data:**
- Campaign: 8 z 10
- Conversions: 2,186.52
- Value: 4,373.03 PLN

---

### Booking Engine Step 2: **Step 2 w BE**
**Google Ads Conversion Name:** `Step 2 w BE` (Booking Engine Step 2)

**Variations Detected:**
- `Step 2 w BE`
- `step 2 w be`
- `booking_step_2`
- `Krok 2` (Polish)

**Business Meaning:** User proceeds to second step of booking (e.g., viewing room details, selecting dates)

**Example from Real Data:**
- Campaign: 8 z 10
- Conversions: 204.91
- Value: 614.73 PLN

---

### Booking Engine Step 3: **Step 3 w BE**
**Google Ads Conversion Name:** `Step 3 w BE` (Booking Engine Step 3)

**Variations Detected:**
- `Step 3 w BE`
- `step 3 w be`
- `booking_step_3`
- `Krok 3` (Polish)

**Business Meaning:** User reaches third step of booking (e.g., filling guest details, preparing to pay)

**Example from Real Data:**
- Campaign: 8 z 10
- Conversions: 27.98
- Value: 139.92 PLN

---

### Reservations (Final Step): **Rezerwacja / Zakup**
**Google Ads Conversion Names:** `Rezerwacja` (Reservation) OR `Zakup` (Purchase)

**Variations Detected:**
- `Rezerwacja` (Polish for Reservation)
- `Zakup` (Polish for Purchase)
- `Reservation`
- `Purchase`
- `Booking`
- `Complete`

**Business Meaning:** Completed reservation/booking with payment

**Example from Real Data:**
- Conversion: "Rezerwacja - Mazury"
- Conversions: 13.00
- Value: 30,858.00 PLN

---

## 🔍 KEY DIFFERENCES: META vs GOOGLE ADS

| Funnel Step | Meta Ads | Google Ads |
|-------------|----------|------------|
| **Step 1** | `search` (standard event) | `Step 1 w BE` (custom conversion) |
| **Step 2** | `view_content` (standard event) | `Step 2 w BE` (custom conversion) |
| **Step 3** | `initiate_checkout` (standard event) | `Step 3 w BE` (custom conversion) |
| **Reservations** | `purchase` (standard event) | `Rezerwacja` / `Zakup` (custom conversion) |

**Note:** Google Ads uses custom conversion names specific to each client, while Meta uses standard Facebook Pixel events.

---

## 🔧 IMPLEMENTATION FILES

### Meta Ads Parser
**File:** `src/lib/meta-actions-parser.ts`

**Functions:**
- `parseMetaActions()` - Parses actions/action_values arrays
- `enhanceCampaignWithConversions()` - Adds metrics to single campaign
- `enhanceCampaignsWithConversions()` - Adds metrics to campaign array
- `aggregateConversionMetrics()` - Sums metrics across campaigns

**Used By:**
- `src/lib/smart-cache-helper.ts` (current month/week data)
- `src/lib/standardized-data-fetcher.ts` (all data requests)
- Background collectors (historical data)

### Google Ads Parser
**File:** `src/lib/google-ads-actions-parser.ts`

**Functions:**
- `parseGoogleAdsConversions()` - Parses conversions array
- `enhanceCampaignWithConversions()` - Adds metrics to single campaign
- `enhanceCampaignsWithConversions()` - Adds metrics to campaign array
- `aggregateConversionMetrics()` - Sums metrics across campaigns

**Used By:**
- Google Ads data fetchers
- Google Ads standardized data fetcher
- Background collectors (historical data)

**Status:** ✅ CREATED

---

## 📋 VALIDATION RULES

### Funnel Logic
The booking engine funnel should follow logical progression:

```
Step 1 (Search) >= Step 2 (View Content) >= Step 3 (Initiate Checkout) >= Reservations
```

**Validation Checks:**
- ⚠️ Warning if Step 2 > Step 1
- ⚠️ Warning if Step 3 > Step 2
- ⚠️ Warning if Reservations > Step 3

These warnings are logged but don't block data processing (as legitimate scenarios exist where users can skip steps via direct links, etc.)

---

## 🎯 EXAMPLE DATA FLOW

### From Meta API Response:
```json
{
  "campaign_id": "123456",
  "campaign_name": "Hotel Campaign",
  "spend": "1127.56",
  "actions": [
    { "action_type": "omni_search", "value": "400" },
    { "action_type": "view_content", "value": "123" },
    { "action_type": "initiate_checkout", "value": "28" },
    { "action_type": "purchase", "value": "6" }
  ],
  "action_values": [
    { "action_type": "purchase", "value": "18262" }
  ]
}
```

### After Parsing:
```json
{
  "campaign_id": "123456",
  "campaign_name": "Hotel Campaign",
  "spend": 1127.56,
  "actions": [ ... ],
  "action_values": [ ... ],
  "booking_step_1": 400,      // ← Parsed from "omni_search"
  "booking_step_2": 123,      // ← Parsed from "view_content"
  "booking_step_3": 28,       // ← Parsed from "initiate_checkout"
  "reservations": 6,          // ← Parsed from "purchase"
  "reservation_value": 18262  // ← Parsed from purchase value
}
```

---

## 🚨 COMMON ISSUES

### Issue #1: Missing Funnel Data
**Symptom:** All funnel metrics show 0

**Causes:**
- Pixel not installed on booking engine
- Custom events not configured
- Incorrect event names in pixel code

**Solution:** Verify Meta Pixel events on booking engine pages

---

### Issue #2: Incorrect Action Names
**Symptom:** Data exists in Meta Ads Manager but not showing in system

**Causes:**
- Custom conversion names don't match parser
- New action types introduced by Meta
- Pixel using old event names

**Solution:** Check actions array in raw Meta API response, update parser if needed

---

### Issue #3: Funnel Inversion
**Symptom:** Step 2 > Step 1 or Step 3 > Step 2

**Causes:**
- Attribution window differences
- Direct deep links bypassing early steps
- Incorrect action type mapping
- Data from different time periods

**Solution:** Review raw Meta data, verify pixel implementation

---

## 📝 NOTES FOR DEVELOPERS

### Adding New Action Types

If Meta introduces new action types or client uses custom conversions:

1. Check raw Meta API response for new `action_type` values
2. Update `meta-actions-parser.ts` to include new types
3. Add to this documentation
4. Test with real campaign data
5. Deploy and clear cache to apply changes

### Testing Changes

```bash
# 1. Update parser code
# 2. Build project
npm run build

# 3. Clear cache to force refetch with new parser
DELETE FROM current_month_cache WHERE client_id = '...';

# 4. Load dashboard to trigger fetch
# 5. Verify parsed metrics
node scripts/diagnose-cache-structure.js
```

---

## 🎯 COMPLETED TASKS

- [x] Get Google Ads conversion names from user
- [x] Create `google-ads-actions-parser.ts`
- [x] Document Google Ads mapping in this file
- [ ] Update Google Ads data fetching to use parser
- [ ] Test with real Google Ads campaign data

## 🚀 NEXT STEPS

1. **Integrate Google Ads parser** into data fetching system
2. **Test with real Belmonte Google Ads data**
3. **Verify funnel metrics** match Google Ads dashboard
4. **Apply to all clients** with Google Ads integration

---

**Maintained By:** Development Team  
**Questions?** Check raw Meta API response or ask user for clarification on conversion events

