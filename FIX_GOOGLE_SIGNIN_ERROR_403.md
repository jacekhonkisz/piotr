# 🔧 FIX: Google Sign-In Error 403 - Access Denied

## 🔍 THE ERROR YOU'RE SEEING

```
Dostęp zablokowany: aplikacja Hotel Ads Dashboard 
nie przeszła procesu weryfikacji przez Google

Błąd 403: access_denied
```

**Account trying to sign in**: `pbajerlein@gmail.com`

---

## 🎯 ROOT CAUSE

You're using **"Sign in with Google"** (via Supabase), but:
- ❌ Your OAuth app is in **Testing mode**
- ❌ Your email (`pbajerlein@gmail.com`) is **NOT a test user**

**This is different from Google Ads API** (which you already have Standard Access for).

---

## ✅ SOLUTION: Add Yourself as Test User

### Step 1: Find Your Google Cloud Project

You need to find which Google Cloud project your Supabase app is using for OAuth.

**Option A: Check Supabase Dashboard**
1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Providers**
4. Find **Google** provider
5. Look for the **Client ID**
6. Note the Google Cloud project it belongs to

**Option B: Check Your Supabase Config**
```bash
# Look in your .env file for:
NEXT_PUBLIC_SUPABASE_URL=...
# Then check Supabase dashboard for the project
```

### Step 2: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. **Select the correct project** (the one used by Supabase)
3. Left menu → **APIs & Services** → **OAuth consent screen**

### Step 3: Add Yourself as Test User

1. Scroll down to **"Test users"** section
2. Click **"+ ADD USERS"**
3. Enter: `pbajerlein@gmail.com`
4. Click **"ADD"**
5. Click **"SAVE"**

### Step 4: Try Signing In Again

1. Go back to your app
2. Click "Zaloguj się przez Google" (Sign in with Google)
3. Should work now! ✅

---

## 🔍 HOW TO FIND THE RIGHT PROJECT

### If You Have Multiple Google Cloud Projects:

**Check Client ID in Supabase**:
1. Supabase Dashboard → Authentication → Providers → Google
2. Copy the **Client ID** (looks like: `123456-abc.apps.googleusercontent.com`)
3. Go to Google Cloud Console
4. For each project, go to **APIs & Services** → **Credentials**
5. Look for the OAuth Client ID that matches
6. That's your project!

---

## 📊 QUICK CHECKLIST

- [ ] **Find your Google Cloud project** (the one Supabase uses)
- [ ] Go to **OAuth consent screen**
- [ ] Check **"Test users"** section
- [ ] Add `pbajerlein@gmail.com`
- [ ] Click **SAVE**
- [ ] Try signing in with Google again
- [ ] ✅ Should work!

---

## 🎯 ALTERNATIVE: Publish the App

If you want **anyone** to sign in with Google (not just test users):

1. Go to OAuth consent screen
2. Review your app information
3. Click **"PUBLISH APP"**
4. Confirm

**Note**: For basic scopes (email, profile), publishing is usually instant. No verification needed unless you request sensitive scopes.

---

## ⚠️ IMPORTANT DISTINCTION

### Three Separate Google OAuth Setups:

1. **Google Ads API OAuth** ✅
   - Status: **Standard Access approved**
   - Purpose: Fetching Google Ads data
   - Developer Token: `WCX04VxQqB0fsV0YDX0w1g`
   - This is working!

2. **Google Sign-In (Supabase Auth)** ❌ 
   - Status: **Test mode, you're not a test user**
   - Purpose: User login to dashboard
   - This is what's failing!

3. **Your Dashboard Google Ads Integration** ✅
   - The email data fix we completed
   - This is working!

---

## 🔧 DETAILED STEPS WITH CONTEXT

### Understanding the OAuth Consent Screen

When you go to: https://console.cloud.google.com/apis/credentials/consent

You'll see:

```
App name: Hotel Ads Dashboard (or similar)
User type: External
Publishing status: Testing ← This is why only test users can sign in

Test users (0) ← This is the problem!
```

### Adding Test User

1. **Scroll down** to "Test users" section
2. You'll see: `Test users (0)` or a list of existing users
3. Click **"+ ADD USERS"** button
4. Enter email: `pbajerlein@gmail.com`
5. Click **"ADD"**
6. Verify it shows: `Test users (1)` with your email listed
7. Click **"SAVE"** at the bottom

### After Adding

You should see:
```
Test users (1)
✅ pbajerlein@gmail.com
```

Now you can sign in with Google!

---

## 🚀 IF YOU STILL SEE THE ERROR

### Check These:

1. **Correct Project?**
   - Make sure you added the test user in the SAME Google Cloud project that Supabase is using

2. **Wait a Moment**
   - Sometimes takes 1-2 minutes for changes to propagate
   - Try clearing browser cache
   - Try incognito/private browsing

3. **Check Supabase Provider**
   - Supabase Dashboard → Authentication → Providers
   - Make sure Google provider is **enabled**
   - Check Client ID and Secret are configured

4. **Redirect URI**
   - In Google Cloud Console → Credentials → OAuth 2.0 Client IDs
   - Make sure authorized redirect URIs include:
     ```
     https://your-project.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback/google
     ```

---

## 📝 SUMMARY

**Problem**: OAuth app in testing mode, you're not a test user  
**Solution**: Add `pbajerlein@gmail.com` as test user in Google Cloud Console  
**Time**: 2 minutes  
**Location**: Google Cloud Console → OAuth consent screen → Test users

**Your Google Ads API is separate and already working!** ✅

---

## 🎯 NEXT STEPS

1. Find which Google Cloud project Supabase is using
2. Add yourself as test user
3. Try signing in with Google
4. ✅ Should work!

**Need help finding the right project?** Check your Supabase dashboard first.





