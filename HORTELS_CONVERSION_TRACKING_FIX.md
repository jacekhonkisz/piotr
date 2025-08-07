# Hortels Conversion Tracking Issue - Analysis & Solution

## 🚨 **Issue Identified**

The conversion tracking is showing as **"Nie skonfigurowane" (Not configured)** for both Hortels clients because their Meta API tokens lack the required permissions to fetch campaign insights data.

---

## 🔍 **Root Cause Analysis**

### **1. Meta API Permission Issue**
- **Error**: `"Ad account owner has NOT grant ads_management or ads_read permission"`
- **Impact**: Cannot fetch campaign insights, including conversion tracking events
- **Result**: All conversion tracking values return 0, triggering "Not configured" status

### **2. Affected Clients**
1. **Havet** (havet@magialubczyku.pl)
   - Ad Account: `659510566204299`
   - Token Status: `valid` but lacks permissions
   
2. **Belmonte Hotel** (belmonte@hotel.com)
   - Ad Account: `438600948208231`
   - Token Status: `valid` but lacks permissions

### **3. How Conversion Tracking Works**
The system determines if conversion tracking is configured by checking if these values are > 0:
- `click_to_call` - Phone number clicks
- `lead` - Lead form submissions  
- `purchase` - Completed reservations
- `booking_step_1`, `booking_step_2`, `booking_step_3` - Reservation process steps
- `purchase_value` - Total reservation value

### **4. Data Flow**
1. **Meta API** → Fetches campaign insights with `actions` and `action_values` fields
2. **Parsing** → Extracts conversion events from the API response
3. **UI Logic** → If values = 0, shows "Nie skonfigurowane"

---

## 🛠️ **Solution: Fix Meta API Permissions**

### **Step 1: Generate New Meta API Tokens**

The current tokens are valid but lack the required permissions. You need to generate new tokens with proper scopes.

#### **Required Permissions:**
- `ads_read` - Read ad account data
- `ads_management` - Manage ad campaigns
- `business_management` - Access business accounts

#### **Token Generation Process:**
1. **Go to Meta for Developers**: https://developers.facebook.com/
2. **Select your app**: API Raporty
3. **Navigate to Tools → Graph API Explorer**
4. **Select your app** from the dropdown
5. **Add these permissions**:
   - `ads_read`
   - `ads_management` 
   - `business_management`
   - `ads_management_standard`
6. **Generate Access Token**

### **Step 2: Update Client Tokens**

Once you have the new tokens with proper permissions, update them in the database:

#### **Option A: Use Admin Panel**
1. Go to `/admin/clients`
2. Edit each Hortels client
3. Update the Meta Access Token field
4. Save changes

#### **Option B: Use Database Script**
```sql
-- Update Havet token
UPDATE clients 
SET meta_access_token = 'NEW_TOKEN_HERE',
    updated_at = NOW()
WHERE name = 'Havet';

-- Update Belmonte Hotel token  
UPDATE clients
SET meta_access_token = 'NEW_TOKEN_HERE',
    updated_at = NOW()
WHERE name = 'Belmonte Hotel';
```

### **Step 3: Verify Permissions**

After updating the tokens, run this script to verify the fix:

```bash
node scripts/check-hortels-permissions.js
```

**Expected Output:**
```
✅ Ad Account Access: [Account Name] (Status: 1)
✅ Campaign Insights Access: Available
📊 Found X campaigns with insights
```

---

## 🎯 **Expected Results After Fix**

### **Before Fix:**
- ❌ Conversion tracking shows "Nie skonfigurowane"
- ❌ All conversion metrics display "—"
- ❌ No conversion data available

### **After Fix:**
- ✅ Conversion tracking shows actual values
- ✅ Phone calls, leads, reservations display real data
- ✅ ROAS and cost per reservation calculated
- ✅ Booking steps tracked properly

---

## 🔧 **Alternative Solutions**

### **Option 1: Use System User Tokens**
If the clients can't provide tokens with proper permissions, you can:
1. Create a System User in Meta Business Manager
2. Grant the System User access to their ad accounts
3. Use the System User token instead

### **Option 2: Request Client Permissions**
Ask the clients to:
1. Go to their Meta Business Manager
2. Add your app as a partner
3. Grant the required permissions to your app

### **Option 3: Manual Data Entry**
As a temporary solution, you could:
1. Manually enter conversion tracking data
2. Override the "Not configured" status
3. Display mock data for demonstration

---

## 📋 **Implementation Checklist**

- [ ] Generate new Meta API tokens with proper permissions
- [ ] Update Havet client token in database
- [ ] Update Belmonte Hotel client token in database
- [ ] Verify permissions with test script
- [ ] Test conversion tracking display
- [ ] Confirm all metrics show real data
- [ ] Document the fix for future reference

---

## 🚀 **Quick Fix Script**

If you have the new tokens ready, you can use this script to update them:

```javascript
// scripts/update-hortels-tokens.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateHortelsTokens() {
  // Replace with actual new tokens
  const newTokens = {
    'Havet': 'NEW_HAVET_TOKEN_HERE',
    'Belmonte Hotel': 'NEW_BELMONTE_TOKEN_HERE'
  };

  for (const [clientName, newToken] of Object.entries(newTokens)) {
    const { error } = await supabase
      .from('clients')
      .update({ 
        meta_access_token: newToken,
        updated_at: new Date().toISOString()
      })
      .eq('name', clientName);

    if (error) {
      console.error(`❌ Error updating ${clientName}:`, error);
    } else {
      console.log(`✅ Updated ${clientName} token`);
    }
  }
}

updateHortelsTokens();
```

---

## 📞 **Support**

If you need help with:
- **Meta API token generation**: Follow Meta's official documentation
- **Permission setup**: Contact Meta Business Support
- **Database updates**: Use the provided scripts
- **Testing**: Run the verification scripts

---

*Report generated on: December 2024*  
*Issue: Conversion tracking shows "Nie skonfigurowane" for Hortels clients*  
*Root Cause: Meta API permission issues*  
*Solution: Update tokens with proper permissions* 