# 🔧 Meta API Permission Issues - Complete Fix Guide

## 🚨 **CRITICAL ISSUE IDENTIFIED**

The reports page is showing zero data because the Meta API tokens don't have the required permissions. The diagnostic revealed:

```
❌ Account info error: (#200) Ad account owner has NOT grant ads_management or ads_read permission
```

## 📋 **Root Cause Analysis**

### **1. Permission Issues**
- **Missing Permissions**: Tokens lack `ads_management` or `ads_read` permissions
- **Token Scope**: Current tokens may be short-lived or have insufficient scope
- **Account Access**: The ad accounts may not be properly connected

### **2. Data Flow Problems**
- **API Calls Failing**: All Meta API calls return permission errors
- **Fallback Logic**: When API fails, the system shows empty data instead of errors
- **Silent Failures**: Users see zeros instead of clear error messages

## 🛠️ **Immediate Fixes**

### **Fix 1: Update Token Permissions**

1. **Go to Meta Business Manager**:
   - Visit: https://business.facebook.com/
   - Navigate to Business Settings > Users > System Users

2. **Update System User Permissions**:
   - Select your system user
   - Add these permissions:
     - `ads_management`
     - `ads_read`
     - `business_management`
     - `read_insights`

3. **Regenerate Access Token**:
   - Go to Business Settings > System Users > Generate Token
   - Select the required permissions
   - Generate a new long-lived token

### **Fix 2: Update Database Tokens**

Run this script to update tokens with proper permissions:

```javascript
// scripts/update-meta-tokens-with-permissions.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateTokensWithPermissions() {
  console.log('🔄 Updating Meta tokens with proper permissions...\n');

  // You'll need to manually update these tokens with proper permissions
  const updatedTokens = {
    'client@techcorp.com': 'NEW_TOKEN_WITH_ADS_MANAGEMENT_PERMISSION',
    'jac.honkisz@gmail.com': 'NEW_TOKEN_WITH_ADS_MANAGEMENT_PERMISSION'
  };

  for (const [email, newToken] of Object.entries(updatedTokens)) {
    if (newToken === 'NEW_TOKEN_WITH_ADS_MANAGEMENT_PERMISSION') {
      console.log(`⚠️  Please update token for ${email} manually`);
      continue;
    }

    const { error } = await supabase
      .from('clients')
      .update({ meta_access_token: newToken })
      .eq('email', email);

    if (error) {
      console.error(`❌ Failed to update ${email}:`, error);
    } else {
      console.log(`✅ Updated token for ${email}`);
    }
  }
}

updateTokensWithPermissions();
```

### **Fix 3: Enhanced Error Handling**

Update the reports page to show clear error messages instead of silent failures:

```typescript
// In src/app/reports/page.tsx - Update the loadMonthData function

const loadMonthData = async (monthId: string) => {
  try {
    setLoadingMonth(monthId);
    console.log(`📡 Loading data for month: ${monthId}`);
    
    // ... existing code ...

    const response = await fetch('/api/fetch-live-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: {
          start: monthStartDate,
          end: monthEndDate
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ API Error:`, errorData);
      
      // Show specific error messages
      if (errorData.error?.includes('permission')) {
        setError(`Meta API Permission Error: ${errorData.error}. Please contact support to update your access token.`);
      } else {
        setError(`Failed to load data: ${errorData.error || 'Unknown error'}`);
      }
      return;
    }

    // ... rest of the function
  } catch (error: any) {
    console.error(`❌ Error loading data for ${monthId}:`, error);
    setError(`Failed to load data for ${monthId}: ${error.message}`);
  } finally {
    setLoadingMonth(null);
  }
};
```

## 🔍 **Testing the Fix**

### **Step 1: Run Diagnostic**
```bash
node scripts/debug-meta-api-data.js
```

### **Step 2: Test Individual API Calls**
```bash
# Test with a specific client
curl -X GET "https://graph.facebook.com/v18.0/act_123456789?access_token=YOUR_TOKEN&fields=id,name"
```

### **Step 3: Test Full Flow**
1. Update tokens with proper permissions
2. Restart the development server
3. Navigate to reports page
4. Check browser console for API responses

## 📊 **Expected Results After Fix**

### **Before Fix (Current State)**:
- ❌ All API calls return permission errors
- ❌ Reports show zeros everywhere
- ❌ Silent failures with no error messages

### **After Fix (Expected State)**:
- ✅ API calls succeed with proper permissions
- ✅ Real campaign data appears in reports
- ✅ Clear error messages if issues occur
- ✅ Proper fallback handling for missing data

## 🚀 **Long-term Improvements**

### **1. Token Management System**
- Implement automatic token refresh
- Add token validation on login
- Create admin interface for token management

### **2. Better Error Handling**
- Show specific error messages for different API issues
- Implement retry logic for temporary failures
- Add offline mode with cached data

### **3. Data Validation**
- Validate API responses before displaying
- Add data quality checks
- Implement data consistency validation

## 🔧 **Quick Test Script**

Create this script to test if the fix worked:

```javascript
// scripts/test-meta-api-fix.js
require('dotenv').config({ path: '.env.local' });

async function testMetaAPIFix() {
  console.log('🧪 Testing Meta API Fix...\n');

  // Test with a client that has updated permissions
  const testToken = 'YOUR_UPDATED_TOKEN_HERE';
  const adAccountId = '123456789';

  const url = `https://graph.facebook.com/v18.0/act_${adAccountId}?access_token=${testToken}&fields=id,name,account_id`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.log('❌ Still getting error:', data.error.message);
    } else {
      console.log('✅ API working! Account:', data.name);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

testMetaAPIFix();
```

## 📞 **Support Steps**

If you need help implementing these fixes:

1. **Check Meta Business Manager** for proper permissions
2. **Update tokens** with the required scopes
3. **Test API calls** individually
4. **Update the application** with better error handling
5. **Monitor logs** for any remaining issues

The key issue is that the Meta API tokens need the `ads_management` or `ads_read` permissions to access campaign data. Once these permissions are granted, the reports should start showing real data instead of zeros. 