# 🔧 Complete Fix Guide - August & September 2025

**Issue:** Both months have incomplete data in `daily_kpi_data`  
**Solution:** Re-fetch from Meta Ads API  
**Time:** ~5 minutes  

---

## 🎯 **WHAT WE LEARNED**

From your audit results:

### **August 2025:**
- ✅ Has campaign data: 25,069.88 zł (16 clients)
- ❌ Conversions are 0 for all clients
- **Cause:** `daily_kpi_data` never collected conversions for August

### **September 2025:**
- ❌ Missing campaign data: 0 zł (16 clients)  
- ✅ Has conversions: 18-352 per client (1,452 total)
- **Cause:** `daily_kpi_data` never collected campaign metrics for September

### **Root Problem:**
The daily collection cron job (`/api/automated/daily-kpi-collection`) had **partial failures** in both months - it collected some metrics but not others.

---

## 🚀 **FIX OPTIONS**

### **Option 1: Use Admin UI** ⭐ **EASIEST**

1. **Go to:** `/admin/data-lifecycle` page
2. **Find:** "Monthly Aggregation" section
3. **For August:**
   - Year: 2025
   - Month: 8
   - Click: "Run Aggregation"
4. **For September:**
   - Year: 2025
   - Month: 9
   - Click: "Run Aggregation"
5. **Wait:** 2-3 minutes per month
6. **Test:** Go to `/reports` and verify both months

---

### **Option 2: Use API Calls** 🔧 **RECOMMENDED**

**For August:**
```bash
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 8}'
```

**For September:**
```bash
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 9}'
```

**Or use the provided script:**
```bash
# Edit FIX_BOTH_MONTHS_FROM_API.sh
# Change: DOMAIN="your-domain.com" to your actual domain
# Then run:
chmod +x FIX_BOTH_MONTHS_FROM_API.sh
./FIX_BOTH_MONTHS_FROM_API.sh
```

---

### **Option 3: Manual Per-Client Fix** ⚠️ **TEDIOUS**

If aggregation endpoint doesn't work, generate reports per client:

```bash
# For each client, run:
curl -X POST https://your-domain.com/api/generate-report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY" \
  -d '{
    "clientId": "CLIENT_UUID",
    "dateRange": {
      "start": "2025-08-01",
      "end": "2025-08-31"
    }
  }'
```

**Client IDs from your results:**
- Belmonte Hotel: (get from clients table)
- Havet: (get from clients table)
- Hotel Lambert: (get from clients table)
... etc for all 16 clients

---

## 📊 **WHAT THE FIX WILL DO**

The `/api/automated/monthly-aggregation` endpoint will:

1. **Fetch from Meta Ads API:**
   - Campaign metrics: spend, impressions, clicks, reach
   - Conversion metrics: click-to-call, email contacts, reservations
   - All conversion funnel data

2. **Store in `daily_kpi_data`:**
   - Backfills missing daily records
   - One record per client per day

3. **Aggregate to `campaign_summaries`:**
   - Sums all daily data for the month
   - Updates existing records with complete data

4. **Result:**
   - August: Campaign data + Conversions ✅
   - September: Campaign data + Conversions ✅

---

## ⏱️ **EXPECTED TIMELINE**

| Step | Duration |
|------|----------|
| **August aggregation** | 2-3 minutes |
| **September aggregation** | 2-3 minutes |
| **Database updates** | 30 seconds |
| **Cache refresh** | 30 seconds |
| **Total** | ~6-8 minutes |

**Per client:** ~10-15 seconds  
**16 clients × 2 months:** ~6 minutes

---

## ✅ **VERIFICATION STEPS**

### **1. Check API Response**

After running aggregation, you should see:
```json
{
  "success": true,
  "targetYear": 2025,
  "targetMonth": 8,
  "totalClients": 16,
  "successCount": 16,
  "failureCount": 0,
  "results": [...]
}
```

### **2. Query Database**

Check that data was updated:

```sql
-- August verification
SELECT 
  c.name,
  cs.total_spend,
  cs.total_impressions,
  cs.click_to_call,
  cs.email_contacts,
  cs.reservations
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-08-01'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC;
```

**Expected:** All clients should have:
- `total_spend` > 0
- `total_impressions` > 0
- `click_to_call`, `email_contacts`, `reservations` > 0

```sql
-- September verification
SELECT 
  c.name,
  cs.total_spend,
  cs.total_impressions,
  cs.click_to_call,
  cs.email_contacts,
  cs.reservations
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-09-01'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC;
```

**Expected:** All metrics populated (not zero)

### **3. Test Reports UI**

1. **Go to:** `/reports`
2. **Select:** August 2025 (Sierpień)
3. **Verify:**
   - ✅ Shows spend: ~99K zł
   - ✅ Shows impressions: millions
   - ✅ Shows conversions: email contacts, phone calls
   - ✅ Shows conversion funnel: complete data
   - ✅ Campaign list: 17+ campaigns

4. **Select:** September 2025 (Wrzesień)
5. **Verify:**
   - ✅ Shows spend: ~77K zł
   - ✅ Shows impressions: millions
   - ✅ Shows conversions: 10,369+ emails
   - ✅ Shows conversion funnel: complete data
   - ✅ Campaign list: not "Brak Kampanii"

---

## 🚨 **TROUBLESHOOTING**

### **Error: "Meta Ads API rate limit exceeded"**

**Cause:** Too many API requests  
**Solution:**
1. Wait 1 hour for rate limit reset
2. Run aggregation again
3. If repeated, contact Meta support to increase limits

---

### **Error: "Meta access token invalid"**

**Cause:** Token expired or revoked  
**Solution:**
1. Go to Meta Business Settings
2. Generate new system user token
3. Update in Supabase: `clients.meta_access_token`
4. Re-run aggregation

---

### **Error: "No data returned from Meta Ads"**

**Cause:** Campaigns may not have run, or ad account access lost  
**Solution:**
1. Check Meta Ads Manager for August/September campaigns
2. Verify ad account permissions
3. Check if campaigns were paused/deleted

---

### **Some clients still show 0 after aggregation**

**Possible reasons:**
1. **No campaigns:** Client genuinely had no campaigns
2. **Different ad account:** Client switched accounts
3. **API permissions:** Lost access to specific accounts
4. **Data retention:** Meta Ads only keeps data for 90 days

**Action:**
- Check individual client in Meta Ads Manager
- Verify ad account ID matches `clients.ad_account_id`
- Check if client campaigns existed in that month

---

## 🛡️ **PREVENTION - AVOID THIS IN FUTURE**

### **1. Fix Daily Collection**

The daily collection job is partially failing. Investigate:

**Check logs:**
```bash
# Vercel logs
vercel logs --since 30d | grep "daily-kpi-collection"

# Or in Vercel dashboard: Functions → Logs → Filter by daily-kpi
```

**Common issues:**
- API rate limits during daily collection
- Timeout errors (collection takes > 10 seconds)
- Partial API responses (some metrics missing)
- Network errors

---

### **2. Add Validation After Collection**

Update `/api/automated/daily-kpi-collection/route.ts`:

```typescript
// After collecting daily data
async function validateDailyCollection(clientId: string, date: string) {
  const data = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', clientId)
    .eq('date', date)
    .single();
  
  // Check for incomplete data
  if (data.total_spend > 0 && data.click_to_call === 0) {
    await sendAlert({
      subject: 'Incomplete daily collection',
      message: `${clientId} on ${date}: has spend but no conversions`,
    });
  }
  
  if (data.click_to_call > 0 && data.total_spend === 0) {
    await sendAlert({
      subject: 'Incomplete daily collection',
      message: `${clientId} on ${date}: has conversions but no spend`,
    });
  }
}
```

---

### **3. Add Retry Logic**

If daily collection fails, retry:

```typescript
// In daily-kpi-collection
async function collectWithRetry(client: Client, date: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await fetchMetaAdsData(client, date);
      
      // Validate completeness
      if (!data.spend || !data.conversions) {
        throw new Error('Incomplete data returned');
      }
      
      await storeDailyData(data);
      return; // Success
      
    } catch (error) {
      if (attempt === maxRetries) {
        await sendAlert('Daily collection failed after 3 retries');
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
}
```

---

### **4. Monitor Aggregation Health**

Add a weekly health check:

```sql
-- Check for incomplete monthly summaries
SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  COUNT(*) as total_clients,
  COUNT(CASE WHEN total_spend > 0 AND click_to_call = 0 THEN 1 END) as missing_conversions,
  COUNT(CASE WHEN click_to_call > 0 AND total_spend = 0 THEN 1 END) as missing_campaigns
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY month
ORDER BY month DESC;
```

Run weekly, alert if any incomplete data found.

---

## 📋 **QUICK REFERENCE**

### **Commands:**

**Re-aggregate August:**
```bash
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 8}'
```

**Re-aggregate September:**
```bash
curl -X POST https://your-domain.com/api/automated/monthly-aggregation \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 9}'
```

**Check results:**
```sql
SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  COUNT(*) as clients,
  SUM(total_spend) as spend,
  SUM(click_to_call + email_contacts + reservations) as conversions
FROM campaign_summaries
WHERE summary_date IN ('2025-08-01', '2025-09-01')
  AND summary_type = 'monthly'
GROUP BY month;
```

---

## ✅ **SUCCESS CRITERIA**

Fix is complete when:

- [ ] August shows: spend + impressions + conversions (all > 0)
- [ ] September shows: spend + impressions + conversions (all > 0)
- [ ] Reports UI displays both months correctly
- [ ] No "Brak Kampanii" messages
- [ ] All 16 clients have data
- [ ] Conversion funnels are complete
- [ ] No console errors

---

## 🎯 **NEXT STEPS**

1. **Immediate:** Run aggregation for both months (Option 1 or 2)
2. **Wait:** 5-10 minutes for completion
3. **Verify:** Check reports UI
4. **Long-term:** Fix daily collection to prevent recurrence
5. **Monitor:** Set up health checks

---

**Priority:** 🟡 High - Data Integrity Issue  
**Fix Method:** Re-aggregate from Meta Ads API  
**Time:** ~10 minutes  
**Risk:** Low (safe operation, fetches fresh data)

---

**Ready?** Start with **Option 1** (Admin UI) or **Option 2** (API calls) above! 🚀








