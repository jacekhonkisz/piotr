# 🔑 Permanent Meta API Setup Guide

## 🚨 **Current Situation**
Your Meta API tokens have expired and need to be replaced with permanent tokens. This guide will help you set up **permanent API access** that never expires.

## 🎯 **Recommended Solutions (In Order of Preference)**

### **Option 1: System User Tokens (MOST PERMANENT) ⭐⭐⭐⭐⭐**

**System User tokens never expire** and are the most reliable solution for production applications.

#### **Step 1: Create System User**
1. Go to [Business Manager](https://business.facebook.com/)
2. Navigate to **Settings** → **Business Settings**
3. Click **"System Users"** → **"Add"**
4. Fill in details:
   - **Name**: "API Integration User"
   - **Role**: "Admin" or "Employee"
   - **Description**: "For Meta Ads API integration"

#### **Step 2: Generate System User Token**
1. Click on your newly created System User
2. Go to **"Access Tokens"** tab
3. Click **"Generate New Token"**
4. Select these **permissions**:
   - ✅ `ads_read`
   - ✅ `ads_management`
   - ✅ `business_management`
   - ✅ `read_insights`
5. Click **"Generate Token"**
6. **Copy the token** (it will look like: `EAABwzLixnjYBO...`)

#### **Step 3: Assign to Ad Accounts**
1. In Business Settings, go to **"Ad Accounts"**
2. Find your ad account(s)
3. Click **"Assign"** → **"System Users"**
4. Select your API Integration User
5. Give **"Admin"** access

#### **Step 4: Update Your Application**
```bash
# Update all clients with the new System User token
node scripts/update-all-tokens.js --all "YOUR_SYSTEM_USER_TOKEN"
```

### **Option 2: Long-Lived User Tokens (60 Days) ⭐⭐⭐⭐**

If you prefer to use your personal account, convert to long-lived tokens.

#### **Step 1: Generate New Token**
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app from the dropdown
3. Click **"Generate Access Token"**
4. Select these **permissions**:
   - ✅ `ads_read`
   - ✅ `ads_management`
   - ✅ `business_management`
   - ✅ `read_insights`
5. Click **"Generate Access Token"**
6. **Copy the token**

#### **Step 2: Convert to Long-Lived Token**
```bash
# Replace with your actual values
curl -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=YOUR_APP_ID&client_secret=YOUR_APP_SECRET&fb_exchange_token=YOUR_SHORT_LIVED_TOKEN"
```

#### **Step 3: Update Your Application**
```bash
# Update specific client
node scripts/update-all-tokens.js jac.honkisz@gmail.com "YOUR_LONG_LIVED_TOKEN"

# Or update all clients
node scripts/update-all-tokens.js --all "YOUR_LONG_LIVED_TOKEN"
```

## 🛠️ **Quick Setup Commands**

### **Check Current Status**
```bash
node scripts/setup-permanent-tokens.js
```

### **Update Single Client**
```bash
node scripts/update-all-tokens.js jac.honkisz@gmail.com "YOUR_NEW_TOKEN"
```

### **Update All Clients**
```bash
node scripts/update-all-tokens.js --all "YOUR_NEW_TOKEN"
```

### **Test Token Validation**
```bash
node scripts/test-meta-validation.js
```

## 📋 **Required Meta App Setup**

### **1. Create Meta App (if you don't have one)**
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **"Create App"**
3. Select **"Business"** as app type
4. Fill in app details
5. Add **"Marketing API"** product

### **2. Environment Variables**
Ensure your `.env.local` file has:
```bash
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
```

## 🔍 **Token Validation Checklist**

After updating tokens, verify:
- ✅ Token is valid (no expiration errors)
- ✅ Has `ads_read` permission
- ✅ Can access ad accounts
- ✅ Can fetch campaign data
- ✅ Works with your specific ad account IDs

## 🚨 **Common Issues & Solutions**

### **"Session has expired"**
- **Cause**: Using short-lived token
- **Solution**: Convert to long-lived token or use System User token

### **"Access denied to ad account"**
- **Cause**: Token doesn't have proper permissions
- **Solution**: Add required permissions to token

### **"Ad account not found"**
- **Cause**: Wrong ad account ID format
- **Solution**: Use account ID without "act_" prefix

### **"Invalid OAuth access token"**
- **Cause**: Token is completely invalid or expired
- **Solution**: Generate new token using the steps above

## 🎯 **Best Practices for Production**

### **1. Use System User Tokens**
- Never expire
- More secure
- Better for production applications

### **2. Regular Token Health Checks**
- Monitor token validity
- Set up alerts for token expiration
- Have backup tokens ready

### **3. Proper Error Handling**
- Your application already handles token validation
- Automatic fallback to cached data
- Clear error messages for users

### **4. Token Security**
- Store tokens securely in database
- Use environment variables for app credentials
- Regular token rotation (for long-lived tokens)

## 📞 **Need Help?**

### **1. Check Your Setup**
```bash
node scripts/setup-permanent-tokens.js
```

### **2. Test Token Manually**
```bash
curl -X GET "https://graph.facebook.com/v18.0/me?access_token=YOUR_TOKEN"
```

### **3. Verify Ad Account Access**
```bash
curl -X GET "https://graph.facebook.com/v18.0/me/adaccounts?access_token=YOUR_TOKEN"
```

### **4. Check Meta App Status**
- Ensure Marketing API is added
- Verify app is in production mode
- Check app permissions

## 🎉 **Success Indicators**

After following this guide, you should see:
- ✅ No more "Session has expired" errors
- ✅ Real Meta data loading in dashboard
- ✅ Successful report generation
- ✅ Permanent API access working

## 🔄 **Maintenance**

### **For System User Tokens**
- ✅ No maintenance needed - they never expire

### **For Long-Lived Tokens**
- ⏰ Set calendar reminder for 50 days (before 60-day expiration)
- 🔄 Generate new token and convert to long-lived
- 📝 Update application with new token

---

**🎯 Recommendation: Use System User tokens for maximum reliability and zero maintenance!** 