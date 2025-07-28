# Meta API Token Troubleshooting Guide

## 🚨 **Current Issue: Token Expired**

Your Meta API access token has expired. The error shows:
```
Session has expired on Monday, 28-Jul-25 05:00:00 PDT
```

## 🔑 **Solution: Automatic Token Conversion (NEW!)**

**Great news!** The system now **automatically converts short-lived tokens to long-lived tokens** when admins add new clients. This is a **one-time setup** - no more token expiration issues!

### **For New Clients (Automatic)**
When an admin adds a new client:
1. ✅ **Automatic validation** of Meta API credentials
2. ✅ **Automatic conversion** of short-lived tokens to long-lived tokens
3. ✅ **Permanent access** - tokens never expire
4. ✅ **One-time setup** - no manual token management needed

### **For Existing Clients (Quick Fix)**
Run this script to convert existing tokens:
```bash
node scripts/convert-existing-tokens.js
```

## 🔑 **Manual Solution (If Needed)**

### **Step 1: Create a Meta App (if you don't have one)**

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click "Create App"
3. Select "Business" as the app type
4. Fill in your app details
5. Add the "Marketing API" product to your app

### **Step 2: Generate a Permanent Access Token**

#### **Method A: Using Graph API Explorer (Recommended)**

1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Click "Generate Access Token"
4. **IMPORTANT**: Select these permissions:
   - `ads_read`
   - `ads_management` 
   - `business_management`
   - `read_insights`
5. Click "Generate Access Token"
6. Copy the generated token

#### **Method B: Using Business Manager**

1. Go to [Business Manager](https://business.facebook.com/)
2. Navigate to Settings → Business Settings
3. Go to "System Users" or "Access Tokens"
4. Create a new System User or generate a token
5. Assign the necessary permissions:
   - `ads_read`
   - `ads_management`
   - `business_management`

### **Step 3: Convert to Long-Lived Token**

**IMPORTANT**: The token from Graph API Explorer is short-lived (2 hours). You need to convert it to a long-lived token:

```bash
# Make this API call to convert your short-lived token to long-lived
curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_SHORT_LIVED_TOKEN"
```

Replace:
- `YOUR_APP_ID` with your Meta app ID
- `YOUR_APP_SECRET` with your Meta app secret  
- `YOUR_SHORT_LIVED_TOKEN` with the token from Graph API Explorer

### **Step 4: Update Your Client Token**

1. Go to your application's admin panel
2. Find your client (jacek)
3. Update the Meta access token with the new long-lived token
4. The system will validate the token automatically

## 🔧 **Alternative: Use System User Token (Most Permanent)**

For the most permanent solution, create a System User:

### **Step 1: Create System User**
1. Go to Business Manager → Settings → Business Settings
2. Click "System Users" → "Add"
3. Name: "API Integration User"
4. Role: "Admin" or "Employee"

### **Step 2: Generate System User Token**
1. Click on your System User
2. Go to "Access Tokens"
3. Generate a new token with these permissions:
   - `ads_read`
   - `ads_management`
   - `business_management`
   - `read_insights`

### **Step 3: Assign to Ad Account**
1. Go to "Ad Accounts" in Business Settings
2. Assign your ad account to the System User
3. Give "Admin" access

## 🛠️ **Quick Fix Script**

I've created a script to help you update the token. Run this after getting your new token:

```bash
node scripts/update-meta-token.js
```

## 📋 **Required Permissions**

Your Meta API token needs these permissions:
- ✅ `ads_read` - Read ad account data
- ✅ `ads_management` - Access campaign insights
- ✅ `business_management` - Access business data
- ✅ `read_insights` - Read performance metrics

## 🔍 **Token Validation**

After updating your token, the system will automatically validate it and show:
- ✅ Token validity
- ✅ Available ad accounts
- ✅ Permission status

## 🚨 **Common Issues**

### **"Session has expired"**
- **Cause**: Using short-lived token
- **Solution**: Convert to long-lived token or use System User token

### **"Access denied to ad account"**
- **Cause**: Token doesn't have proper permissions
- **Solution**: Add required permissions to token

### **"Ad account not found"**
- **Cause**: Wrong ad account ID format
- **Solution**: Use account ID without "act_" prefix

## 📞 **Need Help?**

If you're still having issues:
1. Check your Meta app permissions
2. Verify your ad account ID
3. Ensure your token has the right permissions
4. Try the System User approach for maximum permanence

## 🎯 **Next Steps**

1. Generate a new permanent token using the steps above
2. Update your client's token in the admin panel
3. Test the integration
4. Your reports should now work with real Meta data! 