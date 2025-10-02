# 🔍 Debug: Why September Shows Zeros

**Question:** Even though September has 22 campaigns and 12,735 PLN, some fields show zeros

---

## 🎯 Where Zeros Can Appear

Based on the frontend code review, here are the fields that can show zeros:

### **1. Campaign-Level Metrics** (UnifiedReportView.tsx:279-281)
```typescript
<td>{formatNumber(campaign.reservations || 0)}</td>
<td>{formatCurrency(campaign.reservation_value || 0)}</td>
<td>{(campaign.roas || 0).toFixed(2)}x</td>
```

**These show zeros if:**
- ❌ No conversions/reservations happened (legitimately zero)
- ❌ Meta pixel not tracking conversions
- ❌ campaign_data doesn't have these fields

### **2. Conversion Funnel** (WeeklyReportView.tsx:877-881)
```typescript
step1: booking_step_1
step2: booking_step_2  
step3: booking_step_3
reservations: reservations
reservationValue: reservation_value
roas: calculated from reservation_value / spend
```

**These show zeros if:**
- ❌ Custom conversion events not tracked
- ❌ Fields missing from campaign_data
- ❌ No bookings happened in September

### **3. Summary Totals** (campaign_summaries table)
```sql
click_to_call
email_contacts
booking_step_1
booking_step_2
reservations
reservation_value
roas
```

**These show zeros if:**
- ❌ Not aggregated from campaigns
- ❌ Not tracked by Meta API
- ❌ Fields don't exist in campaign_data

---

## 🔍 Key Questions

### **Q1: Are These Legitimately Zero?**

**Maybe it's not a bug!**

If the client:
- Had no bookings in September
- Didn't get any phone calls (click_to_call)
- Didn't receive emails (email_contacts)

**Then zeros are CORRECT!**

**Check:** Did the client have actual conversions in September?

---

### **Q2: Are Conversion Events Configured?**

Meta requires:
1. ✅ Meta Pixel installed on website
2. ✅ Custom conversion events configured
3. ✅ Events firing when users book/call/email

**Common issue:**
- Meta tracks standard conversions (clicks, impressions)
- But NOT custom events (booking_step_1, reservations) unless configured

**Check:** Are custom conversions set up in Meta Ads Manager?

---

### **Q3: Does Meta API Return Conversion Data?**

Even if conversions exist, Meta API might not return them for historical months.

**Meta API Limitations:**
- ✅ Recent data (last 28 days): Full conversion breakdowns
- ⚠️ Historical data (30+ days ago): May not include all conversion actions
- ❌ Old data (90+ days): Limited conversion data

**Check:** Are we fetching within Meta's data availability window?

---

### **Q4: Are Conversions in campaign_data or Summary Fields?**

There are TWO places conversions can be stored:

#### **A. In campaign_data JSONB** (individual campaigns)
```json
{
  "campaign_name": "Campaign A",
  "spend": 5432,
  "reservations": 12,
  "reservation_value": 15000,
  "booking_step_1": 45
}
```

#### **B. In summary fields** (aggregated totals)
```sql
campaign_summaries.reservations = 12
campaign_summaries.reservation_value = 15000
campaign_summaries.booking_step_1 = 45
```

**Issue:** If data is in (A) but not (B), or vice versa, UI might show zeros!

---

## 🔬 Diagnostic Steps

### **Step 1: Check if Conversions Exist in Database**

Run this in Supabase:

```sql
-- Check summary-level conversions
SELECT 
  'SUMMARY LEVEL' as level,
  summary_date,
  total_spend,
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  reservations,
  reservation_value,
  roas
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly';

-- Check campaign-level conversions
SELECT 
  'CAMPAIGN LEVEL' as level,
  campaign->>'campaign_name' as campaign_name,
  (campaign->>'spend')::numeric as spend,
  (campaign->>'reservations')::int as reservations,
  (campaign->>'reservation_value')::numeric as reservation_value,
  (campaign->>'booking_step_1')::int as booking_step_1
FROM campaign_summaries,
  jsonb_array_elements(campaign_data) as campaign
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly'
ORDER BY (campaign->>'spend')::numeric DESC
LIMIT 10;
```

**Expected outcomes:**

#### **Outcome A: All zeros in database**
→ This is CORRECT data from Meta API
→ Client had no conversions in September
→ **NOT A BUG**

#### **Outcome B: Campaign-level has data, summary-level is zero**
→ Aggregation issue
→ Need to fix how summary totals are calculated
→ **THIS IS A BUG**

#### **Outcome C: Some campaigns have data, others don't**
→ Mixed tracking (some campaigns tracked, others not)
→ This is correct if tracking was enabled mid-month
→ **NOT A BUG**

#### **Outcome D: Database is NULL (not zero)**
→ Fields don't exist
→ Need to add fields to campaign_data
→ **THIS IS A BUG**

---

### **Step 2: Check What API Returns**

Test the fetch-live-data endpoint directly:

```bash
curl -s 'http://localhost:3000/api/fetch-live-data' -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "8657100a-6e87-422c-97f4-b733754a9ff8",
    "startDate": "2025-09-01",
    "endDate": "2025-09-30",
    "platform": "meta"
  }' | jq '{
    campaigns_count: (.data.campaigns | length),
    first_campaign: {
      name: .data.campaigns[0].campaign_name,
      spend: .data.campaigns[0].spend,
      reservations: .data.campaigns[0].reservations,
      reservation_value: .data.campaigns[0].reservation_value,
      booking_step_1: .data.campaigns[0].booking_step_1
    }
  }'
```

**Check:**
- Are conversion fields present?
- Are they zero or NULL?
- Are they in the response at all?

---

### **Step 3: Check Frontend Console**

When viewing September report, open browser console and look for:

```
🔍 RAW CAMPAIGN DATA DEBUG - Sample from API:
{
  campaignName: "...",
  reservations: 0,  ← Is this zero or undefined?
  reservation_value: 0,  ← Is this zero or undefined?
  booking_step_1: 0  ← Is this zero or undefined?
}
```

**Key distinction:**
- `reservations: 0` → Legitimate zero (no bookings)
- `reservations: undefined` → Field missing (data issue)

---

## 🎯 Most Likely Scenarios

### **Scenario #1: Legitimately Zero** (90% probability)
```
✅ September data is correct
✅ Client had impressions, clicks, spend
❌ Client had NO conversions/bookings
→ Result: Zeros are accurate
→ Action: Nothing to fix
```

**How to verify:**
- Check with client: "Did you have any bookings in September?"
- Check Meta Ads Manager directly
- Compare with other analytics (Google Analytics, booking system)

---

### **Scenario #2: Conversion Tracking Not Set Up** (8% probability)
```
✅ Client had bookings
❌ Meta pixel not firing conversion events
❌ Custom conversions not configured
→ Result: Zeros because events not tracked
→ Action: Fix Meta pixel/conversion setup (not a code issue)
```

**How to verify:**
- Check Meta Events Manager
- Test pixel with Meta Pixel Helper extension
- Verify custom conversion events are configured

---

### **Scenario #3: Data Not Aggregated** (2% probability)
```
✅ Campaigns have conversion data
❌ Summary totals are zero
→ Result: Aggregation bug
→ Action: Fix aggregation logic
```

**How to verify:**
- Run Step 1 diagnostic query
- If campaign-level has data but summary doesn't → BUG

---

## 🔧 If It's Scenario #3 (Aggregation Bug)

### **Check aggregation in production-data-manager.ts:**

<function_calls>
<invoke name="codebase_search">
<parameter name="query">How does generateMonthlySummary aggregate conversion metrics from campaigns?
