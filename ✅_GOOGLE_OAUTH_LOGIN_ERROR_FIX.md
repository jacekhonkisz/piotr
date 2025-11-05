# ⚠️ GOOGLE OAUTH LOGIN ERROR - HOW TO FIX

## 🔍 THE ERROR

```
Błąd 403: access_denied

Dostęp zablokowany: aplikacja Hotel Ads Dashboard 
nie przeszła weryfikacji przez Google
```

**Translation**: "Access denied: Hotel Ads Dashboard application has not passed Google verification"

---

## 🎯 ROOT CAUSE

Your app is using **"Sign in with Google"** (via Supabase Auth), but:

1. ❌ The Google OAuth app is in **Testing mode**
2. ❌ Your email (`pbajerlein@gmail.com`) is not added as a **Test User**
3. ⚠️ OR the OAuth consent screen needs to be published

**This is different from Google Ads API OAuth** - this is for user login to your dashboard.

---

## ✅ SOLUTION: Add Yourself as Test User

### Option 1: Add Test User (Quick Fix - 2 minutes)

**Step 1**: Go to Google Cloud Console
- Visit: https://console.cloud.google.com/
- Select your project

**Step 2**: Go to OAuth Consent Screen
- Left menu → **APIs & Services** → **OAuth consent screen**

**Step 3**: Add Test Users
- Scroll down to **"Test users"** section
- Click **"+ ADD USERS"**
- Enter: `pbajerlein@gmail.com`
- Click **"SAVE"**

**Step 4**: Try logging in again
- Refresh your app
- Click "Sign in with Google"
- Should work now! ✅

---

### Option 2: Publish Your App (For Production)

If you want anyone to be able to sign in (not just test users):

**Step 1**: Go to OAuth Consent Screen
- https://console.cloud.google.com/apis/credentials/consent

**Step 2**: Click "PUBLISH APP"
- Review your app details
- Click **"PUBLISH APP"** button
- Confirm the action

**Step 3**: App Status Changes
- Status: **"In Production"** ✅
- Anyone can now sign in with Google

**Note**: For sensitive scopes, Google may require verification, but for basic profile/email access, publishing is usually instant.

---

## 🔍 HOW TO CHECK YOUR CURRENT SETUP

### Check 1: Is Your App in Testing Mode?

1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Look at "Publishing status"
3. If it says **"Testing"** → You need to add test users OR publish

### Check 2: Who Are Your Test Users?

1. On the OAuth consent screen page
2. Scroll down to **"Test users"** section
3. Check if `pbajerlein@gmail.com` is listed
4. If not → Add it!

---

## 📊 QUICK DIAGNOSIS

### Your OAuth Consent Screen Should Look Like:

```
Publishing status: Testing
└─ Test users:
   ├─ pbajerlein@gmail.com ✅
   └─ [any other users who need access]
```

**OR**

```
Publishing status: In production ✅
└─ Anyone with a Google account can sign in
```

---

## 🔧 DETAILED STEPS WITH SCREENSHOTS

### 1. Navigate to Google Cloud Console
```
https://console.cloud.google.com/
→ Select your project
→ Left menu: "APIs & Services"
→ Click "OAuth consent screen"
```

### 2. Current Screen Shows
```
App name: Hotel Ads Dashboard
User type: External
Publishing status: Testing (most likely)
```

### 3. Scroll Down to "Test users"
```
Test users (0)  ← This is the problem!

Click: + ADD USERS
```

### 4. Add Your Email
```
Email addresses:
[pbajerlein@gmail.com    ]

Click: ADD
Click: SAVE
```

### 5. Verify
```
Test users (1)
✅ pbajerlein@gmail.com

Status: You can now sign in!
```

---

## ⚠️ IMPORTANT NOTES

### About Google Ads API vs Google Sign-In

These are **TWO DIFFERENT** OAuth setups:

1. **Google Ads API OAuth** (for fetching ad data)
   - Uses Google Ads-specific scopes
   - Requires `https://www.googleapis.com/auth/adwords`
   - Configured in your system settings

2. **Google Sign-In OAuth** (for user login)
   - Uses Supabase Auth
   - Requires `email` and `profile` scopes
   - Configured in Google Cloud Console

**You're currently seeing an error with #2 (Google Sign-In)**

---

## 🎯 RECOMMENDED SOLUTION

### For Development (Now):
✅ **Add yourself as a test user**
- Takes 2 minutes
- Only you can sign in
- Perfect for development

### For Production (Later):
✅ **Publish your app**
- Anyone can sign in
- Better for real users
- No verification needed for basic auth

---

## 📝 QUICK CHECKLIST

### To Fix Your Login:

- [ ] Go to Google Cloud Console
- [ ] Navigate to OAuth consent screen
- [ ] Check "Test users" section
- [ ] Add `pbajerlein@gmail.com` if not listed
- [ ] Click SAVE
- [ ] Try logging in again
- [ ] ✅ Should work!

---

## 🚀 ALTERNATIVE: Disable Google Login Temporarily

If you want to skip Google login for now:

### Use Email/Password Login Instead

Your app should support email/password auth via Supabase. Just use that instead of Google Sign-In.

**OR**

### Remove Google Login Button

If you're not using Google Sign-In, you can remove/hide the button in your login component.

---

## 📊 SUMMARY

**Problem**: Google OAuth app in testing mode, you're not a test user  
**Solution**: Add `pbajerlein@gmail.com` as test user in Google Cloud Console  
**Time**: 2 minutes  
**Location**: https://console.cloud.google.com/apis/credentials/consent

**Your email data fix is separate and already working!** ✅

---

## 🎯 NEXT STEPS

1. **Add yourself as test user** (2 minutes)
2. **Try logging in again**
3. **If it works**: ✅ Done!
4. **If not**: Publish the app to production

**Need help?** Let me know which step you're on!



