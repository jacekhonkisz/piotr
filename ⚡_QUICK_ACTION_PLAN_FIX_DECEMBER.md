# ⚡ Quick Action Plan - Fix December Google Ads Data

**Priority:** 🔴 CRITICAL  
**Time to Fix:** ~30 minutes  
**Impact:** Restore all December 2025 Google Ads data for Havet

---

## 🎯 **3-STEP FIX**

### **Step 1: Diagnose (5 minutes)**

Run the diagnostic SQL to confirm the issue:

```bash
# Use the audit script created
psql [your-database-connection] -f AUDIT_DECEMBER_GOOGLE_ADS.sql
```

**Expected Findings:**
- December cache exists but has zeros
- Meta December data exists with real values
- Google December data exists with zeros

---

### **Step 2: Add Refresh Token (5 minutes)**

**Get a new Google Ads refresh token:**

1. Go to Google Ads OAuth playground or your auth flow
2. Generate new refresh token for Havet's account
3. Update database:

```sql
UPDATE clients 
SET google_ads_refresh_token = 'YOUR_NEW_REFRESH_TOKEN_HERE'
WHERE id = '93d46876-addc-4b99-b1e1-437428dd54f1';
```

**Verify token works:**

```bash
# Test API call
curl -X POST http://your-domain.com/api/google-ads-smart-cache \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "93d46876-addc-4b99-b1e1-437428dd54f1",
    "forceRefresh": true
  }'
```

---

### **Step 3: Backfill December Data (20 minutes)**

**Option A: Manual API Call (FASTEST)**

Create and run this script:

```typescript
// scripts/backfill-december-havet.ts

import { GoogleAdsService } from '../src/lib/google-ads';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillDecember() {
  const clientId = '93d46876-addc-4b99-b1e1-437428dd54f1';
  
  // 1. Get client data
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  if (!client) {
    throw new Error('Client not found');
  }
  
  // 2. Fetch December data from Google Ads
  const googleAds = new GoogleAdsService();
  const decemberData = await googleAds.getCampaignData(
    client.google_ads_customer_id,
    {
      start: '2025-12-01',
      end: '2025-12-31'
    }
  );
  
  // 3. Get conversion metrics from daily_kpi_data
  const { data: kpiData } = await supabase
    .from('daily_kpi_data')
    .select('*')
    .eq('client_id', clientId)
    .eq('platform', 'google')
    .gte('date', '2025-12-01')
    .lte('date', '2025-12-31');
  
  const conversionMetrics = kpiData?.reduce((acc, day) => ({
    booking_step_1: acc.booking_step_1 + (day.booking_step_1 || 0),
    booking_step_2: acc.booking_step_2 + (day.booking_step_2 || 0),
    booking_step_3: acc.booking_step_3 + (day.booking_step_3 || 0),
    reservations: acc.reservations + (day.reservations || 0),
    reservation_value: acc.reservation_value + (day.reservation_value || 0),
  }), {
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    reservations: 0,
    reservation_value: 0,
  });
  
  // 4. Calculate summary
  const summary = {
    client_id: clientId,
    summary_type: 'monthly',
    summary_date: '2025-12-01',
    platform: 'google',
    total_spend: decemberData.totalSpend,
    total_impressions: decemberData.totalImpressions,
    total_clicks: decemberData.totalClicks,
    total_conversions: decemberData.totalConversions,
    average_ctr: decemberData.averageCtr,
    average_cpc: decemberData.averageCpc,
    booking_step_1: conversionMetrics.booking_step_1,
    booking_step_2: conversionMetrics.booking_step_2,
    booking_step_3: conversionMetrics.booking_step_3,
    reservations: conversionMetrics.reservations,
    reservation_value: conversionMetrics.reservation_value,
    roas: conversionMetrics.reservation_value / decemberData.totalSpend,
    average_cpa: decemberData.totalSpend / conversionMetrics.reservations,
    active_campaigns: decemberData.campaigns.filter(c => c.status === 'ENABLED').length,
    total_campaigns: decemberData.campaigns.length,
    campaign_data: decemberData.campaigns,
    google_ads_tables: decemberData.tables,
    data_source: 'manual_backfill_2026_01_02',
    last_updated: new Date().toISOString()
  };
  
  // 5. Upsert to campaign_summaries
  const { error } = await supabase
    .from('campaign_summaries')
    .upsert(summary, {
      onConflict: 'client_id,summary_type,summary_date,platform'
    });
  
  if (error) {
    throw error;
  }
  
  console.log('✅ December data backfilled successfully!');
  console.log('📊 Summary:', {
    spend: summary.total_spend,
    impressions: summary.total_impressions,
    clicks: summary.total_clicks,
    reservations: summary.reservations,
    roas: summary.roas
  });
}

backfillDecember().catch(console.error);
```

**Run it:**

```bash
npx tsx scripts/backfill-december-havet.ts
```

---

**Option B: Use API Endpoint (EASIER)**

```bash
# Force refresh December cache
curl -X POST http://your-domain.com/api/google-ads-smart-cache \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "93d46876-addc-4b99-b1e1-437428dd54f1",
    "startDate": "2025-12-01",
    "endDate": "2025-12-31",
    "forceRefresh": true
  }'

# Then manually run archival
curl -X POST http://your-domain.com/api/automated/archive-completed-months \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## ✅ **Verification Steps**

After completing the fix:

1. **Check database:**
   ```sql
   SELECT 
     summary_date,
     total_spend,
     total_impressions,
     reservations,
     data_source
   FROM campaign_summaries
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND platform = 'google'
     AND summary_date = '2025-12-01';
   ```

   **Expected:** Should show real spend, impressions, conversions

2. **Check dashboard:**
   - Log in to Havet's dashboard
   - Select December 2025
   - Verify metrics show correctly
   - Verify funnel chart has data
   - Verify weekly breakdown shows data

3. **Check cache:**
   ```sql
   SELECT 
     period_id,
     (cache_data->'stats'->>'totalSpend')::numeric as spend
   FROM google_ads_current_month_cache
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND period_id = '2026-01';
   ```

   **Expected:** January 2026 should now have real data (not zeros)

---

## 🔮 **Prevent Future Issues**

### **Add Monitoring Script**

Create `scripts/check-token-health.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTokenHealth() {
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, google_ads_customer_id, google_ads_refresh_token')
    .not('google_ads_customer_id', 'is', null);
  
  for (const client of clients || []) {
    if (!client.google_ads_refresh_token) {
      console.error(`❌ ${client.name}: Missing Google Ads refresh token`);
    } else {
      console.log(`✅ ${client.name}: Token exists`);
    }
  }
}

checkTokenHealth().catch(console.error);
```

**Run daily:**

```json
// Add to vercel.json
{
  "crons": [
    {
      "path": "/api/automated/check-token-health",
      "schedule": "0 8 * * *"
    }
  ]
}
```

---

### **Add Data Quality Alert**

Modify `data-lifecycle-manager.ts`:

```typescript
async archiveGoogleAdsMonthlyData(cacheEntry: any) {
  const cacheData = cacheEntry.cache_data;
  
  // 🔍 DATA QUALITY CHECK
  const campaigns = cacheData?.campaigns?.length || 0;
  const spend = cacheData?.stats?.totalSpend || 0;
  
  if (campaigns > 50 && spend === 0) {
    logger.error('🚨 DATA QUALITY ALERT: Refusing to archive suspicious Google Ads data', {
      client_id: cacheEntry.client_id,
      period_id: cacheEntry.period_id,
      campaigns,
      spend
    });
    
    // Send alert (implement your alert system)
    await sendAlert({
      type: 'data_quality_issue',
      client_id: cacheEntry.client_id,
      message: `Google Ads archival skipped: ${campaigns} campaigns but $0 spend`
    });
    
    // Skip archival
    return;
  }
  
  // Proceed with normal archival...
}
```

---

## 📊 **Summary**

**Time Investment:**
- Step 1 (Diagnose): 5 min
- Step 2 (Token): 5 min
- Step 3 (Backfill): 20 min
- **Total: 30 minutes**

**What Gets Fixed:**
- ✅ December 2025 data restored
- ✅ January 2026 starts collecting real data
- ✅ Dashboard shows correct metrics
- ✅ Historical comparisons work

**Prevention:**
- ✅ Token monitoring in place
- ✅ Data quality checks added
- ✅ Alerts configured

---

## 🎯 **Bottom Line**

The archival system is **working correctly**. It archived what it found in the cache.

The problem is that the cache had zeros because of a missing refresh token.

**Fix the token → Fix the data → Fix the dashboard**

Simple as that! 🚀

