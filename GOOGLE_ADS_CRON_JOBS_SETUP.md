# Google Ads Automated Collection - Cron Jobs Setup

## 🎯 **OVERVIEW**

The Google Ads data collection system is now fully implemented and working. To ensure continuous data collection for year-over-year comparisons, you need to set up automated cron jobs.

---

## 📅 **RECOMMENDED CRON SCHEDULE**

### **1. Daily Google Ads Collection**
```bash
# Run daily at 2:00 AM
0 2 * * * curl -X GET "http://localhost:3000/api/automated/google-ads-daily-collection"
```
**Purpose**: Collect current day Google Ads data for all clients

### **2. Monthly Background Collection**
```bash
# Run on the 1st of every month at 3:00 AM
0 3 1 * * curl -X GET "http://localhost:3000/api/background/collect-monthly"
```
**Purpose**: Collect monthly summaries for the last 12 months (includes Google Ads)

### **3. Weekly Background Collection**
```bash
# Run every Monday at 4:00 AM
0 4 * * 1 curl -X GET "http://localhost:3000/api/background/collect-weekly"
```
**Purpose**: Collect weekly summaries for the last 52 weeks (includes Google Ads)

### **4. Google Ads Current Month Cache Refresh**
```bash
# Run every 3 hours during business hours
0 */3 * * * curl -X GET "http://localhost:3000/api/automated/refresh-google-ads-current-month-cache"
```
**Purpose**: Keep current month Google Ads data fresh

### **5. Google Ads Current Week Cache Refresh**
```bash
# Run every hour during business hours
0 * * * * curl -X GET "http://localhost:3000/api/automated/refresh-google-ads-current-week-cache"
```
**Purpose**: Keep current week Google Ads data fresh

---

## 🔧 **SETUP INSTRUCTIONS**

### **Option A: Using crontab (Linux/macOS)**

1. **Open crontab editor:**
   ```bash
   crontab -e
   ```

2. **Add the cron jobs:**
   ```bash
   # Google Ads Daily Collection
   0 2 * * * curl -X GET "http://localhost:3000/api/automated/google-ads-daily-collection"
   
   # Monthly Background Collection (includes Google Ads)
   0 3 1 * * curl -X GET "http://localhost:3000/api/background/collect-monthly"
   
   # Weekly Background Collection (includes Google Ads)
   0 4 * * 1 curl -X GET "http://localhost:3000/api/background/collect-weekly"
   
   # Google Ads Current Month Cache Refresh
   0 */3 * * * curl -X GET "http://localhost:3000/api/automated/refresh-google-ads-current-month-cache"
   
   # Google Ads Current Week Cache Refresh
   0 * * * * curl -X GET "http://localhost:3000/api/automated/refresh-google-ads-current-week-cache"
   ```

3. **Save and exit** (usually Ctrl+X, then Y, then Enter)

### **Option B: Using Vercel Cron Jobs**

If you're using Vercel, add to your `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/automated/google-ads-daily-collection",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/background/collect-monthly",
      "schedule": "0 3 1 * *"
    },
    {
      "path": "/api/background/collect-weekly",
      "schedule": "0 4 * * 1"
    },
    {
      "path": "/api/automated/refresh-google-ads-current-month-cache",
      "schedule": "0 */3 * * *"
    },
    {
      "path": "/api/automated/refresh-google-ads-current-week-cache",
      "schedule": "0 * * * *"
    }
  ]
}
```

### **Option C: Using GitHub Actions**

Create `.github/workflows/google-ads-collection.yml`:

```yaml
name: Google Ads Data Collection

on:
  schedule:
    # Daily at 2:00 AM UTC
    - cron: '0 2 * * *'
    # Monthly on 1st at 3:00 AM UTC
    - cron: '0 3 1 * *'
    # Weekly on Monday at 4:00 AM UTC
    - cron: '0 4 * * 1'
    # Every 3 hours
    - cron: '0 */3 * * *'
    # Every hour
    - cron: '0 * * * *'

jobs:
  collect-data:
    runs-on: ubuntu-latest
    steps:
      - name: Daily Google Ads Collection
        if: github.event.schedule == '0 2 * * *'
        run: curl -X GET "${{ secrets.APP_URL }}/api/automated/google-ads-daily-collection"
      
      - name: Monthly Collection
        if: github.event.schedule == '0 3 1 * *'
        run: curl -X GET "${{ secrets.APP_URL }}/api/background/collect-monthly"
      
      - name: Weekly Collection
        if: github.event.schedule == '0 4 * * 1'
        run: curl -X GET "${{ secrets.APP_URL }}/api/background/collect-weekly"
      
      - name: Current Month Cache
        if: github.event.schedule == '0 */3 * * *'
        run: curl -X GET "${{ secrets.APP_URL }}/api/automated/refresh-google-ads-current-month-cache"
      
      - name: Current Week Cache
        if: github.event.schedule == '0 * * * *'
        run: curl -X GET "${{ secrets.APP_URL }}/api/automated/refresh-google-ads-current-week-cache"
```

---

## 📊 **MONITORING & VERIFICATION**

### **Check if cron jobs are working:**

1. **View cron logs:**
   ```bash
   tail -f /var/log/cron.log
   ```

2. **Check database for new data:**
   ```sql
   SELECT 
     platform,
     summary_type,
     COUNT(*) as records,
     MAX(summary_date) as latest_date,
     SUM(total_spend) as total_spend
   FROM campaign_summaries 
   WHERE platform = 'google'
   GROUP BY platform, summary_type
   ORDER BY latest_date DESC;
   ```

3. **Monitor application logs:**
   ```bash
   # Check for Google Ads collection logs
   grep "Google Ads" /path/to/your/app/logs/*.log
   ```

---

## 🚨 **TROUBLESHOOTING**

### **Common Issues:**

1. **Cron job not running:**
   - Check cron service: `sudo service cron status`
   - Verify cron syntax: `crontab -l`
   - Check system logs: `tail -f /var/log/syslog`

2. **API endpoint returning errors:**
   - Check application is running: `curl http://localhost:3000/api/health`
   - Verify Google Ads credentials are valid
   - Check database connectivity

3. **No data being collected:**
   - Verify Google Ads API quotas are not exceeded
   - Check client Google Ads customer IDs are correct
   - Ensure manager refresh token is valid

### **Manual Testing:**

Test each endpoint manually:
```bash
# Test daily collection
curl -X GET "http://localhost:3000/api/automated/google-ads-daily-collection"

# Test monthly collection
curl -X GET "http://localhost:3000/api/background/collect-monthly"

# Test weekly collection
curl -X GET "http://localhost:3000/api/background/collect-weekly"
```

---

## 🎯 **EXPECTED RESULTS**

Once cron jobs are set up and running:

1. **Daily**: Fresh Google Ads data collected every day
2. **Weekly**: Historical weekly summaries maintained (52 weeks)
3. **Monthly**: Historical monthly summaries maintained (12 months)
4. **Year-over-Year**: PDF reports will show real data instead of "Brak danych"
5. **Automatic Cleanup**: Data older than 1 year automatically removed

---

## ⚡ **IMMEDIATE ACTION REQUIRED**

Choose one of the setup options above and implement the cron jobs. The Google Ads data collection system is ready and waiting for automated scheduling!

**Recommended**: Start with Option A (crontab) for immediate setup, then migrate to your preferred platform-specific solution.
