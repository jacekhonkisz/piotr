# 🔑 Shared System User Token - Complete Guide

**Date:** November 13, 2025  
**Question:** "Can you use the same system user token for other clients?"  
**Answer:** **YES! This is the RECOMMENDED approach!** ✅

---

## 🎯 Quick Answer

**YES**, one system user token can be used for **ALL your clients**!

```
┌─────────────────────────────────────────────┐
│  ONE System User Token                      │
│  "EAAxxxxxxxxxxxxxxxxxx..."                 │
└─────────────────────────────────────────────┘
           │
           ├──────────────────┬──────────────────┬──────────────────┐
           ▼                  ▼                  ▼                  ▼
    ┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
    │ Client 1 │       │ Client 2 │       │ Client 3 │       │ Client 4 │
    │ Ad Acc 1 │       │ Ad Acc 2 │       │ Ad Acc 3 │       │ Ad Acc 4 │
    └──────────┘       └──────────┘       └──────────┘       └──────────┘
    Belmonte           Lambert            Mazury             Others...
```

**Each client needs:**
- ✅ Same system user token (shared)
- ✅ Different ad account ID (unique per client)

---

## 🏗️ How It Works

### The Token + Ad Account Combination

When you make a Meta API call:
```javascript
const metaService = new MetaAPIService(TOKEN);
const data = metaService.getCampaignInsights(AD_ACCOUNT_ID, ...);
```

**What happens:**
1. **Token** = Who you are (your system user)
2. **Ad Account ID** = Which account you want data from
3. **Meta checks:** "Does this system user have access to this ad account?"
4. **If yes:** Returns data ✅
5. **If no:** Permission error ❌

### Example

**One token, three clients:**
```javascript
// SAME TOKEN for all
const TOKEN = "EAAGno4gbz9cBO..."; 

// Different ad accounts
const belmonte = metaService.getCampaignInsights("123456789", ...); // ✅
const lambert = metaService.getCampaignInsights("987654321", ...);  // ✅
const mazury = metaService.getCampaignInsights("555666777", ...);   // ✅
```

All three calls use the **SAME token**, but different **ad account IDs**.

---

## ✅ Benefits of Shared System User Token

| Benefit | Description |
|---------|-------------|
| **♾️ Single Token Management** | Only one token to maintain instead of 10+ |
| **🔒 Centralized Security** | Revoke one token = revoke all access |
| **⚡ Easier Updates** | Update token once, applies to all clients |
| **📊 Simplified Monitoring** | One token to validate, not dozens |
| **💰 Cost Effective** | Fewer API validation calls |
| **🎯 Permission Control** | Grant/revoke ad account access centrally |
| **🔄 No Expiration** | System user tokens never expire |

---

## 🛠️ How to Set Up Shared System User Token

### Step 1: Create System User in Meta Business Manager

1. Go to **Meta Business Manager**
2. Navigate to **Business Settings**
3. Click **Users → System Users**
4. Click **Add** to create new system user
5. Name it something like: "API Integration User" or "Your App Name Bot"

### Step 2: Grant Access to All Ad Accounts

**For EACH client's ad account:**
1. In Business Manager → **Ad Accounts**
2. Select the ad account
3. Click **Add People** → Select your system user
4. Grant permissions:
   - ✅ **View performance** (read campaign data)
   - ✅ **Manage campaigns** (if you need to create/edit)
   - Choose based on your needs

**Repeat for ALL client ad accounts:**
- Belmonte's ad account: `act_123456789`
- Lambert's ad account: `act_987654321`
- Mazury's ad account: `act_555666777`
- ... all others

### Step 3: Generate System User Token

1. In System Users, select your system user
2. Click **Generate New Token**
3. Select your app
4. Choose permissions (token permissions):
   - ✅ `ads_management`
   - ✅ `ads_read`
   - ✅ `business_management`
5. Copy the token: `EAAGno4gbz9cBO...`
6. **Save it securely!** This is the ONLY time you'll see it

### Step 4: Update All Clients in Your Database

**Option A: Manual SQL Update**
```sql
-- Update all clients to use the shared token
UPDATE clients 
SET 
  system_user_token = 'EAAGno4gbz9cBO...',  -- Your actual token
  meta_access_token = NULL,                  -- Clear old 60-day tokens
  last_token_validation = NOW(),
  token_health_status = 'valid',
  api_status = 'valid'
WHERE api_status = 'valid'
  AND ad_account_id IS NOT NULL;
```

**Option B: Update via Admin UI**
1. Go to each client in your admin panel
2. Edit client
3. Paste the system user token
4. Save

**Option C: Bulk Update Script** (recommended)
```javascript
// Update all clients at once
const SHARED_TOKEN = "EAAGno4gbz9cBO...";

const clients = await supabase
  .from('clients')
  .select('id, name, ad_account_id')
  .not('ad_account_id', 'is', null);

for (const client of clients.data) {
  await supabase
    .from('clients')
    .update({
      system_user_token: SHARED_TOKEN,
      meta_access_token: null,
      token_health_status: 'valid',
      api_status: 'valid',
      last_token_validation: new Date().toISOString()
    })
    .eq('id', client.id);
  
  console.log(`✅ Updated ${client.name}`);
}
```

---

## 📊 Before vs After

### Before (Individual Tokens Per Client)

```
Belmonte Hotel
├─ system_user_token: "EAAxxxxx111..."  ← Unique token
├─ ad_account_id: "123456789"
└─ Status: ✅ Working (permanent)

Hotel Lambert
├─ meta_access_token: "EAAxxxxx222..."  ← Different token (expired)
├─ ad_account_id: "987654321"
└─ Status: ❌ Failed (expired)

Blue & Green Mazury
├─ meta_access_token: "EAAxxxxx333..."  ← Different token (expired)
├─ ad_account_id: "555666777"
└─ Status: ❌ Failed (expired)

Problems:
- 🔴 Multiple tokens to manage
- 🔴 Some expired
- 🔴 Hard to maintain
- 🔴 Inconsistent
```

### After (Shared System User Token)

```
Belmonte Hotel
├─ system_user_token: "EAAshared..."    ← SAME token
├─ ad_account_id: "123456789"           ← Unique ID
└─ Status: ✅ Working (permanent)

Hotel Lambert
├─ system_user_token: "EAAshared..."    ← SAME token
├─ ad_account_id: "987654321"           ← Unique ID
└─ Status: ✅ Working (permanent)

Blue & Green Mazury
├─ system_user_token: "EAAshared..."    ← SAME token
├─ ad_account_id: "555666777"           ← Unique ID
└─ Status: ✅ Working (permanent)

Benefits:
- ✅ ONE token for all
- ✅ Never expires
- ✅ Easy to maintain
- ✅ Consistent
```

---

## 🔍 How Your Code Already Supports This

### Database Schema (Already Ready!)

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  name TEXT,
  ad_account_id TEXT,              -- Unique per client ✅
  meta_access_token TEXT,          -- Can store shared token here
  system_user_token TEXT,          -- Or here (preferred)
  -- ... other fields
);
```

**You can put the SAME token value in multiple rows!**

### API Code (Already Supports This!)

```typescript
// In live-token-health route (line 140)
const metaToken = client.system_user_token || client.meta_access_token;

// In smart-cache-helper (line 84)
const metaToken = client.system_user_token || client.meta_access_token;

// Both will use the same token if all clients have the same value!
```

**No code changes needed!** Your system is already designed to support shared tokens.

---

## 🎯 Migration Strategy

### Option 1: Quick Migration (Recommended)

**Do all clients at once:**

```sql
-- Backup first!
CREATE TABLE clients_backup AS SELECT * FROM clients;

-- Update all Meta clients to use shared token
UPDATE clients 
SET 
  system_user_token = 'YOUR_SHARED_SYSTEM_USER_TOKEN_HERE',
  meta_access_token = NULL,
  last_token_validation = NOW(),
  token_health_status = 'valid'
WHERE ad_account_id IS NOT NULL;
```

**Then test:**
1. Click "Test All Tokens"
2. All should show ✅ PASSED
3. Test reports for a few clients
4. Verify data loads correctly

### Option 2: Gradual Migration

**Test with one client first:**

```sql
-- Test with Belmonte first
UPDATE clients 
SET 
  system_user_token = 'YOUR_SHARED_TOKEN',
  meta_access_token = NULL
WHERE name = 'Belmonte Hotel';
```

**Verify it works:**
1. Test Belmonte's token validation
2. Check Belmonte's reports
3. If all good, proceed with others

**Then migrate rest:**
```sql
UPDATE clients 
SET 
  system_user_token = 'YOUR_SHARED_TOKEN',
  meta_access_token = NULL
WHERE name IN (
  'Hotel Lambert Ustronie Morskie',
  'Apartamenty Lambert',
  'Blue & Green Mazury',
  -- ... add all others
);
```

---

## 🔒 Security Considerations

### Is It Safe to Share Tokens?

**YES**, as long as you control access at the Business Manager level.

**Security model:**
```
System User Token = Master Key to Your Business Manager
├─ But access is controlled by permissions
├─ Each ad account needs explicit permission grant
└─ Token alone can't access account without permission
```

### Best Practices

1. **✅ Use System User Token (not personal token)**
   - Personal tokens = tied to individual user
   - System tokens = tied to business, more stable

2. **✅ Grant Minimum Required Permissions**
   - Only `ads_read` if read-only access
   - Add `ads_management` only if needed

3. **✅ Store Token Securely**
   - Environment variables for production
   - Encrypted database fields
   - Never commit to Git

4. **✅ Monitor Token Usage**
   - Check API logs regularly
   - Set up alerts for unusual activity

5. **✅ Rotate Token Periodically**
   - Though system tokens don't expire
   - Good practice to regenerate annually
   - Easy: generate new, update once, done!

---

## 🚨 Common Concerns Addressed

### "What if the token is compromised?"

**With individual tokens:**
- 🔴 Need to regenerate 10+ tokens
- 🔴 Update 10+ database records
- 🔴 Risk missing some clients

**With shared token:**
- ✅ Regenerate ONE token
- ✅ Update database once (bulk update)
- ✅ All clients fixed instantly

**Actually EASIER to secure with shared token!**

### "What if I want different permissions per client?"

**Solution: Ad Account Permissions**

Permissions are controlled at the ad account level, not token level:

```
System User "API Bot"
├─ Ad Account A: View only
├─ Ad Account B: View + Manage
├─ Ad Account C: Full admin
└─ Ad Account D: Revoked (no access)
```

All using the SAME token, but different permissions per account!

### "What about rate limits?"

**Meta API rate limits are per:**
- ✅ Ad Account (not token)
- ✅ App (not token)

**Using one token doesn't increase rate limit pressure!**

Each ad account still has its own rate limits.

---

## 📋 Implementation Checklist

### Prerequisites
- [ ] Access to Meta Business Manager
- [ ] Admin rights to all client ad accounts
- [ ] Database access to update clients table

### Setup Steps
- [ ] Create system user in Meta Business Manager
- [ ] Grant system user access to all ad accounts
- [ ] Generate system user token
- [ ] Save token securely (environment variable)
- [ ] Test token with one ad account
- [ ] Update database (all clients)
- [ ] Run token validation test
- [ ] Verify reports load for sample clients
- [ ] Monitor for 24 hours
- [ ] Document token location for team

### Verification
- [ ] All clients show ✅ PASSED in token validation
- [ ] Reports load data correctly
- [ ] No permission errors in logs
- [ ] Cache refresh works
- [ ] Automated collection works

---

## 🎯 Example: Updating Your System

### Step-by-Step Guide

**1. Get your system user token from Meta:**
```
Meta Business Manager → System Users → Your System User → Generate Token
Result: EAAGno4gbz9cBOxxxxxxxxxxxxx...
```

**2. Test with database query:**
```sql
-- See current token situation
SELECT 
  name,
  CASE 
    WHEN system_user_token IS NOT NULL THEN 'Has System Token'
    WHEN meta_access_token IS NOT NULL THEN 'Has Access Token'
    ELSE 'No Token'
  END as current_token,
  ad_account_id
FROM clients
WHERE api_status = 'valid'
ORDER BY name;
```

**3. Update all clients:**
```sql
-- Update to shared system user token
UPDATE clients 
SET 
  system_user_token = 'EAAGno4gbz9cBOxxxxxxxxxxxxx',  -- Your actual token
  meta_access_token = NULL,
  last_token_validation = NOW(),
  token_health_status = 'valid',
  api_status = 'valid',
  updated_at = NOW()
WHERE ad_account_id IS NOT NULL;
```

**4. Verify update:**
```sql
-- Check all clients now use the shared token
SELECT 
  name,
  LEFT(system_user_token, 20) || '...' as token_preview,
  ad_account_id
FROM clients
WHERE system_user_token IS NOT NULL
ORDER BY name;
```

**5. Test in UI:**
- Go to `/admin/monitoring`
- Click "Test All Tokens"
- All should show ✅ PASSED

---

## 📊 Expected Results

### Token Validation Results

**Before (mixed tokens):**
```
✅ 1 client (Belmonte with system token)
❌ 12 clients (expired access tokens)
Total: 13 clients
```

**After (shared system token):**
```
✅ 13 clients (all using shared system token)
❌ 0 clients
Total: 13 clients
```

### Database View

**All clients will have:**
```sql
system_user_token = 'EAAGno4gbz9cBO...' -- Same value!
meta_access_token = NULL                -- Cleared
token_health_status = 'valid'           -- Healthy
api_status = 'valid'                    -- Active
```

---

## 🎉 Summary

### The Big Picture

**Current situation:**
- Belmonte: Has permanent system token ✅
- Others: Have expired 60-day tokens ❌
- Question: Can we use Belmonte's token for others?

**Answer: YES!**
- ✅ One system user token can serve ALL clients
- ✅ Just need different ad_account_id per client
- ✅ This is Meta's RECOMMENDED approach
- ✅ Your code already supports this!

### Next Steps

1. **Create/use system user** in Meta Business Manager
2. **Grant access** to all client ad accounts
3. **Generate token** once
4. **Update database** (bulk update)
5. **Test** - all clients should pass validation
6. **Celebrate** - no more token expiration issues! 🎉

### Benefits You'll Get

- ♾️ **Never expires** - No more token maintenance
- 🎯 **One token to rule them all** - Simple management
- ✅ **All clients healthy** - Consistent status
- 🔒 **More secure** - Centralized control
- 💰 **Time saver** - Update once, applies to all

---

**Bottom Line:** Use ONE system user token for ALL your clients. It's simpler, more secure, and exactly how Meta designed it to work! 🎯

---

*Last Updated: November 13, 2025*

