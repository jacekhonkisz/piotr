# 📊 How to View Production Logs

## ✅ Your App is Working!

Based on the logs, your production deployment is receiving and processing requests successfully:
- ✅ `/api/clients` - Working
- ✅ `/api/fetch-live-data` - Working with cache
- ✅ `/api/google-ads-smart-cache` - Working

---

## 🖥️ **Method 1: Vercel Dashboard (Easiest)**

**Best way to monitor your app:**

1. **Open Vercel Dashboard:**
   ```
   https://vercel.com/jachonkisz-gmailcoms-projects/piotr
   ```

2. **View Logs:**
   - Click on the latest deployment
   - Click "Functions" tab
   - Click "Runtime Logs"
   - See real-time logs with filtering

3. **View Cron Jobs:**
   - Click "Cron Jobs" tab
   - See all scheduled tasks
   - View execution history

**Advantages:**
- ✅ Real-time updates
- ✅ Filter by function/endpoint
- ✅ Search logs
- ✅ No command needed
- ✅ Visual interface

---

## 💻 **Method 2: Terminal Commands**

### View Latest Deployment Logs:

```bash
# Your current production deployment
vercel logs https://piotr-eqn2whneq-jachonkisz-gmailcoms-projects.vercel.app
```

### Get Deployment URL First:

```bash
# List all deployments
vercel ls

# Then view logs for specific deployment
vercel logs <DEPLOYMENT_URL>
```

### View Logs as JSON (for parsing):

```bash
vercel logs https://piotr-eqn2whneq-jachonkisz-gmailcoms-projects.vercel.app --json
```

### Filter Logs with JQ:

```bash
# Only show errors
vercel logs <URL> --json | jq 'select(.level == "error")'

# Only show warnings
vercel logs <URL> --json | jq 'select(.level == "warning")'

# Search for specific text
vercel logs <URL> --json | jq 'select(.message | contains("cron"))'
```

---

## 🔍 **What to Look For**

### ✅ Success Indicators:

**Cron Jobs Working:**
```
✅ Verified Vercel cron job (x-vercel-cron header)
```

**Cache Refreshing:**
```
[INFO] 🔄 Force refresh requested, bypassing cache
[INFO] ✅ Fresh data cached successfully
```

**Emails Sending:**
```
[INFO] ✅ Email sent successfully
```

### ⚠️ Issues to Watch:

**Unauthorized Cron Attempts:**
```
🚫 Unauthorized cron attempt detected
```
*If you see this, CRON_SECRET might be wrong*

**API Errors:**
```
[ERROR] Meta API: Ad relevance fetch failed
```
*Check Meta API token*

**Database Errors:**
```
[ERROR] Database query failed
```
*Check Supabase connection*

---

## 📅 **Monitor Scheduled Tasks**

### Cron Job Schedule:

| Time | Task | What to Look For |
|------|------|------------------|
| **Every 3 hours** | Cache Refresh | `✅ Fresh data cached successfully` |
| **1:00 AM** | Daily KPI | `✅ Daily KPI collection complete` |
| **1:15 AM** | Google Ads Sync | `✅ Google Ads data synced` |
| **9:00 AM** | Email Reports | `✅ Email sent successfully` |
| **Mon 4 AM** | Weekly Reports | `✅ Weekly report generated` |
| **1st 5 AM** | Monthly Reports | `✅ Monthly report generated` |

### How to Verify Cron Jobs:

**Option 1: Vercel Dashboard**
1. Go to: https://vercel.com/jachonkisz-gmailcoms-projects/piotr
2. Click "Cron Jobs" tab
3. See execution history

**Option 2: Check Logs Tomorrow**
```bash
# After 1:15 AM, check for this log
vercel logs <URL> --json | grep "Daily KPI collection"
```

---

## 🛠️ **Troubleshooting Commands**

### Get Current Deployment Info:

```bash
cd /Users/macbook/piotr
vercel ls --prod
```

### Get All Environment Variables:

```bash
vercel env ls
```

### Pull Production Environment Locally:

```bash
vercel env pull .env.production
```

### Test Cron Endpoint Manually:

```bash
# Generate a new CRON_SECRET first
export CRON_SECRET="your-secret-here"

# Test automated endpoint
curl -X GET \
  "https://piotr-eqn2whneq-jachonkisz-gmailcoms-projects.vercel.app/api/automated/refresh-all-caches" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 📊 **Monitoring Best Practices**

### Daily Checks:

1. **Morning (9 AM):** 
   - Check if email reports sent
   - View logs: `vercel logs <URL> --json | grep "Email sent"`

2. **Afternoon:**
   - Quick dashboard check
   - Verify no errors in Functions tab

### Weekly Checks:

1. **Monday Morning:**
   - Check weekly report generation (4 AM)
   - Verify cache refresh working

2. **Review Metrics:**
   - Check API call count
   - Review error rate
   - Check cache hit ratio

### Monthly Checks:

1. **1st of Month:**
   - Verify monthly report generation (5 AM)
   - Check end-of-month collection (2 AM)
   - Review archival tasks

---

## 🚨 **Alert Setup (Optional)**

### Vercel Integrations:

1. **Slack Notifications:**
   - Go to: https://vercel.com/integrations/slack
   - Connect your Slack workspace
   - Get alerts for failed deployments

2. **Sentry Error Tracking:**
   - Already integrated in your code
   - Configure SENTRY_DSN in environment variables
   - Get real-time error alerts

3. **Email Notifications:**
   - Vercel sends emails for:
     - Failed deployments
     - Excessive errors
     - Quota warnings

---

## 📝 **Quick Reference**

### Most Common Commands:

```bash
# View current production logs
vercel logs https://piotr-eqn2whneq-jachonkisz-gmailcoms-projects.vercel.app

# List all deployments
vercel ls

# Redeploy if needed
vercel --prod

# View environment variables
vercel env ls

# Pull production environment
vercel env pull
```

### Dashboard URLs:

- **Project Dashboard:** https://vercel.com/jachonkisz-gmailcoms-projects/piotr
- **Runtime Logs:** https://vercel.com/jachonkisz-gmailcoms-projects/piotr/logs
- **Cron Jobs:** https://vercel.com/jachonkisz-gmailcoms-projects/piotr/crons
- **Environment Variables:** https://vercel.com/jachonkisz-gmailcoms-projects/piotr/settings/environment-variables

---

## 🎯 **What You Just Saw**

Your logs show:
```
✅ API requests being processed
✅ Cache checks working
✅ Data fetching successful
✅ Google Ads integration active
```

**Your app is working perfectly in production!** 🎉

---

## 💡 **Pro Tips**

1. **Use Dashboard for Daily Monitoring**
   - Faster and more visual
   - Real-time updates
   - Easy filtering

2. **Use CLI for Debugging**
   - When you need to search logs
   - When you need JSON output
   - For automation scripts

3. **Set Up Alerts**
   - Connect Slack for instant notifications
   - Monitor error rates
   - Track cron job execution

4. **Check Logs Tomorrow Morning**
   - After 1 AM - verify daily collection
   - After 9 AM - verify email sending
   - Look for success messages

---

**Your deployment is healthy and running!** ✅

For more details, check the Vercel dashboard or run the commands above.

