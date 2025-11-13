# 🔍 Token Display Audit Guide

**Date:** November 13, 2025  
**Purpose:** Verify the Meta System User Token is properly displayed in the modal  
**Status:** Database has token (207 chars) ✅ | Modal shows "Nie ustawiono" ❌

---

## 🎯 Quick 2-Step Audit

### **Step 1: Database Check** (30 seconds)

**Run this in Supabase SQL Editor:**

```sql
-- Copy and paste: audit_token_display.sql
```

**Expected Result:**
```
✅ SUCCESS: Token is properly stored in database (207 chars)
```

If you see ❌ FAIL, run `fix_empty_token.sql` first.

---

### **Step 2: Frontend Check** (1 minute)

**A. Restart Dev Server:**
```bash
# Stop server: Ctrl+C
npm run dev
```

**B. Open Browser DevTools:**
1. Press `F12` (or `Cmd+Option+I` on Mac)
2. Go to **Console** tab
3. Clear console (🚫 icon)

**C. Open the Modal:**
1. Click **"API Tokens"** button in your app
2. Switch to **"Meta Ads"** tab

**D. Check Console Output:**

✅ **Success - You should see:**
```
📤 API returning Meta token: { hasToken: true, tokenLength: 207, ... }
🔍 Meta settings API response: { meta_system_user_token: "EAAR4i...", ... }
🔑 Meta token value: EAAR4iSxFE60...
🔑 Meta token length: 207
```
→ **Modal should now show the token!**

❌ **If you see errors:**
```
❌ Meta settings API failed: 401 Unauthorized
```
→ Authentication issue - check if you're logged in as admin

```
📤 API returning Meta token: { hasToken: false, tokenLength: 0, ... }
```
→ RLS policy issue - check Section 6 below

---

## 🔧 Full Diagnostic Sections

### **Section 1: Database State**
- ✅ Check if token exists
- ✅ Verify token format (should start with "EAA")
- ✅ Verify token length (should be 150+ chars)

### **Section 2: Token Consistency**
- ✅ Compare settings table vs clients table
- ✅ Ensure tokens match (if using shared token)

### **Section 3: RLS Security**
- ✅ Check if Row Level Security is enabled
- ✅ Verify admin access policies exist
- ✅ Test read access

### **Section 4: API Response**
- ✅ Simulate what API should return
- ✅ Verify JSON structure

### **Section 5: Frontend Display**
- ✅ What modal should show
- ✅ Expected behavior

### **Section 6: Troubleshooting Checklist**
- ✅ 5-point verification checklist
- ✅ Pass/fail status for each check

### **Section 7: Final Verdict**
- ✅ Overall status
- ✅ Next steps if issues found

---

## 🌐 Network Tab Check (If Console Shows Success but Modal Still Broken)

**Open Network Tab:**
1. DevTools → **Network** tab
2. Clear network log (🚫 icon)
3. Open modal again
4. Look for request to `/api/admin/meta-settings`

**Check the response:**
```json
{
  "meta_system_user_token": "EAAR4iSxFE60...",
  "lastUpdate": "2025-11-13T..."
}
```

**If response is correct but modal still shows "Nie ustawiono":**
→ Frontend state issue - check React state in React DevTools

---

## 🚨 Common Issues & Fixes

### **Issue 1: Token Empty in Database**
```
❌ FAIL: Token is not in database
```

**Fix:**
```bash
# Run in Supabase SQL Editor:
fix_empty_token.sql
```

---

### **Issue 2: RLS Policy Blocks Access**
```
📤 API returning Meta token: { hasToken: false, tokenLength: 0, ... }
```

**Fix:**
```sql
-- Check your admin status
SELECT id, role FROM profiles WHERE id = auth.uid();

-- If role is not 'admin', update it:
UPDATE profiles SET role = 'admin' WHERE id = auth.uid();
```

---

### **Issue 3: API Returns Token but Modal Shows "Nie ustawiono"**

**This means the frontend isn't updating state.**

**Fix:**
1. Check browser console for React errors
2. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
3. Clear browser cache
4. Check if `existingMetaSystemUserToken` state is being set:
   ```javascript
   // Should see this in console:
   🔑 Meta token length: 207
   ```

---

### **Issue 4: Cached Response**

**The API might be returning cached empty response.**

**Fix (Already Implemented):**
- ✅ Added `cache: 'no-store'` to frontend fetch
- ✅ Added `dynamic = 'force-dynamic'` to API route
- ✅ Added cache-control headers to response

**Just restart dev server:**
```bash
npm run dev
```

---

## ✅ Success Indicators

After the audit, you should see:

**✅ In Database Audit:**
```
✅ SUCCESS: Token is properly stored in database (207 chars)
```

**✅ In Browser Console:**
```
📤 API returning Meta token: { hasToken: true, tokenLength: 207, ... }
🔍 Meta settings API response: { meta_system_user_token: "EAAR4i...", ... }
```

**✅ In Modal:**
```
Aktualny Meta System User Token
✅ [EAAR4iSxFE60BPKn1vq...] 👁️
Aktualnie używany token globalny - wprowadź nowy poniżej aby zaktualizować
```

---

## 🎉 Manual Override (If All Else Fails)

**Just re-save the token through the modal:**

1. You already have the token in the input field
2. Click the 👁️ **eye icon** to reveal it
3. Copy the full token
4. Click **"Zapisz Meta Token"**
5. This will trigger the save API and refresh the display

This bypasses any caching/display issues!

---

## 📋 Audit Checklist

Run through this in order:

- [ ] Run `audit_token_display.sql` → Check database
- [ ] Restart dev server (`npm run dev`)
- [ ] Open browser DevTools (F12)
- [ ] Open modal and check console logs
- [ ] Verify API response in Network tab
- [ ] Check if modal displays correctly

If all checks pass but modal still shows "Nie ustawiono":
- [ ] Hard refresh browser (Cmd+Shift+R)
- [ ] Clear browser cache
- [ ] Try manual re-save (option above)

---

## 🆘 If Nothing Works

Share the output of:
1. `audit_token_display.sql` (database state)
2. Browser console logs (when opening modal)
3. Network tab response for `/api/admin/meta-settings`

This will help diagnose the exact issue!

