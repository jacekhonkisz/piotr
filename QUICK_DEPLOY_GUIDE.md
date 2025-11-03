# ⚡ Quick Deploy Guide - Cron Jobs Fix

**5-Minute Deployment Guide**

---

## 🚨 **WHAT WAS BROKEN?**

```
vercel.json had "crons": [] → No automated jobs running!
```

**Impact:** Cache becomes stale, no data collection, reports not sent

---

## ✅ **WHAT'S FIXED?**

```
vercel.json now has 17 production cron jobs configured
```

**Result:** Automated cache refresh, data collection, and reports

---

## 🚀 **DEPLOY IN 3 STEPS**

### **Step 1: Test Locally (2 min)**
```bash
# Start dev server
npm run dev

# Run test script (in another terminal)
./test-cron-endpoints.sh

# Expected: "✓ All tests passed! Ready for deployment."
```

### **Step 2: Deploy (2 min)**
```bash
# Commit and push
git add vercel.json *.md test-cron-endpoints.sh
git commit -m "fix: Configure production cron jobs"
git push origin main

# Deploy to Vercel
vercel --prod
```

### **Step 3: Verify (1 min)**
1. Go to Vercel Dashboard
2. Settings → Cron Jobs
3. Verify 17 jobs are listed
4. Check logs: `vercel logs --prod`

---

## 📊 **WHAT RUNS WHEN?**

### **Every 3 Hours (Cache Refresh)**
- Meta Ads cache
- Google Ads cache
- Social media cache

**Times:** 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 UTC

### **Daily (Data Collection & Reports)**
- 01:00 UTC - Collect daily metrics
- 01:15 UTC - Collect Google Ads data
- 09:00 UTC - Send reports

### **Weekly (Maintenance)**
- Monday 03:00 - Archive weekly data
- Saturday 02:00 - Cleanup old data

### **Monthly (Archival)**
- 1st @ 02:00 - Archive previous month
- 1st @ 04:00 - Monthly cleanup

---

## 🎯 **SUCCESS CHECKLIST**

After deployment, verify:

- [ ] 17 cron jobs visible in Vercel Dashboard
- [ ] Test endpoint: `curl https://your-domain.com/api/health`
- [ ] Wait 3 hours, check cache updated
- [ ] Dashboard loads fast (<2 sec)
- [ ] No errors in Vercel logs

---

## ⚠️ **REQUIREMENTS**

- ✅ Vercel Pro Plan (required for frequent crons)
- ✅ Environment variables set in Vercel
- ✅ Supabase database accessible
- ✅ API keys configured (Meta, Google Ads)

---

## 🆘 **QUICK TROUBLESHOOTING**

**Problem:** Cron jobs not showing in Vercel  
**Fix:** Redeploy the project

**Problem:** Jobs failing  
**Fix:** Check environment variables: `vercel env pull`

**Problem:** Cache still stale  
**Fix:** Manual trigger: `curl https://your-domain.com/api/automated/refresh-current-month-cache`

---

## 📚 **DETAILED DOCS**

- **Full Audit:** CRON_JOBS_AUDIT_AND_FIX.md
- **Deployment Checklist:** PRODUCTION_DEPLOYMENT_CHECKLIST.md
- **Summary:** CRON_JOBS_FIX_SUMMARY.md

---

## ✅ **READY TO DEPLOY?**

```bash
./test-cron-endpoints.sh && git push origin main && vercel --prod
```

**That's it! Your automated system is now production-ready.** 🎉




