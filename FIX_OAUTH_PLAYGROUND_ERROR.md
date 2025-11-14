# Fix: redirect_uri_mismatch Error in OAuth Playground

**Error**: `Błąd 400: redirect_uri_mismatch`  
**Cause**: OAuth Playground redirect URI not authorized in Google Cloud Console  
**Fix Time**: 2 minutes

---

## 🔧 Quick Fix

### Step 1: Go to Google Cloud Console

1. Go to: **https://console.cloud.google.com/**
2. Make sure you're in the correct project
3. Go to: **APIs & Services** → **Credentials**

### Step 2: Edit Your OAuth Client

1. Find your OAuth 2.0 Client ID: `77508981337-7kkho8u7mkfs3b2huojbmjt2mi236fps`
2. Click on it to **EDIT**

### Step 3: Add OAuth Playground Redirect URI

1. Find the **"Authorized redirect URIs"** section
2. Click **"+ ADD URI"**
3. Add this EXACT URI:
   ```
   https://developers.google.com/oauthplayground
   ```
   ⚠️ **Important**: Copy it EXACTLY as shown above (no trailing slash)

4. Click **"SAVE"**

### Step 4: Wait 1-2 Minutes

- Google may take 1-2 minutes to propagate the change
- Don't try OAuth Playground immediately after saving

### Step 5: Try OAuth Playground Again

Go back to: **https://developers.google.com/oauthplayground/**

1. Click gear icon ⚙️
2. Check "Use your own OAuth credentials"
3. Enter:
   - **OAuth Client ID**: `77508981337-7kkho8u7mkfs3b2huojbmjt2mi236fps.apps.googleusercontent.com`
   - **OAuth Client Secret**: `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`
4. In left panel, find **"Google Ads API v17"**
5. Check: `https://www.googleapis.com/auth/adwords`
6. Click **"Authorize APIs"**

**This time it should work!** ✅

---

## 📋 Complete List of Redirect URIs You Should Have

After adding OAuth Playground, your **Authorized redirect URIs** should include:

```
https://developers.google.com/oauthplayground
http://localhost:3000/api/auth/callback/google-ads
https://your-production-domain.com/api/auth/callback/google-ads
```

(Replace `your-production-domain.com` with your actual domain when you deploy)

---

## 🎯 What This Error Means

**redirect_uri_mismatch** happens when:
- The OAuth Playground redirects back to `https://developers.google.com/oauthplayground`
- But that URI isn't in your authorized list
- Google blocks it for security

**Solution**: Add OAuth Playground's URI to your authorized list ✅

---

## ✅ After Fixing

Once you've added the redirect URI and it works:

1. **Authorize** - Sign in and allow access
2. **Exchange** - Get your authorization code exchanged
3. **Copy refresh_token** - From the response
4. **Update database** - Add it to `system_settings.google_ads_manager_refresh_token`

Then test:
```bash
node scripts/test-google-ads-production-ready.js
```

Expected: **100% success** 🎉

---

**Total time to fix**: 2 minutes  
**Then you can generate the refresh token!** ✅





