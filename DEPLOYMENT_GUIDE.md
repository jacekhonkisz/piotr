# 🚀 Vercel Deployment Guide

Complete step-by-step guide to deploy your Meta Ads Reporting SaaS to Vercel.

---

## 📋 Pre-Deployment Checklist

- [ ] Git repository is initialized and pushed to GitHub/GitLab/Bitbucket
- [ ] All environment variables are documented
- [ ] Database migrations are ready
- [ ] Resend account is set up
- [ ] Supabase project is configured

---

## 🔧 Step 1: Install Vercel CLI (Optional but Recommended)

```bash
npm i -g vercel
```

Or use the web interface at [vercel.com](https://vercel.com)

---

## 🔧 Step 2: Prepare Your Repository

Ensure your code is committed and pushed:

```bash
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

---

## 🔧 Step 3: Deploy via Vercel Dashboard

### Option A: GitHub Integration (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New Project"**
3. **Import your Git repository**
   - Select your repository (GitHub/GitLab/Bitbucket)
   - Vercel will auto-detect Next.js
4. **Configure Project Settings:**
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

### Option B: Vercel CLI

```bash
# Navigate to project directory
cd /Users/macbook/piotr

# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

---

## 🔐 Step 4: Configure Environment Variables

**CRITICAL:** Add all environment variables in Vercel Dashboard:

### Go to: Project Settings → Environment Variables

Add these **REQUIRED** variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Email Service (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Application URL (will be provided by Vercel after first deploy)
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app

# Cron Job Security (CRITICAL - Generate a secure random string)
CRON_SECRET=your-secure-random-secret-min-32-chars

# Environment
NODE_ENV=production
```

### Optional but Recommended:

```bash
# OpenAI API (for AI summaries)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx

# Gmail Fallback (optional)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# Email From Address (optional, defaults to Resend)
EMAIL_FROM_ADDRESS=noreply@yourdomain.com

# Sentry Error Tracking (optional)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### Generate CRON_SECRET:

```bash
# Generate a secure random secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔧 Step 5: Verify Cron Jobs Configuration

Your `vercel.json` is already configured with 16 cron jobs. Vercel will automatically set them up.

**Important:** 
- **Hobby Plan:** Limited to 1 cron job (you have 16 - consider upgrading to Pro)
- **Pro Plan:** Unlimited cron jobs ✅

If on Hobby plan, you may need to:
1. Upgrade to Pro plan, OR
2. Consolidate cron jobs into fewer endpoints

---

## 🔧 Step 6: Configure Build Settings

In Vercel Dashboard → Project Settings → General:

- **Node.js Version:** 18.x or 20.x (recommended)
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

---

## 🔧 Step 7: Deploy

1. **Click "Deploy"** in Vercel Dashboard
2. **Wait for build to complete** (usually 2-5 minutes)
3. **Check build logs** for any errors

---

## ✅ Step 8: Post-Deployment Verification

### 1. Test the Application

Visit your deployment URL: `https://your-project.vercel.app`

- [ ] Homepage loads
- [ ] Login works
- [ ] Admin dashboard accessible
- [ ] Client dashboard accessible

### 2. Verify Environment Variables

Create a test endpoint or check logs to ensure all env vars are loaded:

```typescript
// Test in browser console or create a test page
console.log('App URL:', process.env.NEXT_PUBLIC_APP_URL);
```

### 3. Test Cron Jobs

After deployment, cron jobs will start automatically. To test manually:

```bash
# Test a cron endpoint manually
curl -X GET "https://your-project.vercel.app/api/automated/send-scheduled-reports" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 4. Verify Email Sending

- [ ] Send a test email from admin panel
- [ ] Check Resend dashboard for delivery status
- [ ] Verify email templates render correctly

### 5. Check Cron Job Status

In Vercel Dashboard → Project → Cron Jobs:
- [ ] All 16 cron jobs are listed
- [ ] Schedules are correct
- [ ] Last run times are showing

---

## 🔧 Step 9: Configure Custom Domain (Optional)

1. Go to **Project Settings → Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_APP_URL` environment variable

---

## 🐛 Troubleshooting

### Build Fails

**Error: "Module not found"**
- Check `package.json` dependencies
- Ensure all imports are correct
- Run `npm install` locally to verify

**Error: "Environment variable missing"**
- Verify all required env vars are set in Vercel
- Check variable names (case-sensitive)
- Redeploy after adding variables

### Cron Jobs Not Running

**Issue: Cron jobs not executing**
- Check Vercel plan (Hobby has limitations)
- Verify `vercel.json` is in root directory
- Check cron job logs in Vercel Dashboard

**Issue: "Unauthorized" errors**
- Verify `CRON_SECRET` is set correctly
- Check `x-vercel-cron` header is present (automatic)
- Review `src/lib/cron-auth.ts` implementation

### Email Not Sending

**Issue: Emails not delivered**
- Verify `RESEND_API_KEY` is correct
- Check Resend dashboard for errors
- Verify domain is verified in Resend
- Check `MONITORING_MODE` is `false` in production

### Database Connection Issues

**Issue: "Supabase connection failed"**
- Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
- Check `SUPABASE_SERVICE_ROLE_KEY` is set
- Ensure Supabase project is active
- Check RLS policies are configured

---

## 📊 Monitoring & Logs

### View Logs

1. **Vercel Dashboard → Project → Logs**
   - Real-time function logs
   - Build logs
   - Cron job execution logs

2. **Function Logs:**
   - Click on any function in Vercel Dashboard
   - View execution logs and errors

### Monitor Cron Jobs

- **Vercel Dashboard → Project → Cron Jobs**
  - See all scheduled jobs
  - View execution history
  - Check success/failure rates

---

## 🔄 Continuous Deployment

Vercel automatically deploys on every push to your main branch:

1. Push to `main` branch
2. Vercel detects changes
3. Builds and deploys automatically
4. Preview deployments for PRs

---

## 📝 Environment Variables Reference

### Production Environment Variables

Copy this list and fill in your values:

```bash
# ============================================
# REQUIRED - Core Configuration
# ============================================
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
NODE_ENV=production

# ============================================
# OPTIONAL - Enhanced Features
# ============================================
OPENAI_API_KEY=
GMAIL_USER=
GMAIL_APP_PASSWORD=
EMAIL_FROM_ADDRESS=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

---

## 🎯 Quick Deploy Checklist

- [ ] Code pushed to Git repository
- [ ] Vercel project created
- [ ] All environment variables set
- [ ] Build successful
- [ ] Application accessible
- [ ] Login works
- [ ] Cron jobs configured
- [ ] Email sending works
- [ ] Database connection verified

---

## 🆘 Support

If you encounter issues:

1. Check Vercel build logs
2. Review function execution logs
3. Verify environment variables
4. Check Supabase dashboard
5. Review Resend dashboard for email issues

---

**🎉 Your app is now deployed and ready for production!**

All automated features (emails, reports, data collection) will run automatically based on your cron job schedule.
