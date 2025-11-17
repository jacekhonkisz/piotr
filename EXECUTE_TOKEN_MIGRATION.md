# 🚀 Execute: Copy Belmonte's Token to All Clients

**Date:** November 13, 2025  
**Action:** Use Belmonte's working system_user_token for all clients  
**Time Required:** 5 minutes  
**Risk Level:** 🟢 Low (includes backup & rollback)

---

## ✅ What This Will Do

**Copy Belmonte's permanent system user token to all your other clients.**

### Before
```
Belmonte:        system_user_token ✅ → Working
Lambert:         meta_access_token ❌ → Expired  
Mazury:          meta_access_token ❌ → Expired
Others (10+):    meta_access_token ❌ → Expired
```

### After
```
Belmonte:        system_user_token ✅ → Working
Lambert:         system_user_token ✅ → Working (Belmonte's token)
Mazury:          system_user_token ✅ → Working (Belmonte's token)
Others (10+):    system_user_token ✅ → Working (Belmonte's token)
```

**Result:** All clients use ONE permanent token that never expires! 🎉

---

## 📋 Prerequisites Check

Before running the script, verify:

### ✅ Database Access
- [ ] You have database connection
- [ ] You can run SQL queries
- [ ] You have write permissions

### ✅ Meta Business Manager Setup
- [ ] System user exists (Belmonte's token comes from this)
- [ ] System user has access to ALL client ad accounts
- [ ] Ad account permissions are set correctly

**To verify in Meta Business Manager:**
1. Go to Business Settings → System Users
2. Find the system user
3. Check "Assigned Assets" → Should list all ad accounts

**If any ad accounts are missing:**
1. Go to Business Settings → Ad Accounts
2. For each missing account → Add People
3. Select your system user → Grant "ads_read" permission

---

## 🚀 Execution Steps

### Option A: Database GUI (Recommended)

**If you use a database GUI (like DBeaver, pgAdmin, etc.):**

1. **Open** `copy_belmonte_token_to_all.sql`
2. **Review** the script (read the comments)
3. **Run** the entire script
4. **Check** the output reports

### Option B: Command Line

**If you use psql or similar:**

```bash
# Connect to your database
psql $DATABASE_URL

# Run the migration script
\i copy_belmonte_token_to_all.sql

# Check the results
```

### Option C: Your Database Tool

**Use whatever database tool you normally use:**
- Copy contents of `copy_belmonte_token_to_all.sql`
- Paste into query window
- Execute
- Review output

---

## 📊 What to Look For

### Step 1 Output: Backup Created
```
backed_up_clients | client_names
------------------+----------------------------------
        13        | Belmonte Hotel, Lambert, Mazury...
```
✅ **Good:** Shows all clients backed up

### Step 2 Output: Belmonte's Token
```
name           | token_info
---------------+---------------------------------------
Belmonte Hotel | ✅ Has System Token: EAAGno4gbz9cBO...
```
✅ **Good:** Belmonte has system_user_token

### Step 3 Output: Preview Updates
```
name                      | current_status        | action
--------------------------+----------------------+------------------------
Apartamenty Lambert       | Has Access Token     | → Will get Belmonte token
Blue & Green Mazury       | Has Access Token     | → Will get Belmonte token
...
```
✅ **Good:** Shows what will change

### Step 4 Output: Update Complete
```
UPDATE 12
```
✅ **Good:** Shows number of clients updated (all except Belmonte)

### Step 5 Output: Verification
```
name                      | token_match          | cleanup_status
--------------------------+---------------------+------------------
Belmonte Hotel            | ✅ Same as Belmonte | ✅ Clean
Apartamenty Lambert       | ✅ Same as Belmonte | ✅ Clean
Blue & Green Mazury       | ✅ Same as Belmonte | ✅ Clean
...
```
✅ **Good:** All show "Same as Belmonte" and "Clean"

### Step 6 Output: Summary
```
report                 | total_meta_clients | unique_tokens | status
-----------------------+-------------------+---------------+---------------------------
📊 MIGRATION SUMMARY  |        13         |       1       | ✅ SUCCESS - All using same token!
```
✅ **Perfect:** unique_tokens = 1 means all clients use the same token!

---

## 🧪 Testing After Migration

### Test 1: Token Validation

1. **Go to:** `/admin/monitoring`
2. **Click:** "Test All Tokens" button
3. **Expected:**
   - ✅ All Meta clients show GREEN
   - ✅ Status: "PASSED"
   - ✅ No "No account info returned" errors

**If you see failures:**
- Check error message
- Verify system user has access to that ad account in Business Manager
- Check the ad_account_id is correct

### Test 2: Check Reports

**Test data loading for 2-3 clients:**

1. **Go to:** Client dashboard
2. **Select:** Date range (e.g., last month)
3. **Expected:**
   - ✅ Data loads without errors
   - ✅ Campaigns show up
   - ✅ Metrics display correctly

**Test these clients specifically:**
- ✅ Belmonte (should still work)
- ✅ Lambert (should now work)
- ✅ Mazury (should now work)

### Test 3: Check Logs

**Look at server logs for:**
```
🔑 Using system_user (permanent) for [Client Name]
✅ Meta token valid for [Client Name]
```

**Good signs:**
- All clients show "system_user (permanent)"
- No "access_token (60-day)" messages
- No API errors

---

## 🎯 Expected Results

### Monitoring Dashboard

**Before:**
```
Live Token Validation - META Platform
Status: ❌ 3 Critical, ⚠️ 10 Warnings
```

**After:**
```
Live Token Validation - META Platform  
Status: ✅ 13 Healthy, ❌ 0 Critical
```

### Database State

**All clients should have:**
```sql
system_user_token: "EAAGno4gbz9cBO..." (same value for all)
meta_access_token: NULL (cleared)
token_health_status: "valid"
api_status: "valid"
```

---

## ⚠️ Troubleshooting

### Problem: Some clients still show failed

**Possible causes:**
1. System user doesn't have access to that ad account
2. Ad account ID is incorrect in database
3. Ad account was deleted/disabled in Meta

**Solution:**
```sql
-- Check which clients failed
SELECT name, ad_account_id, system_user_token
FROM clients
WHERE token_health_status != 'valid';
```

Then verify in Meta Business Manager that system user has access.

### Problem: "unique_tokens" shows 2 or more

**Cause:** Belmonte might not have a system_user_token, or has both tokens

**Solution:**
```sql
-- Check Belmonte specifically
SELECT 
  name,
  system_user_token IS NOT NULL as has_system,
  meta_access_token IS NOT NULL as has_access
FROM clients
WHERE name ILIKE '%belmonte%';
```

If Belmonte doesn't have system_user_token, check meta_access_token instead.

### Problem: Rollback needed

**If something goes wrong:**
```sql
-- Restore from backup (included in script)
UPDATE clients c
SET 
  system_user_token = b.system_user_token,
  meta_access_token = b.meta_access_token,
  token_health_status = b.token_health_status,
  api_status = b.api_status
FROM clients_backup_before_token_copy b
WHERE c.id = b.id;
```

---

## 🎉 Success Criteria

You'll know it worked when:

### ✅ Database
- [ ] All clients have same system_user_token
- [ ] All clients have NULL meta_access_token
- [ ] All clients show token_health_status = 'valid'

### ✅ Monitoring
- [ ] Token validation shows all ✅ PASSED
- [ ] No "No account info returned" errors
- [ ] Platform badges show correctly

### ✅ Reports
- [ ] Client reports load data
- [ ] No authentication errors
- [ ] Metrics display correctly

### ✅ Logs
- [ ] Show "system_user (permanent)" for all
- [ ] No expired token messages
- [ ] API calls succeed

---

## 📅 Post-Migration Checklist

### Immediate (Within 1 Hour)
- [ ] Run token validation test
- [ ] Check 2-3 client reports
- [ ] Review error logs
- [ ] Verify all looks good

### Within 24 Hours
- [ ] Test all client reports
- [ ] Check automated collection works
- [ ] Verify cache refresh works
- [ ] Monitor error logs

### Within 48 Hours
- [ ] Confirm stable operation
- [ ] Document token location (for team)
- [ ] Clean up backup table (optional)

### Cleanup (After 48 Hours)
```sql
-- Once everything is verified working
DROP TABLE IF EXISTS clients_backup_before_token_copy;
```

---

## 🔐 Security Notes

### Is This Safe?

**YES!** Here's why:

1. **Token controls WHO can make requests**
   - System user identity

2. **Ad Account ID controls WHAT data is accessed**
   - Each client has unique ad_account_id
   - Token + Ad Account ID = specific client data

3. **Business Manager controls PERMISSIONS**
   - System user must have explicit permission per ad account
   - Can't access accounts without permission
   - Can revoke access per account anytime

### Security Best Practices

**After migration:**
- ✅ Store token securely (environment variable)
- ✅ Don't commit to Git
- ✅ Limit access to production database
- ✅ Monitor API usage regularly
- ✅ Document for team

---

## 📞 If You Need Help

### Before Running
- Review `SHARED_SYSTEM_USER_TOKEN_GUIDE.md` for detailed explanation
- Check Meta Business Manager for system user setup
- Verify ad account permissions

### During Running
- The script includes verification at each step
- Check output carefully
- Don't proceed if errors appear

### After Running
- Test thoroughly before considering it complete
- Keep backup table for 48 hours minimum
- Monitor logs for any issues

---

## 🎯 Summary

**What you're doing:**
- Copying Belmonte's working system_user_token to all other clients

**Why it's good:**
- ♾️ One permanent token for all
- ✅ No more expiration issues
- 🎯 Simpler management
- 🔒 More secure

**Time required:**
- Script execution: 1 minute
- Testing: 10 minutes
- Monitoring: 24-48 hours

**Risk level:**
- 🟢 Low (includes backup and rollback)

---

**Ready to execute?** Run `copy_belmonte_token_to_all.sql` and watch all your clients turn GREEN! ✅

---

*Last Updated: November 13, 2025*



