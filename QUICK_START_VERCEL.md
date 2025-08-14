# 🚀 Quick Start: Deploy to Vercel in 5 Minutes

## Option 1: One-Command Deployment

```bash
# Run the automated deployment script
./scripts/deploy-to-vercel.sh
```

This script will:
- ✅ Install Vercel CLI if needed
- ✅ Check authentication
- ✅ Build the app locally
- ✅ Deploy to Vercel
- ✅ Configure cron jobs
- ✅ Help set up environment variables

## Option 2: Manual Deployment

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy
```bash
# For production
vercel --prod

# For preview
vercel
```

### 4. Set Environment Variables
```bash
# Use the helper script
./scripts/setup-vercel-env.sh

# Or manually in Vercel dashboard
```

## Required Environment Variables

Copy these to your Vercel project settings:

```bash
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
RESEND_API_KEY=your-resend-api-key
NEXT_PUBLIC_APP_URL=your-vercel-domain
OPENAI_API_KEY=your-openai-api-key
META_ACCESS_TOKEN=your-meta-token
LOG_LEVEL=info
```

## Verify Deployment

### 1. Check Health Endpoint
```bash
curl https://your-app.vercel.app/api/health
```

### 2. Verify Cron Jobs
- Go to Vercel Dashboard → Your Project → Functions → Crons
- Should see 11 cron jobs configured

### 3. Test Authentication
```bash
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

## Cron Jobs Configured ✅

- **Monthly Collection**: Sunday 23:00
- **Weekly Collection**: Daily 00:01  
- **Background Cleanup**: Saturday 02:00
- **Executive Summaries Cleanup**: Saturday 03:00
- **Send Scheduled Reports**: Daily 09:00
- **Current Month Cache Refresh**: Every 3 hours
- **Current Week Cache Refresh**: Every 3 hours (offset)
- **Archive Completed Months**: 1st of month 01:00
- **Archive Completed Weeks**: Monday 02:00
- **Monthly Cleanup**: 1st of month 04:00
- **Daily KPI Collection**: Daily 01:00

## 🚨 Important Notes

1. **Vercel Pro Plan Required**: Cron jobs only work on Vercel Pro plans
2. **Environment Variables**: Must be set before cron jobs work properly
3. **Database Setup**: Ensure Supabase is configured with proper tables
4. **Meta API**: Ensure Meta developer app is configured

## Next Steps

1. ✅ Deploy application
2. ✅ Set environment variables
3. ✅ Verify cron jobs are active
4. ✅ Test API endpoints
5. ✅ Monitor logs for any issues
6. ✅ Set up custom domain (optional)

## Troubleshooting

### Build Fails
```bash
npm run build
npm run type-check
```

### Cron Jobs Not Running
- Check Vercel Pro plan
- Verify environment variables
- Check function logs

### API Errors
- Check environment variables
- Verify Supabase connection
- Check Meta API tokens

## Support

- Check `VERCEL_DEPLOYMENT_GUIDE.md` for detailed instructions
- Review logs in Vercel dashboard
- Test endpoints manually

---

**Your Meta Ads Reporting SaaS is ready to go! 🎉** 