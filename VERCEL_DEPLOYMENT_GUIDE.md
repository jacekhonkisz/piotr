# Vercel Deployment Guide - Meta Ads Reporting SaaS

## 🚀 Quick Deployment (10 minutes)

### Prerequisites
- Vercel account
- GitHub repository access
- Supabase project setup
- Meta Developer App configured
- Resend account for emails
- OpenAI API key (for AI summaries)

## 📋 Step-by-Step Deployment

### 1. **Connect Repository to Vercel**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from project root
vercel
```

Or use the Vercel Dashboard:
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Configure build settings (automatically detected)

### 2. **Environment Variables Setup**

Configure these environment variables in Vercel Dashboard or via CLI:

#### **Required Environment Variables**

```bash
# Application Environment
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=production

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key

# Email Service (Resend)
RESEND_API_KEY=your-production-resend-key

# Application URL (will be your Vercel domain)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Error Tracking (Sentry) - Optional
SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=your-public-sentry-dsn

# Logging
LOG_LEVEL=info

# OpenAI API for AI Executive Summaries
OPENAI_API_KEY=your-openai-api-key

# Meta API (for health checks)
META_ACCESS_TOKEN=your-meta-access-token
```

#### **Setting Environment Variables via CLI**

```bash
# Set environment variables
vercel env add NODE_ENV
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add RESEND_API_KEY
vercel env add NEXT_PUBLIC_APP_URL
vercel env add OPENAI_API_KEY
# ... continue for all variables
```

#### **Setting Environment Variables via Dashboard**

1. Go to your project in Vercel Dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable with appropriate environment (Production, Preview, Development)

### 3. **Vercel Configuration**

Your `vercel.json` is already configured with cron jobs:

```json
{
  "crons": [
    {
      "path": "/api/background/collect-monthly",
      "schedule": "0 23 * * 0"
    },
    {
      "path": "/api/background/collect-weekly", 
      "schedule": "1 0 * * *"
    },
    {
      "path": "/api/background/cleanup-old-data",
      "schedule": "0 2 * * 6"
    },
    {
      "path": "/api/background/cleanup-executive-summaries",
      "schedule": "0 3 * * 6"
    },
    {
      "path": "/api/automated/send-scheduled-reports",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/automated/refresh-current-month-cache",
      "schedule": "0 */3 * * *"
    },
    {
      "path": "/api/automated/refresh-current-week-cache",
      "schedule": "15 */3 * * *"
    },
    {
      "path": "/api/automated/archive-completed-months",
      "schedule": "0 1 1 * *"
    },
    {
      "path": "/api/automated/archive-completed-weeks",
      "schedule": "0 2 * * 1"
    },
    {
      "path": "/api/automated/cleanup-old-data",
      "schedule": "0 4 1 * *"
    },
    {
      "path": "/api/automated/daily-kpi-collection",
      "schedule": "0 1 * * *"
    }
  ]
}
```

### 4. **Deploy the Application**

```bash
# Deploy to production
vercel --prod

# Or deploy specific environment
vercel deploy --prod
```

### 5. **Post-Deployment Setup**

#### **Database Migration (if needed)**
```bash
# Run database migrations on Supabase
# This should be done in your Supabase dashboard
```

#### **Test API Endpoints**
```bash
# Test health endpoint
curl https://your-app.vercel.app/api/health

# Test authentication
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

#### **Verify Cron Jobs**
Cron jobs are automatically enabled on Vercel Pro plans. Check:
1. Go to Vercel Dashboard → Functions → Crons
2. Verify all cron jobs are listed and active
3. Monitor cron job executions in the logs

## 📅 Cron Jobs Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| **Monthly Collection** | Sunday 23:00 | Collects last 12 months of data |
| **Weekly Collection** | Daily 00:01 | Collects last 52 weeks of data |
| **Background Cleanup** | Saturday 02:00 | Removes old data |
| **Executive Summaries Cleanup** | Saturday 03:00 | Cleans up AI summaries |
| **Send Scheduled Reports** | Daily 09:00 | Sends automated reports |
| **Current Month Cache Refresh** | Every 3 hours | Refreshes current month data |
| **Current Week Cache Refresh** | Every 3 hours (offset) | Refreshes current week data |
| **Archive Completed Months** | 1st of month 01:00 | Archives completed months |
| **Archive Completed Weeks** | Monday 02:00 | Archives completed weeks |
| **Monthly Cleanup** | 1st of month 04:00 | Monthly data cleanup |
| **Daily KPI Collection** | Daily 01:00 | Collects daily KPI data |

## 🔒 Security Considerations

### **Authentication & Authorization**
- JWT tokens for API authentication
- Role-based access control (admin/client)
- Secure password hashing

### **API Security**
- Rate limiting on API endpoints
- CORS configuration
- Environment variable protection

### **Data Protection**
- Encrypted database connections
- Secure Meta API token storage
- Email encryption for reports

## 🔍 Monitoring & Logging

### **Vercel Monitoring**
1. **Function Logs**: Monitor cron job executions
2. **Analytics**: Track application performance
3. **Error Tracking**: Set up Sentry integration

### **Application Monitoring**
```bash
# Check cron job execution
curl https://your-app.vercel.app/api/health

# Monitor specific endpoints
curl https://your-app.vercel.app/api/automated/send-scheduled-reports
```

### **Database Monitoring**
- Monitor Supabase dashboard for query performance
- Check database storage usage
- Review connection limits

## 🚨 Troubleshooting

### **Common Issues**

#### 1. **Environment Variables Missing**
```bash
# Check deployed environment variables
vercel env ls

# Add missing variables
vercel env add VARIABLE_NAME
```

#### 2. **Cron Jobs Not Running**
- Verify Vercel Pro plan (required for cron jobs)
- Check function logs in Vercel dashboard
- Ensure endpoints return 200 status codes

#### 3. **Database Connection Issues**
- Verify Supabase service role key
- Check database connection limits
- Review Supabase logs

#### 4. **Build Failures**
```bash
# Check build logs
vercel logs

# Run build locally
npm run build

# Check TypeScript errors
npm run type-check
```

### **Debug Commands**

```bash
# Check deployment status
vercel ls

# View deployment logs
vercel logs

# Test specific functions
vercel dev
```

## 📊 Performance Optimization

### **Vercel Optimizations**
- Enable Edge functions for geo-distributed performance
- Use Vercel Analytics for monitoring
- Configure proper caching headers

### **Application Optimizations**
- Database query optimization
- Implement smart caching for Meta API calls
- Use connection pooling for database

## 🔄 Continuous Deployment

### **Automatic Deployments**
- Connect GitHub repository for automatic deployments
- Set up preview deployments for pull requests
- Configure production deployments from main branch

### **Development Workflow**
```bash
# Development environment
vercel dev

# Preview deployment
git push origin feature-branch

# Production deployment
git push origin main
```

## ✅ Post-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Cron jobs active and running
- [ ] Health endpoints responding
- [ ] Authentication working
- [ ] Email service configured
- [ ] Meta API integration working
- [ ] OpenAI integration working
- [ ] Monitoring and logging active
- [ ] Error tracking configured
- [ ] Performance optimizations applied

## 🎯 Next Steps

1. **Setup Monitoring Alerts**: Configure alerts for failed cron jobs
2. **Performance Monitoring**: Set up application performance monitoring
3. **Backup Strategy**: Implement database backup procedures
4. **Documentation**: Update API documentation
5. **User Training**: Prepare user guides and training materials

## 📞 Support

For deployment issues:
1. Check Vercel documentation
2. Review application logs
3. Test endpoints manually
4. Contact support if needed

---

**Deployment Complete!** 🎉

Your Meta Ads Reporting SaaS is now live on Vercel with automated cron jobs running in the background. 