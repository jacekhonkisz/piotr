# 🔐 GOOGLE OAUTH INTERNAL APP SETUP - STEP BY STEP

**Goal**: Configure OAuth app as "Internal" to get **permanent refresh tokens** that never expire.

**Time Required**: 10-15 minutes  
**Difficulty**: Easy  
**Result**: Refresh token that never expires ✅

---

## 📋 PREREQUISITES

Before you start, gather this information:

1. ✅ Google Cloud Project ID (where your OAuth app is)
2. ✅ Google Workspace domain (e.g., `yourcompany.com`)
3. ✅ Admin access to Google Cloud Console
4. ✅ Admin access to Google Workspace (may be needed)

---

## 🚀 STEP 1: ACCESS GOOGLE CLOUD CONSOLE

### 1.1 Open Google Cloud Console

1. Go to: **https://console.cloud.google.com/**
2. Sign in with your Google account (the one with admin access)
3. You should see your project dashboard

### 1.2 Select Your Project

If you have multiple projects:

1. Click the **project dropdown** at the top (next to "Google Cloud")
2. Find and select the project that has your OAuth credentials
   - Look for project name or ID
   - It's the same project where you created OAuth Client ID

**💡 Tip**: If you don't remember which project:
- Check your `.env` file for `google_ads_client_id`
- Go to: APIs & Services → Credentials
- Find a project that has OAuth 2.0 Client ID starting with your client ID

---

## 🔧 STEP 2: NAVIGATE TO OAUTH CONSENT SCREEN

### 2.1 Open the Menu

1. Click the **☰ hamburger menu** (top-left, three horizontal lines)
2. Scroll down to **"APIs & Services"**
3. Click **"OAuth consent screen"**

**Direct link**: https://console.cloud.google.com/apis/credentials/consent

### 2.2 Current Status Check

You should see a page with:
- **User Type**: Currently set to "External" (most likely)
- **Publishing status**: "Testing" (this is why tokens expire!)
- **App information**: Your app name, logo, etc.

**Screenshot points**:
- Look for a banner saying "Testing" or "Your app is currently being tested"
- This confirms the 7-day expiration issue

---

## 🎯 STEP 3: CHANGE TO INTERNAL USER TYPE

### 3.1 Check if You Can Use Internal

**Requirements for Internal:**
- ✅ You must have a **Google Workspace** account
- ✅ You must be using a Workspace domain (not @gmail.com)
- ✅ Your organization domain must be verified in Workspace

**⚠️ IMPORTANT**: If you're using a personal Gmail account (@gmail.com), you **CANNOT** use "Internal" type. Skip to Option 2 (Production) instead.

### 3.2 Change User Type to Internal

**Method A: If you can edit User Type directly**

1. On the OAuth consent screen page, look for **"User Type"** section
2. Click **"EDIT APP"** or "Make Internal" button
3. Select **"Internal"** radio button
4. Click **"SAVE"** or "CREATE"

**Method B: If you need to start over**

If you can't edit the user type (it's locked):

1. **⚠️ WARNING**: This will reset your OAuth consent screen
2. Scroll to the bottom
3. Click **"DELETE APP"** (don't worry, this only deletes the consent config, not your credentials)
4. Confirm deletion
5. Now click **"CREATE"** to start fresh
6. Select **"Internal"** user type
7. Click **"CREATE"**

### 3.3 Verify Internal Status

After changing:

1. You should see **"User Type: Internal"**
2. You should see **"Publishing status: In production"** (automatic for Internal)
3. No more "Testing" warnings!

**✅ Success indicator**: The page says "Internal" and no expiration warnings appear.

---

## 📝 STEP 4: CONFIGURE APP INFORMATION

If you're creating fresh or editing:

### 4.1 App Information Page

Fill in these fields:

```
App name: Your SaaS Name (e.g., "Meta Ads Reporting SaaS")
User support email: your@workspace-domain.com
App logo: (optional, upload your logo)
App domain: yourdomain.com (your SaaS domain)
```

**Authorized domains**: Add your domain(s):
- `yourdomain.com`
- Any other domains your app uses

Click **"SAVE AND CONTINUE"**

### 4.2 Scopes Page

Add required scopes for Google Ads API:

1. Click **"ADD OR REMOVE SCOPES"**
2. In the filter/search box, type: `adwords`
3. Select: **`https://www.googleapis.com/auth/adwords`**
4. Click **"UPDATE"**
5. Click **"SAVE AND CONTINUE"**

**💡 Tip**: You may already have this scope if you set it up before. Just verify it's there.

### 4.3 Summary Page

1. Review your settings
2. Everything should show:
   - User Type: **Internal**
   - Publishing status: **In production** ✅
3. Click **"BACK TO DASHBOARD"**

---

## 🔑 STEP 5: VERIFY OAuth CLIENT CREDENTIALS

### 5.1 Go to Credentials Page

1. In the same menu, click **"Credentials"** (above "OAuth consent screen")
2. Look for **"OAuth 2.0 Client IDs"** section
3. Find your OAuth client (should match your `google_ads_client_id`)

**Direct link**: https://console.cloud.google.com/apis/credentials

### 5.2 Verify Client ID and Secret

1. Click on your OAuth client name
2. You should see:
   - **Client ID**: Should start with your project number (e.g., `775089813...`)
   - **Client secret**: Your secret key
3. **⚠️ IMPORTANT**: These should match what's in your database!

**Check if they match**:
```
Database Client ID:     77508981337-7kkho8u7mkfs3b2huojbmjt2mi236fps.apps.googleusercontent.com
Google Cloud Client ID: Should be EXACTLY the same
```

If they **don't match**, you have the wrong OAuth client! You'll need to find the correct one or create a new one.

### 5.3 Verify Authorized Redirect URIs

Make sure your callback URL is listed:

```
https://yourdomain.com/api/auth/google-ads/callback
```

Or whatever redirect URI your app uses.

If missing, add it:
1. Click **"ADD URI"**
2. Enter your redirect URI
3. Click **"SAVE"**

---

## 🔄 STEP 6: GENERATE NEW REFRESH TOKEN

Now you need a fresh token (old one is expired).

### 6.1 Prepare OAuth URL

You need to construct an OAuth authorization URL. Here's the template:

```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_CLIENT_ID
  &redirect_uri=YOUR_REDIRECT_URI
  &response_type=code
  &scope=https://www.googleapis.com/auth/adwords
  &access_type=offline
  &prompt=consent
```

**💡 Easier way**: Create a script to generate this URL.

### 6.2 Create Token Generation Script

I'll create a script for you:

**File**: `scripts/generate-google-oauth-url.ts`

```typescript
#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateOAuthURL() {
  // Get credentials from database
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id']);

  const clientId = settings?.find(s => s.key === 'google_ads_client_id')?.value;

  if (!clientId) {
    console.error('❌ Client ID not found in database');
    process.exit(1);
  }

  const redirectUri = 'urn:ietf:wg:oauth:2.0:oob'; // For manual token copy
  const scope = 'https://www.googleapis.com/auth/adwords';

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  console.log('\n🔐 GOOGLE ADS OAUTH AUTHORIZATION\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log('📋 INSTRUCTIONS:\n');
  console.log('1. Copy the URL below');
  console.log('2. Paste it in your browser');
  console.log('3. Sign in with your Google Workspace account');
  console.log('4. Grant permissions');
  console.log('5. Copy the authorization code');
  console.log('6. Run the exchange script with the code\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log('🔗 AUTHORIZATION URL:\n');
  console.log(authUrl);
  console.log('\n═══════════════════════════════════════════════════════════════════════════════\n');
}

generateOAuthURL();
```

**Run it**:
```bash
npx tsx scripts/generate-google-oauth-url.ts
```

### 6.3 Complete OAuth Flow

1. **Copy the URL** from the script output
2. **Paste in browser** (use an incognito/private window)
3. **Sign in** with your Google Workspace account (the one with Google Ads access)
4. You'll see a consent screen:
   - App name: Your app name
   - Requesting permission to: "View and manage your Google Ads"
   - **Important**: Should NOT say "unverified app" anymore (because it's Internal)
5. Click **"Allow"**
6. You'll see a page with an **authorization code**
7. **Copy the entire code** (it's long, like `4/0AdLIrYe...`)

### 6.4 Exchange Code for Refresh Token

Create another script to exchange the code:

**File**: `scripts/exchange-oauth-code.ts`

```typescript
#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function exchangeCode(authCode: string) {
  console.log('\n🔄 EXCHANGING AUTHORIZATION CODE FOR REFRESH TOKEN\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Get credentials
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['google_ads_client_id', 'google_ads_client_secret']);

  const clientId = settings?.find(s => s.key === 'google_ads_client_id')?.value;
  const clientSecret = settings?.find(s => s.key === 'google_ads_client_secret')?.value;

  if (!clientId || !clientSecret) {
    console.error('❌ Credentials not found');
    process.exit(1);
  }

  console.log('📤 Sending request to Google...\n');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: authCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      grant_type: 'authorization_code'
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Token exchange failed:', data);
    process.exit(1);
  }

  console.log('✅ SUCCESS! Tokens received\n');
  console.log('📊 Token Information:\n');
  console.log(`   Access Token: ${data.access_token.substring(0, 20)}...`);
  console.log(`   Refresh Token: ${data.refresh_token.substring(0, 20)}...`);
  console.log(`   Token Type: ${data.token_type}`);
  console.log(`   Expires In: ${data.expires_in} seconds\n`);

  console.log('💾 Saving to database...\n');

  const { error } = await supabase
    .from('system_settings')
    .update({ 
      value: data.refresh_token,
      updated_at: new Date().toISOString()
    })
    .eq('key', 'google_ads_manager_refresh_token');

  if (error) {
    console.error('❌ Database update failed:', error);
    console.log('\n📋 MANUAL UPDATE REQUIRED:\n');
    console.log('Run this SQL:');
    console.log(`UPDATE system_settings SET value = '${data.refresh_token}' WHERE key = 'google_ads_manager_refresh_token';`);
    process.exit(1);
  }

  console.log('✅ Refresh token saved to database!\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  console.log('🎉 SETUP COMPLETE!\n');
  console.log('Your refresh token is now permanent and will never expire.\n');
  console.log('Next steps:');
  console.log('1. Run: npx tsx scripts/test-google-token-live.ts');
  console.log('2. Verify all tests pass');
  console.log('3. Check dashboard displays current data\n');
}

// Get auth code from command line argument
const authCode = process.argv[2];

if (!authCode) {
  console.error('❌ Missing authorization code');
  console.log('\nUsage:');
  console.log('  npx tsx scripts/exchange-oauth-code.ts YOUR_AUTH_CODE\n');
  process.exit(1);
}

exchangeCode(authCode);
```

**Run it with your code**:
```bash
npx tsx scripts/exchange-oauth-code.ts "4/0AdLIrYe...YOUR_CODE_HERE"
```

---

## ✅ STEP 7: VERIFY NEW TOKEN WORKS

### 7.1 Run Token Test

```bash
npx tsx scripts/test-google-token-live.ts
```

**Expected output**:
```
✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅
The Google Ads refresh token is VALID and WORKING!
🎉 Token is a valid production token
```

### 7.2 Check Token Age

```bash
npx tsx scripts/check-google-token-config.ts
```

You should see:
```
📅 Token age: 0 days
✅ Token was updated within the last week (0 days ago)
```

### 7.3 Verify Smart Cache Can Refresh

The smart cache should now be able to auto-refresh. Check:

```bash
# Check current cache age
# It should refresh automatically within 3 hours
```

---

## 🎉 STEP 8: VERIFY IN DASHBOARD

### 8.1 Refresh Your Dashboard

1. Open your app: `http://localhost:3000` (or your domain)
2. Navigate to Belmonte client
3. Check current month/week data
4. Data should display correctly

### 8.2 Check Logs

In your terminal (where dev server is running), you should see:

```
✅ RETURNING fresh Google Ads cached data
Cache age: X minutes
```

No more `invalid_grant` errors!

---

## 📋 TROUBLESHOOTING

### Issue 1: "Can't select Internal user type"

**Problem**: The "Internal" option is greyed out or not available.

**Cause**: You're not using a Google Workspace account.

**Solution**: 
- You must use a Google Workspace (formerly G Suite) account
- Personal Gmail accounts can't use "Internal"
- Alternative: Use Option 2 (Publish to Production)

---

### Issue 2: "invalid_client error"

**Problem**: Getting `invalid_client` when exchanging code.

**Cause**: Client ID or Secret doesn't match.

**Solution**:
1. Verify credentials in Google Cloud Console
2. Check database values match exactly:
```bash
npx tsx scripts/check-google-token-config.ts
```
3. Update database if needed

---

### Issue 3: "redirect_uri_mismatch"

**Problem**: OAuth flow fails with redirect URI mismatch.

**Cause**: Redirect URI not authorized in OAuth client.

**Solution**:
1. Go to: APIs & Services → Credentials
2. Click your OAuth client
3. Add `urn:ietf:wg:oauth:2.0:oob` to Authorized redirect URIs
4. Click Save

---

### Issue 4: "access_denied error"

**Problem**: User denied access or app isn't verified.

**Cause**: Wrong account or app needs admin approval.

**Solution**:
1. Make sure you're signed in with the correct Google Workspace account
2. Make sure that account has Google Ads access
3. If using manager account, use the manager account email

---

### Issue 5: "Token still expires"

**Problem**: Token expires even after setting to Internal.

**Cause**: User Type wasn't actually changed, still in Testing.

**Solution**:
1. Go back to OAuth consent screen
2. Verify it says **"User Type: Internal"**
3. Verify it says **"Publishing status: In production"**
4. If not, delete and recreate consent config as Internal

---

## 🎓 WHAT YOU JUST ACCOMPLISHED

✅ **Before**:
- Tokens expired every 7 days
- Had to regenerate weekly
- Smart cache couldn't refresh automatically
- Manual maintenance required

✅ **After**:
- Token **NEVER expires** (permanent)
- No regeneration needed
- Smart cache auto-refreshes every 3 hours
- Zero maintenance required
- Production ready

---

## 📊 FINAL CHECKLIST

Before closing this guide, verify:

- [ ] OAuth consent screen shows "Internal" user type
- [ ] OAuth consent screen shows "In production" status
- [ ] New refresh token generated and saved to database
- [ ] Token test script passes all tests
- [ ] Dashboard displays current data correctly
- [ ] No `invalid_grant` errors in logs
- [ ] Smart cache age is recent (< 3 hours)

---

## 🆘 NEED HELP?

If you're stuck:

1. **Check Google Cloud Console status**:
   - https://console.cloud.google.com/apis/credentials/consent
   - Verify "Internal" and "In production"

2. **Run diagnostics**:
   ```bash
   npx tsx scripts/check-google-token-config.ts
   npx tsx scripts/test-google-token-live.ts
   ```

3. **Check logs**:
   - Look for specific error messages
   - Google the exact error for solutions

4. **Google Ads API Documentation**:
   - https://developers.google.com/google-ads/api/docs/oauth/overview

---

**🎉 Congratulations!** You now have a permanent Google Ads refresh token that will never expire!



