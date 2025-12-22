# Google OAuth Setup - Step by Step Guide

**What You Need**: OAuth 2.0 Client ID and Client Secret  
**Time Required**: 15 minutes  
**Current Status**: Token approved, just need OAuth credentials

---

## 🎯 What You're Getting

You need two pieces of information from Google Cloud Console:

1. **OAuth Client ID** - Looks like: `123456789-abc123xyz.apps.googleusercontent.com`
2. **OAuth Client Secret** - Looks like: `GOCSPX-abc123xyz789`

These allow your app to authenticate with Google Ads API on behalf of users.

---

## 📋 Step-by-Step Instructions

### STEP 1: Go to Google Cloud Console

1. Open your browser and go to: **https://console.cloud.google.com/**
2. Sign in with your Google account (the one managing Google Ads)
3. If you have multiple projects, select your project (or create a new one)

---

### STEP 2: Enable Google Ads API

1. In the left menu, click **"APIs & Services"** → **"Library"**
2. In the search box, type: **"Google Ads API"**
3. Click on **"Google Ads API"**
4. Click the blue **"ENABLE"** button
5. Wait for confirmation (takes 5-10 seconds)

✅ **Checkpoint**: You should see "API enabled" message

---

### STEP 3: Configure OAuth Consent Screen

This is required before creating credentials.

1. In the left menu, go to **"APIs & Services"** → **"OAuth consent screen"**

2. **Choose User Type:**
   - Select **"External"** (unless you have a Google Workspace account)
   - Click **"CREATE"**

3. **Fill out App Information:**
   ```
   App name: Hotel Ads Dashboard
   User support email: [Your email]
   Developer contact email: [Your email]
   ```
   - Leave other fields as default
   - Click **"SAVE AND CONTINUE"**

4. **Add Scopes:**
   - Click **"ADD OR REMOVE SCOPES"**
   - In the filter box, search for: `adwords`
   - Check the box for: `https://www.googleapis.com/auth/adwords`
   - Click **"UPDATE"**
   - Click **"SAVE AND CONTINUE"**

5. **Add Test Users (Important!):**
   - Click **"+ ADD USERS"**
   - Enter your email address (the one managing Google Ads)
   - Click **"ADD"**
   - Click **"SAVE AND CONTINUE"**

6. **Review and Confirm:**
   - Review your settings
   - Click **"BACK TO DASHBOARD"**

✅ **Checkpoint**: OAuth consent screen is configured

---

### STEP 4: Create OAuth 2.0 Credentials

Now we'll get your Client ID and Secret.

1. In the left menu, go to **"APIs & Services"** → **"Credentials"**

2. Click the **"+ CREATE CREDENTIALS"** button at the top

3. Select **"OAuth client ID"**

4. **Configure the OAuth client:**
   
   **Application type:** Select **"Web application"**
   
   **Name:** `Google Ads API Client`
   
   **Authorized redirect URIs:** Add these URLs:
   ```
   http://localhost:3000/api/auth/callback/google-ads
   https://your-production-domain.com/api/auth/callback/google-ads
   ```
   (Replace `your-production-domain.com` with your actual domain)
   
   Click **"CREATE"**

5. **Save Your Credentials!**
   
   A popup will appear with your credentials:
   
   ```
   Your Client ID:     [Long string ending in .apps.googleusercontent.com]
   Your Client Secret: [String starting with GOCSPX-]
   ```
   
   **⚠️ IMPORTANT**: Copy both of these NOW! You'll need them in the next step.

✅ **Checkpoint**: You have Client ID and Client Secret copied

---

### STEP 5: Add Credentials to Your Database

Now we'll add these to your app's database.

**Option A: Using the Script (Recommended)**

```bash
cd /Users/macbook/piotr
node scripts/update-google-oauth-credentials.js
```

When prompted:
1. Type `yes` and press Enter
2. Paste your **Client ID** and press Enter
3. Paste your **Client Secret** and press Enter

**Option B: Manual Database Update**

If you prefer to update directly in Supabase:

1. Go to your Supabase dashboard
2. Navigate to **Table Editor** → **system_settings**
3. Find the row where `key = 'google_ads_client_id'`
4. Click to edit, paste your Client ID in the `value` column
5. Find the row where `key = 'google_ads_client_secret'`
6. Click to edit, paste your Client Secret in the `value` column
7. Click **Save**

✅ **Checkpoint**: Credentials are in database

---

### STEP 6: Generate Refresh Token

You need a refresh token to make API calls. Use Google's OAuth Playground:

1. Go to: **https://developers.google.com/oauthplayground/**

2. Click the **⚙️ (gear icon)** in the top right

3. Check the box: **"Use your own OAuth credentials"**

4. Enter your credentials:
   ```
   OAuth Client ID:     [Paste your Client ID]
   OAuth Client Secret: [Paste your Client Secret]
   ```
   
5. Close the settings

6. In the left panel, find **"Google Ads API v17"**
   - Scroll down or use search to find it
   - Check the box for: `https://www.googleapis.com/auth/adwords`

7. Click the blue button: **"Authorize APIs"**

8. **Sign in with your Google Ads account**
   - Choose the Google account that manages your Google Ads
   - Click **"Continue"** on the warning screen (it's safe - it's your own app)
   - Click **"Allow"** to grant permissions

9. You'll be redirected back to OAuth Playground
   - Click the blue button: **"Exchange authorization code for tokens"**

10. **Copy the Refresh Token**
    - You'll see a response with `refresh_token`
    - Copy the entire refresh token value

11. **Save Refresh Token to Database**

    **Using Terminal:**
    ```bash
    # Connect to Supabase and run this SQL
    UPDATE system_settings 
    SET value = 'YOUR_REFRESH_TOKEN_HERE'
    WHERE key = 'google_ads_manager_refresh_token';
    ```
    
    Or update directly in Supabase dashboard:
    - Go to **system_settings** table
    - Find `google_ads_manager_refresh_token`
    - Paste your refresh token in the `value` column

✅ **Checkpoint**: Refresh token is saved

---

### STEP 7: Verify Everything Works

Test that your OAuth setup is complete:

```bash
cd /Users/macbook/piotr
node scripts/test-google-ads-production-ready.js
```

**Expected Result:**
```
✅ Tests Passed: 24/24
Success Rate: 100%
🎉 PRODUCTION READY!
```

If you see any errors, check:
- Client ID is correct
- Client Secret is correct
- Refresh token is correct
- All values are saved in the database

---

### STEP 8: Test Belmonte Data Fetching

Verify that data fetching works:

```bash
node scripts/test-belmonte-google-ads-fetch.js
```

**Expected Result:**
```
✅ Tests Passed: 9/9
Success Rate: 100%
🎉 ALL TESTS PASSED!
```

---

### STEP 9: Trigger Data Collection

Now collect fresh data for October:

**Option A: Via API (if deployed)**
```bash
curl -X POST https://your-domain.com/api/cron/collect-google-ads-data \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Option B: Via Supabase Edge Function**
- Go to your Supabase dashboard
- Navigate to Edge Functions
- Trigger the Google Ads data collection function

**Option C: Wait for Automatic Collection**
- Your cron jobs are configured to run daily at 2 AM
- Wait until tomorrow morning and data will be collected automatically

---

## 🎉 You're Done!

After completing these steps:

✅ OAuth 2.0 credentials configured  
✅ Refresh token generated  
✅ All tests passing at 100%  
✅ Data collection enabled  
✅ Production ready!

---

## 📝 Quick Reference

### What You Created:

1. **OAuth Client ID** - Stored in: `system_settings.google_ads_client_id`
2. **OAuth Client Secret** - Stored in: `system_settings.google_ads_client_secret`
3. **Refresh Token** - Stored in: `system_settings.google_ads_manager_refresh_token`

### Test Commands:

```bash
# Check production readiness
node scripts/test-google-ads-production-ready.js

# Test Belmonte data
node scripts/test-belmonte-google-ads-fetch.js

# View current settings
node scripts/update-google-oauth-credentials.js --show
```

---

## 🆘 Troubleshooting

### Error: "invalid_client"
- Check that Client ID and Secret are copied correctly
- No extra spaces or characters

### Error: "invalid_grant"
- Refresh token may have expired
- Generate a new refresh token (repeat Step 6)

### Error: "DEVELOPER_TOKEN_NOT_ON_ALLOWLIST"
- Token activation may take 1-2 hours after approval
- Wait and try again

### Error: "redirect_uri_mismatch"
- Add your redirect URI in Google Cloud Console
- Must exactly match (including http/https)

---

## 🔒 Security Notes

- **Never share** your Client Secret or Refresh Token
- Store credentials only in your secure database
- Use environment variables for local development
- Enable HTTPS for all redirect URIs in production

---

**Next Action**: Go to Step 1 and start the OAuth setup!  
**Time Required**: 15 minutes  
**Difficulty**: Easy (just follow the steps)

**You've got this!** 🚀











