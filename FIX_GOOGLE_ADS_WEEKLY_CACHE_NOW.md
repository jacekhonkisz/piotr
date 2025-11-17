# 🚨 Fix Google Ads Weekly Cache Now

## 🔴 Current Status

**Google Ads Weekly Cache: BROKEN (0/14 clients working)**

```
Error: "Token refresh failed: 400"
Root Cause: OAuth tokens expired (Testing mode = 7-day expiration)
```

---

## ✅ Quick Fix (15 Minutes)

### Step 1: Change OAuth App to Production Mode

1. **Go to Google Cloud Console:**
   ```
   https://console.cloud.google.com/apis/credentials/consent
   ```

2. **Click "PUBLISH APP" or Change to "Internal"**
   - If using Google Workspace → Select **"Internal"** (immediate)
   - If using personal Gmail → Select **"In production"** (may need verification)

3. **Verify Status:**
   - Publishing status should show: **"In production"** ✅
   - No "Testing" warnings ✅

---

### Step 2: Regenerate Tokens for All Clients

#### Option A: Bulk Regeneration (Recommended)

**You'll need to:**
1. Generate OAuth URL for each client
2. Get authorization code (user clicks "Allow")
3. Exchange code for refresh token
4. Update database

**Scripts available:**
```bash
# Generate OAuth URL
npx tsx scripts/generate-google-oauth-url.ts

# Exchange code for token
npx tsx scripts/exchange-oauth-code.ts "YOUR_CODE_HERE"
```

#### Option B: Manual Via UI

If you have an admin UI for token management:
1. Have each client re-authenticate
2. Store new refresh tokens

---

### Step 3: Verify Fix

After regenerating tokens:

```bash
# Test Google Ads weekly cache
curl -X POST http://localhost:3000/api/automated/refresh-google-ads-current-week-cache \
  -H "Content-Type: application/json" | jq '.summary'
```

**Expected Result:**
```json
{
  "successful": 14,
  "errors": 0
}
```

---

## 📊 Affected Clients (14 total)

All clients with Google Ads are affected:
- Hotel Lambert Ustronie Morskie
- Sandra SPA Karpacz
- Belmonte Hotel
- Blue & Green Mazury
- Cesarskie Ogrody
- Havet
- Hotel Diva SPA Kołobrzeg
- Hotel Artis Loft
- Arche Dwór Uphagena Gdańsk
- Blue & Green Baltic Kołobrzeg
- Hotel Zalewski Mrzeżyno
- Hotel Tobaco Łódź
- (+ 2 more)

---

## 🔍 Why This Happened

**OAuth Testing Mode:**
- Google sets default OAuth apps to "Testing" mode
- Testing mode = 7-day token expiration
- Production mode = Permanent tokens (until revoked)

**Timeline:**
- Tokens generated 7+ days ago
- All expired simultaneously
- Weekly cache can't refresh without valid tokens

---

## 📝 Full Documentation

For complete details, see:
- **`GOOGLE_TOKEN_FIX_EMAIL_GUIDE.md`** - Step-by-step OAuth fix
- **`META_VS_GOOGLE_WEEKLY_CACHE_STATUS.md`** - Comparison of both platforms

---

## ⚡ After Fix Checklist

- [ ] OAuth app in "Production" mode
- [ ] All 14 clients have new refresh tokens
- [ ] Test endpoint shows 14/14 success
- [ ] SQL shows data in `google_ads_current_week_cache`
- [ ] Monitor automated cron jobs

---

## 🆚 Comparison

| Aspect | Meta Weekly Cache | Google Ads Weekly Cache |
|--------|-------------------|-------------------------|
| **Status** | ✅ Fixed | ❌ Broken |
| **Issue Type** | Code/Auth | OAuth/Credentials |
| **Fix Complexity** | Easy (code change) | Medium (token regeneration) |
| **Time to Fix** | 10 mins ✅ | 15-30 mins |
| **Success Rate** | 13/16 (81%) | 0/14 (0%) |

---

**Date:** November 12, 2025  
**Priority:** 🔴 **HIGH** - Google Ads data not updating  
**Action Required:** OAuth token regeneration



