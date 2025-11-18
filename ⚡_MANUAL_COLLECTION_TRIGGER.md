# ⚡ MANUAL WEEKLY COLLECTION TRIGGER

**Purpose:** Trigger weekly collection manually to fix existing missing conversion data  
**Date:** November 18, 2025

---

## 🔧 HOW TO TRIGGER MANUALLY

### Step 1: Get Your CRON_SECRET

**Option A: From Vercel Dashboard**
1. Go to: https://vercel.com/jacekhonkiszs-projects/piotr/settings/environment-variables
2. Find `CRON_SECRET`
3. Copy the value

**Option B: From .env.local (if you have it)**
```bash
grep CRON_SECRET .env.local
```

---

### Step 2: Get Your Deployment URL

**Option A: Check Vercel Dashboard**
- Production URL: https://piotr-gamma.vercel.app

**Option B: Use Vercel CLI**
```bash
vercel ls piotr --prod
```

---

### Step 3: Trigger Weekly Collection

**Replace `YOUR_CRON_SECRET` with actual value:**

```bash
curl -X POST https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -v
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Weekly summaries collection completed",
  "results": {
    "successful": 1,
    "failed": 0,
    "total": 1
  }
}
```

---

### Step 4: Trigger Monthly Collection (Optional)

```bash
curl -X POST https://piotr-gamma.vercel.app/api/automated/collect-monthly-summaries \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -v
```

---

## 📊 WHAT THIS DOES

1. **Fetches fresh data** from Meta API for last 53 weeks + current week
2. **Includes custom conversions** (booking steps, reservations)
3. **Uses improved fallback logic** (just deployed)
4. **Overwrites existing data** in campaign_summaries table
5. **Populates missing metrics** for historical periods

---

## ⏱️ TIMING

- **Weekly collection:** Takes ~2-5 minutes (fetches 54 weeks)
- **Monthly collection:** Takes ~1-3 minutes (fetches 12 months)
- **Both together:** ~5-8 minutes total

---

## 🔍 VERIFY IT WORKED

### After Collection Completes:

**1. Check Logs:**
```bash
vercel logs --since 10m | grep "Enhanced conversion metrics"
```

Should see logs like:
```
✅ Enhanced conversion metrics from daily_kpi_data: {
  booking_step_1: 123,
  booking_step_2: 456,
  booking_step_3: 83,
  reservations: 18,
  ...
}
```

**2. Check Reports Page:**
- Open: https://piotr-gamma.vercel.app/reports
- Select a week that had missing data (e.g., Week 46)
- Should now show complete conversion metrics
- All booking steps should have values (not 0)

**3. Check Database:**
```sql
SELECT 
  summary_date,
  summary_type,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND summary_date >= '2025-11-01'
ORDER BY summary_date DESC;
```

Should show populated values, not zeros.

---

## 🚨 TROUBLESHOOTING

### Error: "Unauthorized" (401)
- CRON_SECRET is wrong or missing
- Check environment variable in Vercel dashboard

### Error: "Not Found" (404)
- URL is wrong
- Check production deployment URL

### Error: "Internal Server Error" (500)
- Check Vercel logs for details:
```bash
vercel logs --since 10m
```

### Collection Times Out
- This is normal for large datasets
- Check logs to see progress
- Wait 5-10 minutes and check database

### No Data After Collection
- Check if Meta API tokens are valid
- Check if daily_kpi_data has conversion metrics
- Run diagnostic SQL: `scripts/diagnose-missing-conversions.sql`

---

## 📋 ALTERNATIVE: Use Vercel Dashboard

1. Go to: https://vercel.com/jacekhonkiszs-projects/piotr
2. Click **Deployments**
3. Click on latest deployment
4. Click **Functions** tab
5. Find `/api/automated/collect-weekly-summaries`
6. Click **Invoke** button
7. Enter headers:
   ```json
   {
     "Authorization": "Bearer YOUR_CRON_SECRET"
   }
   ```
8. Click **Send Request**

---

## ⚡ QUICK COMMAND (Copy-Paste Ready)

**Once you have CRON_SECRET, run this:**

```bash
# Set your CRON_SECRET
export CRON_SECRET="your-actual-secret-here"

# Trigger weekly collection
curl -X POST https://piotr-gamma.vercel.app/api/automated/collect-weekly-summaries \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -v

# Wait 5 minutes, then trigger monthly
sleep 300
curl -X POST https://piotr-gamma.vercel.app/api/automated/collect-monthly-summaries \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -v
```

---

## 📊 EXPECTED TIMELINE

- **Now:** Trigger collection
- **+2 min:** Weekly collection processing
- **+5 min:** Weekly collection complete
- **+5 min:** Trigger monthly collection
- **+8 min:** Monthly collection complete
- **+10 min:** Verify data on reports page

---

**Status:** Waiting for CRON_SECRET to trigger collection

