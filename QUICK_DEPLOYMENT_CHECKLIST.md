# ⚡ QUICK DEPLOYMENT CHECKLIST

**Total Time: ~45 minutes**

---

## ☑️ PRE-DEPLOYMENT (10 min)

- [ ] **Generate CRON_SECRET**
  ```bash
  openssl rand -hex 32
  ```
  Save output: `_________________________`

- [ ] **Add to environment variables**
  - Platform: ________________
  - Variable name: `CRON_SECRET`
  - Value: (paste from above)

- [ ] **Run migration**
  ```bash
  npx supabase migration up
  ```
  Expected: ✅ Migration 054 applied

---

## ☑️ CRON SETUP (15 min)

**Choose your platform:**

### ✓ Vercel
- [ ] Create `vercel.json` (see guide)
- [ ] Commit and push

### ✓ GitHub Actions  
- [ ] Create `.github/workflows/data-lifecycle.yml` (see guide)
- [ ] Add `CRON_SECRET` to GitHub secrets
- [ ] Commit and push

### ✓ External Service
- [ ] Sign up for cron service
- [ ] Add 4 jobs (see guide)
- [ ] Test each job

---

## ☑️ LOCAL TESTING (10 min)

- [ ] **Start dev server**
  ```bash
  npm run dev
  ```

- [ ] **Test archival** (in new terminal)
  ```bash
  curl -H "Authorization: Bearer YOUR_SECRET" \
    http://localhost:3000/api/cron/archive-periods
  ```
  Expected: `"success": true`

- [ ] **Test transition**
  ```bash
  curl -H "Authorization: Bearer YOUR_SECRET" \
    http://localhost:3000/api/cron/period-transition
  ```
  Expected: `"success": true`

- [ ] **Test health**
  ```bash
  curl http://localhost:3000/api/monitoring/data-health
  ```
  Expected: `"healthy": true`

---

## ☑️ DEPLOYMENT (5 min)

- [ ] **Commit changes**
  ```bash
  git add .
  git commit -m "feat: production readiness fixes"
  git push origin main
  ```

- [ ] **Wait for deployment**
  - Check hosting platform dashboard
  - Verify deployment succeeded

---

## ☑️ PRODUCTION VERIFICATION (5 min)

- [ ] **Test health endpoint**
  ```bash
  curl https://your-domain.com/api/monitoring/data-health
  ```
  Expected: `"healthScore": 100`

- [ ] **Verify cron security**
  ```bash
  curl https://your-domain.com/api/cron/archive-periods
  ```
  Expected: `401 Unauthorized` (this is good!)

- [ ] **Check deprecated tables**
  - Open Supabase dashboard
  - Run: `SELECT * FROM v_deprecated_tables_usage;`
  - Expected: See monitoring data

---

## ☑️ WEEK 1 MONITORING

- [ ] **Monday:** Check cron logs (should run at midnight & 1 AM)
- [ ] **1st of Month:** Check cron logs (should run at midnight & 1 AM)
- [ ] **Daily:** Check health endpoint
  ```bash
  curl https://your-domain.com/api/monitoring/data-health
  ```
- [ ] **End of Week:** Verify no manual interventions needed

---

## 🎉 DONE!

If all checkboxes are ticked: **You're production ready!**

**Health Score Target:** ≥90  
**Current Status:** Check at: https://your-domain.com/api/monitoring/data-health

---

## 🆘 TROUBLESHOOTING

**Problem:** Cron returns 401  
**Fix:** Check `CRON_SECRET` in environment variables

**Problem:** Health score < 90  
**Fix:** Check issues in health endpoint response

**Problem:** Cron not running  
**Fix:** Check platform logs, verify cron config

---

**Need full details?** See:
- `DEPLOYMENT_CONFIGURATION_GUIDE.md`
- `IMPLEMENTATION_COMPLETE_SUMMARY.md`
- `PRODUCTION_FIXES_ACTION_PLAN.md`

