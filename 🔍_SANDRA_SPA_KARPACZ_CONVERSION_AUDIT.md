# 🔍 SANDRA SPA KARPACZ - CONVERSION TRACKING AUDIT

**Date:** December 23, 2025  
**Status:** Issue Identified  
**Priority:** 🔴 HIGH

---

## 📊 EXECUTIVE SUMMARY

**The issue is NOT that conversion tracking is broken - it's that ONLY final reservations are being tracked, without any funnel micro-conversions.**

| Metric | Meta Ads | Google Ads |
|--------|----------|------------|
| Total Spend (Oct-Dec 2025) | 12,588.55 PLN | 11,871.74 PLN |
| Total Reservations | 42 | 139 |
| Cost per Reservation | 299.73 PLN | 85.41 PLN |
| Click-to-Call Events | ❌ 0 | ⚠️ 75 (only 1 week) |
| Email Contact Events | ❌ 0 | ⚠️ 100 (only 1 week) |
| Booking Step 1 | ❌ 0 | ⚠️ 248 (only 1 week) |
| Booking Step 2 | ❌ 0 | ⚠️ 1 (only 1 week) |

---

## 🔍 ROOT CAUSE ANALYSIS

### What's Working:
✅ Meta Pixel IS tracking **Purchase/Reservation** events  
✅ Google Ads IS tracking **Purchase/Reservation** events  
✅ Final conversion values ARE being captured  
✅ Attribution is working for final conversions

### What's NOT Working:
❌ **Meta Pixel** is NOT tracking funnel events:
- InitiateCheckout (booking_step_1)
- AddToCart / BeginCheckout (booking_step_2)
- Lead / Contact events
- Phone click events

❌ **Google Ads** funnel tracking is inconsistent:
- Only ONE week (Dec 22) shows funnel events
- All other weeks show reservations without funnel steps
- Suggests conversion actions may have been added recently

---

## 📋 WHY FUNNEL RELIABILITY SCORE = 0/100

The audit flagged Sandra SPA Karpacz as "illogical" because:

```
Example from data:
Week 2025-12-08:
  Google: 23 reservations but 0 click_to_call, 0 email_contacts, 0 booking_step_1
  Meta: 0 reservations but 3,653 clicks

This looks "impossible" - reservations without any prior funnel actions
```

**This is NOT a data collection error** - it reflects reality:
- The website conversion funnel events aren't being tracked
- Only the final Purchase event is captured
- Google Ads is performing better (3.5x more reservations per PLN spent)

---

## 🎯 REQUIRED ACTIONS

### 1. Meta Pixel Configuration (URGENT)

**Check in Meta Business Suite:**

1. Go to Events Manager → Pixels → Sandra SPA Karpacz pixel
2. Verify these events are configured:
   - `Lead` (for contact form submissions)
   - `Contact` (for phone clicks, email clicks)
   - `InitiateCheckout` (for booking step 1)
   - `AddPaymentInfo` or custom event (for booking step 2)
   - `Purchase` (already working ✅)

3. Test with Facebook Pixel Helper browser extension:
   - Visit the booking page
   - Complete booking flow
   - Verify each step fires an event

**Expected Result:**
- Lead events → map to `click_to_call`, `email_contacts`
- InitiateCheckout → map to `booking_step_1`
- Purchase → map to `reservations` (already working)

---

### 2. Google Ads Conversion Tracking (INVESTIGATE)

**Why did funnel events appear only on Dec 22?**

Check Google Ads account:
1. Go to Tools & Settings → Measurement → Conversions
2. Review all conversion actions:
   - When were they created?
   - Are they properly configured?
   - Is the conversion tag installed?

**Hypothesis:** Someone may have added conversion actions on Dec 22, which is why only that week has funnel data.

---

### 3. Website Tracking Code Review

**Check the Sandra SPA Karpacz website:**

1. Inspect the booking flow
2. Verify tracking code fires at each step:
   - Contact page / form
   - Phone number clicks
   - Booking step 1 (date selection?)
   - Booking step 2 (guest details?)
   - Booking step 3 (payment?)
   - Confirmation page

**Tools to use:**
- Facebook Pixel Helper (Chrome extension)
- Google Tag Assistant (Chrome extension)
- Browser DevTools → Network tab → filter "facebook" or "google"

---

## 📊 EXPECTED IMPROVEMENT

After fixing conversion tracking:

| Metric | Current | Expected |
|--------|---------|----------|
| Funnel Reliability Score | 0/100 | >80/100 |
| Click-to-Call Tracking | 0 | 50-200/week |
| Email Contact Tracking | 0 | 20-100/week |
| Booking Step 1 Tracking | 0 | 100-500/week |
| Attribution Accuracy | Limited | Full funnel |

---

## 💰 BUSINESS IMPACT

### Current State (Without Funnel Data):
- Can only measure final reservations
- Cannot optimize for top-of-funnel actions
- Cannot identify funnel drop-off points
- Google Ads appears 3.5x more efficient (may not be accurate)

### After Fix (With Funnel Data):
- Full visibility into customer journey
- Can optimize campaigns for micro-conversions
- Can identify where prospects drop off
- Better budget allocation between platforms
- More accurate attribution

---

## 🔧 TECHNICAL NOTES

### API Response Check

The system IS receiving data correctly. Recent API responses show:
- Meta API returning spend, impressions, clicks ✅
- Meta API returning purchase/reservation events ✅
- Meta API NOT returning funnel events (because they're not configured)

### Database Schema

Funnel columns in `campaign_summaries` table:
```sql
click_to_call BIGINT DEFAULT 0
email_contacts BIGINT DEFAULT 0
booking_step_1 BIGINT DEFAULT 0
booking_step_2 BIGINT DEFAULT 0
booking_step_3 BIGINT DEFAULT 0
reservations BIGINT DEFAULT 0
reservation_value DECIMAL(12,2) DEFAULT 0
```

All columns are ready to receive data once tracking is configured.

---

## ✅ ACTION CHECKLIST

- [ ] Access Meta Business Suite for Sandra SPA Karpacz
- [ ] Review Events Manager → Pixel configuration
- [ ] Add missing conversion events (Lead, InitiateCheckout, Contact)
- [ ] Test pixel firing on website
- [ ] Access Google Ads account
- [ ] Review conversion action configuration
- [ ] Verify conversion tags are installed on website
- [ ] Wait 1 week for data to collect
- [ ] Re-run funnel audit to verify improvement

---

## 📞 ESCALATION

If you don't have access to Sandra SPA Karpacz's Meta Business Suite or Google Ads account:

1. Contact the client to request access
2. OR request they share screenshots of Events Manager / Conversion settings
3. OR schedule a screen share to review together

---

**Document Created:** December 23, 2025  
**Next Review:** After conversion tracking is configured

