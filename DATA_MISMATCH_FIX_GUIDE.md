# 🔧 Data Mismatch Fix Guide - August vs September 2025

**Date:** October 1, 2025  
**Issue:** Inconsistent data between August and September reports  
**Status:** ⚠️ **DATA INTEGRITY ISSUE**

---

## 🔍 **PROBLEM SUMMARY**

### **August 2025 (Sierpień):**
- ✅ Has campaign metrics: 25,069.88 zł spend, 2.9M impressions, 42.2K clicks
- ✅ Has conversion funnel: 23,320 → 5,310 → 954 → 973
- ❌ **Missing conversion attribution**: 0 email contacts, 0 phone calls
- Shows: 17 campaigns

### **September 2025 (Wrzesień):**
- ❌ **Missing campaign metrics**: 0 zł spend, 0 impressions, 0 clicks
- ❌ Shows "Brak Kampanii" (No campaigns)
- ✅ Has conversion data: 10,369 email contacts, 11 phone calls
- Conversion funnel: 10,364 → 3,115 → 0 → 94

---

## 🎯 **ROOT CAUSE**

This is a **data aggregation mismatch** where:

1. **Campaign data** (spend, impressions, clicks) and **conversion data** (email contacts, phone calls, reservations) are stored in different places:
   - Campaign metrics: `campaign_summaries.total_spend`, `total_impressions`, `total_clicks`
   - Conversion metrics: `campaign_summaries.click_to_call`, `email_contacts`, `reservations`

2. **Archival process issues:**
   - August: Campaign data was archived but conversion data was not aggregated
   - September: Conversion data was archived but campaign data was not aggregated

3. **Possible causes:**
   - Archival process ran at different times
   - Data source disconnection during aggregation
   - Different API fetch failures for different metrics
   - `daily_kpi_data` incomplete for one or both months

---

## 📊 **DATA FLOW ANALYSIS**

### **How Data Should Flow:**

```
┌─────────────────────────────────────────────────────────┐
│ DAILY COLLECTION (Every day at 2 AM)                    │
│ ├─ Fetch from Meta Ads API (spend, impressions, clicks)│
│ ├─ Fetch from conversion tracking (emails, calls, etc.) │
│ └─ Store in: daily_kpi_data table                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ MONTHLY AGGREGATION (1st of month at 2 AM)             │
│ ├─ Sum all daily_kpi_data for previous month           │
│ ├─ Aggregate: spend + impressions + clicks             │
│ ├─ Aggregate: conversions + emails + calls             │
│ └─ Store in: campaign_summaries (monthly)              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ REPORTS UI (User views)                                 │
│ └─ Fetch from: campaign_summaries                      │
│    Should show: Campaign data + Conversion data         │
└─────────────────────────────────────────────────────────┘
```

### **What Went Wrong:**

**August:**
```
✅ Campaign data aggregated → campaign_summaries
❌ Conversion data NOT aggregated → Missing from campaign_summaries
Result: Reports show spend/impressions but no conversions
```

**September:**
```
❌ Campaign data NOT aggregated → Missing from campaign_summaries
✅ Conversion data aggregated → campaign_summaries
Result: Reports show conversions but no spend/impressions
```

---

## 🛠️ **FIX PROCEDURE**

### **Step 1: Audit Current State** (5 minutes)

Run: `AUDIT_DATA_MISMATCH_AUGUST_SEPTEMBER.sql`

This will show you:
- What data exists in `campaign_summaries` for August/September
- What data exists in `daily_kpi_data` for August/September
- Per-client breakdown of missing data
- Specific recommendations

**Expected findings:**
- August has campaign data, missing conversions
- September has conversions, missing campaign data
- `daily_kpi_data` may have complete data for both

---

### **Step 2: Fix August Conversions** (2 minutes)

Run: `FIX_AUGUST_CONVERSIONS.sql`

**What it does:**
- Updates `campaign_summaries` for August 2025
- Adds conversion data from `daily_kpi_data`
- Preserves existing campaign metrics
- Updates: `click_to_call`, `email_contacts`, `reservations`, etc.

**Expected result:**
```
Before:
- Spend: 25,069.88 zł
- Conversions: 0

After:
- Spend: 25,069.88 zł
- Conversions: (aggregated from daily data)
```

---

### **Step 3: Fix September Campaigns** (2 minutes)

Run: `FIX_SEPTEMBER_CAMPAIGNS.sql`

**What it does:**
- Updates `campaign_summaries` for September 2025
- Adds campaign data from `daily_kpi_data`
- Preserves existing conversion metrics
- Updates: `total_spend`, `total_impressions`, `total_clicks`, etc.

**Expected result:**
```
Before:
- Spend: 0 zł
- Conversions: 10,369 emails

After:
- Spend: (aggregated from daily data)
- Conversions: 10,369 emails
```

---

### **Step 4: Verify Fix** (5 minutes)

**Check August:**
1. Go to `/reports`
2. Select: **Sierpień 2025** (August)
3. Should see:
   - ✅ Campaign metrics (spend, impressions, clicks)
   - ✅ Conversion data (emails, phone calls, reservations)
   - ✅ All 17 campaigns

**Check September:**
1. Select: **Wrzesień 2025** (September)
2. Should see:
   - ✅ Campaign metrics (spend, impressions, clicks)
   - ✅ Conversion data (emails, phone calls, reservations)
   - ✅ Campaign list (not "Brak Kampanii")

---

## 🚨 **IF FIX DOESN'T WORK**

### **Scenario A: daily_kpi_data is also incomplete**

If `daily_kpi_data` doesn't have the missing metrics, you need to fetch from Meta Ads API:

```bash
# Re-fetch August from Meta Ads API
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 8}'

# Re-fetch September from Meta Ads API
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 9}'
```

**Or use admin UI:**
- Go to: `/admin/data-lifecycle`
- Click: "Run Monthly Aggregation"
- Enter: Year 2025, Month 8 (then repeat for Month 9)

---

### **Scenario B: Meta Ads API has rate limits**

If API fetch fails due to rate limits:

1. **Wait 1 hour** for rate limit reset
2. **Try again** with API call
3. **Check Meta Ads permissions** (token may have expired)

---

### **Scenario C: Data was never collected**

If data genuinely doesn't exist anywhere:

1. **August conversions:** May not have been tracked
2. **September campaigns:** May not have run (unlikely with 10K email contacts)
3. **Check:** Client campaign status in Meta Ads Manager

---

## 🔍 **PREVENTION STRATEGIES**

### **1. Monitor Aggregation Health**

Add monitoring to detect incomplete aggregations:

```typescript
// After monthly aggregation
async function verifyMonthlyAggregation(year: number, month: number) {
  const summaries = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('summary_date', `${year}-${String(month).padStart(2, '0')}-01`)
    .eq('summary_type', 'monthly');
  
  for (const summary of summaries) {
    // Check for incomplete data
    if (summary.total_spend > 0 && summary.click_to_call === 0) {
      await sendAlert('Missing conversion data for ' + clientName);
    }
    
    if (summary.click_to_call > 0 && summary.total_spend === 0) {
      await sendAlert('Missing campaign data for ' + clientName);
    }
  }
}
```

---

### **2. Improve Archival Process**

Ensure archival aggregates ALL metrics at once:

```typescript
// src/lib/data-lifecycle-manager.ts
async archiveMonthlyData(cacheEntry: any) {
  // Get campaign data
  const campaigns = cacheData?.campaigns || [];
  
  // Get conversion totals
  const conversions = await this.getConversionsFromDailyData(
    clientId, 
    startDate, 
    endDate
  );
  
  // Store BOTH together
  await supabase.from('campaign_summaries').upsert({
    // Campaign metrics
    total_spend: campaignTotals.spend,
    total_impressions: campaignTotals.impressions,
    
    // Conversion metrics (from daily data)
    click_to_call: conversions.clickToCall,
    email_contacts: conversions.emails,
    reservations: conversions.reservations
  });
}
```

---

### **3. Add Data Validation**

Before showing reports, validate data completeness:

```typescript
// In reports page
async function validateReportData(month: string) {
  const data = await fetchReportData(month);
  
  if (data.spend > 0 && data.conversions === 0) {
    showWarning('Conversion data may be incomplete');
  }
  
  if (data.conversions > 0 && data.spend === 0) {
    showWarning('Campaign data may be incomplete');
  }
}
```

---

### **4. Daily Data Collection Verification**

Ensure daily collection gets both campaign AND conversion data:

```typescript
// src/app/api/automated/daily-kpi-collection/route.ts
async function collectDailyData(client: Client, date: string) {
  // Fetch campaign metrics
  const campaignData = await fetchMetaAdsData(client, date);
  
  // Fetch conversion metrics
  const conversionData = await fetchConversionData(client, date);
  
  // Verify BOTH are present
  if (!campaignData || !conversionData) {
    await sendAlert('Incomplete daily data for ' + date);
  }
  
  // Store together
  await supabase.from('daily_kpi_data').upsert({
    // Campaign metrics
    total_spend: campaignData.spend,
    total_impressions: campaignData.impressions,
    
    // Conversion metrics
    click_to_call: conversionData.clickToCall,
    email_contacts: conversionData.emails
  });
}
```

---

## 📋 **QUICK REFERENCE**

### **Files Created:**
- `AUDIT_DATA_MISMATCH_AUGUST_SEPTEMBER.sql` - Diagnose the issue
- `FIX_AUGUST_CONVERSIONS.sql` - Fix August conversion data
- `FIX_SEPTEMBER_CAMPAIGNS.sql` - Fix September campaign data
- `DATA_MISMATCH_FIX_GUIDE.md` - This guide

### **Execution Order:**
1. Run audit script
2. Run August fix
3. Run September fix
4. Test reports UI
5. Verify both months

### **Time Estimate:**
- Audit: 5 minutes
- Fixes: 4 minutes (2 min each)
- Testing: 5 minutes
- **Total: ~15 minutes**

---

## ✅ **SUCCESS CRITERIA**

Fix is complete when:

- ✅ August shows campaign data AND conversion data
- ✅ September shows campaign data AND conversion data
- ✅ No "Brak Kampanii" messages
- ✅ All metrics populated (not zero)
- ✅ Conversion funnel complete
- ✅ Email/phone contacts visible

---

## 🆘 **TROUBLESHOOTING**

### **Error: "Cannot update, no rows affected"**
- `campaign_summaries` may not have records for that month
- Run audit script to verify records exist
- May need to create records first

### **Warning: "X clients still have zero spend"**
- `daily_kpi_data` doesn't have campaign metrics
- Need to fetch from Meta Ads API
- Use monthly-aggregation endpoint

### **Reports still show incorrect data**
- Clear browser cache
- Check correct database connection
- Verify Supabase project (not staging)
- Re-run audit script to confirm fix applied

---

**Priority:** 🟡 **High - Data Integrity Issue**  
**Impact:** Reports show incomplete data  
**Fix Time:** ~15 minutes  
**Risk:** Low (safe update scripts with rollback)

**Start with:** Run `AUDIT_DATA_MISMATCH_AUGUST_SEPTEMBER.sql` to understand the full scope.








