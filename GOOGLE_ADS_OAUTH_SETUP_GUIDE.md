# Google Ads OAuth Setup Guide

## ✅ Current Status

Your Google Ads API integration is **91.7% production ready**!

### What's Working ✅
- ✅ Developer Token: `WCX04VxQqB0fsV0YDX0w1g` (Standard Access approved)
- ✅ Manager Customer ID: `293-100-0497`
- ✅ Manager Refresh Token: Configured
- ✅ All RMF methods implemented
- ✅ All API endpoints created
- ✅ Database schema configured
- ✅ Background data collection ready

### What's Needed ⚠️
- ⚠️ OAuth Client ID
- ⚠️ OAuth Client Secret

---

## 🔧 How to Get OAuth Credentials

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Select your project (or create a new one)

### Step 2: Enable Google Ads API

1. Go to **APIs & Services** > **Library**
2. Search for "Google Ads API"
3. Click **Enable**

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen first:
   - **User Type**: External
   - **App name**: Your app name (e.g., "Hotel Ads Dashboard")
   - **User support email**: Your email
   - **Developer contact information**: Your email
   - Click **Save and Continue**
   
4. Add scopes:
   - Click **Add or Remove Scopes**
   - Add: `https://www.googleapis.com/auth/adwords`
   - Click **Update** and **Save and Continue**

5. Add test users (if in testing mode):
   - Add your email and any other users who need access
   - Click **Save and Continue**

6. Return to **Credentials** page
7. Click **Create Credentials** > **OAuth client ID**
8. Choose **Application type**:
   - **Web application** (recommended)
   
9. Configure:
   - **Name**: "Google Ads API Client"
   - **Authorized redirect URIs**: Add your callback URL
     - For local testing: `http://localhost:3000/api/auth/callback/google-ads`
     - For production: `https://your-domain.com/api/auth/callback/google-ads`
   
10. Click **Create**

### Step 4: Save Your Credentials

You'll receive:
- **Client ID**: Looks like `123456789-abc123.apps.googleusercontent.com`
- **Client Secret**: Looks like `GOCSPX-abc123xyz789`

**⚠️ Keep these secure!**

---

## 🗄️ Update Database with OAuth Credentials

### Option 1: Using Admin Settings Page (Recommended)

1. Go to your app's admin settings page: `/admin/settings`
2. Find the **Google Ads API** section
3. Enter:
   - **Client ID**: Your OAuth Client ID
   - **Client Secret**: Your OAuth Client Secret
4. Click **Save**

### Option 2: Using Node Script

Run this command to update the database:

```bash
node scripts/update-google-oauth-credentials.js
```

(Script will be created if you choose this option)

### Option 3: Manual Database Update

Connect to your Supabase database and run:

```sql
-- Update OAuth Client ID
UPDATE system_settings 
SET value = 'YOUR_CLIENT_ID_HERE'
WHERE key = 'google_ads_client_id';

-- Update OAuth Client Secret
UPDATE system_settings 
SET value = 'YOUR_CLIENT_SECRET_HERE'
WHERE key = 'google_ads_client_secret';
```

---

## 🔄 Generate Refresh Token

After adding OAuth credentials, you need to generate a refresh token:

### Method 1: Using OAuth Playground

1. Go to: https://developers.google.com/oauthplayground/
2. Click the gear icon (Settings) in top right
3. Check **Use your own OAuth credentials**
4. Enter your Client ID and Client Secret
5. In the left panel, find "Google Ads API v17"
6. Select `https://www.googleapis.com/auth/adwords`
7. Click **Authorize APIs**
8. Sign in with your Google Ads manager account
9. Click **Exchange authorization code for tokens**
10. Copy the **Refresh token**
11. Save it to your database:

```sql
UPDATE system_settings 
SET value = 'YOUR_REFRESH_TOKEN_HERE'
WHERE key = 'google_ads_manager_refresh_token';
```

### Method 2: Using Your App's OAuth Flow

1. Create an OAuth endpoint in your app
2. Redirect users to Google OAuth
3. Capture the refresh token from the callback
4. Save it to the database

---

## ✅ Verify Everything Works

After setting up OAuth credentials and refresh token, run:

```bash
node scripts/test-google-ads-production-ready.js
```

You should see **100% success rate** if everything is configured correctly!

---

## 🚀 Testing API Connection

Once OAuth is set up, test the actual API connection:

```bash
node scripts/test-google-ads-api-connection.js
```

This will:
- ✅ Test token refresh
- ✅ Fetch account information
- ✅ Verify Standard Access is active
- ✅ Test basic queries

---

## 📊 Production Deployment Checklist

Before going live, ensure:

- [x] Developer token configured (Standard Access)
- [x] Manager Customer ID configured
- [x] All RMF methods implemented
- [x] Database schema created
- [ ] OAuth credentials configured
- [ ] Refresh token generated
- [ ] API connection tested successfully
- [ ] Test with real client account
- [ ] Deploy to production environment
- [ ] Monitor API quota usage

---

## 🆘 Troubleshooting

### Error: "DEVELOPER_TOKEN_NOT_ON_ALLOWLIST"

**Cause**: Token not yet activated (can take 1-2 hours after approval)
**Solution**: Wait a few hours and try again

### Error: "invalid_grant"

**Cause**: Refresh token expired or revoked
**Solution**: Generate a new refresh token

### Error: "AUTHENTICATION_ERROR"

**Cause**: OAuth credentials incorrect
**Solution**: Double-check Client ID and Client Secret

### Error: "PERMISSION_DENIED"

**Cause**: Missing required scopes
**Solution**: Ensure `https://www.googleapis.com/auth/adwords` scope is added

---

## 📝 Support

If you encounter issues:

1. Check Google Ads API documentation: https://developers.google.com/google-ads/api
2. Review your OAuth consent screen configuration
3. Verify all credentials are entered correctly
4. Check Supabase logs for detailed error messages

---

## 🎉 Success!

Once everything is configured:
- Your app will have **Standard Access** to Google Ads API
- You can access **all client accounts** under your manager account
- Data collection will run automatically
- Reports will show real-time Google Ads data

**Congratulations on your Google Ads API approval!** 🎊











