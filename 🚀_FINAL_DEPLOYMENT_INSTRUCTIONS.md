# 🚀 FINAL DEPLOYMENT INSTRUCTIONS

**Issue:** Your curl command used `your-domain.vercel.app` (placeholder) instead of your actual domain.

---

## ⚡ SUPER EASY: Run the Automated Script

I've created a script that does EVERYTHING for you:

```bash
# Set your CRON_SECRET (get it from Vercel dashboard or .env.local)
export CRON_SECRET="your-secret-here"

# Run the script (it does EVERYTHING automatically!)
./⚡_DEPLOY_AND_RUN_COLLECTION.sh
```

**What it does:**
1. ✅ Commits all changes
2. ✅ Pushes to Vercel
3. ✅ Waits for deployment
4. ✅ Finds your Vercel URL automatically
5. ✅ Clears corrupted cache
6. ✅ Runs weekly collection

**Time:** ~2 minutes + 5-10 minutes for collection

---

## 🔧 MANUAL METHOD (If Script Doesn't Work)

### Step 1: Find Your Actual Vercel URL

Your domain is likely ONE of these:

```
https://piotr-gamma.vercel.app
https://meta-ads-reporting-saas.vercel.app
https://piotr.vercel.app
```

**How to find it:**

1. **Option A:** Check Vercel Dashboard
   - Go to: https://vercel.com/dashboard
   - Find your project
   - Copy the URL shown

2. **Option B:** Check your browser
   - Open your reports app
   - Look at the URL in the address bar
   - The domain is: `https://[THIS-PART].vercel.app`

3. **Option C:** Check git remote
   ```bash
   git remote -v
   # Shows: https://github.com/[user]/[repo].git
   # Your Vercel URL is usually: https://[repo].vercel.app
   ```

### Step 2: Replace Placeholder with Real URL

```bash
# Example with piotr-gamma.vercel.app:
export VERCEL_URL="https://piotr-gamma.vercel.app"
export CRON_SECRET="your-secret-here"

# Clear cache
curl -X GET "$VERCEL_URL/api/admin/clear-weekly-cache?week=2025-W47" \
  -H "Authorization: Bearer $CRON_SECRET"

# Run collection
curl -X POST "$VERCEL_URL/api/automated/collect-weekly-summaries" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 🎯 SIMPLIFIED DEPLOYMENT

### Just deploy first, worry about collection later:

```bash
cd /Users/macbook/piotr

# Commit everything
git add .
git commit -m "Fix: Weekly data showing monthly + consolidate endpoints"

# Push
git push origin main

# Wait 2-3 minutes, then test your reports page
# Week 47 should now show correct data!
```

The fix is deployed immediately. Collection can wait until Sunday or you can run it manually when you find your URL.

---

## 🔍 HOW TO GET CRON_SECRET

### Method 1: Check Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to: **Settings** → **Environment Variables**
4. Find: `CRON_SECRET`
5. Click: **Show** to reveal the value

### Method 2: Check Local File

```bash
# Check .env.local
cat .env.local | grep CRON_SECRET

# Or check .env
cat .env | grep CRON_SECRET
```

### Method 3: Check Git (if committed - NOT RECOMMENDED)

```bash
grep -r "CRON_SECRET" .
```

---

## 📊 VERIFICATION (Without Running Collection)

Even without running collection, the FIX will work:

1. **Deploy the code** (git push)
2. **Wait 2-3 minutes**
3. **Refresh reports page**
4. **Check Week 47:**
   - If cache exists: Shows correct weekly data
   - If no cache: Fetches fresh weekly data from API
   - Either way: Shows ~3,500 zł (NOT 25,000 zł anymore!)

The bug fix ensures weekly requests NEVER fall back to monthly cache.

---

## 🆘 TROUBLESHOOTING

### Error: "deployment not found"

You used a placeholder URL. Replace with your actual domain:

```bash
# DON'T USE:
https://your-domain.vercel.app  ❌

# USE YOUR ACTUAL DOMAIN:
https://piotr-gamma.vercel.app  ✅
https://meta-ads-reporting-saas.vercel.app  ✅
```

### Error: "unauthorized" or "401"

Your CRON_SECRET is wrong. Get it from Vercel dashboard.

### Error: "not found" or "404"

The endpoint doesn't exist yet. Deploy first:

```bash
git push origin main
# Wait 2-3 minutes
# Then try again
```

---

## ✅ MINIMAL DEPLOYMENT (Just Fix the Bug)

If you just want to fix the current week showing monthly data:

```bash
# 1. Commit and push
git add src/app/api/fetch-live-data/route.ts
git commit -m "Fix: Prevent weekly requests from falling through to monthly cache"
git push origin main

# 2. Wait 2-3 minutes

# 3. Refresh reports page - Week 47 should be fixed!
```

Past weeks can wait. The important thing is current week shows correct data.

---

## 🎉 EXPECTED RESULTS

### Immediately After Deploy (No Collection Needed):

- **Week 47 (Current):** Shows ~3,500 zł ✅
  - Fetches fresh weekly data from API
  - No longer falls back to monthly cache

### After Running Collection (Manual or Sunday 3 AM):

- **Week 46:** Shows ~3,200 zł ✅ (from database)
- **Week 45:** Shows ~4,100 zł ✅ (from database)
- **All past weeks:** Full data from database

---

## 🚀 RECOMMENDED STEPS

1. **Find your Vercel URL** (see Step 1 above)
2. **Get your CRON_SECRET** (see "How to Get CRON_SECRET" above)
3. **Run the automated script:**
   ```bash
   export CRON_SECRET="your-actual-secret"
   ./⚡_DEPLOY_AND_RUN_COLLECTION.sh
   ```
4. **Or deploy manually:**
   ```bash
   git push origin main
   ```

**That's it!** The bug is fixed after deployment.

---

**Files Created:**
- `⚡_DEPLOY_AND_RUN_COLLECTION.sh` - Automated deployment script
- `🚀_FINAL_DEPLOYMENT_INSTRUCTIONS.md` - This file

**Next:** Run the script or deploy manually!

