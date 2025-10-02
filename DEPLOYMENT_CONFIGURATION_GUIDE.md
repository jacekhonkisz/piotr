# 🚀 Production Deployment Configuration Guide

**Date:** October 2, 2025  
**Status:** Required for production deployment

---

## 📋 Environment Variables

### **NEW - Required for P0 Fixes**

#### CRON_SECRET
**Purpose:** Authenticates automated cron job requests  
**Required:** YES  
**Generate:**
```bash
openssl rand -hex 32
```
**Example:** `8f7e6d5c4b3a29180e1f2d3c4b5a6789...`

**Where to add:**
- Vercel: Settings → Environment Variables
- Railway: Settings → Variables
- Heroku: Settings → Config Vars
- Local: `.env.local`

---

## 🔧 Cron Job Configuration

Your system now requires automated cron jobs for data lifecycle management.

### **Option 1: Vercel Cron (Recommended if using Vercel)**

Create `vercel.json` in project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/archive-periods",
      "schedule": "0 1 1 * *"
    },
    {
      "path": "/api/cron/archive-periods",
      "schedule": "0 1 * * 1"
    },
    {
      "path": "/api/cron/period-transition",
      "schedule": "0 0 1 * *"
    },
    {
      "path": "/api/cron/period-transition",
      "schedule": "0 0 * * 1"
    }
  ]
}
```

**Cron Schedule Explanation:**
- `0 1 1 * *` - 1 AM on the 1st of every month (monthly archival)
- `0 1 * * 1` - 1 AM every Monday (weekly archival)
- `0 0 1 * *` - Midnight on the 1st of every month (monthly transition)
- `0 0 * * 1` - Midnight every Monday (weekly transition)

### **Option 2: GitHub Actions**

Create `.github/workflows/data-lifecycle.yml`:

```yaml
name: Data Lifecycle Management

on:
  schedule:
    # Monthly archival - 1st of month at 1 AM UTC
    - cron: '0 1 1 * *'
    # Weekly archival - Every Monday at 1 AM UTC
    - cron: '0 1 * * 1'
    # Monthly transition - 1st of month at midnight UTC
    - cron: '0 0 1 * *'
    # Weekly transition - Every Monday at midnight UTC
    - cron: '0 0 * * 1'
  
  # Allow manual triggering
  workflow_dispatch:

jobs:
  data-lifecycle:
    runs-on: ubuntu-latest
    
    steps:
      - name: Archive completed periods
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -f \
            https://your-domain.com/api/cron/archive-periods
      
      - name: Handle period transitions
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -f \
            https://your-domain.com/api/cron/period-transition
```

**Setup:**
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Add secret: `CRON_SECRET` with your generated value
3. Commit `.github/workflows/data-lifecycle.yml`

### **Option 3: External Cron Service (cron-job.org, EasyCron, etc.)**

**Setup:**
1. Create account on cron service
2. Add jobs with Authorization header: `Bearer YOUR_CRON_SECRET`

**Jobs to create:**

| Name | URL | Schedule | Headers |
|------|-----|----------|---------|
| Monthly Archival | `https://your-domain.com/api/cron/archive-periods` | 1st of month, 1 AM | `Authorization: Bearer YOUR_SECRET` |
| Weekly Archival | `https://your-domain.com/api/cron/archive-periods` | Every Monday, 1 AM | `Authorization: Bearer YOUR_SECRET` |
| Monthly Transition | `https://your-domain.com/api/cron/period-transition` | 1st of month, midnight | `Authorization: Bearer YOUR_SECRET` |
| Weekly Transition | `https://your-domain.com/api/cron/period-transition` | Every Monday, midnight | `Authorization: Bearer YOUR_SECRET` |

---

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] **Generate CRON_SECRET**
  ```bash
  openssl rand -hex 32
  ```

- [ ] **Add CRON_SECRET to environment**
  - Production hosting platform
  - Local `.env.local` for testing

- [ ] **Configure cron jobs**
  - Choose option (Vercel/GitHub Actions/External)
  - Set up all 4 cron jobs
  - Test manual trigger

- [ ] **Run database migration**
  ```bash
  npx supabase migration up
  ```

- [ ] **Test endpoints locally**
  ```bash
  # Test archival endpoint
  curl -H "Authorization: Bearer YOUR_SECRET" http://localhost:3000/api/cron/archive-periods
  
  # Test transition endpoint
  curl -H "Authorization: Bearer YOUR_SECRET" http://localhost:3000/api/cron/period-transition
  
  # Test health check
  curl http://localhost:3000/api/monitoring/data-health
  ```

### Post-Deployment

- [ ] **Verify cron jobs are running**
  - Check logs on 1st of month
  - Check logs every Monday
  - Confirm no errors

- [ ] **Monitor data health**
  ```bash
  curl https://your-domain.com/api/monitoring/data-health
  ```

- [ ] **Check deprecated table usage**
  ```sql
  SELECT * FROM v_deprecated_tables_usage;
  ```

- [ ] **Verify archival working**
  - Wait for first period transition
  - Check `campaign_summaries` for new data
  - Check cache tables are clean

---

## 🧪 Testing Cron Jobs

### Manual Testing

```bash
# Set your CRON_SECRET
export CRON_SECRET="your-secret-here"

# Test archival endpoint
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/archive-periods

# Test transition endpoint
curl -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/period-transition

# Test health check (no auth needed)
curl http://localhost:3000/api/monitoring/data-health
```

### Expected Responses

**Archive Periods:**
```json
{
  "success": true,
  "timestamp": "2025-10-02T10:00:00.000Z",
  "executionTime": 1234,
  "results": {
    "monthsArchived": 1,
    "weeksArchived": 1,
    "dataCleanedUp": true,
    "errors": []
  }
}
```

**Period Transition:**
```json
{
  "success": true,
  "timestamp": "2025-10-02T00:00:00.000Z",
  "executionTime": 567,
  "totalArchived": 2,
  "totalErrors": 0,
  "details": {
    "monthTransition": { "archived": 1, "errors": 0 },
    "weekTransition": { "archived": 1, "errors": 0 }
  }
}
```

**Data Health:**
```json
{
  "healthy": true,
  "healthScore": 100,
  "issues": [],
  "warnings": [],
  "stats": {
    "total_summaries": 150,
    "monthly_summaries": 56,
    "weekly_summaries": 94,
    "current_month_caches": 4,
    "current_week_caches": 4,
    "total_storage_entries": 158,
    "platforms": {
      "meta": 120,
      "google": 30
    }
  },
  "recommendation": "✅ System is healthy"
}
```

---

## 🔒 Security Best Practices

### CRON_SECRET Management

1. **Never commit to repository**
   - Add to `.gitignore`: `.env.local`
   - Use environment variables only

2. **Use strong random values**
   - Minimum 32 characters
   - Use cryptographically secure generation

3. **Rotate periodically**
   - Rotate every 90 days
   - Update in all environments simultaneously

4. **Monitor unauthorized attempts**
   - Check logs for 401 responses
   - Set up alerts for repeated failures

---

## 📊 Monitoring & Alerting

### Set Up Daily Health Checks

Add to your monitoring system:

```bash
# Daily at 9 AM
curl https://your-domain.com/api/monitoring/data-health | \
  jq '.healthScore' | \
  awk '{if ($1 < 90) exit 1}'
```

### Slack Alerts (Optional)

If health score drops below 90, send alert:

```bash
HEALTH=$(curl -s https://your-domain.com/api/monitoring/data-health)
SCORE=$(echo $HEALTH | jq '.healthScore')

if [ "$SCORE" -lt 90 ]; then
  curl -X POST $SLACK_WEBHOOK_URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"⚠️ Data Health Alert: Score dropped to $SCORE\"}"
fi
```

---

## 🆘 Troubleshooting

### Cron Job Not Running

**Check:**
1. CRON_SECRET is set correctly
2. Cron schedule is correct (use crontab.guru)
3. URLs are accessible from external
4. Authorization header is included

**Debug:**
```bash
# Test with verbose output
curl -v -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/cron/archive-periods
```

### Health Check Showing Issues

**Common Issues:**

1. **Stale Cache Data**
   - **Cause:** Period transition not running
   - **Fix:** Run manually: `/api/cron/period-transition`

2. **Retention Policy Violation**
   - **Cause:** Cleanup not running
   - **Fix:** Run manually: `/api/cron/archive-periods`

3. **Legacy Table Usage**
   - **Cause:** Old code still using deprecated tables
   - **Fix:** Audit code and migrate to `campaign_summaries`

### Manual Recovery

If cron jobs fail, you can manually trigger:

```bash
# Archive and cleanup
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/cron/archive-periods

# Handle transitions
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://your-domain.com/api/cron/period-transition
```

---

## 📞 Support

**Questions?**
- Check logs in your hosting platform
- Review data health endpoint: `/api/monitoring/data-health`
- Check deprecated table usage: `SELECT * FROM v_deprecated_tables_usage;`

**Need Help?**
Refer to:
- `PRODUCTION_READINESS_COMPREHENSIVE_REPORTS_AUDIT.md`
- `PRODUCTION_FIXES_ACTION_PLAN.md`

---

**Last Updated:** October 2, 2025  
**Version:** 1.0

