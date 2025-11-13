# 📧 Google Ads Token Fix - Standard Access Guide

**Subject**: Fix Google Ads Refresh Token Expiration (Standard OAuth Access)

---

## 📋 Overview

Your Google Ads OAuth app has **standard/production access** (approved by Google), but refresh tokens are expiring after 7 days because the OAuth consent screen is still in "Testing" mode. This guide will help you switch to permanent tokens.

**Current Status**: ✅ Standard access approved  
**Issue**: ⚠️ OAuth app in "Testing" mode → 7-day token expiration  
**Solution**: Change to "Internal" or "Production" mode → Permanent tokens

---

## 🎯 Quick Fix (5 Minutes)

### Step 1: Update OAuth Consent Screen Status

1. **Navigate to Google Cloud Console**:
   - URL: https://console.cloud.google.com/apis/credentials/consent
   - Sign in with your Google account (the one with admin access)

2. **Select Your Project**:
   - Use the project dropdown at the top
   - Select the project containing your OAuth credentials

3. **Change Publishing Status**:
   - On the OAuth consent screen page, look for **"Publishing status"**
   - If it shows **"Testing"**, click **"PUBLISH APP"** or **"Make Internal"**
   - Choose one:
     - **Option A**: **"Internal"** (if you have Google Workspace) → Immediate, no verification
     - **Option B**: **"In production"** (if using personal Gmail) → May need verification

4. **Verify Status**:
   - After publishing, confirm it shows:
     - ✅ Publishing status: **"In production"**
     - ✅ No "Testing" warnings

### Step 2: Generate New Refresh Token

Since your token expired, you need a fresh one. Use these scripts:

**Generate OAuth URL**:
```bash
cd /Users/macbook/piotr
npx tsx scripts/generate-google-oauth-url.ts
```

**Complete OAuth Flow**:
1. Copy the URL from the script output
2. Paste in your browser (use incognito/private window)
3. Sign in with your Google account (the one with Google Ads Manager access)
4. Click **"Allow"** to grant permissions
5. Copy the **authorization code** displayed on screen (long string like `4/0AdLIrYe...`)

**Exchange Code for Token**:
```bash
npx tsx scripts/exchange-oauth-code.ts "YOUR_AUTHORIZATION_CODE_HERE"
```

Replace `YOUR_AUTHORIZATION_CODE_HERE` with the actual code you copied.

**Verify Token Works**:
```bash
npx tsx scripts/test-google-token-live.ts
```

Expected output: `✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅`

---

## ✅ What This Accomplishes

**Before**:
- ❌ Refresh tokens expire every 7 days
- ❌ Requires weekly manual regeneration
- ❌ Smart cache cannot auto-refresh
- ❌ Dashboard shows stale data

**After**:
- ✅ Refresh tokens **never expire** (permanent)
- ✅ Zero maintenance required
- ✅ Smart cache auto-refreshes every 3 hours
- ✅ Dashboard always displays current data
- ✅ Production-ready setup

---

## 🔍 Verification Checklist

After completing the steps above, verify:

- [ ] OAuth consent screen shows **"In production"** status
- [ ] New refresh token generated and saved to database
- [ ] Token test script passes all tests
- [ ] Dashboard displays current month/week data correctly
- [ ] No `invalid_grant` errors in logs
- [ ] Smart cache age is recent (< 3 hours)

---

## 📊 Current Configuration Status

Based on your database:

- ✅ **Client ID**: Configured (77508981337-7kkho8u7...)
- ✅ **Client Secret**: Configured
- ✅ **Developer Token**: Configured
- ✅ **Manager Customer ID**: Configured (293-100-0497)
- ❌ **Refresh Token**: Expired (8 days old, expired Nov 11)

**Action Required**: Generate new token after updating OAuth consent screen status.

---

## 🆘 Troubleshooting

### Issue: "Can't publish app" or "Verification required"

**If using "Production" mode**:
- Google may require app verification for sensitive scopes
- This can take 1-2 weeks
- **Temporary solution**: Use "Internal" mode if you have Google Workspace

**If using "Internal" mode**:
- Requires Google Workspace account (not personal Gmail)
- If unavailable, you'll need to use "Production" mode

### Issue: "invalid_client" error

- Verify Client ID and Secret in database match Google Cloud Console
- Run: `npx tsx scripts/check-google-token-config.ts` to verify

### Issue: "redirect_uri_mismatch"

- Go to: APIs & Services → Credentials → Your OAuth Client
- Add `urn:ietf:wg:oauth:2.0:oob` to Authorized redirect URIs
- Click Save

### Issue: Token test still fails after fix

- Verify OAuth consent screen actually shows "In production"
- Generate a completely fresh token (old tokens won't work)
- Check that you're using the correct Google account

---

## 📞 Support

If you encounter issues:

1. **Check current status**:
   ```bash
   npx tsx scripts/check-google-token-config.ts
   ```

2. **Test token**:
   ```bash
   npx tsx scripts/test-google-token-live.ts
   ```

3. **Review detailed guide**:
   - See: `GOOGLE_OAUTH_INTERNAL_SETUP_GUIDE.md` for step-by-step instructions

---

## 🎯 Summary

**Problem**: OAuth app in "Testing" mode causes 7-day token expiration  
**Solution**: Publish to "Internal" or "Production" → Generate new token  
**Result**: Permanent refresh token that never expires

**Time Required**: 5-10 minutes  
**Difficulty**: Easy  
**Maintenance**: None (after fix)

---

**Next Steps**: Follow Step 1 and Step 2 above, then verify with the test script.

---

*This guide assumes you already have standard OAuth access approved by Google. If you need to request access or change OAuth app configuration, refer to Google Cloud Console documentation.*

