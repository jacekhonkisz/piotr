# Vercel Deployment Guide - Google RMF Audit

**Date:** January 27, 2025  
**Purpose:** Deploy app to Vercel for Google RMF audit demonstration  
**Status:** Ready for deployment

---

## 📋 Pre-Deployment Checklist

Before deploying, make sure you have:

- [x] Fixed build errors (Google Ads API issue) ✅
- [x] All RMF features implemented ✅
- [ ] Supabase project ready
- [ ] Google Ads API credentials
- [ ] Meta API credentials (if using)
- [ ] OpenAI API key (for AI summaries)
- [ ] Vercel account

---

## 🚀 Quick Deployment (Fastest Method)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

```bash
# From your project directory
vercel
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Which scope?** Select your account
- **Link to existing project?** No (first time) or Yes (updating)
- **Project name?** piotr-hotel-ads-dashboard (or your choice)
- **Directory?** ./ (current directory)
- **Override settings?** No

---

## 🔐 Required Environment Variables

You need to add these environment variables in Vercel Dashboard after first deployment.

### **Supabase (Required)**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### **Google Ads API (Required for RMF)**

**System Settings** (stored in database `system_settings` table):
- `google_ads_client_id`
- `google_ads_client_secret`
- `google_ads_developer_token`
- `google_ads_manager_customer_id`

**Per Client** (stored in `clients` table):
- `google_ads_customer_id`
- `google_ads_refresh_token`

> Note: Google Ads credentials are stored in database, not environment variables

### **OpenAI (Optional - for AI summaries)**

```bash
OPENAI_API_KEY=sk-your-key-here
```

### **Email (Optional - for report sending)**

```bash
# Gmail API
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REFRESH_TOKEN=your-gmail-refresh-token
GMAIL_USER_EMAIL=your-email@gmail.com
```

---

## 📝 Step-by-Step Deployment Guide

### Method 1: Vercel CLI (Recommended)

#### 1. Prepare Your Code

```bash
# Make sure all changes are committed
git add .
git commit -m "Prepare for Vercel deployment"
```

#### 2. Deploy to Vercel

```bash
# Development preview (test first)
vercel

# Production deployment
vercel --prod
```

#### 3. Add Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add the required variables listed above.

#### 4. Redeploy with Environment Variables

```bash
vercel --prod
```

---

### Method 2: GitHub Integration (Alternative)

#### 1. Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework: Next.js
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: `.next`

#### 3. Add Environment Variables

In Vercel project settings, add all required environment variables.

#### 4. Deploy

Click "Deploy" - Vercel will automatically deploy from your `main` branch.

---

## 🗄️ Database Setup

### Supabase Configuration

1. **Create Supabase Project** (if not exists)
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Note down:
     - Project URL
     - Anon key
     - Service role key

2. **Run Database Migrations**

Your database should have these tables:
- `clients`
- `campaigns`
- `campaign_summaries`
- `daily_kpi`
- `system_settings`
- `reports`
- `sent_reports`
- `executive_summaries`

3. **Add Google Ads System Settings**

In Supabase SQL Editor:

```sql
-- Insert system settings for Google Ads
INSERT INTO system_settings (key, value, description)
VALUES 
  ('google_ads_client_id', 'your-client-id', 'Google Ads OAuth Client ID'),
  ('google_ads_client_secret', 'your-client-secret', 'Google Ads OAuth Client Secret'),
  ('google_ads_developer_token', 'your-dev-token', 'Google Ads Developer Token'),
  ('google_ads_manager_customer_id', 'your-manager-id', 'Google Ads Manager Customer ID')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

4. **Add Demo Client**

```sql
-- Insert a demo client for Google to test
INSERT INTO clients (
  name,
  email,
  company,
  google_ads_enabled,
  google_ads_customer_id,
  google_ads_refresh_token
)
VALUES (
  'Demo Hotel',
  'demo@example.com',
  'Demo Hotel Group',
  true,
  'your-google-ads-customer-id',
  'your-google-ads-refresh-token'
);
```

---

## 🧪 Testing After Deployment

### 1. Basic Health Check

```bash
# Check if site is up
curl https://your-app.vercel.app/

# Expected: Should return HTML
```

### 2. Test API Endpoints

```bash
# Test system health
curl https://your-app.vercel.app/api/monitoring/system-health

# Expected: {"status":"ok",...}
```

### 3. Test RMF Features

Visit your deployed app:
1. Go to `https://your-app.vercel.app`
2. Login as admin
3. Go to Dashboard
4. Switch to Google Ads tab
5. Verify:
   - ✅ Account Overview displays (R.10)
   - ✅ Go to Reports page
   - ✅ Click campaign → See ad groups (R.30)
   - ✅ Click ad group → See ads (R.40)
   - ✅ Check "Wyszukiwane hasła" tab (R.70)

---

## 🎯 For Google RMF Audit

### Provide Google With:

1. **Live URL:**
   ```
   https://your-app.vercel.app
   ```

2. **Demo Credentials:**
   - Email: demo@example.com
   - Password: [Your secure password]

3. **Access Instructions:**
   ```
   1. Go to https://your-app.vercel.app
   2. Login with provided credentials
   3. Click "Dashboard" in navigation
   4. Switch to "Google Ads" tab at top
   5. View Account Overview (R.10)
   6. Click "Reports" in navigation
   7. Select time period (e.g., "Current Month")
   8. View campaign table
   9. Click any campaign → See ad groups (R.30)
   10. Click any ad group → See ads (R.40)
   11. Switch to "Wyszukiwane hasła (R.70)" tab
   ```

4. **Screenshots** (Take these from live site)
   - Account Overview
   - Campaign table
   - Expanded ad groups
   - Expanded ads
   - Search Terms tab
   - Network and Device tabs

---

## 🔧 Common Issues & Solutions

### Issue 1: Build Fails

**Error:** Module not found

**Solution:**
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json .next
npm install
npm run build

# If successful locally, try deployment again
vercel --prod
```

### Issue 2: Environment Variables Not Working

**Solution:**
1. Verify variables in Vercel Dashboard
2. Make sure no typos in variable names
3. Redeploy after adding variables:
   ```bash
   vercel --prod
   ```

### Issue 3: Database Connection Fails

**Solution:**
1. Check Supabase URL and keys are correct
2. Verify Supabase project is not paused
3. Check RLS (Row Level Security) policies allow access

### Issue 4: Google Ads Data Not Loading

**Solution:**
1. Verify Google Ads credentials in `system_settings` table
2. Check client has valid `google_ads_refresh_token`
3. Check browser console for API errors
4. Test API endpoints directly:
   ```bash
   curl -X POST https://your-app.vercel.app/api/google-ads-account-performance \
     -H "Content-Type: application/json" \
     -d '{"clientId":"your-client-id","dateStart":"2025-01-01","dateEnd":"2025-01-31"}'
   ```

---

## 📊 Vercel Configuration

Your `vercel.json` includes cron jobs. After deployment, verify they're scheduled:

**Vercel Dashboard → Your Project → Cron Jobs**

You should see:
- 3-hour cache refreshes
- Daily data collection
- Monthly/weekly report generation

---

## 🎨 Custom Domain (Optional)

### Add Custom Domain

1. Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain (e.g., `ads-dashboard.example.com`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (up to 24 hours)

---

## 📈 Monitoring After Deployment

### Vercel Analytics

- Vercel Dashboard → Your Project → Analytics
- Monitor:
  - Page views
  - Response times
  - Error rates

### Supabase Logs

- Supabase Dashboard → Logs
- Monitor:
  - API calls
  - Database queries
  - Error logs

---

## 🔒 Security Checklist

Before sharing with Google:

- [ ] Environment variables are set (not hardcoded)
- [ ] Database RLS policies are enabled
- [ ] Demo account has limited permissions
- [ ] No sensitive data in Git history
- [ ] HTTPS is enabled (automatic with Vercel)
- [ ] API rate limiting is configured

---

## 📞 Deployment Checklist

```bash
# 1. Ensure code is ready
npm run build
# Should complete without errors

# 2. Commit all changes
git add .
git commit -m "Ready for production"

# 3. Deploy to Vercel
vercel --prod

# 4. Add environment variables in Vercel Dashboard
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - OPENAI_API_KEY (optional)

# 5. Redeploy with env vars
vercel --prod

# 6. Test live site
# - Visit https://your-app.vercel.app
# - Test all RMF features
# - Verify no console errors

# 7. Take screenshots

# 8. Share with Google
```

---

## 🎯 Quick Commands Reference

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy preview
vercel

# Deploy to production
vercel --prod

# Check deployment logs
vercel logs

# List deployments
vercel ls

# Remove deployment
vercel rm deployment-url
```

---

## 📧 Contact Info for Google

Update these in your RMF response:

- **Production URL:** https://your-app.vercel.app
- **Demo Email:** demo@example.com
- **Demo Password:** [Provided separately]
- **Technical Contact:** your-email@example.com
- **Support:** support@example.com

---

## ✅ Final Verification

Before submitting to Google:

1. ✅ Site loads without errors
2. ✅ Login works with demo credentials
3. ✅ Dashboard displays data
4. ✅ Google Ads tab works
5. ✅ Account Overview shows (R.10)
6. ✅ Reports page loads
7. ✅ Campaigns can be expanded (R.30)
8. ✅ Ad groups can be expanded (R.40)
9. ✅ Search Terms tab is visible (R.70)
10. ✅ All metrics display correctly
11. ✅ No console errors
12. ✅ Screenshots taken
13. ✅ Documentation updated

---

## 🚀 You're Ready!

Your app is now deployed and ready for Google's RMF audit. 

**Next steps:**
1. Test thoroughly on live URL
2. Take annotated screenshots
3. Update `GOOGLE_RMF_AUDIT_RESPONSE.md` with live URL
4. Submit to Google with confidence!

Good luck with your RMF audit! 🎯
