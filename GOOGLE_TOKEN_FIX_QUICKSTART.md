# ⚡ QUICK START: Fix Google Ads Token (5 Minutes)

**Problem**: Token expires every 7 days  
**Solution**: Change OAuth app to "Internal" → Get permanent token  
**Time**: 5-10 minutes

---

## 📋 CHECKLIST

### ☑️ **PART 1: Google Cloud Console** (3 minutes)

1. [ ] Go to: https://console.cloud.google.com/apis/credentials/consent
2. [ ] Select your project
3. [ ] Click "EDIT APP" (or "Make Internal")
4. [ ] Change **User Type** to **"Internal"**
   - ⚠️ Requires Google Workspace (not personal Gmail)
   - If you can't select Internal, you need to publish to "Production" instead
5. [ ] Click "SAVE"
6. [ ] Verify it says:
   - ✅ User Type: **Internal**
   - ✅ Publishing status: **In production**

---

### ☑️ **PART 2: Generate New Token** (2 minutes)

**Step 1: Generate OAuth URL**

```bash
cd /Users/macbook/piotr
npx tsx scripts/generate-google-oauth-url.ts
```

**Step 2: Complete OAuth Flow**

1. [ ] Copy the URL from output
2. [ ] Paste in browser (incognito window)
3. [ ] Sign in with Google Workspace account
4. [ ] Click "Allow"
5. [ ] Copy the authorization code (looks like: `4/0AdLIrYe...`)

**Step 3: Exchange Code for Token**

```bash
npx tsx scripts/exchange-oauth-code.ts "YOUR_CODE_HERE"
```

Replace `YOUR_CODE_HERE` with the actual code you copied.

---

### ☑️ **PART 3: Verify** (1 minute)

```bash
npx tsx scripts/test-google-token-live.ts
```

**Expected output**:
```
✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅
The Google Ads refresh token is VALID and WORKING!
```

---

## 🎉 DONE!

Your token will now **NEVER expire**.

---

## ❌ TROUBLESHOOTING

### "Can't select Internal"
- You need Google Workspace (business account)
- Personal Gmail won't work
- **Solution**: Use "Production" mode instead (requires Google verification)

### "invalid_client" error
- Client ID/Secret mismatch
- **Solution**: Run `npx tsx scripts/check-google-token-config.ts` to verify

### "redirect_uri_mismatch"
- **Solution**: Add `urn:ietf:wg:oauth:2.0:oob` to authorized redirect URIs in Google Cloud Console

### Token test still fails
- Make sure you completed ALL steps in Part 1
- Verify OAuth consent screen shows "Internal" and "In production"
- Generate a fresh token (old ones won't work)

---

## 📚 DETAILED GUIDE

For step-by-step instructions with screenshots:
- See: `GOOGLE_OAUTH_INTERNAL_SETUP_GUIDE.md`

---

## 🆘 STILL STUCK?

Run diagnostics:
```bash
npx tsx scripts/check-google-token-config.ts
```

This will show you:
- Current token status
- What's stored in database
- Token age
- Validation results

