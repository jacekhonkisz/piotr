# 🔐 Permanent Token Setup Checklist

## ✅ **Current Status: EXCELLENT!**

Your current setup is **production-ready** with all clients using permanent System User tokens.

## 📋 **Client Onboarding Checklist for Permanent Tokens**

### **Pre-Onboarding (Before Adding Client)**

- [ ] **Meta App Setup**
  - [ ] Meta App ID configured in `.env.local`
  - [ ] Meta App Secret configured in `.env.local`
  - [ ] Marketing API product added to app
  - [ ] App is in production mode

- [ ] **Business Manager Access**
  - [ ] Client has added you as admin to their Business Manager
  - [ ] You have admin permissions in their Business Manager
  - [ ] You can access their ad accounts

### **System User Creation (Manual Process)**

- [ ] **Create System User**
  - [ ] Go to Business Manager → Settings → Business Settings
  - [ ] Navigate to Users → System Users
  - [ ] Click "Add" → "System User"
  - [ ] Name: "API Access User - [Client Name]"
  - [ ] Role: Admin
  - [ ] Click "Create System User"

- [ ] **Assign Ad Account Access**
  - [ ] Select the created System User
  - [ ] Go to "Assigned Assets" → "Ad Accounts"
  - [ ] Click "Assign" → "Ad Accounts"
  - [ ] Select client's ad account(s)
  - [ ] Role: Admin
  - [ ] Click "Assign"

- [ ] **Generate Permanent Token**
  - [ ] In System User settings
  - [ ] Go to "Access Tokens" tab
  - [ ] Click "Generate New Token"
  - [ ] Select your Meta app
  - [ ] Select these permissions:
    - [ ] `ads_read`
    - [ ] `ads_management`
    - [ ] `business_management`
    - [ ] `read_insights`
  - [ ] Click "Generate Token"
  - [ ] Copy the token (starts with EAA...)

### **Client Record Setup**

- [ ] **Add Client to System**
  - [ ] Use admin panel to add new client
  - [ ] Enter client information:
    - [ ] Company Name
    - [ ] Contact Email
    - [ ] Meta Ad Account ID
    - [ ] Meta Access Token (System User token)
  - [ ] Click "Validate Token" to test
  - [ ] Click "Test Connection" to verify ad account access
  - [ ] Save client record

### **Verification Steps**

- [ ] **Token Validation**
  - [ ] Token shows as "valid" in admin panel
  - [ ] No expiration warnings
  - [ ] All required permissions present

- [ ] **Connection Testing**
  - [ ] Can access ad account data
  - [ ] Can fetch campaign information
  - [ ] No API errors in logs

- [ ] **Dashboard Access**
  - [ ] Client can log in to dashboard
  - [ ] Real Meta data loads correctly
  - [ ] Reports generate successfully

## 🛠️ **Automated Setup (Future Enhancement)**

### **Current Implementation**
- ✅ Token validation system
- ✅ Automatic token type detection
- ✅ Permission checking
- ✅ Connection testing

### **Planned Enhancements**
- [ ] Automated System User creation via Meta API
- [ ] Automated token generation
- [ ] Automated ad account assignment
- [ ] Bulk client setup process

## 🔍 **Audit Commands**

### **Check Current Status**
```bash
node scripts/audit-permanent-tokens.js
```

### **Validate All Tokens**
```bash
node scripts/setup-permanent-tokens.js
```

### **Test Specific Client**
```bash
# Use admin panel to test individual client connections
```

## 🚨 **Common Issues & Solutions**

### **"Token validation failed"**
- **Cause**: Invalid or expired token
- **Solution**: Generate new System User token

### **"Access denied to ad account"**
- **Cause**: System User not assigned to ad account
- **Solution**: Assign ad account to System User in Business Manager

### **"Missing permissions"**
- **Cause**: Token doesn't have required scopes
- **Solution**: Regenerate token with all required permissions

### **"Business Manager access denied"**
- **Cause**: You don't have admin access
- **Solution**: Ask client to add you as admin to Business Manager

## 📞 **Support Resources**

- **Meta Business Manager**: https://business.facebook.com/
- **Meta Developers**: https://developers.facebook.com/
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
- **System User Documentation**: https://developers.facebook.com/docs/business-api/guides/system-users

## 🎯 **Success Indicators**

After following this checklist, you should see:
- ✅ All clients have permanent tokens
- ✅ No token expiration warnings
- ✅ Real Meta data loading in dashboards
- ✅ Successful report generation
- ✅ No API errors in logs

## 🔄 **Maintenance Schedule**

### **Daily**
- [ ] Check for any API errors in logs
- [ ] Monitor dashboard performance

### **Weekly**
- [ ] Run token audit script
- [ ] Check client dashboard access

### **Monthly**
- [ ] Review token health status
- [ ] Update setup documentation if needed

### **Never (for System User tokens)**
- [ ] Token renewal (System User tokens never expire!)
- [ ] Manual token updates
- [ ] Expiration warnings

---

**Last Updated**: Current audit shows all clients have permanent tokens ✅
**Next Audit**: Run `node scripts/audit-permanent-tokens.js` after adding new clients 