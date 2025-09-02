# 🔍 Social Insights Debugging Guide

## Quick Diagnosis Steps

### 1. Check Browser Console
1. **Open Developer Tools** (F12)
2. **Go to Console tab**
3. **Refresh the /reports page**
4. **Look for these messages:**

```javascript
// Expected log messages:
🔄 Fetching social insights from API...
🔍 Component context: { clientData: {...}, reportIds: [...] }
🔑 Session check: { hasSession: true, hasAccessToken: true }
📅 Using date range from report data: { start: "...", end: "..." }
📡 Making social insights API request: {...}
📦 API Response: { status: 200, ok: true }
✅ Social insights received: {...}
📊 Parsing social metrics: {...}
✅ Social insights state updated: {...}
```

### 2. Check Status Message
Look for the status box in the reports page:
- **🟢 Green**: API working but data might be zero
- **🟡 Yellow**: Loading state (should be temporary)
- **🔴 Red**: Error occurred - check error message

### 3. Manual API Test
**Copy and paste this into browser console:**

```javascript
// Test social insights API manually
async function testSocialInsights() {
  try {
    console.log('🧪 Manual API Test Starting...');
    
    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('❌ Not logged in');
      return;
    }
    
    console.log('✅ Session active:', session.user.email);
    
    // Test API call
    const response = await fetch('/api/fetch-social-insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa', // Belmonte
        dateRange: {
          start: '2025-01-01',
          end: '2025-01-31'
        },
        period: 'day'
      })
    });
    
    console.log('📡 Response:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('📊 Full API Response:', data);
    
    if (data.success) {
      console.log('✅ API Success!');
      console.log('📘 Facebook:', data.data.metrics.facebook);
      console.log('📷 Instagram:', data.data.metrics.instagram);
      console.log('🏢 Accounts:', data.data.accounts);
      console.log('🔑 Permissions:', data.data.permissions);
    } else {
      console.error('❌ API Failed:', data.error);
      console.error('📋 Details:', data.details);
    }
    
  } catch (error) {
    console.error('💥 Test Error:', error);
  }
}

// Run the test
testSocialInsights();
```

## Common Issues & Solutions

### Issue 1: "Insufficient permissions for social insights"
**Cause:** Meta access token missing required permissions

**Solution:**
1. Contact client to regenerate Meta token with these permissions:
   - `pages_read_engagement`
   - `pages_show_list` 
   - `instagram_basic`
   - `instagram_manage_insights`

### Issue 2: API returns success but all zeros
**Possible causes:**
1. **No activity in date range** - Try different periods
2. **Instagram not connected** - Check if business account linked
3. **New accounts** - Recently created accounts may have no historical data

**Debug steps:**
```javascript
// Check available accounts
const response = await fetch('/api/fetch-social-insights', {/* ... */});
const data = await response.json();
console.log('Available pages:', data.data.accounts.pages);
console.log('Available Instagram:', data.data.accounts.instagram);
```

### Issue 3: "Client missing Meta access token"
**Cause:** Client record in database has no token

**Solution:** Update client token in admin panel

### Issue 4: "Authentication failed"
**Cause:** User not logged in or session expired

**Solution:** Log out and log back in

### Issue 5: Component shows loading forever
**Cause:** API call hanging or failing silently

**Debug steps:**
1. Check Network tab for failed requests
2. Look for JavaScript errors in console
3. Verify useEffect is running with proper dependencies

## Expected Data Structure

### Successful API Response:
```json
{
  "success": true,
  "data": {
    "metrics": {
      "facebook": {
        "page_fan_adds": 15,
        "page_fans": 2450,
        "page_views": 1250,
        "page_impressions": 8900,
        "page_impressions_unique": 5600,
        "page_engaged_users": 340
      },
      "instagram": {
        "follower_count": 16150,
        "profile_views": 890,
        "reach": 5400,
        "impressions": 12000,
        "website_clicks": 45,
        "email_contacts": 0,
        "phone_call_clicks": 0,
        "get_directions_clicks": 0
      }
    },
    "accounts": {
      "pages": [
        {
          "id": "662055110314035",
          "name": "Moon SPA"
        },
        {
          "id": "2060497564277062", 
          "name": "Belmonte Hotel Krynica-Zdrój"
        }
      ],
      "instagram": [
        {
          "id": "instagram_id",
          "username": "belmontehotelkrynica",
          "followers_count": 16150,
          "connected_page": "Belmonte Hotel Krynica-Zdrój"
        }
      ]
    },
    "permissions": ["pages_read_engagement", "pages_show_list", "instagram_basic", "instagram_manage_insights"]
  }
}
```

## Zero Values Troubleshooting

### If Facebook metrics are zero:
1. **Check page activity** - Was there actual activity in the selected period?
2. **Verify page connection** - Is the correct page being accessed?
3. **Check permissions** - Does token have `pages_read_engagement`?

### If Instagram metrics are zero:
1. **Check business account** - Is Instagram connected as business account?
2. **Verify period** - Instagram insights may have delays
3. **Check permissions** - Does token have `instagram_manage_insights`?

### If both are zero but API succeeds:
1. **Try different date ranges** - Current month, previous month, last week
2. **Check account setup** - Verify accounts are properly configured in Meta
3. **Test with broader date range** - Last 90 days

## Next Steps

1. **Run the manual test** in browser console
2. **Check the status message** on reports page
3. **Try different date periods** to see if any return data
4. **If all fails**, check Meta Business Manager for account setup

The most likely issue is either:
- ✅ **Working correctly** but no activity in selected period
- 🔑 **Missing permissions** in Meta access token  
- 📱 **Account not connected** properly in Meta Business Manager 