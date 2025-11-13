# 🧪 Manual Token Testing Guide

**Purpose:** Test your Meta API token against all client ad accounts to see which have permissions and which don't.

---

## 🚀 Quick Start (3 Steps)

### Step 1: Get Your Token and Client List

**Run this SQL:**
```sql
-- Run: get_clients_for_testing.sql
```

This will give you:
1. The token to test (copy this!)
2. List of all client ad accounts
3. Ready-made curl commands

### Step 2: Option A - Use Automated Script (Easiest)

**Edit the script:**
1. Open `test_all_clients_manually.sh`
2. Replace `TOKEN="YOUR_TOKEN_HERE"` with your actual token
3. Update the CLIENTS array with your ad account IDs (from SQL output)

**Run it:**
```bash
chmod +x test_all_clients_manually.sh
./test_all_clients_manually.sh
```

**You'll see:**
```
🧪 Testing Meta API Token Against All Client Ad Accounts
==========================================================

✅ SUCCESS - Belmonte Hotel
   Account: Belmonte Hotel (ID: act_123456789)

❌ FAILED - Hotel Lambert
   Error: Insufficient permissions (Code: 200)
   Account ID: act_987654321

... (continues for all clients)

📊 SUMMARY
✅ Successful: 1 / 16
❌ Failed: 15 / 16

⚠️  Failed Clients:
   • Hotel Lambert
   • Apartamenty Lambert
   ... (all that failed)
```

### Step 3: Fix Permissions

For each failed client, add the ad account to your system user in Meta Business Manager.

---

## 📋 Option B - Manual curl Testing

**If you prefer to test one by one:**

### Get Token from Database
```sql
SELECT system_user_token 
FROM clients 
WHERE system_user_token IS NOT NULL 
LIMIT 1;
```

### Test Each Client

**Template:**
```bash
TOKEN="your_token_here"
AD_ACCOUNT_ID="123456789"  # Without 'act_' prefix

curl "https://graph.facebook.com/v18.0/act_${AD_ACCOUNT_ID}?fields=id,name,account_status&access_token=${TOKEN}"
```

**Success Response:**
```json
{
  "id": "act_123456789",
  "name": "Belmonte Hotel",
  "account_status": 1,
  "currency": "PLN"
}
```

**Permission Error:**
```json
{
  "error": {
    "message": "Insufficient permissions for this ad account",
    "code": 200,
    "error_subcode": 1357004
  }
}
```

**Token Invalid:**
```json
{
  "error": {
    "message": "Invalid OAuth access token",
    "code": 190,
    "error_subcode": 463
  }
}
```

---

## 🔍 Interpreting Results

### ✅ Success (HTTP 200 with data)
**Meaning:** Token has permission to this ad account  
**Action:** None needed for this account

### ❌ Error Code 200 - Insufficient Permissions
**Meaning:** Token is valid but lacks access to this ad account  
**Action:** Add ad account to system user in Meta Business Manager

### ❌ Error Code 190 - Invalid Token
**Meaning:** The token itself is invalid or expired  
**Action:** Generate new system user token in Meta Business Manager

### ❌ Error Code 100 - Account Not Found
**Meaning:** Ad account ID is wrong or account doesn't exist  
**Action:** Verify ad_account_id in database

---

## 🛠️ Fixing Permission Errors

**For each account that fails with "Insufficient permissions":**

### Step 1: Go to Meta Business Manager
```
https://business.facebook.com
```

### Step 2: Navigate to System Users
```
Business Settings → Users → System Users
```

### Step 3: Select Your System User
Click on the system user that owns the token you're testing

### Step 4: Check Current Access
View "Assigned Assets" → Ad Accounts

You'll see which ad accounts are currently assigned

### Step 5: Add Missing Ad Account
1. Click "Add Assets" → Ad Accounts
2. Search for the ad account by name or ID
3. Select it
4. Choose permissions: "ads_read" (minimum)
5. Save

### Step 6: Verify
Re-run the test for that specific ad account:
```bash
curl "https://graph.facebook.com/v18.0/act_ACCOUNT_ID?fields=id,name&access_token=$TOKEN"
```

Should now return success! ✅

---

## 📊 Expected Results

### If All Permissions Are Set Correctly

```bash
./test_all_clients_manually.sh

✅ SUCCESS - Belmonte Hotel
✅ SUCCESS - Hotel Lambert  
✅ SUCCESS - Apartamenty Lambert
✅ SUCCESS - jacek
... (all clients)

📊 SUMMARY
✅ Successful: 16 / 16
❌ Failed: 0 / 16

🎉 Perfect! All clients have proper permissions!
```

### If Permissions Are Missing

```bash
./test_all_clients_manually.sh

✅ SUCCESS - Belmonte Hotel
❌ FAILED - Hotel Lambert
   Error: Insufficient permissions (Code: 200)
❌ FAILED - Apartamenty Lambert
   Error: Insufficient permissions (Code: 200)
... (etc)

📊 SUMMARY
✅ Successful: 1 / 16
❌ Failed: 15 / 16

⚠️  Diagnosis: Token works but needs permissions for 15 accounts
```

---

## 🎯 Workflow

```
1. Run get_clients_for_testing.sql
   ↓
2. Copy token from output
   ↓
3. Edit test_all_clients_manually.sh
   ↓
4. Run the test script
   ↓
5. See which accounts fail
   ↓
6. Go to Meta Business Manager
   ↓
7. Add failed accounts to system user
   ↓
8. Grant ads_read permission
   ↓
9. Re-run test script
   ↓
10. All should pass! ✅
    ↓
11. Test in monitoring dashboard
    ↓
12. All clients show GREEN! 🎉
```

---

## 🔧 Troubleshooting

### "All clients fail with error 190"
**Problem:** Token is invalid  
**Solution:** Generate new system user token in Meta Business Manager

### "Some accounts show 'not found'"
**Problem:** Ad account ID in database doesn't match Meta  
**Solution:** Verify ad_account_id values:
```sql
SELECT name, ad_account_id FROM clients WHERE ad_account_id IS NOT NULL;
```

### "Script shows 'command not found'"
**Problem:** Script isn't executable or curl not installed  
**Solution:** 
```bash
chmod +x test_all_clients_manually.sh
# Or install curl: brew install curl (Mac) / apt install curl (Linux)
```

### "Can't find the ad account in Business Manager"
**Problem:** Account might be in different Business Manager or deleted  
**Solution:** Check with client if ad account still exists and which Business Manager it's in

---

## 📝 Quick Reference

### Get Token from Database
```sql
SELECT system_user_token FROM clients WHERE system_user_token IS NOT NULL LIMIT 1;
```

### Test Single Account
```bash
curl "https://graph.facebook.com/v18.0/act_ACCOUNT_ID?fields=id,name&access_token=TOKEN"
```

### Check All Clients in Database
```sql
SELECT name, ad_account_id FROM clients WHERE ad_account_id IS NOT NULL ORDER BY name;
```

### Verify Migration Worked
```sql
SELECT COUNT(DISTINCT system_user_token) FROM clients WHERE system_user_token IS NOT NULL;
-- Should return: 1 (all using same token)
```

---

## 🎉 Success Criteria

You'll know everything is working when:

### ✅ Test Script Shows
- All 16 clients: SUCCESS
- 0 failures
- Message: "Perfect! All clients have proper permissions!"

### ✅ Monitoring Dashboard Shows
- 16 Healthy (API Tested)
- 0 Critical
- All clients with ✅ GREEN status

### ✅ Meta Business Manager Shows
- System user has 16 ad accounts assigned
- Each with "ads_read" permission minimum

---

**Start with Step 1: Run `get_clients_for_testing.sql` to get your token and client list!**

---

*This manual testing helps you identify exactly which accounts need permissions before testing in the monitoring dashboard.*

