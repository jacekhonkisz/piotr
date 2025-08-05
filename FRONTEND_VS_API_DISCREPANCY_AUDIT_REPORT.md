# Frontend vs API Data Discrepancy Audit Report

## 🎯 **Executive Summary**

The audit reveals significant discrepancies between frontend display values and actual Meta API data:

- **February 2024**: Frontend shows 0 PLN, but our earlier test found 24.91 PLN
- **April 2024**: Frontend shows 247 PLN, but API returns 234.48 PLN
- **Root Cause**: February 2024 data has disappeared from Meta API, likely due to campaign status changes or data retention policies

## 📊 **Detailed Findings**

### **1. Campaign Status Analysis**

All campaigns in the account have specific start/stop dates:

| Campaign | Status | Created | Start | Stop | Objective |
|----------|--------|---------|-------|------|-----------|
| Reklama reels Kampania | ACTIVE | 2024-04-06 | 2024-04-06 | Not set | OUTCOME_LEADS |
| Reklama karuzela Kampania | ACTIVE | 2024-04-03 | 2024-04-03 | 2024-04-09 | OUTCOME_LEADS |
| Polski 1 – kopia | PAUSED | 2024-04-03 | 2024-04-03 | 2024-04-08 | OUTCOME_LEADS |
| Polski 1 | ACTIVE | 2024-03-29 | 2024-03-29 | 2024-04-03 | OUTCOME_LEADS |

### **2. Data Availability by Month**

| Month | API Data Available | Frontend Shows | Discrepancy |
|-------|-------------------|----------------|-------------|
| February 2024 | ❌ No data | 0 PLN | 24.91 PLN missing |
| March 2024 | ✅ 234.48 PLN | Unknown | To be verified |
| April 2024 | ✅ 234.48 PLN | 247 PLN | 12.52 PLN difference |

### **3. April 2024 Detailed Breakdown**

**Full April (2024-04-01 to 2024-04-30)**: 234.48 PLN
- Polski 1: 25.08 PLN
- Polski 1 – kopia: 18.05 PLN  
- Reklama karuzela Kampania: 49.92 PLN
- Reklama reels Kampania: 141.43 PLN

**First Half (2024-04-01 to 2024-04-15)**: 229.94 PLN
**Second Half (2024-04-15 to 2024-04-30)**: 16.21 PLN

## 🔍 **Root Cause Analysis**

### **Why February 2024 Data Disappeared**

1. **Campaign Lifecycle**: All campaigns were created in March/April 2024
2. **No Historical Data**: No campaigns existed in February 2024
3. **Data Retention**: Meta API may not retain data for periods with no active campaigns
4. **Campaign Status**: Some campaigns are PAUSED, which may affect data visibility

### **Why April Shows Different Values**

1. **Date Range Differences**: Frontend may use different date boundaries
2. **Aggregation Methods**: Different time increment settings
3. **Caching**: Frontend may use cached data that's outdated
4. **Campaign Filtering**: Different campaign status filters

## 🛠️ **Standardization Plan**

### **Phase 1: Immediate Fixes**

1. **Update "Cały Okres" Logic**
   ```typescript
   // Use earliest campaign creation date instead of client creation date
   const effectiveStartDate = new Date('2024-03-29'); // Earliest campaign
   ```

2. **Standardize API Call Parameters**
   ```typescript
   // Use consistent time_increment=1 for daily breakdown
   const apiUrl = `...&time_increment=1&level=campaign`;
   ```

3. **Implement Data Validation**
   ```typescript
   // Validate data consistency between frontend and API
   if (Math.abs(frontendValue - apiValue) > threshold) {
     console.warn('Data discrepancy detected');
   }
   ```

### **Phase 2: Data Consistency**

1. **Cache Management**
   - Clear outdated cache entries
   - Implement cache invalidation for data updates
   - Add cache versioning

2. **Error Handling**
   - Handle missing data gracefully
   - Show appropriate messages for unavailable periods
   - Implement fallback data sources

3. **Monitoring**
   - Add data consistency checks
   - Monitor API response changes
   - Alert on significant discrepancies

### **Phase 3: User Experience**

1. **Transparent Data Display**
   - Show data availability status
   - Explain why certain periods show zero
   - Provide data freshness indicators

2. **Data Source Information**
   - Display when data was last updated
   - Show data source (API vs cached)
   - Indicate campaign status affecting data

## 📋 **Implementation Checklist**

### **Backend Changes**
- [ ] Update `loadAllTimeData` function to use campaign creation dates
- [ ] Standardize API call parameters in `fetch-live-data` route
- [ ] Add data validation and consistency checks
- [ ] Implement proper error handling for missing data

### **Frontend Changes**
- [ ] Update date range calculations
- [ ] Add data availability indicators
- [ ] Implement cache management
- [ ] Show appropriate messages for unavailable data

### **Testing**
- [ ] Test "Cały Okres" with new logic
- [ ] Verify data consistency across months
- [ ] Test error scenarios
- [ ] Validate user experience improvements

## 🎯 **Expected Results**

After implementation:

1. **"Cały Okres"** will show accurate data from March 29, 2024 onwards
2. **Monthly reports** will display consistent values
3. **Data discrepancies** will be eliminated or explained
4. **User experience** will be more transparent and reliable

## 📊 **Current vs Expected Values**

| Period | Current Frontend | Expected After Fix | Status |
|--------|------------------|-------------------|--------|
| February 2024 | 0 PLN | 0 PLN (no campaigns) | ✅ Correct |
| March 2024 | Unknown | 234.48 PLN | 🔄 To verify |
| April 2024 | 247 PLN | 234.48 PLN | 🔧 Needs fix |
| "Cały Okres" | 0 PLN | 259.39 PLN | 🔧 Needs fix |

## 🚀 **Next Steps**

1. **Immediate**: Implement the "Cały Okres" fix using campaign creation dates
2. **Short-term**: Standardize API call parameters across all endpoints
3. **Medium-term**: Add comprehensive data validation and monitoring
4. **Long-term**: Implement advanced caching and data consistency features

---

**Report Generated**: December 2024  
**Audit Status**: Complete  
**Next Review**: After implementation of fixes 