# 🔧 Environment Variables Setup Guide

## Quick Setup - Required Variables

Your Vercel app needs these environment variables to function properly:

### 1. **Application Settings**
```bash
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_APP_URL=https://piotr-ko8vf5ara-jachonkisz-gmailcoms-projects.vercel.app
LOG_LEVEL=info
```

### 2. **Supabase Database** (Required)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key
```

### 3. **Email Service - Resend** (Required)
```bash
RESEND_API_KEY=your-resend-api-key
```

### 4. **OpenAI API** (Required for AI summaries)
```bash
OPENAI_API_KEY=your-openai-api-key
```

### 5. **Meta Ads API** (Required for ads data)
```bash
META_ACCESS_TOKEN=your-meta-access-token
```

### 6. **Optional - Error Tracking**
```bash
SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_SENTRY_DSN=your-public-sentry-dsn
```

## 📋 Where to Get Each Value:

### **Supabase (Database)**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` key → `SUPABASE_SERVICE_ROLE_KEY`

### **Resend (Email Service)**
1. Go to https://resend.com/dashboard
2. Go to API Keys
3. Create new API key
4. Copy the key → `RESEND_API_KEY`

### **OpenAI API**
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key → `OPENAI_API_KEY`

### **Meta Ads API**
1. Go to https://developers.facebook.com/
2. Go to your app → Marketing API → Tools
3. Generate access token
4. Copy the token → `META_ACCESS_TOKEN`

## 🎯 Quick Setup Methods:

### **Method 1: Vercel Dashboard (Recommended)**
1. Go to https://vercel.com/dashboard
2. Select project: `piotr`
3. Go to Settings → Environment Variables
4. Add each variable with target "Production"

### **Method 2: Vercel CLI**
```bash
# Add each variable
vercel env add VARIABLE_NAME
# Enter the value when prompted
```

## ✅ Testing After Setup

Once all variables are added:

1. **Redeploy** (environment changes require redeployment):
   ```bash
   vercel --prod
   ```

2. **Test Health Endpoint**:
   ```bash
   curl https://piotr-ko8vf5ara-jachonkisz-gmailcoms-projects.vercel.app/api/health
   ```

3. **Check Cron Jobs**:
   - Go to Vercel Dashboard → Functions → Crons
   - Verify all 11 jobs are active

## 🚨 Important Notes:

- **Redeploy Required**: Environment variable changes require a new deployment
- **Security**: Never share these keys publicly
- **Testing**: Start with basic variables (Supabase, App URL) then add others
- **Cron Jobs**: Will start working automatically once environment is configured

## 🎉 Success Indicators:

- ✅ Health endpoint returns JSON (not auth page)
- ✅ Cron jobs show successful executions
- ✅ Application loads without errors
- ✅ Database connections work
- ✅ Email functionality operational 