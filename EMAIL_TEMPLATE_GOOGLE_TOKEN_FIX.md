# 📧 Email Template: Google Ads Token Fix Instructions

---

**Subject**: Fix Google Ads Refresh Token - Standard Access Setup

---

**Body**:

Hi,

Your Google Ads OAuth integration has **standard access** (approved by Google), but refresh tokens are expiring every 7 days because the OAuth consent screen is still in "Testing" mode. Here's how to fix it:

## Quick Fix (5 Minutes)

### 1. Update OAuth Consent Screen

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Select your project
3. Change **Publishing status** from "Testing" to:
   - **"Internal"** (if you have Google Workspace) - Recommended, immediate
   - **"In production"** (if using personal Gmail) - May need verification
4. Click **"PUBLISH APP"** or **"Make Internal"**
5. Verify it shows: **"Publishing status: In production"**

### 2. Generate New Refresh Token

Your current token expired (8 days old). Generate a fresh one:

**Step 1 - Generate OAuth URL**:
```bash
cd /Users/macbook/piotr
npx tsx scripts/generate-google-oauth-url.ts
```

**Step 2 - Complete OAuth Flow**:
1. Copy the URL from output
2. Open in browser (incognito window)
3. Sign in with your Google account
4. Click "Allow"
5. Copy the authorization code shown

**Step 3 - Exchange for Token**:
```bash
npx tsx scripts/exchange-oauth-code.ts "YOUR_CODE_HERE"
```

**Step 4 - Verify**:
```bash
npx tsx scripts/test-google-token-live.ts
```

Should see: `✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅`

## What This Fixes

**Before**: Tokens expire every 7 days → Manual regeneration needed  
**After**: Tokens never expire → Zero maintenance

## Current Status

- ✅ Standard OAuth access: Approved
- ✅ Client credentials: Configured
- ❌ Refresh token: Expired (needs regeneration)
- ⚠️ OAuth app: Still in "Testing" mode (needs publishing)

## Verification

After completing the steps:
- [ ] OAuth consent screen shows "In production"
- [ ] New token generated and saved
- [ ] Token test passes
- [ ] Dashboard displays current data

## Troubleshooting

**"Can't publish app"**: 
- If using personal Gmail, you may need Google verification (1-2 weeks)
- Alternative: Use "Internal" mode with Google Workspace

**"invalid_client" error**:
- Verify Client ID/Secret match in database and Google Cloud Console
- Run: `npx tsx scripts/check-google-token-config.ts`

**Token test fails**:
- Make sure OAuth consent screen actually shows "In production"
- Generate a completely fresh token

## Files Created

I've created these helper scripts:
- `scripts/generate-google-oauth-url.ts` - Generates OAuth URL
- `scripts/exchange-oauth-code.ts` - Exchanges code for token
- `scripts/test-google-token-live.ts` - Tests token validity

## Detailed Guide

For step-by-step instructions with screenshots:
- See: `GOOGLE_OAUTH_INTERNAL_SETUP_GUIDE.md`

---

**Time Required**: 5-10 minutes  
**Result**: Permanent refresh token that never expires

Let me know if you need any clarification!

---







