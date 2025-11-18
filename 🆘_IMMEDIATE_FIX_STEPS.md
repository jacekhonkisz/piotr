# 🆘 IMMEDIATE FIX: Week 46 Shows Wrong Data

**Problem:** Week 46 shows 25,257 zł (full month) instead of ~3,500 zł (weekly)  
**Root Cause:** Database has NO weekly data (automated cron job timing out)  
**Time to Fix:** 5 minutes

---

## ✅ **FASTEST FIX - Run Local Script**

### Step 1: Open Terminal

Navigate to your project:
```bash
cd /Users/macbook/piotr
```

### Step 2: Run Collection Script

```bash
node scripts/manual-collect-belmonte.js
```

**Expected output:**
```
🚀 Starting manual weekly data collection for Belmonte Hotel...
📅 This will collect 53 weeks + current week of data
⏱️  Estimated time: 2-3 minutes

📡 Sending request to API...
........................................
✅ SUCCESS! Weekly data collection completed
```

### Step 3: Verify Fix

1. Open browser: `https://piotr-gamma.vercel.app/reports`
2. Select: **Tygodniowy** (Weekly)
3. Choose: **Week 46** (10.11 - 16.11.2025)
4. **Expected result:**
   - Spend: ~3,500 zł (NOT 25,257 zł)
   - Campaigns: 18 (NOT 1 fallback)
   - Data source: "Z bazy danych" or "Dane na żywo"

---

## 🔄 **ALTERNATIVE - Manual API Call**

If the script doesn't work, run this `curl` command:

```bash
curl -X POST "https://piotr-gamma.vercel.app/api/manual/collect-client-weekly" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"ab0b4c7e-2bf0-46bc-b455-b18ef6942baa"}'
```

**Note:** This requires the endpoint to be deployed (may take a few minutes after latest push).

---

## 🔍 **VERIFY DATABASE (Supabase Dashboard)**

### Check if Weekly Data Exists:

1. Go to: `https://supabase.com/dashboard/project/YOUR_PROJECT/editor`
2. Run this query:

```sql
SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  array_length(campaign_data, 1) as campaigns,
  created_at
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND summary_type = 'weekly'
AND summary_date >= '2025-11-01'
ORDER BY summary_date DESC;
```

**Expected result:**
- **BEFORE FIX:** 0 rows (empty) ❌
- **AFTER FIX:** Multiple rows for November weeks ✅

---

## 🎯 **WHAT GETS FIXED**

### Before (Current State):
```
Database Query Result: 0 rows
↓
System Fallback: Use stale monthly cache
↓
Reports Show: 25,257 zł (full month)
↓
Campaigns: 1 fake fallback campaign
```

###  After (Fixed):
```
Database Query Result: Found Week 46 data
↓
Reports Show: ~3,500 zł (actual weekly total)
↓
Campaigns: 18 real campaigns
↓
Year-over-year: Working correctly
```

---

## 📋 **TROUBLESHOOTING**

### Issue: Script fails with "Cannot find module"
**Solution:** Install dependencies first:
```bash
npm install
```

### Issue: API returns 404
**Solution:** Wait 2-3 minutes for deployment to complete, then retry.

### Issue: API returns "Admin access required"
**Solution:** Use the Node.js script instead (bypasses auth).

### Issue: Request times out
**Solution:** This is expected for full collection. Check Vercel function logs:
```bash
vercel logs piotr-gamma.vercel.app --since 10m
```

---

## 🔧 **LONG-TERM FIX (TODO)**

The automated weekly cron job needs optimization:

**Current:** Collects 53 weeks × ALL clients = 10+ minutes ❌  
**Target:** Collect only MISSING weeks = 10-30 seconds ✅

**Implementation:** See `WEEKLY_DATA_COLLECTION_ISSUE.md` for full plan.

---

## 📞 **NEED HELP?**

If none of these work:
1. Check Vercel deployment status
2. Review function logs for errors
3. Try triggering from Vercel dashboard: Settings → Crons → Run Now

---

**Last Updated:** November 18, 2025  
**Status:** Ready to fix - run the script above!

