# 🔍 Belmonte & Havet Token Configuration Audit

**Date**: 2025-01-XX  
**Question**: "What about Belmonte Hotel? It should be assigned to one system user token?"

---

## ✅ **AUDIT RESULTS**

### **Belmonte Hotel** ✅
- **Client ID**: `ab0b4c7e-2bf0-46bc-b455-b18ef6942baa`
- **Ad Account**: `438600948208231`
- **Token Type**: `system_user_token` (PERMANENT) ✅
- **Token Permissions**: ✅ All required permissions granted
  - ✅ `ads_read`
  - ✅ `ads_management`
  - ✅ `business_management`
  - ✅ `read_insights`
- **Ad Account Access**: ✅ **GRANTED** by ad account owner
- **Status**: ✅ **WORKING PERFECTLY**

### **Havet** ⚠️
- **Client ID**: `93d46876-addc-4b99-b1e1-437428dd54f1`
- **Ad Account**: `659510566204299`
- **Token Type**: `system_user_token` (PERMANENT) ✅
- **Token Permissions**: ✅ All required permissions granted
  - ✅ `ads_read`
  - ✅ `ads_management`
  - ✅ `business_management`
  - ✅ `read_insights`
- **Ad Account Access**: ❌ **NOT GRANTED** by ad account owner
- **Status**: ❌ **BLOCKED** - Permission errors

---

## 🔍 **KEY FINDINGS**

### **1. Both Use the SAME System User Token** ✅
Both Belmonte and Havet are using the **same system user token**:
```
Token: EAAR4iSxFE60BPKn1vqWoG2s4IBUwZ...
```

This token is also stored in the global `settings` table as `meta_system_user_token`.

### **2. The Token Has All Required Permissions** ✅
The system user token has all the required permissions at the app/user level.

### **3. The Difference: Ad Account Access** ⚠️
- **Belmonte**: Ad account owner **granted access** → ✅ Works
- **Havet**: Ad account owner **has NOT granted access** → ❌ Fails

### **4. Code Bug Fixed** ✅
The `fetch-meta-tables` route was only checking `meta_access_token`, not `system_user_token`. This has been fixed to check both.

---

## 🚨 **ROOT CAUSE**

The issue is **NOT** with the token or permissions. The issue is that:

1. **Belmonte's ad account owner** has granted the system user access to ad account `438600948208231` ✅
2. **Havet's ad account owner** has NOT granted the system user access to ad account `659510566204299` ❌

Even though both use the same token, Meta API requires **two levels of access**:
1. ✅ Token permissions (app/user level) - **BOTH HAVE THIS**
2. ❌ Ad account access (account owner level) - **ONLY BELMONTE HAS THIS**

---

## 🔧 **SOLUTION**

### **To Fix Havet's Access:**

The owner of Havet's ad account (`659510566204299`) needs to:

1. **Go to Meta Business Manager**: https://business.facebook.com/
2. **Navigate to**: Business Settings → Ad Accounts
3. **Select**: Ad account `659510566204299`
4. **Go to**: "People" or "Partners" tab
5. **Add**: The system user that owns the token
6. **Grant permissions**: 
   - ✅ `ads_read`
   - ✅ `ads_management`

### **Alternative: Verify System User Has Access**

Check in Meta Business Manager:
1. Go to Business Settings → System Users
2. Find the system user (the one that generated the token)
3. Check "Assigned Assets" → Ad Accounts
4. Verify that ad account `659510566204299` (Havet) is listed
5. If not listed, add it with `ads_read` and `ads_management` permissions

---

## 📊 **RECOMMENDATION**

### **✅ YES - Use One System User Token for All Clients**

This is the **RECOMMENDED approach** and is already implemented:

```
┌─────────────────────────────────────────────┐
│  ONE System User Token                      │
│  "EAAR4iSxFE60BPKn1vqWoG2s4IBUwZ..."        │
└─────────────────────────────────────────────┘
           │
           ├──────────────────┬──────────────────┐
           ▼                  ▼                  ▼
    ┌──────────┐       ┌──────────┐       ┌──────────┐
    │ Belmonte │       │  Havet   │       │  Others  │
    │ Ad Acc 1 │       │ Ad Acc 2 │       │ Ad Acc N │
    │ ✅ Works │       │ ❌ Blocked│      │  ?       │
    └──────────┘       └──────────┘       └──────────┘
```

**Benefits:**
- ✅ One token to manage (never expires)
- ✅ Centralized security
- ✅ Easier updates
- ✅ Consistent across all clients

**Requirement:**
- ⚠️ System user must have access to ALL ad accounts in Meta Business Manager

---

## 🐛 **CODE FIXES APPLIED**

### **Fix #1: fetch-meta-tables Route**
**File**: `src/app/api/fetch-meta-tables/route.ts`

**Before:**
```typescript
if (!client.meta_access_token || !client.ad_account_id) {
  return createErrorResponse('Client missing Meta Ads credentials', 400);
}
const metaService = new MetaAPIService(client.meta_access_token);
```

**After:**
```typescript
const metaToken = client.system_user_token || client.meta_access_token;
if (!metaToken || !client.ad_account_id) {
  return createErrorResponse('Client missing Meta Ads credentials', 400);
}
const metaService = new MetaAPIService(metaToken);
```

Now the route will use `system_user_token` if available, otherwise fall back to `meta_access_token`.

---

## 📋 **VERIFICATION**

To verify the fix works:

1. **Check if Havet's ad account access is granted** in Meta Business Manager
2. **Test the API** - The errors should stop once access is granted
3. **Run audit script**:
   ```bash
   node scripts/audit-meta-permissions-issue.js
   ```

Expected result after fix:
- ✅ Account info accessible
- ✅ Placement performance returns data
- ✅ No OAuthException errors

---

## 🎯 **SUMMARY**

**Question**: "What about Belmonte Hotel? It should be assigned to one system user token?"

**Answer**: ✅ **YES!** Belmonte is already using a system user token, and it's the **same token** that Havet (and potentially all clients) should use. The system is correctly set up to use one system user token for all clients.

**The only issue**: Havet's ad account owner needs to grant the system user access to their ad account in Meta Business Manager.

Once that's done, both Belmonte and Havet (and any other clients using the same token) will work perfectly! 🎉




