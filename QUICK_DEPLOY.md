# ⚡ Quick Deploy to Vercel

## 🚀 Fastest Way to Deploy

### Method 1: Vercel Dashboard (Recommended for First Time)

1. **Go to [vercel.com](https://vercel.com)** → Sign in → "Add New Project"

2. **Import Git Repository:**
   - Connect your GitHub/GitLab/Bitbucket
   - Select your repository
   - Click "Import"

3. **Configure Project:**
   - Framework: Next.js (auto-detected) ✅
   - Root Directory: `./` ✅
   - Build Command: `npm run build` ✅
   - Click "Deploy"

4. **Add Environment Variables** (after first deploy):
   - Go to: **Settings → Environment Variables**
   - Add all variables from the list below
   - **Redeploy** after adding variables

5. **Done!** Your app is live at `https://your-project.vercel.app`

---

### Method 2: Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Navigate to project
cd /Users/macbook/piotr

# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

---

## 🔐 Required Environment Variables

**Add these in Vercel Dashboard → Settings → Environment Variables:**

```bash
# ============================================
# REQUIRED - Copy & Paste These
# ============================================

NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
RESEND_API_KEY=your-resend-key
CRON_SECRET=generate-secure-random-32-chars
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
NODE_ENV=production
```

**Generate CRON_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ✅ Post-Deployment Checklist

After deployment, verify:

- [ ] App loads at `https://your-project.vercel.app`
- [ ] Login works
- [ ] Admin dashboard accessible
- [ ] Environment variables are set
- [ ] Cron jobs appear in Vercel Dashboard (may need Pro plan for all 16)

---

## ⚠️ Important Notes

1. **Cron Jobs:** You have 16 cron jobs configured. Vercel Hobby plan allows only 1 cron job. Consider upgrading to Pro plan for full automation.

2. **First Deploy:** After first deploy, update `NEXT_PUBLIC_APP_URL` with your actual Vercel URL, then redeploy.

3. **Build Time:** First build takes 3-5 minutes. Subsequent builds are faster.

---

## 🆘 Need Help?

See full deployment guide: `DEPLOYMENT_GUIDE.md`

---

**Ready to deploy?** Go to [vercel.com](https://vercel.com) and click "Add New Project"! 🚀

