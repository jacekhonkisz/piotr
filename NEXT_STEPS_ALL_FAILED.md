# 🔍 Diagnosis: All Clients Still Failed

**Status:** All clients showing "Meta API error - check token permissions"  
**Date:** November 13, 2025

---

## 🎯 What This Error Means

**Good news:** The error "Meta API error - check token permissions" means:
- ✅ The token is valid and working
- ✅ Meta API is responding
- ❌ But the token doesn't have permission to access these ad accounts

This is a **PERMISSIONS issue**, not a token validity issue.

---

## 🔍 Step 1: Check What Actually Happened

**Run this SQL to see the current state:**

```sql
-- Run: diagnose_current_state.sql
```

This will show you:
1. What tokens each client has
2. If the migration actually ran
3. What Belmonte's token is
4. If all clients have the same token

---

## 📊 Possible Scenarios

### Scenario A: Migration Worked, Need Permissions

**If SQL shows:**
- ✅ All clients have system_user_token
- ✅ All have the same token value
- ✅ Token came from Belmonte

**Problem:** The system user doesn't have access to the ad accounts

**Solution:** Grant permissions in Meta Business Manager (see Step 2)

### Scenario B: Migration Didn't Run

**If SQL shows:**
- ❌ Clients have different tokens or NULL
- ❌ No backup table exists

**Problem:** The SQL script didn't run or didn't complete

**Solution:** Re-run `copy_belmonte_token_to_all.sql`

### Scenario C: Belmonte Has No System Token

**If SQL shows:**
- ❌ Belmonte has meta_access_token (not system_user_token)

**Problem:** Belmonte doesn't have a permanent system user token

**Solution:** Need to create system user token in Meta Business Manager first

---

## 🛠️ Step 2: Grant Permissions (If Scenario A)

### Check in Meta Business Manager

1. **Go to:** Meta Business Manager (business.facebook.com)
2. **Navigate to:** Business Settings → Users → System Users
3. **Find your system user** (the one whose token is in the database)
4. **Click on it** → View "Assigned Assets"

### What You Should See

**Under "Ad Accounts":**
```
Expected:
✅ Belmonte Hotel - ad account 123456789
✅ Hotel Lambert - ad account 987654321
✅ Apartamenty Lambert - ad account 555666777
✅ jacek - ad account 111222333
✅ ... (all other clients)

If you see:
❌ Only Belmonte listed
❌ Some accounts missing
```

### If Accounts Are Missing: Add Them

**For EACH missing ad account:**

1. **Go to:** Business Settings → Ad Accounts
2. **Find the ad account** (search by name or ID)
3. **Click on it** → "Add People"
4. **Select:** Your system user
5. **Grant permissions:**
   - ✅ View performance
   - ✅ View analytics (if available)
6. **Save**

**Repeat for ALL client ad accounts!**

---

## 🧪 Step 3: Test Token Manually (Optional)

**To verify the token works before adding all permissions:**

### Get the Token

From SQL output (`diagnose_current_state.sql`), copy the token value.

### Test with Belmonte's Account

```bash
# Replace with your values:
TOKEN="EAAGno4gbz9cBO..."
AD_ACCOUNT_ID="123456789"  # Belmonte's ID

curl "https://graph.facebook.com/v18.0/act_${AD_ACCOUNT_ID}?fields=id,name,account_status&access_token=${TOKEN}"
```

**If successful, you'll see:**
```json
{
  "id": "act_123456789",
  "name": "Belmonte Hotel",
  "account_status": 1
}
```

**If permission error:**
```json
{
  "error": {
    "message": "Insufficient permissions",
    "code": 200
  }
}
```

### Test with Other Accounts

Try the same with other ad account IDs. If Belmonte works but others don't, it confirms it's a permissions issue.

---

## 🎯 Step 4: After Granting Permissions

### Re-test in Monitoring

1. **Go to:** `/admin/monitoring`
2. **Click:** "Test All Tokens"
3. **Expected:** Clients should turn GREEN as you add permissions

**You can test incrementally:**
- Add permission for 1 ad account
- Test
- See that client turn GREEN
- Add more permissions
- Test again

---

## 📋 Quick Checklist

### Immediate Actions

- [ ] Run `diagnose_current_state.sql`
- [ ] Check which scenario applies
- [ ] Verify Belmonte's token in database
- [ ] Check Meta Business Manager for system user
- [ ] Verify system user has ad account access

### If Permissions Issue

- [ ] List all client ad account IDs from database
- [ ] Check which are assigned to system user
- [ ] Add missing ad accounts to system user
- [ ] Test monitoring page after each addition

### If Migration Didn't Run

- [ ] Re-run `copy_belmonte_token_to_all.sql`
- [ ] Verify backup table created
- [ ] Check clients have same token
- [ ] Then proceed with permissions

---

## 🔍 Common Issues

### Issue: "I don't have a system user in Business Manager"

**Solution:** Create one first:

1. Business Settings → Users → System Users
2. Click "Add" → Create system user
3. Name it: "API Integration" or similar
4. Generate token with permissions: ads_read, ads_management
5. Save the token
6. Then run migration SQL with this new token

### Issue: "I can't find some ad accounts in Business Manager"

**Possible reasons:**
1. Ad account is in different Business Manager
2. Ad account was deleted
3. Client's ad_account_id in database is wrong

**Solution:** Verify ad_account_id values:
```sql
SELECT name, ad_account_id 
FROM clients 
WHERE ad_account_id IS NOT NULL 
ORDER BY name;
```

Cross-reference with Meta Business Manager → Ad Accounts

### Issue: "Belmonte shows as failed too"

**This means:** Belmonte's token doesn't even work for Belmonte!

**Possible causes:**
1. Belmonte doesn't have system_user_token (has access_token instead)
2. The token in database is invalid/expired
3. Ad account ID is wrong

**Solution:** Check Belmonte's actual token:
```sql
SELECT * FROM clients WHERE name ILIKE '%belmonte%';
```

---

## 🎯 Expected Resolution Path

### Path A: Permissions (Most Likely)

```
Current: All failed with "check token permissions"
↓
Run diagnose_current_state.sql
↓
Confirm: All have same system_user_token
↓
Go to Meta Business Manager
↓
Add ad account permissions to system user
↓
Re-test monitoring
↓
Result: All turn GREEN ✅
```

### Path B: No System User Token Yet

```
Current: All failed
↓
Run diagnose_current_state.sql
↓
Find: Belmonte has meta_access_token, not system_user_token
↓
Create system user in Meta Business Manager
↓
Generate system user token
↓
Update Belmonte with this token:
UPDATE clients SET system_user_token = 'NEW_TOKEN' 
WHERE name ILIKE '%belmonte%';
↓
Re-run copy_belmonte_token_to_all.sql
↓
Add all ad account permissions
↓
Result: All turn GREEN ✅
```

---

## 🚨 Critical Questions to Answer

1. **Does the backup table exist?**
   - Check: `\dt clients_backup_before_token_copy` in psql
   - Or run diagnose_current_state.sql

2. **Do all clients have the same token?**
   - Should be: 1 unique system_user_token
   - Check SQL output

3. **Does Belmonte have system_user_token or meta_access_token?**
   - Need: system_user_token (permanent)
   - If has meta_access_token: wrong token type

4. **In Meta Business Manager, how many ad accounts does your system user have access to?**
   - Should be: ALL 16 client ad accounts
   - If fewer: need to add permissions

---

## 📞 Next Step

**Run `diagnose_current_state.sql` and share the output.**

Based on what it shows, I can give you the exact steps to fix it!

---

*The error "check token permissions" is actually progress - the token is working, just needs permissions!*



