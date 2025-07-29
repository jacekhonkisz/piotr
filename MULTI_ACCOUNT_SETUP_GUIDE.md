# 🏢 Multi-Account Meta API Setup Guide

## 📋 **The Challenge: Multiple Meta Accounts**

When you have **20 different clients from different Meta accounts**, you need a different approach because:

- **Token A** can only access **Meta Account A's** ad accounts
- **Token B** can only access **Meta Account B's** ad accounts  
- **You cannot use one token** to access multiple different Meta accounts

## 🎯 **Solution: Multi-Token Management System**

### **Approach 1: Individual Client Tokens (Recommended)**

Each client provides their own Meta API token from their Meta account.

### **Approach 2: System User per Client**

Create a System User for each client in their respective Meta accounts.

---

## 🛠️ **Step-by-Step Setup**

### **Step 1: Client Token Collection Process**

#### **For Each Client:**

1. **Client goes to**: https://developers.facebook.com/tools/explorer/
2. **Select their app** (or create one)
3. **Generate User Access Token**
4. **Copy the token** (starts with EAA...)
5. **Send token to admin**

#### **Admin Process:**

1. **Use the enhanced admin panel**
2. **Add client with their token**
3. **Validate token automatically**
4. **Select their ad account**
5. **Test connection**

### **Step 2: Enhanced Admin Panel Features**

Your admin panel now includes:

#### **Multi-Token Client Form**
- ✅ **Client-specific token input**
- ✅ **Meta account name field** (for organization)
- ✅ **Automatic token validation**
- ✅ **Ad account discovery**
- ✅ **Connection testing**

#### **Bulk Import with Multiple Tokens**
- ✅ **CSV import with individual tokens**
- ✅ **Token validation before import**
- ✅ **Error handling for invalid tokens**

---

## 🔧 **Database Schema Updates**

### **Enhanced Client Table**

```sql
-- Add these fields to your clients table
ALTER TABLE clients ADD COLUMN meta_account_name TEXT;
ALTER TABLE clients ADD COLUMN token_status TEXT DEFAULT 'pending';
ALTER TABLE clients ADD COLUMN last_token_validation TIMESTAMP;
ALTER TABLE clients ADD COLUMN campaigns_count INTEGER DEFAULT 0;
```

### **Token Management Table** (Optional)

```sql
CREATE TABLE client_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  token_hash TEXT NOT NULL,
  token_status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  last_used TIMESTAMP
);
```

---

## 📊 **Admin Workflow**

### **Adding Individual Clients**

1. **Admin Panel** → **"Add Client"**
2. **Fill basic info** (name, email)
3. **Enter client's Meta account name** (optional)
4. **Paste client's Meta API token**
5. **Click "Validate Token"**
6. **Click "Find Accounts"** to discover available ad accounts
7. **Select the correct ad account**
8. **Click "Test Connection"**
9. **Save client**

### **Bulk Import Process**

1. **Admin Panel** → **"Bulk Import"**
2. **Download CSV template**
3. **Fill with client data**:
   ```csv
   name,email,meta_access_token,ad_account_id,meta_account_name,role
   Client A,clienta@example.com,EAA...,123456789,Client A Business,client
   Client B,clientb@example.com,EAA...,987654321,Client B Business,client
   ```
4. **Upload CSV**
5. **Review preview**
6. **Import all clients**

---

## 🎯 **Token Collection Strategies**

### **Strategy 1: Manual Collection**
- **Admin emails each client**
- **Client generates token manually**
- **Client sends token back**
- **Admin adds to system**

### **Strategy 2: Self-Service Portal**
- **Client logs into your app**
- **Client connects their Meta account**
- **Token generated automatically**
- **Admin approves connection**

### **Strategy 3: Guided Setup**
- **Admin provides step-by-step instructions**
- **Client follows video tutorial**
- **Client uploads token via form**
- **Admin validates and activates**

---

## 🔒 **Security Best Practices**

### **Token Storage**
- ✅ **Encrypt tokens** in database
- ✅ **Hash tokens** for validation
- ✅ **Store token metadata** (expiry, permissions)
- ✅ **Regular token rotation**

### **Access Control**
- ✅ **Client can only see their own data**
- ✅ **Admin can manage all clients**
- ✅ **Token validation on every request**
- ✅ **Audit trail for token usage**

### **Token Validation**
- ✅ **Validate on client creation**
- ✅ **Regular validation checks**
- ✅ **Automatic expiry detection**
- ✅ **Fallback token handling**

---

## 📈 **Scaling Considerations**

### **Phase 1: Manual Setup (1-20 clients)**
- **Individual token collection**
- **Manual admin panel management**
- **Basic validation and testing**

### **Phase 2: Automated Setup (20-100 clients)**
- **Self-service client portal**
- **Automated token validation**
- **Bulk import capabilities**
- **Advanced error handling**

### **Phase 3: Enterprise Setup (100+ clients)**
- **Multi-tenant architecture**
- **Advanced token management**
- **Automated onboarding**
- **Comprehensive monitoring**

---

## 🚀 **Implementation Steps**

### **Immediate (Week 1)**
1. ✅ **Update database schema**
2. ✅ **Enhance admin panel forms**
3. ✅ **Add token validation API**
4. ✅ **Test with 2-3 clients**

### **Short Term (Week 2-3)**
1. 🔄 **Implement bulk import**
2. 🔄 **Add token management features**
3. 🔄 **Create client onboarding guide**
4. 🔄 **Test with 10-15 clients**

### **Medium Term (Month 2)**
1. 🔄 **Build self-service portal**
2. 🔄 **Add automated validation**
3. 🔄 **Implement token rotation**
4. 🔄 **Scale to 50+ clients**

---

## 💡 **Pro Tips**

### **Client Communication**
- **Provide clear instructions** for token generation
- **Create video tutorials** for common issues
- **Offer support** for technical difficulties
- **Set expectations** for setup time

### **Token Management**
- **Monitor token expiry** dates
- **Proactively renew** expiring tokens
- **Keep backup tokens** for critical clients
- **Document token sources** and permissions

### **Error Handling**
- **Graceful degradation** when tokens fail
- **Clear error messages** for clients
- **Automatic retry** mechanisms
- **Fallback options** for critical data

---

## 🎉 **Benefits of Multi-Token System**

✅ **True multi-account support** - each client has their own Meta account  
✅ **Individual data isolation** - clients only see their own campaigns  
✅ **Flexible token management** - different tokens for different needs  
✅ **Scalable architecture** - can handle hundreds of clients  
✅ **Enhanced security** - tokens are client-specific  
✅ **Better organization** - track which Meta account each client uses  

---

## 📞 **Support Resources**

### **For Admins**
- **Token validation scripts** in `/scripts/`
- **Bulk import templates** in admin panel
- **Error handling guides** in documentation
- **Client onboarding checklists**

### **For Clients**
- **Step-by-step token generation guide**
- **Video tutorials** for common issues
- **Support email** for technical help
- **FAQ section** for quick answers

**Your multi-account Meta API system is ready to handle 20+ different clients! 🚀** 