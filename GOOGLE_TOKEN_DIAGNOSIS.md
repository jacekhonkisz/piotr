# 🚨 GOOGLE ADS TOKEN ISSUE - DIAGNOSIS & SOLUTION

**Date**: November 12, 2025  
**Issue**: Refresh token invalid (`invalid_grant: Token has been expired or revoked`)  
**Token Age**: 8 days (created November 4, 2025)

---

## 🔍 ROOT CAUSE

Your Google OAuth application is likely in **"Testing"** publishing status, which causes refresh tokens to **expire after 7 days**.

### Evidence:
1. ✅ Token was updated 8 days ago (November 4th)
2. ✅ Token format is correct (103 chars, proper format)
3. ❌ Google returns `invalid_grant` error
4. ⏰ **8 days > 7 days** → Token expired!

---

## 🎯 THE PROBLEM: "Testing" vs "Production" OAuth Apps

### Testing Status (Current):
- ❌ Refresh tokens expire after **7 days**
- ❌ Tokens need to be regenerated weekly
- ⚠️ Max 100 test users
- ⚠️ OAuth consent shows "Unverified app" warning

### Production Status (Needed):
- ✅ Refresh tokens **NEVER expire**
- ✅ No need to regenerate
- ✅ Unlimited users
- ✅ No "Unverified app" warning

---

## 🔧 SOLUTION: Publish OAuth App to Production

### Step 1: Check Current Status

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to: **APIs & Services → OAuth consent screen**
4. Check **Publishing status**:
   - If it says **"Testing"** → You need to publish
   - If it says **"In production"** → Something else is wrong

### Step 2: Publish to Production

#### Option A: **For Internal Use Only** (Easiest)

If you only need this for your organization:

1. On OAuth consent screen, select **"Internal"** user type
2. This automatically makes tokens permanent
3. No verification needed from Google
4. ✅ Best option for most SaaS apps

#### Option B: **For External Users** (More Complex)

If you need external users to connect their Google Ads accounts:

1. Change **Publishing status** to **"In production"**
2. You'll need to submit for verification if using sensitive scopes
3. Verification can take 1-2 weeks
4. Required scopes for Google Ads API:
   - `https://www.googleapis.com/auth/adwords`

### Step 3: Regenerate Refresh Token

After publishing:

1. **Revoke old token** (it's already expired anyway)
2. **Generate new token** via OAuth flow
3. **Save new token** to database
4. ✅ **New token will never expire**

---

## 🚀 QUICK FIX (Temporary - 7 days)

If you can't publish to production immediately:

### Regenerate Token for Another 7 Days

1. Go to your OAuth flow URL
2. Complete authentication
3. Get new refresh token
4. Update database:

```sql
UPDATE system_settings 
SET value = 'YOUR_NEW_TOKEN_HERE',
    updated_at = NOW()
WHERE key = 'google_ads_manager_refresh_token';
```

⚠️ **WARNING**: This only works for 7 more days. You'll need to repeat this every week until you publish to production.

---

## 📊 HOW TO VERIFY STATUS

### Check OAuth App Status:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services → OAuth consent screen**
3. Look for:

```
Publishing status: Testing
⚠️ Your app is currently being tested
```

**If you see this**: Your tokens expire every 7 days!

### What "Production" Looks Like:

```
Publishing status: In production
✅ Your app is published
```

**If you see this**: Tokens are permanent!

---

## 🎯 RECOMMENDED SOLUTION

### For Your SaaS App:

**Use "Internal" OAuth App Type**

1. **Pros**:
   - ✅ Tokens never expire
   - ✅ No verification needed
   - ✅ Immediate activation
   - ✅ Perfect for B2B SaaS

2. **Setup**:
   - OAuth consent screen → User type: **"Internal"**
   - Add your workspace domain
   - All users in your workspace can authenticate
   - Tokens are permanent from day 1

3. **Use Cases**:
   - ✅ Your agency managing client accounts
   - ✅ Internal tools
   - ✅ SaaS apps for specific organizations

### Why This Works:

For a Google Ads management SaaS:
- You (the agency/SaaS) authenticate ONCE with your manager account
- You manage client accounts via manager account access
- Clients don't need to authenticate individually
- → **"Internal" is perfect for this use case**

---

## 🔍 OTHER POSSIBLE CAUSES (Less Likely)

If publishing to production doesn't fix it:

### 1. Token for Wrong OAuth Client
- Check that Client ID in database matches the one in Google Cloud Console
- Verify you're not mixing dev/staging/prod credentials

### 2. OAuth App Deleted/Modified
- Someone might have deleted/recreated the OAuth client
- This invalidates all existing tokens

### 3. User Revoked Access
- Check Google account settings: "Apps with access to your account"
- Revoke and re-authorize if needed

### 4. Scopes Changed
- If you modified required scopes, old tokens become invalid
- Need to regenerate with new scopes

---

## ✅ VERIFICATION AFTER FIX

Run this command to test:

```bash
npx tsx scripts/test-google-token-live.ts
```

Expected output:
```
✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅
The Google Ads refresh token is VALID and WORKING!
```

---

## 📋 ACTION ITEMS

### Immediate (Today):
1. [ ] Check OAuth app publishing status in Google Cloud Console
2. [ ] If "Testing" → Change to "Internal" or publish to production
3. [ ] Regenerate refresh token after publishing
4. [ ] Update database with new token
5. [ ] Run test script to verify

### Verification:
1. [ ] Run `npx tsx scripts/test-google-token-live.ts`
2. [ ] Confirm all tests pass
3. [ ] Check smart cache can refresh
4. [ ] Verify dashboard displays current data

---

## 🎓 UNDERSTANDING GOOGLE OAUTH

### Token Types:

1. **Authorization Code**: One-time use, expires in minutes
2. **Access Token**: Short-lived (1 hour), for API calls
3. **Refresh Token**: Long-lived, gets new access tokens

### Refresh Token Expiration:

| OAuth App Status | Refresh Token Lifespan |
|-----------------|------------------------|
| Testing | ❌ 7 days (expired) |
| Production | ✅ Never expires* |
| Internal | ✅ Never expires |

*Unless revoked by user or admin

### Your Situation:

```
Token created: Nov 4, 2025 (8 days ago)
OAuth status: Testing (7-day expiry)
Result: Token expired Nov 11, 2025
Error: invalid_grant
```

---

## 🎉 EXPECTED OUTCOME

After fixing:

1. ✅ **Permanent token** - No more weekly regeneration
2. ✅ **Smart cache works** - Auto-refresh every 3 hours
3. ✅ **Live API calls work** - Data always up-to-date
4. ✅ **Dashboard accurate** - Current period data displays correctly
5. ✅ **Production ready** - No maintenance required

---

**Next Step**: Check OAuth app status in Google Cloud Console and publish to production (or change to Internal).


