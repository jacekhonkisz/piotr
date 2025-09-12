# 🔐 Google Ads Service Account Setup Guide

## **Why Service Accounts?**

**Current Problem:**
- ❌ OAuth refresh tokens expire every 6-24 months
- ❌ Tokens can be revoked by users
- ❌ Requires interactive OAuth flow
- ❌ Your system makes 60+ API calls per day (causing token revocation)

**Service Account Solution:**
- ✅ **Truly lifelong tokens** (never expire)
- ✅ **Non-revocable** (only admin can disable)
- ✅ **Non-interactive** (no OAuth flow needed)
- ✅ **Higher rate limits** (better for production)
- ✅ **More secure** (designed for server-to-server)

---

## **STEP 1: CREATE GOOGLE CLOUD PROJECT**

### 1.1 Go to Google Cloud Console
- Visit: https://console.cloud.google.com/
- Sign in with your Google account

### 1.2 Create New Project
- Click "Select a project" → "New Project"
- **Project name:** `piotr-google-ads-service`
- **Organization:** (select your organization if applicable)
- Click "Create"

### 1.3 Enable Google Ads API
- Go to "APIs & Services" → "Library"
- Search for "Google Ads API"
- Click "Enable"

---

## **STEP 2: CREATE SERVICE ACCOUNT**

### 2.1 Navigate to Service Accounts
- Go to "IAM & Admin" → "Service Accounts"
- Click "Create Service Account"

### 2.2 Configure Service Account
- **Service account name:** `piotr-google-ads-service-account`
- **Service account ID:** (auto-generated)
- **Description:** `Service account for Google Ads API access in Piotr reporting system`
- Click "Create and Continue"

### 2.3 Grant Permissions
- **Role:** `Google Ads API User` (if available) or `Editor`
- Click "Continue" → "Done"

---

## **STEP 3: GENERATE SERVICE ACCOUNT KEY**

### 3.1 Create Key
- Click on your service account name
- Go to "Keys" tab
- Click "Add Key" → "Create new key"
- **Key type:** JSON
- Click "Create"

### 3.2 Download JSON File
- **Save as:** `piotr-google-ads-service-account.json`
- **⚠️ KEEP THIS FILE SECURE - NEVER COMMIT TO GIT**

---

## **STEP 4: CONFIGURE GOOGLE ADS API ACCESS**

### 4.1 Go to Google Ads API Center
- Visit: https://ads.google.com/aw/apicenter
- Sign in with your Google Ads account

### 4.2 Link Google Cloud Project
- Click "Link Google Cloud Project"
- Select your project: `piotr-google-ads-service`
- Click "Link"

### 4.3 Request API Access
- Click "Apply for access"
- **Application type:** "Other"
- **Description:** "Automated reporting system for client data collection and analysis"
- **Use case:** "Collecting campaign performance data for client reporting"
- Submit application

---

## **STEP 5: UPDATE YOUR SYSTEM**

### 5.1 Run Database Migration
```bash
# Apply the migration
npx supabase migration up
```

### 5.2 Set Up Service Account
```bash
# Run the setup script with your JSON file
node scripts/setup-google-ads-service-account.js /path/to/piotr-google-ads-service-account.json
```

### 5.3 Test Service Account
```bash
# Test the service account authentication
node scripts/test-service-account.js
```

---

## **STEP 6: UPDATE YOUR CODE**

### 6.1 Install Dependencies
```bash
npm install google-auth-library
```

### 6.2 Update Google Ads API Service
Replace the OAuth refresh token system with service account authentication:

```typescript
// Old way (OAuth refresh tokens)
const googleAdsService = new GoogleAdsAPIService({
  refreshToken: '1//...', // ❌ Expires
  clientId: '...',
  clientSecret: '...',
  // ...
});

// New way (Service account)
const serviceAccountService = new GoogleAdsServiceAccountService(serviceAccountKey);
const accessToken = await serviceAccountService.getAccessToken(); // ✅ Never expires
```

---

## **STEP 7: VERIFY SETUP**

### 7.1 Check Service Account Status
```bash
node scripts/test-service-account.js
```

**Expected Output:**
```
✅ Service Account Key: Configured
✅ Service Account Email: Configured
✅ Project ID: Configured
✅ Developer Token: Configured
✅ Service account authentication: SUCCESS
🎉 SERVICE ACCOUNT IS WORKING!
```

### 7.2 Test Live Data Collection
```bash
# Test with a real client
curl -X POST http://localhost:3000/api/fetch-google-ads-live-data \
  -H "Content-Type: application/json" \
  -d '{"clientId": "your-client-id", "dateRange": {"start": "2024-01-01", "end": "2024-01-31"}}'
```

---

## **STEP 8: MONITOR AND MAINTAIN**

### 8.1 Monitor Token Health
- Service account tokens never expire
- No need for token refresh automation
- Monitor API usage and rate limits

### 8.2 Security Best Practices
- Store JSON key file securely
- Use environment variables in production
- Never commit JSON key to git
- Rotate keys annually (optional)

---

## **TROUBLESHOOTING**

### Common Issues:

**1. "Service account not found"**
- Check if the service account exists in Google Cloud Console
- Verify the JSON file is valid

**2. "Permission denied"**
- Ensure service account has Google Ads API access
- Check if Google Ads API is enabled in the project

**3. "API access not approved"**
- Wait for Google to approve your API access request
- Check the status in Google Ads API Center

**4. "Invalid developer token"**
- Verify your developer token is valid
- Check if it's approved for production use

---

## **BENEFITS AFTER SETUP**

### ✅ **Truly Lifelong Tokens**
- No more token expiration issues
- No need for token refresh automation
- 100% reliable authentication

### ✅ **Better Performance**
- Faster authentication (no OAuth flow)
- Higher API rate limits
- More reliable for production

### ✅ **Enhanced Security**
- Service account credentials are more secure
- No user interaction required
- Designed for server-to-server communication

### ✅ **Easier Maintenance**
- No token management needed
- No user account dependencies
- Simplified authentication flow

---

## **NEXT STEPS**

1. **Complete the setup** using this guide
2. **Test the service account** with the provided scripts
3. **Update your code** to use service account authentication
4. **Monitor for 24-48 hours** to ensure stability
5. **Remove OAuth refresh token system** once confirmed working

**Result: Truly lifelong Google Ads tokens that never expire! 🚀**
