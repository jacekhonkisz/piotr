# ⚡ Quick Deploy Guide - Fix Stale Caches

## 🎯 Problem Fixed
- ❌ Meta Weekly: 21 hours stale
- ❌ Google Ads Monthly: 54 hours stale  
- ❌ Google Ads Weekly: 54 hours stale

## ✅ Solution
Consolidated 4 separate cron jobs → 1 unified cron job

---

## 🚀 Deploy Now (3 Steps)

### Step 1: Commit & Push
```bash
cd /Users/macbook/piotr

git add src/app/api/automated/refresh-all-caches/route.ts vercel.json
git commit -m "fix: consolidate cache refresh cron jobs"
git push origin main
```

### Step 2: Manual Refresh (While Deploying)
```bash
# Get immediate relief for Belmonte
curl -X POST https://YOUR_DOMAIN/api/automated/refresh-current-week-cache
```

### Step 3: Verify (After Deploy)
```
1. Go to: YOUR_DOMAIN/admin/monitoring
2. Check: All caches show "Healthy" ✅
3. Verify: Fresh % > 80% for all caches
```

---

## 📊 Expected Result

**Before:**
```
Meta Weekly:       21h old  ❌
Google Ads caches: 54h old  ❌
```

**After (within 30 min):**
```
All caches:        < 3h old ✅
Fresh percentage:  > 90%    ✅
Belmonte:         Fresh     ✅
```

---

## ✅ Done!

Vercel will auto-deploy and run the unified cron every 3 hours.
