# All-Time Zeros Audit Report

## 🎯 Executive Summary

**Date:** August 5, 2025  
**Issue:** "Cały Okres" (Full Period) view showing all zeros  
**Status:** 🔍 **UNDER INVESTIGATION** - Root cause analysis in progress

## 🔍 Root Cause Analysis

### The Problem
When users click "Cały Okres" (Full Period) button in the reports page, all metrics show zero values:
- **Całkowite Wydatki (Total Spend):** 0,00 zł
- **Wyświetlenia (Impressions):** 0
- **Kliknięcia (Clicks):** 0
- **Konwersje (Conversions):** 0

### Technical Analysis

#### 1. Data Flow Analysis
```typescript
// Frontend: src/app/reports/page.tsx
const loadAllTimeData = async () => {
  // Fetches data month by month from effective start date to today
  for (let year = startYear; year <= currentYear; year++) {
    for (let month = monthStart; month <= monthEnd; month++) {
      // API call for each month
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        body: JSON.stringify({
          dateRange: { start, end },
          clientId: client.id
        })
      });
    }
  }
};
```

#### 2. API Endpoint Analysis
```typescript
// Backend: src/app/api/fetch-live-data/route.ts
export async function POST(request: NextRequest) {
  // Processes date range and calls Meta API
  const campaignInsights = await metaService.getCampaignInsights(
    adAccountId,
    dateStart,
    dateEnd,
    timeIncrement
  );
  
  // Returns processed data
  return NextResponse.json({
    data: {
      campaigns: campaignInsights,
      stats: { totalSpend, totalImpressions, totalClicks, totalConversions }
    }
  });
}
```

#### 3. Meta API Service Analysis
```typescript
// src/lib/meta-api.ts
async getCampaignInsights(adAccountId, dateStart, dateEnd, timeIncrement) {
  // Makes API call to Meta Graph API
  const response = await fetch(url);
  const data = await response.json();
  
  // Returns empty array if no data
  if (!data.data || data.data.length === 0) {
    return [];
  }
}
```

## 🔍 Potential Root Causes

### 1. **Meta API Token Issues**
- **Token Expiration:** Meta API tokens can expire
- **Token Permissions:** Insufficient permissions for insights
- **Token Validation:** Token might be invalid

### 2. **Date Range Issues**
- **API Limits:** Meta API has 37-month limit
- **Invalid Dates:** Date formatting issues
- **Future Dates:** Requesting data from future dates

### 3. **Ad Account Issues**
- **No Campaigns:** Ad account has no campaigns
- **Inactive Campaigns:** All campaigns are paused/inactive
- **Wrong Account:** Incorrect ad account ID

### 4. **Data Processing Issues**
- **Empty Responses:** Meta API returns empty data
- **Data Transformation:** Issues in data processing
- **Error Handling:** Errors being swallowed

### 5. **Frontend Processing Issues**
- **Data Aggregation:** Issues in combining monthly data
- **State Management:** Problems with React state updates
- **Component Rendering:** Issues in WeeklyReportView

## 🔧 Investigation Steps

### Step 1: Check Meta API Token
```javascript
// Test token validation
const tokenValidation = await metaService.validateToken();
console.log('Token validation:', tokenValidation);
```

### Step 2: Test Single Month API Call
```javascript
// Test with a known good month
const testMonth = {
  start: '2024-01-01',
  end: '2024-01-31'
};
```

### Step 3: Check Ad Account Data
```javascript
// Get all campaigns for the ad account
const campaigns = await metaService.getCampaigns(adAccountId);
console.log('Campaigns found:', campaigns.length);
```

### Step 4: Verify Date Calculations
```javascript
// Check effective start date calculation
const clientStartDate = new Date(client.created_at);
const maxPastDate = new Date();
maxPastDate.setMonth(maxPastDate.getMonth() - 37);
const effectiveStartDate = clientStartDate > maxPastDate ? clientStartDate : maxPastDate;
```

## 📊 Expected vs Actual Behavior

### Expected Behavior
- **Data Source:** Meta API campaign insights
- **Date Range:** From client creation or 37 months ago (whichever is later)
- **Data Type:** Aggregated campaign performance metrics
- **Display:** Non-zero values for active campaigns

### Actual Behavior
- **Data Source:** Meta API (but returning zeros)
- **Date Range:** Correctly calculated
- **Data Type:** Campaign insights (but all zeros)
- **Display:** All metrics showing zero

## 🎯 Most Likely Causes

### 1. **Meta API Token Issues (High Probability)**
- Token might be expired or invalid
- Token might not have required permissions
- Token might be for wrong ad account

### 2. **No Active Campaigns (Medium Probability)**
- All campaigns might be paused
- Campaigns might not have data for the date range
- Ad account might be empty

### 3. **Date Range Issues (Medium Probability)**
- Requesting data from periods with no activity
- Date formatting issues
- API limit violations

### 4. **Data Processing Bugs (Low Probability)**
- Issues in the month-by-month aggregation
- Problems in the frontend data processing
- State management issues

## 🔧 Recommended Fixes

### Immediate Actions
1. **Check Meta API Token Status**
   - Validate token expiration
   - Check token permissions
   - Verify token belongs to correct ad account

2. **Test Single Month API Call**
   - Test with a known good month (e.g., January 2024)
   - Verify API response structure
   - Check for error messages

3. **Verify Ad Account Data**
   - Check if ad account has campaigns
   - Verify campaign status (active/paused)
   - Check campaign date ranges

### Code Improvements
1. **Enhanced Error Handling**
   ```typescript
   // Add better error logging
   console.log('Meta API Response:', {
     status: response.status,
     data: data,
     error: data.error
   });
   ```

2. **Token Validation**
   ```typescript
   // Add token validation before API calls
   const tokenInfo = await metaService.getTokenInfo();
   if (!tokenInfo.isValid) {
     throw new Error('Invalid Meta API token');
   }
   ```

3. **Data Validation**
   ```typescript
   // Validate campaign data before processing
   if (campaignInsights.length === 0) {
     console.log('No campaign insights found for date range');
   }
   ```

## 📋 Next Steps

1. **Run Debug Script:** Execute `debug-all-time-zeros.js` to get detailed logs
2. **Check Browser Console:** Look for error messages in browser dev tools
3. **Verify Token Status:** Check Meta API token validity and permissions
4. **Test Single Month:** Test API with a specific month to isolate the issue
5. **Check Ad Account:** Verify ad account has campaigns and data

## 🔍 Debug Commands

```bash
# Test the debug script
node scripts/debug-all-time-zeros.js

# Check server health
curl http://localhost:3000/api/health

# Test API endpoint directly
curl -X POST http://localhost:3000/api/fetch-live-data \
  -H "Content-Type: application/json" \
  -d '{"dateRange":{"start":"2024-01-01","end":"2024-01-31"},"clientId":"CLIENT_ID"}'
```

## 📊 Success Criteria

- [ ] Meta API token is valid and has proper permissions
- [ ] Ad account has active campaigns with data
- [ ] Single month API call returns non-zero data
- [ ] All-time aggregation works correctly
- [ ] Frontend displays correct aggregated data

---

**Status:** 🔍 **INVESTIGATION IN PROGRESS**
**Next Update:** After running debug script and checking token status 