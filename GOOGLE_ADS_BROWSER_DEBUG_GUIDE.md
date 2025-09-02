# Google Ads Browser Debug Guide 🔍

## 🚨 **URGENT: Check Browser Console**

The API is working perfectly (terminal shows 15,800 PLN), but UI shows zeros. We need to check what the **browser** is receiving.

### **Step 1: Open Browser Console**
1. Press **F12** (or Cmd+Option+I on Mac)
2. Click **Console** tab
3. **Refresh** the `/reports` page
4. **Select Google Ads** toggle

### **Step 2: Look for These Specific Logs**

You should see logs like this:

```
🚨 CRITICAL API RESPONSE: {
  periodId: "2025-08",
  responseSuccess: true,
  campaignsCount: 3,           ← Should be 3, not 0
  totalSpend: 15800,           ← Should be 15800, not 0
  apiSource: "database"
}

📊 Raw API response structure: {
  hasSuccess: true,
  hasData: true,
  campaignsInData: 3,          ← Should be 3
  campaignsDirect: 0
}

📊 Processing campaigns: {
  rawCampaigns: 3              ← Should be 3
}

📊 Transformed campaigns: 3 campaigns

💾 Setting successful report for 2025-08: {
  campaigns: [3 campaigns]     ← Should show 3 campaigns
}
```

### **Step 3: Check What You Actually See**

**If you see:**
- ✅ `campaignsCount: 3` and `totalSpend: 15800` → API working, issue is in UI rendering
- ❌ `campaignsCount: 0` and `totalSpend: 0` → API not returning database data
- ❌ Multiple API calls with different results → Race condition issue
- ❌ JavaScript errors → Frontend error preventing data display

### **Step 4: Check Network Tab**

1. Go to **Network** tab
2. **Refresh** page
3. Look for `fetch-google-ads-live-data` requests
4. Click on the request
5. Check **Response** tab
6. Should see:

```json
{
  "success": true,
  "data": {
    "campaigns": [
      {
        "campaign_name": "Belmonte Hotel - Search Ads",
        "spend": 8500,
        "impressions": 125000,
        "clicks": 3200
      }
      // ... 2 more campaigns
    ],
    "stats": {
      "totalSpend": 15800,
      "totalImpressions": 370000,
      "totalClicks": 7400
    }
  },
  "source": "database"
}
```

### **Step 5: Report Back**

**Tell me exactly what you see:**

1. **Console logs**: What values do you see for `campaignsCount` and `totalSpend`?
2. **Network response**: Does the API response show 15800 spend?
3. **JavaScript errors**: Any red error messages in console?
4. **Multiple calls**: How many `fetch-google-ads-live-data` requests do you see?

## 🎯 **Expected vs Actual**

**Expected (API working correctly):**
- Console: `totalSpend: 15800`
- Network: `"totalSpend": 15800`
- UI: Should show **15,800 zł**

**If API is broken:**
- Console: `totalSpend: 0`
- Network: `"totalSpend": 0`
- UI: Shows **0.00 zł** (current state)

## 🔧 **Quick Fixes to Try**

1. **Hard Refresh**: Ctrl+F5 (or Cmd+Shift+R)
2. **Clear Cache**: Settings → Clear browsing data
3. **Disable Extensions**: Try in incognito mode
4. **Check Different Browser**: Try Chrome/Firefox

---

**The terminal logs show the API is perfect. The browser console will tell us where the disconnect is happening!** 🎯
