# Meta Rankings Setup Action Plan

## 🔍 **Diagnostic Results Summary**

### ✅ **What's Working:**
- Client data is properly stored in database
- Meta API token is valid and authenticated
- Basic API connectivity is functional

### ❌ **Main Issues Found:**

#### **1. API Permissions Problem**
```
Error: "Unsupported get request. Object with ID '703853679965014' does not exist, 
cannot be loaded due to missing permissions, or does not support this operation."
```

**Root Cause:** The Meta API token doesn't have sufficient permissions to access the ad account data.

#### **2. Missing Required Permissions**
The token needs these specific permissions:
- `ads_read` - Read ad account data
- `ads_management` - Access campaign insights
- `business_management` - Access business account data

## 🛠️ **Step-by-Step Fix Plan**

### **Phase 1: Fix API Permissions (CRITICAL)**

#### **Step 1.1: Check Current Token Permissions**
```bash
# Run this to see what permissions the current token has
node scripts/check-token-permissions.js
```

#### **Step 1.2: Generate New Token with Correct Permissions**
1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Navigate to your app
3. Go to "Tools" → "Graph API Explorer"
4. Select your app from the dropdown
5. Add these permissions:
   - `ads_read`
   - `ads_management` 
   - `business_management`
   - `read_insights`
6. Generate a new token
7. Update the token in your database

#### **Step 1.3: Update Database Token**
```sql
UPDATE clients 
SET meta_access_token = 'NEW_TOKEN_HERE'
WHERE email = 'jac.honkisz@gmail.com';
```

### **Phase 2: Verify Account Access**

#### **Step 2.1: Test Account-Level Access**
After updating the token, run:
```bash
node scripts/check-meta-rankings-setup.js
```

Expected results:
- ✅ Account info should load successfully
- ✅ Campaigns list should be accessible
- ✅ Insights data should be available

#### **Step 2.2: Check Campaign Status**
Ensure campaigns are:
- **ACTIVE** (not paused)
- **Have sufficient budget** (at least $5-10/day)
- **Have been running for 7+ days**

### **Phase 3: Test Rankings Data**

#### **Step 3.1: Test Different Date Ranges**
The script will test:
- Last 7 days
- Last 30 days  
- Last 90 days

**Expected Results:**
- 30+ day ranges should show ranking data
- 7-day ranges might show "Unknown" (insufficient data)

#### **Step 3.2: Check Minimum Requirements**
Meta requires for rankings:
- **1000+ impressions** per ad
- **Sufficient engagement** (clicks, interactions)
- **Comparable ads** in the same industry

### **Phase 4: Application Updates**

#### **Step 4.1: Improve Error Handling**
Update `src/lib/meta-api.ts` to handle permission errors gracefully:

```typescript
if (data.error?.code === 100) {
  console.error('❌ API Permissions Error:', data.error.message);
  throw new Error('Insufficient API permissions. Please check token permissions.');
}
```

#### **Step 4.2: Add Better Fallback Logic**
Update `src/components/MetaAdsTables.tsx` to show helpful messages:

```typescript
const getRankingLabel = (ranking: string) => {
  switch (ranking) {
    case 'ABOVE_AVERAGE':
      return { label: 'Above Average', color: 'text-white', bgColor: 'bg-gradient-to-r from-green-500 to-emerald-500' };
    case 'AVERAGE':
      return { label: 'Average', color: 'text-white', bgColor: 'bg-gradient-to-r from-yellow-500 to-orange-500' };
    case 'BELOW_AVERAGE':
      return { label: 'Below Average', color: 'text-white', bgColor: 'bg-gradient-to-r from-red-500 to-pink-500' };
    case 'UNKNOWN':
      return { label: 'Insufficient Data', color: 'text-gray-700', bgColor: 'bg-gradient-to-r from-gray-200 to-gray-300' };
    default:
      return { label: 'Not Available', color: 'text-gray-700', bgColor: 'bg-gradient-to-r from-gray-200 to-gray-300' };
  }
};
```

## 🎯 **Success Criteria**

### **Immediate Success (After Phase 1):**
- ✅ Account info loads without errors
- ✅ Campaigns list is accessible
- ✅ Basic insights data is available

### **Full Success (After Phase 3):**
- ✅ Quality rankings show actual values (Above/Average/Below)
- ✅ Engagement rankings are populated
- ✅ Conversion rankings are available
- ✅ Dashboard displays meaningful ranking data

## 🚨 **Troubleshooting Guide**

### **If Permissions Still Don't Work:**
1. Check if the ad account is in a Business Manager
2. Verify the user has admin access to the ad account
3. Ensure the app is approved for the required permissions
4. Try using a System User token instead of a user token

### **If Rankings Still Show "Unknown":**
1. Increase campaign budget to $10+/day
2. Wait for campaigns to accumulate 1000+ impressions
3. Use longer date ranges (30+ days)
4. Ensure campaigns are in the same industry/vertical

### **If No Data at All:**
1. Check if campaigns are actually active
2. Verify the date range contains active campaign data
3. Ensure the ad account has recent activity

## 📋 **Next Steps**

1. **Immediate:** Fix API permissions (Phase 1)
2. **Short-term:** Verify account access (Phase 2)
3. **Medium-term:** Test and optimize rankings (Phase 3)
4. **Long-term:** Improve application error handling (Phase 4)

## 🔗 **Useful Resources**

- [Meta Graph API Permissions](https://developers.facebook.com/docs/permissions/reference)
- [Meta Ads API Insights](https://developers.facebook.com/docs/marketing-api/insights)
- [Meta Business Manager Setup](https://developers.facebook.com/docs/business-manager) 