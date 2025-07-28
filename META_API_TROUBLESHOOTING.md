# Meta API Validation Troubleshooting Guide

## 🚨 Understanding the 403 Error

The 403 error you're seeing means **"Forbidden"** - your access token doesn't have the required permissions to access the Meta Ads API endpoints.

### What the 403 Error Means:
- ✅ Your access token is **valid** (not expired or malformed)
- ❌ Your access token **lacks required permissions**
- ❌ The token doesn't have access to the specific ad account

## 🔧 How to Fix the 403 Error

### Step 1: Check Your Access Token Permissions

Your Meta access token needs these **specific permissions**:

#### Required Permissions:
- `ads_read` - Read ad account data
- `ads_management` - Manage ads and campaigns
- `business_management` - Access business accounts

#### Optional but Recommended:
- `pages_read_engagement` - Read page insights
- `pages_show_list` - List pages

### Step 2: Generate a Proper Access Token

#### Method 1: Using Meta for Developers (Recommended)

1. **Go to [developers.facebook.com](https://developers.facebook.com)**
2. **Create or select your app**
3. **Add the "Marketing API" product** to your app
4. **Go to Tools → Graph API Explorer**
5. **Select your app from the dropdown**
6. **Add these permissions:**
   ```
   ads_read
   ads_management
   business_management
   ```
7. **Click "Generate Access Token"**
8. **Copy the generated token**

#### Method 2: Using Facebook Business Manager

1. **Go to [business.facebook.com](https://business.facebook.com)**
2. **Navigate to Business Settings → System Users**
3. **Create a new System User**
4. **Assign the required permissions:**
   - Ads Manager
   - Business Manager
5. **Generate an access token for this System User**

### Step 3: Verify Your Ad Account ID

Your Ad Account ID should be in one of these formats:
- `act_123456789` (with `act_` prefix)
- `123456789` (just the numbers)

#### How to Find Your Ad Account ID:

1. **In Facebook Ads Manager:**
   - Go to Ads Manager
   - Look at the URL: `https://www.facebook.com/adsmanager/manage/accounts?act=123456789`
   - The number after `act=` is your Ad Account ID

2. **In Business Manager:**
   - Go to Business Settings → Ad Accounts
   - Find your ad account and copy the ID

### Step 4: Test Your Credentials

Use the new test page I created to verify your credentials:

1. **Go to: `http://localhost:3000/test-meta-validation`**
2. **Enter your access token and ad account ID**
3. **Click "Test Validation"**
4. **Review the detailed results**

## 🧪 Testing Your Setup

### Quick Test Commands

You can test your token directly using curl:

```bash
# Test basic token validity
curl "https://graph.facebook.com/v18.0/me?access_token=YOUR_TOKEN"

# Test ad accounts access
curl "https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name,account_id&access_token=YOUR_TOKEN"

# Test specific ad account
curl "https://graph.facebook.com/v18.0/act_YOUR_ACCOUNT_ID?fields=id,name,account_id&access_token=YOUR_TOKEN"
```

### Expected Responses

#### ✅ Successful Token Test:
```json
{
  "id": "123456789",
  "name": "Your Name"
}
```

#### ✅ Successful Ad Accounts Test:
```json
{
  "data": [
    {
      "id": "act_123456789",
      "name": "Your Ad Account",
      "account_id": "123456789"
    }
  ]
}
```

#### ❌ 403 Error Response:
```json
{
  "error": {
    "message": "This endpoint requires the 'ads_read' permission",
    "type": "OAuthException",
    "code": 200,
    "fbtrace_id": "trace_id"
  }
}
```

## 🔍 Common Issues and Solutions

### Issue 1: "This endpoint requires the 'ads_read' permission"

**Solution:** Your token lacks the `ads_read` permission.

**Fix:**
1. Go to Graph API Explorer
2. Add `ads_read` permission
3. Generate a new token

### Issue 2: "Ad Account ID not found"

**Solution:** The ad account ID is incorrect or the token doesn't have access to it.

**Fix:**
1. Verify the ad account ID in Ads Manager
2. Ensure the token has access to this specific account
3. Check if the account is active

### Issue 3: "Access token has expired"

**Solution:** Access tokens expire after 60 days.

**Fix:**
1. Generate a new access token
2. Consider using a long-lived token or System User token

### Issue 4: "App not approved for ads_read"

**Solution:** Your Meta app needs to be approved for the Marketing API.

**Fix:**
1. Submit your app for review
2. Or use a System User token from Business Manager

## 🛠️ Using the Test Tools

### Test Page Features

The test page at `/test-meta-validation` provides:

1. **Token Validation** - Tests basic token validity
2. **Account Validation** - Tests specific ad account access
3. **Ad Accounts List** - Lists all accessible ad accounts
4. **Campaign Access** - Tests campaign data access
5. **Raw API Debug** - Shows exact API responses

### Understanding Test Results

#### ✅ All Tests Pass:
- Your credentials are working perfectly
- You can proceed with adding clients

#### ❌ Token Validation Fails:
- Check token format and expiration
- Regenerate the token

#### ❌ Account Validation Fails:
- Verify ad account ID
- Check if token has access to this account

#### ❌ Ad Accounts List Fails:
- Token lacks `ads_read` permission
- Add the required permission

## 📋 Checklist for Valid Credentials

Before adding a client, ensure:

- [ ] Access token is valid and not expired
- [ ] Token has `ads_read` permission
- [ ] Token has `ads_management` permission
- [ ] Ad account ID is correct
- [ ] Token has access to the specific ad account
- [ ] Ad account is active and not disabled

## 🆘 Getting Help

If you're still having issues:

1. **Check the test page results** for specific error messages
2. **Verify your Meta app settings** in the developer console
3. **Ensure your Business Manager permissions** are correct
4. **Contact Meta support** if it's a platform issue

## 🔐 Security Notes

- **Never share access tokens** publicly
- **Store tokens securely** in your application
- **Rotate tokens regularly** for security
- **Use System User tokens** for production applications
- **Monitor token usage** and permissions

---

**Remember:** The 403 error is actually good news - it means your token is valid but just needs the right permissions! 🎯 