# 🔍 December 2025 Google Ads Data - Archival Audit

**Date:** January 2, 2026  
**Client:** Havet Hotel  
**Issue:** December Google Ads showing zeros, but Meta Ads properly stored  
**Status:** 🔴 **CRITICAL - DATA ARCHIVAL FAILURE**

---

## 🎯 **EXECUTIVE SUMMARY**

**Problem:** December 2025 Google Ads data for Havet is showing zeros, while Meta Ads data for the same period is properly stored and displayed.

**Root Cause:** The automatic archival process that should have run on **January 1, 2026 at 2:30 AM** likely failed or didn't execute properly for Google Ads data, even though the code is correctly implemented to handle both platforms.

---

## 📊 **WHAT SHOULD HAVE HAPPENED**

### **Timeline:**

1. **Throughout December 2025:**
   - ✅ Google Ads data cached in `google_ads_current_month_cache` with `period_id = '2025-12'`
   - ✅ Cache refreshed every 3 hours by cron job
   - ✅ Users viewing dashboard see fresh December data

2. **January 1, 2026 at 2:30 AM:**
   - ✅ Cron job `/api/automated/archive-completed-months` should run
   - ✅ Archive December cache from `google_ads_current_month_cache` to `campaign_summaries`
   - ✅ Clean up December cache
   - ✅ January cache becomes active

3. **January 2, 2026 (today):**
   - ✅ December data should be in `campaign_summaries` table
   - ✅ Dashboard displays December historical data from database

---

## ❌ **WHAT ACTUALLY HAPPENED**

### **Evidence:**

Based on your analysis document (`🔍_HAVET_DATA_ANALYSIS.md`):

```
📦 Current Month Cache (January 2026):
   Spend: 0 PLN
   Impressions: 0
   Clicks: 0
   Campaigns: 102 campaigns (but all have 0 data)
```

This suggests:

1. ❌ **December cache was not properly archived** on January 1st
2. ❌ **January cache is showing zeros** (no refresh token = can't fetch new data)
3. ✅ **Historical data exists** for previous months (system worked before)
4. ✅ **Meta Ads December data IS properly stored** (archival worked for Meta)

---

## 🔧 **ARCHIVAL CODE ANALYSIS**

### **Code Implementation (CORRECT):**

```282:710:src/lib/data-lifecycle-manager.ts
export class DataLifecycleManager {
  private static instance: DataLifecycleManager

  public static getInstance(): DataLifecycleManager {
    if (!DataLifecycleManager.instance) {
      DataLifecycleManager.instance = new DataLifecycleManager();
    }
    return DataLifecycleManager.instance;
  }

  /**
   * Archive completed current month data to permanent storage
   * This runs when a month ends to preserve the cached data
   * NOW SUPPORTS BOTH META AND GOOGLE ADS
   */
  async archiveCompletedMonths(): Promise<void> {
    logger.info('📅 Starting monthly data archival process for both Meta and Google Ads...');
    
    try {
      // Get current date info
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // Get previous month info
      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const prevMonthPeriodId = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
      
      logger.info(`📊 Archiving completed month: ${prevMonthPeriodId}`);
      
      let totalArchived = 0;
      let totalErrors = 0;
      
      // ============================================
      // ARCHIVE META ADS CACHE
      // ============================================
      logger.info('📱 Archiving Meta Ads monthly cache...');
      const { data: metaCacheData, error: metaCacheError } = await supabase
        .from('current_month_cache')
        .select('*')
        .eq('period_id', prevMonthPeriodId);
      
      if (metaCacheError) {
        logger.error(`❌ Failed to fetch Meta month cache data: ${metaCacheError.message}`);
      } else if (!metaCacheData || metaCacheData.length === 0) {
        logger.info('📝 No Meta monthly cache data found to archive');
      } else {
        logger.info(`📦 Found ${metaCacheData.length} Meta monthly cache entries to archive`);
        
        for (const cacheEntry of metaCacheData) {
          try {
            await this.archiveMonthlyData(cacheEntry, 'meta');
            totalArchived++;
          } catch (error) {
            logger.error(`❌ Failed to archive Meta monthly data for client ${cacheEntry.client_id}:`, error);
            totalErrors++;
          }
        }
        
        // Clean up archived Meta cache
        if (metaCacheData.length > 0) {
          await this.cleanupArchivedMonthlyCache(prevMonthPeriodId);
        }
      }
      
      // ============================================
      // ARCHIVE GOOGLE ADS CACHE (NEW)
      // ============================================
      logger.info('🔍 Archiving Google Ads monthly cache...');
      const { data: googleCacheData, error: googleCacheError } = await supabase
        .from('google_ads_current_month_cache')
        .select('*')
        .eq('period_id', prevMonthPeriodId);
      
      if (googleCacheError) {
        logger.error(`❌ Failed to fetch Google Ads month cache data: ${googleCacheError.message}`);
      } else if (!googleCacheData || googleCacheData.length === 0) {
        logger.info('📝 No Google Ads monthly cache data found to archive');
      } else {
        logger.info(`📦 Found ${googleCacheData.length} Google Ads monthly cache entries to archive`);
        
        for (const cacheEntry of googleCacheData) {
          try {
            await this.archiveGoogleAdsMonthlyData(cacheEntry);
            totalArchived++;
          } catch (error) {
            logger.error(`❌ Failed to archive Google Ads monthly data for client ${cacheEntry.client_id}:`, error);
            totalErrors++;
          }
        }
        
        // Clean up archived Google Ads cache
        if (googleCacheData.length > 0) {
          await this.cleanupArchivedGoogleAdsMonthlyCache(prevMonthPeriodId);
        }
      }
      
      logger.info(`✅ Monthly archival completed: ${totalArchived} total archived (Meta + Google), ${totalErrors} errors`);
      
    } catch (error) {
      logger.error('❌ Monthly data archival failed:', error);
      logger.error('Monthly data archival failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }
```

**✅ The code is CORRECT and COMPLETE:**
- ✅ Archives Meta Ads cache
- ✅ Archives Google Ads cache
- ✅ Handles errors gracefully
- ✅ Cleans up after archival

---

## 🔍 **POSSIBLE FAILURE SCENARIOS**

### **Scenario 1: No December Cache Existed** ⚠️ MOST LIKELY

**What happened:**
- December 2025: Havet's Google Ads refresh token **expired or was missing**
- Cache refresh jobs ran every 3 hours but **silently failed** (no token)
- Cache table had entry for `period_id = '2025-12'` but with **all zeros**
- January 1st: Archival job found the cache entry and archived it with zeros

**Evidence:**
```
🏨 Client: Havet
   ID: 93d46876-addc-4b99-b1e1-437428dd54f1
   Google Ads Customer ID: 733-667-6488
   Has Refresh Token: ❌ NO  ← THIS IS THE PROBLEM!
```

**Why Meta worked but Google didn't:**
- Meta refresh token was valid → Meta cache had real data → Archived successfully
- Google refresh token was missing → Google cache had zero data → Archived zeros

---

### **Scenario 2: Archival Job Failed to Run**

**What happened:**
- Cron job `/api/automated/archive-completed-months` didn't execute
- Vercel cron job misconfiguration
- Authentication failure (CRON_SECRET)

**Less likely because:**
- Meta data WAS archived successfully
- Same cron job handles both platforms

---

### **Scenario 3: Database Permission Issue**

**What happened:**
- Permission denied when trying to write to `campaign_summaries`
- RLS policies blocked the archival

**Less likely because:**
- Meta data was successfully written
- Historical data exists from previous months

---

## 🔎 **DIAGNOSTIC STEPS**

### **Step 1: Check if December Cache Existed**

Run this SQL query:

```sql
-- Check if December 2025 cache ever existed
SELECT 
  client_id,
  period_id,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  (cache_data->'stats'->>'totalImpressions')::numeric as impressions,
  jsonb_array_length(cache_data->'campaigns') as campaign_count,
  last_updated,
  created_at
FROM google_ads_current_month_cache
WHERE period_id = '2025-12'
  AND client_id = '93d46876-addc-4b99-b1e1-437428dd54f1';
```

**Expected Results:**

**If NO rows:** Cache was never created → refresh token missing throughout December  
**If rows with zeros:** Cache existed but had no data → refresh token missing throughout December  
**If rows with data:** Cache had data but wasn't archived → check archival job logs

---

### **Step 2: Check if December Was Archived**

```sql
-- Check if December was archived to campaign_summaries
SELECT 
  summary_date,
  platform,
  total_spend,
  total_impressions,
  reservations,
  data_source,
  last_updated
FROM campaign_summaries
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND platform = 'google'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-12-01'
  AND summary_date <= '2025-12-31';
```

**Expected Results:**

**If NO rows:** Archival never ran or failed  
**If rows with zeros:** Archival ran but source data was zeros  
**If rows with data:** Data exists (investigate why dashboard shows zeros)

---

### **Step 3: Check Archival Job Logs**

Look for logs from **January 1, 2026 at ~2:30 AM**:

```
Search for:
- "Starting monthly data archival process"
- "Archiving completed month: 2025-12"
- "Found X Google Ads monthly cache entries to archive"
- "Monthly archival completed"
```

**What to look for:**
- ✅ Job ran successfully
- ❌ Job failed with error
- ❌ Job didn't run at all

---

### **Step 4: Compare with Meta Ads**

```sql
-- Check Meta December (working correctly)
SELECT 
  summary_date,
  platform,
  total_spend,
  total_impressions,
  reservations,
  data_source,
  last_updated
FROM campaign_summaries
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND platform = 'meta'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-12-01'
  AND summary_date <= '2025-12-31';
```

**If Meta has data but Google doesn't:** Source data issue (refresh token)

---

## 🛠️ **SOLUTION**

### **Immediate Fix (Get December Data Back):**

1. **Add Google Ads Refresh Token**
   ```sql
   UPDATE clients 
   SET google_ads_refresh_token = 'YOUR_NEW_REFRESH_TOKEN'
   WHERE id = '93d46876-addc-4b99-b1e1-437428dd54f1';
   ```

2. **Manually Fetch December 2025 Historical Data**
   - Google Ads API supports historical queries
   - Fetch data for `2025-12-01` to `2025-12-31`
   - Store in `campaign_summaries` table

3. **Verify Data**
   - Check dashboard shows December metrics
   - Verify all conversion data is present

---

### **Long-Term Fix (Prevent Future Issues):**

#### **1. Add Token Expiration Monitoring**

Create alert system:
```typescript
// Pseudo-code for monitoring
async function checkTokenHealth() {
  const clients = await getClientsWithGoogleAds();
  
  for (const client of clients) {
    if (!client.google_ads_refresh_token) {
      // 🚨 ALERT: Missing refresh token
      sendAlert(`Client ${client.name} missing Google Ads token`);
    }
    
    // Try a test API call
    try {
      await testGoogleAdsAuth(client);
    } catch (error) {
      // 🚨 ALERT: Token expired or invalid
      sendAlert(`Client ${client.name} Google Ads auth failed`);
    }
  }
}
```

#### **2. Add Pre-Archival Data Quality Check**

Before archiving, verify data quality:
```typescript
async archiveCompletedMonths() {
  const cacheData = await fetchCacheForArchival();
  
  // 🔍 DATA QUALITY CHECK
  for (const entry of cacheData) {
    const spend = entry.cache_data?.stats?.totalSpend || 0;
    const campaigns = entry.cache_data?.campaigns?.length || 0;
    
    if (campaigns > 0 && spend === 0) {
      // 🚨 WARNING: Campaigns exist but no spend
      logger.warn(`Suspicious data for ${entry.client_id}: ${campaigns} campaigns but $0 spend`);
    }
  }
  
  // Proceed with archival...
}
```

#### **3. Add Post-Archival Verification**

After archiving, verify data was properly stored:
```typescript
async archiveCompletedMonths() {
  // Archive data...
  
  // ✅ VERIFICATION
  const archived = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('summary_date', archiveDate)
    .eq('platform', 'google');
  
  if (!archived || archived.length === 0) {
    // 🚨 ALERT: Archival completed but no data in database
    sendAlert('Google Ads archival verification failed');
  }
}
```

---

## 📋 **ACTION ITEMS**

### **For You (System Admin):**

1. ✅ **Run diagnostic SQL** (use `AUDIT_DECEMBER_GOOGLE_ADS.sql`)
2. ✅ **Check archival job logs** from Jan 1, 2026 at 2:30 AM
3. ✅ **Add Google Ads refresh token** for Havet
4. ✅ **Manually fetch December data** via API
5. ✅ **Verify dashboard** shows correct December metrics

### **For Development:**

1. ⚠️ **Add token health monitoring** (prevent future token expiry issues)
2. ⚠️ **Add data quality checks** before archival
3. ⚠️ **Add archival verification** after completion
4. ⚠️ **Add alerting system** for critical failures

---

## 💡 **CONCLUSION**

**Most Likely Root Cause:**
- Google Ads refresh token was missing/expired throughout December 2025
- Cache refresh jobs ran but fetched zero data (couldn't authenticate)
- Archival job ran successfully on Jan 1st but archived zero data
- Meta Ads worked fine because its token was valid

**Why Meta Worked:**
- Meta refresh token was valid → fetched real data → archived successfully

**Why Google Didn't:**
- Google refresh token was missing → fetched zeros → archived zeros

**Fix Priority:**
1. **Immediate:** Add refresh token + manually backfill December data
2. **Short-term:** Implement token monitoring
3. **Long-term:** Add data quality checks and alerting

---

## 🔗 **RELATED FILES**

- Archival Code: `src/lib/data-lifecycle-manager.ts` (lines 24-116)
- Cron Job: `src/app/api/automated/archive-completed-months/route.ts`
- Schedule: `vercel.json` (line 48-49: runs at 2:30 AM on 1st of month)
- Diagnostic SQL: `AUDIT_DECEMBER_GOOGLE_ADS.sql` (created)

---

**Next Step:** Run the diagnostic SQL queries to confirm the root cause, then proceed with the immediate fix.

