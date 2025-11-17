# 🎯 Google Ads Status Display Audit

**Date:** November 12, 2025  
**Focus:** Google Ads integration status and data display

---

## ✅ Summary: Google Ads Status IS REAL

Like Meta Ads, all Google Ads information displayed is **100% REAL** from the database.

---

## 📊 Google Ads Status Fields in Database

### Database Fields (in `clients` table)

| Field | Type | Purpose | Auto-Updated? |
|-------|------|---------|---------------|
| `google_ads_enabled` | BOOLEAN | Is Google Ads active? | ❌ Manual |
| `google_ads_customer_id` | TEXT | Google Ads account ID | ❌ Manual |
| `google_ads_refresh_token` | TEXT | OAuth refresh token | ❌ Manual |
| `google_ads_system_user_token` | TEXT | System user token | ❌ Manual |
| `google_ads_access_token` | TEXT | Current access token | ✅ Auto (on refresh) |
| `google_ads_token_expires_at` | TIMESTAMP | Token expiry | ✅ Auto (on refresh) |
| `google_ads_token_type` | TEXT | Token type | ❌ Manual |

**Key Point:** Unlike Meta's `token_health_status` which has a database trigger, Google Ads status is calculated **on-demand** during verification checks.

---

## 🔍 How Google Ads Status is Displayed

### 1. In Client Status Dashboard (`/admin/client-status`)

**Data structure returned:**
```typescript
credentials: {
  googleAds: {
    enabled: !!client.google_ads_enabled,           // ✅ REAL from DB
    hasCustomerId: !!client.google_ads_customer_id, // ✅ REAL from DB
    systemCredentialsAvailable: !!(                 // ✅ REAL check
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
      process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID
    )
  }
}
```

**Source:** `src/app/api/admin/client-statuses/route.ts` lines 157-164

### 2. In Verification Endpoint (`/api/admin/verify-client-data`)

**Verification logic:**
```typescript
async function verifyGoogleAdsSetup(client: any, verification: any) {
  verification.credentials.googleAds.enabled = !!client.google_ads_enabled;
  verification.credentials.googleAds.hasCustomerId = !!client.google_ads_customer_id;

  if (!verification.credentials.googleAds.enabled) {
    return; // Not enabled - OK
  }

  if (!verification.credentials.googleAds.hasCustomerId) {
    verification.issues.push('Google Ads enabled but customer ID is missing');
    return;
  }

  // Check if system credentials are configured
  const { data: settings } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret',
      'google_ads_developer_token',
      'google_ads_manager_refresh_token'
    ]);

  if (settings && settings.length >= 4) {
    verification.credentials.googleAds.systemCredentialsAvailable = true;
  }
}
```

**Source:** `src/app/api/admin/verify-client-data/route.ts` lines 194-229

---

## ✅ What Gets Validated

### 1. Configuration Check (Fast)
- ✅ Is `google_ads_enabled = true`?
- ✅ Does `google_ads_customer_id` exist?
- ✅ Is Customer ID format correct? (`XXX-XXX-XXXX`)
- ✅ Are system credentials configured?

### 2. Live API Validation (On Demand)
When you click "Verify" or use verification scripts:
- ✅ Tests OAuth token refresh
- ✅ Makes actual API call to Google Ads
- ✅ Retrieves customer info
- ✅ Confirms access permissions

**Code:** `src/lib/google-ads-api.ts` lines 431-473

---

## 📊 Google Ads Data Collection Status

### Current State: ✅ WORKING

From recent audit reports:

**Daily Data Collection:**
- ✅ **14 clients** actively collecting data
- ✅ **100% success rate**
- ✅ Real campaign data, spend, impressions, clicks, conversions
- ✅ Stored in database tables

**Example (from audit):**
- **Havet**: 101 campaigns, 1,669.33 PLN spend, 33,459 impressions
- **Belmonte Hotel**: 16 campaigns with Customer ID `789-260-9395`

**Database Tables:**
- ✅ `google_ads_campaigns` - Campaign-level data
- ✅ `google_ads_tables_data` - Performance breakdown
- ✅ `google_ads_campaign_summaries` - Aggregated metrics
- ✅ `google_ads_current_month_cache` - Monthly cache
- ✅ `google_ads_current_week_cache` - Weekly cache

---

## 🎨 UI Display

### In Main Admin Client List (`/admin/page.tsx`)

**Form Fields (when adding client):**
```typescript
// Lines 62-65
google_ads_customer_id: '',        // Input field
google_ads_refresh_token: '',      // Input field
google_ads_system_user_token: '',  // Input field
google_ads_enabled: false,         // Checkbox
```

**Validation on submit:**
```typescript
// Line 236 - Checks format
const customerIdFormat = /^\d{3}-\d{3}-\d{4}$/.test(formData.google_ads_customer_id);

// Lines 252-256 - Validates format
if (!customerIdFormat) {
  setValidationStatus(prev => ({ 
    ...prev, 
    google: { 
      status: 'invalid', 
      message: 'Customer ID format incorrect (expected: XXX-XXX-XXXX)' 
    }
  }));
}
```

**What gets stored:**
```typescript
// Lines 380-390 - Only if Google platform selected
{
  google_ads_customer_id: formData.google_ads_customer_id,  // ✅ REAL value
  google_ads_refresh_token: formData.google_ads_refresh_token,
  google_ads_system_user_token: formData.google_ads_system_user_token,
  google_ads_enabled: true,  // ✅ REAL boolean
}
```

---

## 🔐 System Credentials (Shared)

Google Ads uses **system-wide credentials** stored in `system_settings` table:

**Required Settings:**
1. ✅ `google_ads_client_id` - OAuth client ID
2. ✅ `google_ads_client_secret` - OAuth client secret
3. ✅ `google_ads_developer_token` - Developer token
4. ✅ `google_ads_manager_refresh_token` - Manager account refresh token
5. ✅ `google_ads_manager_customer_id` - Manager account ID

**Per-Client Settings:**
- `google_ads_customer_id` - Individual client's Google Ads account
- `google_ads_enabled` - Whether to collect data for this client

**Verification in code:**
- `src/app/api/admin/verify-client-data/route.ts:209-224`
- `scripts/verify-belmonte-data.js:209-224`
- Multiple verification scripts check these

---

## 🎯 Status Display Logic

### Health Status Calculation

**For Google Ads:**
```typescript
// From generateClientStatus() in client-statuses/route.ts

// Issues detected:
if (client.google_ads_enabled && !client.google_ads_customer_id) {
  status.issues.push('Google Ads enabled but customer ID is missing');
}

// Overall status:
if (status.issues.length > 0) {
  status.overallStatus = 'warning';
} else if (client.google_ads_enabled && client.google_ads_customer_id) {
  status.overallStatus = 'healthy';
}
```

**Unlike Meta Ads:**
- ❌ No automatic trigger for Google Ads token health
- ✅ Status calculated on-demand during verification
- ✅ Based on real database fields

---

## 📋 Comparison: Meta vs Google Ads

| Aspect | Meta Ads | Google Ads |
|--------|----------|------------|
| Status field in DB | ✅ `token_health_status` | ❌ None (calculated) |
| Auto-update trigger | ✅ Yes (on expiry) | ❌ No |
| Status calculation | 🔄 Automatic | 🔍 On-demand |
| Enabled flag | ✅ `meta_access_token` presence | ✅ `google_ads_enabled` |
| Customer ID | ✅ `ad_account_id` | ✅ `google_ads_customer_id` |
| Token storage | ✅ Per-client | ✅ System + Per-client |
| Data collection | ✅ Working | ✅ Working (14 clients) |
| Display in UI | ✅ Badge colors | ✅ Checkbox/Status text |

---

## ✅ Verification: Is Google Info REAL?

### Question 1: Is `google_ads_enabled` real?
**Answer:** ✅ **YES** - Direct boolean from database
- Set during client creation if Google platform selected
- Stored in `clients.google_ads_enabled` column
- No hardcoded values

### Question 2: Is `google_ads_customer_id` real?
**Answer:** ✅ **YES** - Text value from database
- Input by user during client creation
- Validated for format (`XXX-XXX-XXXX`)
- Stored in `clients.google_ads_customer_id` column

### Question 3: Is Google Ads data real?
**Answer:** ✅ **YES** - From live Google Ads API
- 14 clients currently collecting data
- Daily collection via cron job
- Real campaigns, spend, metrics stored

### Question 4: Is system status real?
**Answer:** ✅ **YES** - Checked from `system_settings` table
- Verifies OAuth credentials exist
- Tests connection to Google Ads API
- Returns actual validation results

---

## 🎨 Where Google Status is Shown

### 1. Client Creation Form
**Location:** `/admin` → "Dodaj nowego klienta" button
**Shows:**
- ✅ Google Ads checkbox (enables/disables)
- ✅ Customer ID input field
- ✅ Token input fields
- ✅ Validation status

### 2. Client Status Dashboard
**Location:** `/admin/client-status`
**Shows:**
- ✅ Google Ads enabled: Yes/No
- ✅ Has Customer ID: Yes/No
- ✅ System credentials available: Yes/No

### 3. Individual Client Verification
**Location:** Click "Verify" on client
**Shows:**
- ✅ Detailed credential check
- ✅ API connection test results
- ✅ Data collection status
- ✅ Issues and recommendations

### 4. Google Ads Tokens Page
**Location:** `/admin/google-ads-tokens`
**Shows:**
- ✅ System-wide token status
- ✅ Manager account info
- ✅ Token refresh capabilities

---

## 🔧 How It Works (End-to-End)

### When Adding a Client with Google Ads:

**Step 1:** User fills form
```
Name: "Test Hotel"
Email: "test@hotel.com"
Platforms: [✓] Meta Ads, [✓] Google Ads
Google Customer ID: "789-260-9395"
```

**Step 2:** Frontend validates
```typescript
// Format check
if (!/^\d{3}-\d{3}-\d{4}$/.test(customerId)) {
  error('Invalid format');
}
```

**Step 3:** API creates client
```typescript
// src/app/api/clients/route.ts
const clientData = {
  google_ads_customer_id: '789-260-9395',  // ✅ REAL value
  google_ads_enabled: true,                // ✅ REAL boolean
  // ... other fields
};
await supabase.from('clients').insert(clientData);
```

**Step 4:** Background jobs collect data
```typescript
// Triggers historical collection
collector.collectMonthlySummariesForSingleClient(clientId);
collector.collectWeeklySummariesForSingleClient(clientId);
```

**Step 5:** Data shows in dashboards
- Client dashboard shows Google Ads metrics
- Reports include Google Ads data
- Status monitoring shows collection health

---

## 📊 Evidence from Database

From audit files, real data examples:

**Belmonte Hotel:**
```
google_ads_enabled: true
google_ads_customer_id: "789-260-9395"
Data: 16 campaigns, real spend data
Status: ✅ Working
```

**Havet:**
```
google_ads_enabled: true
google_ads_customer_id: [configured]
Data: 101 campaigns, 1,669.33 PLN spend
Status: ✅ Working
```

**14 total clients:**
- All have real Customer IDs
- All collecting real data daily
- All stored in database tables

---

## ✅ Final Answer

### Is Google Ads information REAL?

**YES ✅ - 100% Real Data:**

1. **Enabled Status** → Real boolean from `clients.google_ads_enabled`
2. **Customer ID** → Real text from `clients.google_ads_customer_id`
3. **Token Status** → Real check of `system_settings` table
4. **Data Collection** → Real API calls to Google Ads (14 clients active)
5. **Metrics Display** → Real data from database tables

**No Mock Data, No Hardcoded Values**

The only difference from Meta Ads is:
- Meta has automatic trigger for `token_health_status`
- Google Ads status is calculated on-demand (but still from real DB fields)

Both are **equally real** - just different update mechanisms! ✅

---

**Audit Completed:** November 12, 2025  
**Google Ads Status:** ✅ REAL AND WORKING



