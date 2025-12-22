# 🔍 Google Ads Token Configuration Audit Result

**Date**: 2025-01-XX  
**Error**: `invalid_grant` - Token refresh failed

---

## ✅ **AUDIT RESULTS**

### **System Settings** ✅ (Partially Configured)
- **google_ads_client_id**: ✅ SET
- **google_ads_client_secret**: ✅ SET
- **google_ads_developer_token**: ✅ SET
- **google_ads_manager_customer_id**: ✅ SET (`293-100-0497`)
- **google_ads_manager_refresh_token**: ⚠️ **TEST TOKEN** (Invalid)

### **Manager Refresh Token Issue** 🚨
The refresh token in `system_settings` is a **test/placeholder token**:
```
Token: 1//04test-token-for-validation...
Length: 36 characters
```

**Real Google OAuth refresh tokens** are typically:
- 100+ characters long
- Start with `1//` but contain much more data
- Generated through proper OAuth flow

### **Clients Configuration**
- **14 clients** have Google Ads customer IDs configured
- **0 clients** have individual refresh tokens
- All clients rely on the **manager refresh token** (which is invalid)

---

## 🚨 **ROOT CAUSE**

The `invalid_grant` error occurs because:

1. **The refresh token is a test/placeholder token** - not a real OAuth refresh token
2. **Google OAuth API rejects it** - returns `invalid_grant` error
3. **All clients fail** - because they all depend on this manager token

---

## 🔧 **SOLUTION**

### **Step 1: Generate a Real Refresh Token**

You need to generate a **real Google OAuth refresh token**:

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select your project** (the one with OAuth credentials)
3. **Go to**: APIs & Services → Credentials
4. **Find your OAuth 2.0 Client ID** (the one matching `google_ads_client_id`)
5. **Use OAuth 2.0 Playground** or **create a script** to get refresh token

### **Step 2: OAuth Flow to Get Refresh Token**

**Option A: Using OAuth 2.0 Playground**
1. Go to: https://developers.google.com/oauthplayground/
2. Click the gear icon (⚙️) → Check "Use your own OAuth credentials"
3. Enter:
   - OAuth Client ID: `77508981337-7kkho8u7mkfs3b2huo...`
   - OAuth Client secret: `GOCSPX-0dZOBXgqQlcFHKhlxV9K_7O...`
4. In the left panel, find "Google Ads API"
5. Select scopes:
   - `https://www.googleapis.com/auth/adwords`
6. Click "Authorize APIs"
7. After authorization, click "Exchange authorization code for tokens"
8. Copy the **refresh_token** (long string starting with `1//`)

**Option B: Using Script**
```bash
# Run the OAuth flow script
node scripts/generate-google-ads-token.js
```

### **Step 3: Update the Refresh Token**

Update the token in the database:

```sql
UPDATE system_settings 
SET value = 'YOUR_NEW_REFRESH_TOKEN_HERE'
WHERE key = 'google_ads_manager_refresh_token';
```

Or use the admin UI:
1. Go to Admin Panel → Platform Tokens
2. Update Google Ads Manager Refresh Token
3. Save

---

## 📊 **VERIFICATION**

After updating the token, verify it works:

```bash
node scripts/audit-google-ads-token-config.js
```

Expected result:
- ✅ Token refresh successful
- ✅ Access token generated
- ✅ No `invalid_grant` errors

---

## 🎯 **RECOMMENDATION**

### **Use Manager Refresh Token for All Clients** ✅

This is the **RECOMMENDED approach** (similar to Meta's system user token):

```
┌─────────────────────────────────────────────┐
│  ONE Manager Refresh Token                  │
│  "1//0gxxxxxxxxxxxxxxxxxxxxx..."            │
└─────────────────────────────────────────────┘
           │
           ├──────────────────┬──────────────────┬──────────────────┐
           ▼                  ▼                  ▼                  ▼
    ┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
    │ Belmonte │       │  Havet   │       │  Others  │       │  Others  │
    │ Cust ID  │       │ Cust ID  │       │ Cust ID  │       │ Cust ID  │
    │ 789-...  │       │ 733-...  │       │ 894-...  │       │ 859-...  │
    └──────────┘       └──────────┘       └──────────┘       └──────────┘
```

**Benefits:**
- ✅ One token to manage
- ✅ Works for all clients (if manager has access)
- ✅ Centralized security
- ✅ Easier updates

**Requirement:**
- ⚠️ Manager account (`293-100-0497`) must have access to all client customer accounts

---

## 🔍 **ADDITIONAL NOTES**

### **Why Test Token Exists**
The test token (`1//04test-token-for-validation...`) was likely:
- Created during development/testing
- Never replaced with a real token
- Or the real token expired/was revoked

### **Token Expiration**
Google OAuth refresh tokens can be revoked if:
- User revokes access
- Token is unused for 6 months
- Security issues detected
- OAuth client is deleted/modified

### **Error Handling**
The current error handling shows:
- `invalid_grant` error is caught
- But the error message could be clearer
- Consider showing user-friendly message: "Google Ads token expired. Please update in admin panel."

---

## 📋 **SUMMARY**

**Issue**: Manager refresh token is a test/placeholder token, causing `invalid_grant` errors.

**Solution**: Generate a real OAuth refresh token and update it in `system_settings` table.

**Status**: ⚠️ **BLOCKED** - Waiting for real refresh token to be configured.

Once a real refresh token is configured, all 14 clients should work automatically! 🎉




