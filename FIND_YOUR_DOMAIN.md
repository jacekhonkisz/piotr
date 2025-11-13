# 🔍 How to Find Your Vercel Domain

## Method 1: Check Vercel Dashboard (30 seconds)

1. Go to: **https://vercel.com/dashboard**
2. Look for project named: **piotr** or **meta-ads-reporting-saas**
3. Click on the project
4. You'll see the domain at the top, something like:
   - `piotr-abc123.vercel.app`
   - `meta-ads-reporting-saas-xyz.vercel.app`

**Copy that domain!**

---

## Method 2: Check Recent Deployment Email

1. Check your email for "Vercel - Deployment Ready"
2. The email will have a link to your deployment
3. The domain is in that link

---

## Method 3: Check Git Push Output

Look at the terminal output when you pushed the code.
Vercel should have shown deployment URL there.

---

## Once You Have the Domain:

Run these commands in your terminal:

```bash
# Replace YOUR_DOMAIN with the actual domain (without https://)
DOMAIN="YOUR_DOMAIN.vercel.app"

# Refresh Meta Weekly cache (21h stale)
curl -X POST https://$DOMAIN/api/automated/refresh-current-week-cache

# Refresh Google Ads Monthly cache (54h stale)
curl -X POST https://$DOMAIN/api/automated/refresh-google-ads-current-month-cache

# Refresh Google Ads Weekly cache (54h stale)
curl -X POST https://$DOMAIN/api/automated/refresh-google-ads-current-week-cache
```

---

## Example:

If your domain is `piotr-abc123.vercel.app`:

```bash
curl -X POST https://piotr-abc123.vercel.app/api/automated/refresh-current-week-cache
curl -X POST https://piotr-abc123.vercel.app/api/automated/refresh-google-ads-current-month-cache
curl -X POST https://piotr-abc123.vercel.app/api/automated/refresh-google-ads-current-week-cache
```

---

## ✅ What to Expect:

Each command should return:
```json
{
  "success": true,
  "summary": {
    "totalClients": 13,
    "successCount": 12,
    ...
  }
}
```

---

## Alternative: Use Browser

If terminal commands don't work, you can also trigger refreshes from your admin panel:

1. Go to: `https://YOUR_DOMAIN/admin/monitoring`
2. Look for each cache type
3. Click "Refresh" button (if available)

Or just wait for the automated cron to run at the next :00 hour (every 3 hours).

