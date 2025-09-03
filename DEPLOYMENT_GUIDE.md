# 🚀 Production Deployment Guide - Vercel

## Pre-Deployment Checklist ✅

- [x] Email monitoring mode disabled
- [x] Vercel configuration file ready
- [x] Database migrations prepared
- [x] Cron jobs configured
- [x] Environment variables documented

## Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

## Step 2: Login to Vercel

```bash
vercel login
```

## Step 3: Deploy to Vercel

```bash
# Deploy from project root
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: meta-ads-reporting-saas
# - Directory: ./
# - Override settings? No
```

## Step 4: Set Environment Variables

In Vercel Dashboard or via CLI:

```bash
# Required Environment Variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY  
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add RESEND_API_KEY
vercel env add NEXT_PUBLIC_APP_URL

# Optional Environment Variables
vercel env add SENTRY_DSN
vercel env add META_ACCESS_TOKEN
vercel env add GOOGLE_ADS_DEVELOPER_TOKEN
```

### Environment Variables Template:

```env
# REQUIRED - Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# REQUIRED - Email Service
RESEND_API_KEY=re_your_resend_api_key

# REQUIRED - Application URL
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# OPTIONAL - Monitoring
SENTRY_DSN=your_sentry_dsn
NODE_ENV=production
```

## Step 5: Configure Cron Jobs

Your `vercel.json` already includes 12 automated cron jobs:

### Data Collection Jobs
- **Daily KPI Collection**: `0 2 * * *` (2 AM daily)
- **Weekly Data Collection**: `1 0 * * *` (12:01 AM daily)  
- **Monthly Data Collection**: `0 23 * * 0` (11 PM Sundays)

### Cache Refresh Jobs
- **Current Month Cache**: `0 */3 * * *` (Every 3 hours)
- **Current Week Cache**: `30 */3 * * *` (Every 3 hours, offset)
- **Google Ads Month Cache**: `15 */3 * * *` (Every 3 hours, offset)
- **Google Ads Week Cache**: `45 */3 * * *` (Every 3 hours, offset)

### Maintenance Jobs
- **Archive Completed Months**: `0 2 1 * *` (2 AM, 1st of month)
- **Archive Completed Weeks**: `0 3 * * 1` (3 AM Mondays)
- **Cleanup Old Data**: `0 4 * * 0` (4 AM Sundays)
- **Cleanup Executive Summaries**: `0 5 * * 0` (5 AM Sundays)

### Report Generation
- **Send Scheduled Reports**: `0 9 * * *` (9 AM daily)
- **Generate Monthly Reports**: `0 2 1 * *` (2 AM, 1st of month)
- **Generate Weekly Reports**: `0 3 * * 1` (3 AM Mondays)

## Step 6: Database Setup

### Run Migrations on Production Supabase

1. **Connect to Production Database**:
   ```bash
   # Update supabase/config.toml with production URL
   supabase link --project-ref your-production-project-ref
   ```

2. **Apply Migrations**:
   ```bash
   supabase db push
   ```

3. **Generate Types**:
   ```bash
   npm run db:generate
   ```

## Step 7: Verify Deployment

### Test Critical Endpoints

```bash
# Health check
curl https://your-domain.vercel.app/api/health

# Authentication test (should return 401)
curl https://your-domain.vercel.app/api/clients

# Cron job test
curl https://your-domain.vercel.app/api/automated/refresh-current-month-cache
```

### Test User Flows

1. **Admin Registration/Login**
2. **Client Creation**
3. **Report Generation**
4. **Email Delivery**
5. **Dashboard Analytics**

## Step 8: Production Monitoring

### Vercel Analytics
- Enable Vercel Analytics in dashboard
- Monitor function execution times
- Track cron job success rates

### Sentry Error Monitoring
- Verify error reporting works
- Set up alerts for critical errors
- Monitor API response times

### Supabase Monitoring
- Check database performance
- Monitor RLS policy effectiveness
- Track API usage

## Step 9: Post-Deployment Configuration

### Email Verification
1. Test welcome email delivery
2. Verify report notification emails
3. Check email templates render correctly

### API Rate Limits
1. Monitor Meta Ads API usage
2. Check Google Ads API quotas
3. Verify rate limiting works

### Cache Performance
1. Monitor cache hit rates
2. Check background refresh jobs
3. Verify stale-while-revalidate works

## Automated Deployment Commands

Create these scripts in `package.json`:

```json
{
  "scripts": {
    "deploy": "vercel --prod",
    "deploy:preview": "vercel",
    "env:pull": "vercel env pull .env.local",
    "env:push": "vercel env add",
    "logs": "vercel logs",
    "domains": "vercel domains"
  }
}
```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   ```bash
   vercel env ls
   vercel env add MISSING_VAR
   ```

2. **Cron Jobs Not Running**
   - Check Vercel Functions tab
   - Verify cron syntax in vercel.json
   - Check function logs

3. **Database Connection Issues**
   - Verify Supabase URL and keys
   - Check RLS policies
   - Test connection in Supabase dashboard

4. **Email Delivery Problems**
   - Verify Resend API key
   - Check domain verification
   - Test with Resend dashboard

### Performance Optimization

1. **Enable Vercel Edge Functions** for faster response times
2. **Configure CDN caching** for static assets
3. **Monitor bundle size** and optimize if needed
4. **Use Vercel Image Optimization** for client logos

## Security Checklist

- [x] Environment variables secured
- [x] API routes protected with authentication
- [x] RLS policies active in Supabase
- [x] Rate limiting configured
- [x] CORS properly configured
- [x] Security headers enabled

## Success Metrics

After deployment, monitor:
- **Uptime**: >99.9%
- **Response Time**: <500ms for API calls
- **Cache Hit Rate**: >80%
- **Email Delivery Rate**: >95%
- **Error Rate**: <1%

---

## 🎉 Your application is now production-ready!

Access your deployed application at: `https://your-domain.vercel.app`

### Next Steps:
1. Set up custom domain
2. Configure SSL certificate
3. Set up monitoring alerts
4. Create backup strategies
5. Plan scaling for growth
