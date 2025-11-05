# 🔧 FIX: Generate Google Ads Refresh Token - Complete Guide

## 🎯 YOUR GOAL

You need to generate a **Google Ads API refresh token** but getting:
```
Error 403: access_denied
"Hotel Ads Dashboard nie przeszła weryfikacji"
```

**This is different from dashboard login** - you need OAuth access for Google Ads API token generation.

---

## ✅ SOLUTION: Fix Google Cloud OAuth Consent Screen

### Step 1: Find Your Google Cloud Project

**For Google Ads API, you need the project that has:**
- Google Ads API enabled
- OAuth 2.0 credentials created
- Your developer token configured

**How to find it:**

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Look for project with**:
   - Google Ads API enabled
   - Your developer token: `WCX04VxQqB0fsV0YDX0w1g`
   - OAuth credentials for Google Ads

**OR** check your system settings:
```sql
-- In Supabase system_settings table
SELECT * FROM system_settings 
WHERE key LIKE 'google_ads%';
```

---

### Step 2: Go to OAuth Consent Screen

1. **In Google Cloud Console**
2. **Left menu** → **APIs & Services** → **OAuth consent screen**
3. **Select the correct project** (the one with Google Ads API)

---

### Step 3: Configure OAuth Consent Screen (If Not Done)

**If you see "Configure Consent Screen":**

1. **User Type**: Select **"External"**
2. **Click "CREATE"**

3. **App Information**:
   ```
   App name: Hotel Ads Dashboard
   User support email: pbajerlein@gmail.com
   Developer contact email: pbajerlein@gmail.com
   ```
   - Click **"SAVE AND CONTINUE"**

4. **Scopes**:
   - Click **"ADD OR REMOVE SCOPES"**
   - **Manually add scope**:
     ```
     https://www.googleapis.com/auth/adwords
     ```
   - Click **"UPDATE"**
   - Click **"SAVE AND CONTINUE"**

5. **Test Users** ⚠️ **CRITICAL STEP**:
   - Click **"+ ADD USERS"**
   - Enter: `pbajerlein@gmail.com`
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

6. **Summary**:
   - Review everything
   - Click **"BACK TO DASHBOARD"**

---

### Step 4: Verify OAuth Credentials

1. **Go to**: **APIs & Services** → **Credentials**
2. **Find OAuth 2.0 Client ID** (for Google Ads)
3. **Check**:
   - ✅ Client ID exists
   - ✅ Client Secret exists
   - ✅ Authorized redirect URIs configured

**If no credentials exist:**
- Click **"+ CREATE CREDENTIALS"**
- Select **"OAuth client ID"**
- **Application type**: "Web application"
- **Name**: "Google Ads API Client"
- **Authorized redirect URIs**: 
  ```
  http://localhost:3000/api/auth/callback/google-ads
  urn:ietf:wg:oauth:2.0:oob
  ```
- Click **"CREATE"**
- **Save Client ID and Client Secret!**

---

### Step 5: Generate Refresh Token

**Now that OAuth is configured, generate the token:**

#### Option A: Using Your Script

```bash
cd /Users/macbook/piotr
node get-google-ads-refresh-token.js
```

**OR**

```bash
node generate-google-ads-token.js
```

**Follow the prompts:**
1. Enter Client ID (from Step 4)
2. Enter Client Secret (from Step 4)
3. Open the authorization URL in browser
4. Sign in with `pbajerlein@gmail.com` (now it should work!)
5. Grant permissions
6. Copy authorization code
7. Paste code into script
8. Get refresh token ✅

---

#### Option B: Manual Method

1. **Build authorization URL**:
```
https://accounts.google.com/o/oauth2/v2/auth?
client_id=YOUR_CLIENT_ID&
redirect_uri=urn:ietf:wg:oauth:2.0:oob&
scope=https://www.googleapis.com/auth/adwords&
response_type=code&
access_type=offline&
prompt=consent
```

2. **Open in browser** (replace YOUR_CLIENT_ID)
3. **Sign in with**: `pbajerlein@gmail.com`
4. **Grant permissions** (should work now!)
5. **Copy authorization code** from page

6. **Exchange code for token**:
```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=AUTHORIZATION_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
```

7. **Response contains**:
```json
{
  "refresh_token": "1//xxxxx...",
  "access_token": "..."
}
```

**Save the `refresh_token`!**

---

## 🔍 CHECKLIST BEFORE GENERATING TOKEN

Before trying to generate refresh token, verify:

- [ ] ✅ **OAuth consent screen configured**
  - App name set
  - Support email set
  - Scope `https://www.googleapis.com/auth/adwords` added

- [ ] ✅ **Test user added**
  - `pbajerlein@gmail.com` is in test users list
  - Status shows "Testing" mode

- [ ] ✅ **OAuth credentials exist**
  - Client ID available
  - Client Secret available
  - Redirect URIs configured

- [ ] ✅ **Google Ads API enabled**
  - In APIs & Services → Library
  - Google Ads API is enabled

---

## ⚠️ IMPORTANT NOTES

### Why You Need Test User

**Your OAuth app is in "Testing" mode** because:
- Google Ads API requires verification for production
- Testing mode allows only approved test users
- `pbajerlein@gmail.com` must be in test users list

### After Adding Test User

**Wait 1-2 minutes** for changes to propagate, then:
1. Try generating refresh token again
2. Google Sign-In should work
3. You'll get authorization code
4. Exchange code for refresh token ✅

---

## 🚀 QUICK START

**Fastest way to generate token:**

1. **Add test user** (2 minutes):
   - Google Cloud Console → OAuth consent screen
   - Test users → Add `pbajerlein@gmail.com`
   - Save

2. **Wait 1-2 minutes**

3. **Run your token script**:
   ```bash
   node get-google-ads-refresh-token.js
   ```

4. **Follow prompts**:
   - Opens browser
   - Sign in with `pbajerlein@gmail.com`
   - Should work now! ✅
   - Copy code
   - Get refresh token

---

## 📝 WHERE TO SAVE REFRESH TOKEN

**After generating, save to**:

1. **System Settings** (for manager account):
   ```sql
   UPDATE system_settings
   SET value = 'YOUR_REFRESH_TOKEN'
   WHERE key = 'google_ads_manager_refresh_token';
   ```

2. **Or client record** (for client-specific):
   ```sql
   UPDATE clients
   SET google_ads_refresh_token = 'YOUR_REFRESH_TOKEN'
   WHERE email = 'pbajerlein@gmail.com';
   ```

---

## ✅ SUMMARY

**To generate Google Ads refresh token:**

1. ✅ Add `pbajerlein@gmail.com` as test user in Google Cloud Console
2. ✅ Wait 1-2 minutes
3. ✅ Run token generation script
4. ✅ Sign in with Google (should work now!)
5. ✅ Get refresh token
6. ✅ Save to database

**The key fix**: Adding yourself as test user allows Google OAuth to work! 🎉

---

**Need help with any specific step?** Let me know!



