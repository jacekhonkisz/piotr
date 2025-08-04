# Production Automation Checklist for Smart Data Loading

## 🚀 **Pre-Deployment Setup**

### 1. **Environment Configuration**
- [ ] Set up production environment variables
- [ ] Configure admin tokens for background collection
- [ ] Set up database connection strings
- [ ] Configure Meta API credentials

### 2. **Database Migration**
- [ ] Run migration `013_add_campaign_summaries.sql`
- [ ] Run migration `017_add_automation_triggers.sql`
- [ ] Verify `campaign_summaries` table exists
- [ ] Verify `system_logs` table exists
- [ ] Test database functions

### 3. **API Endpoints Verification**
- [ ] Test `/api/background/collect-monthly`
- [ ] Test `/api/background/collect-weekly`
- [ ] Test `/api/background/cleanup-old-data`
- [ ] Verify admin authentication works

## ⏰ **Automation Setup**

### Option A: **Cron Jobs (Linux/Unix)**
- [ ] Run `scripts/setup-production-automation.sh`
- [ ] Verify cron jobs are installed: `crontab -l`
- [ ] Test manual execution of collection scripts
- [ ] Set up log rotation for `/var/log/smart-data-collection.log`

### Option B: **Vercel Cron Jobs**
- [ ] Deploy `vercel.json` with cron configuration
- [ ] Verify cron jobs are active in Vercel dashboard
- [ ] Test endpoint accessibility

### Option C: **Cloud Scheduler (GCP/AWS)**
- [ ] Set up Cloud Scheduler jobs
- [ ] Configure HTTP targets for collection endpoints
- [ ] Set up authentication headers
- [ ] Test job execution

## 📊 **Monitoring Setup**

### 1. **Database Monitoring**
- [ ] Set up database alerts for storage size
- [ ] Configure alerts for failed collection jobs
- [ ] Set up monitoring for data freshness

### 2. **Application Monitoring**
- [ ] Deploy monitoring dashboard at `/admin/monitoring`
- [ ] Set up email alerts for system errors
- [ ] Configure log aggregation (if using external service)

### 3. **Performance Monitoring**
- [ ] Set up API response time monitoring
- [ ] Configure alerts for slow queries
- [ ] Monitor Meta API rate limits

## 🔧 **Initial Data Population**

### 1. **First-Time Setup**
- [ ] Run initial monthly collection for all clients
- [ ] Run initial weekly collection for all clients
- [ ] Verify data is stored in `campaign_summaries`
- [ ] Check data completeness (should have 12 months + 52 weeks)

### 2. **Data Validation**
- [ ] Verify stored data matches live API data
- [ ] Check data freshness (should be recent)
- [ ] Validate data integrity and format

## 🧪 **Testing & Validation**

### 1. **Automation Testing**
- [ ] Test monthly collection manually
- [ ] Test weekly collection manually
- [ ] Verify cleanup function works
- [ ] Test error handling and recovery

### 2. **Performance Testing**
- [ ] Measure stored data access speed
- [ ] Compare with live API access speed
- [ ] Verify 39x performance improvement
- [ ] Test under load

### 3. **Integration Testing**
- [ ] Test smart data loading with stored data
- [ ] Test fallback to live API for old data
- [ ] Verify data source indicators work
- [ ] Test user experience improvements

## 📈 **Ongoing Maintenance**

### 1. **Daily Monitoring**
- [ ] Check system logs for errors
- [ ] Monitor collection job success rates
- [ ] Verify data freshness
- [ ] Check storage size and growth

### 2. **Weekly Tasks**
- [ ] Review performance metrics
- [ ] Check for failed collections
- [ ] Verify cleanup is working
- [ ] Update monitoring dashboard

### 3. **Monthly Tasks**
- [ ] Review storage growth trends
- [ ] Optimize collection schedules if needed
- [ ] Update Meta API tokens if expiring
- [ ] Review and update automation scripts

## 🚨 **Alert Configuration**

### 1. **Critical Alerts**
- [ ] Collection jobs failing for >2 hours
- [ ] Database storage >80% full
- [ ] Meta API rate limit exceeded
- [ ] Data freshness >7 days old

### 2. **Warning Alerts**
- [ ] Collection jobs taking >30 minutes
- [ ] Storage size growing rapidly
- [ ] API response times increasing
- [ ] Data completeness <80%

## 📋 **Verification Commands**

### Test Automation Setup
```bash
# Check cron jobs
crontab -l

# Test collection endpoints
curl -X POST https://your-domain.com/api/background/collect-monthly \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check logs
tail -f /var/log/smart-data-collection.log

# Test database functions
psql -c "SELECT * FROM get_storage_stats();"
psql -c "SELECT * FROM get_recent_logs(24);"
```

### Monitor Performance
```bash
# Check storage statistics
node scripts/test-smart-loader-direct.js

# Verify data completeness
node scripts/test-database-storage-verification.js

# Test automation
node scripts/run-background-collection.js
```

## ✅ **Success Criteria**

### Performance Goals
- [ ] Stored data access: <100ms
- [ ] Live API access: <3 seconds
- [ ] Collection jobs: <30 minutes
- [ ] Storage size: <100MB for 20 clients

### Reliability Goals
- [ ] Collection success rate: >95%
- [ ] Data freshness: <7 days for monthly, <24h for weekly
- [ ] System uptime: >99.9%
- [ ] Error rate: <1%

### User Experience Goals
- [ ] Dashboard load time: <2 seconds
- [ ] Report generation: <5 seconds
- [ ] User satisfaction: >90%
- [ ] Support tickets: <5% related to performance

## 🔄 **Rollback Plan**

### If Automation Fails
1. Disable cron jobs: `crontab -r`
2. Switch to manual collection temporarily
3. Investigate and fix automation issues
4. Re-enable automation with fixes

### If Performance Degrades
1. Check storage size and cleanup old data
2. Optimize database queries
3. Review Meta API rate limits
4. Scale infrastructure if needed

## 📞 **Support Contacts**

- **Database Issues**: Database administrator
- **API Issues**: Meta API support
- **Infrastructure**: DevOps team
- **Application Issues**: Development team

---

**Last Updated**: [Date]
**Next Review**: [Date + 1 month] 