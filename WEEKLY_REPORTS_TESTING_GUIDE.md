# Weekly Reports Testing Guide

## ✅ Server Status
- **Status**: ✅ Running on http://localhost:3000
- **Reports Page**: ✅ HTTP 200 (accessible)
- **API Endpoint**: ✅ HTTP 401 (requires authentication)

## 🔧 Fixes Implemented

### **Critical Bug Fixed**: `fetchFreshCurrentWeekData()` always fetched current week
- ✅ **Before**: All weeks showed identical 40k data (current week data)
- ✅ **After**: Function now accepts `targetWeek` parameter
- ✅ **Protection**: Historical weeks cannot fetch from Meta API (database only)

### **Smart Routing Enhanced**:
- ✅ **Current Week (2025-W35)**: Uses smart cache → Live Meta API data
- ✅ **Historical Weeks (W30-W34)**: Uses database → Stored historical data
- ✅ **Fallback Prevention**: Historical weeks cannot accidentally get current week data

## 🧪 Manual Testing Instructions

### **Step 1: Navigate to Reports**
1. Go to `http://localhost:3000/reports`
2. Login with your credentials
3. Switch to **Weekly** view

### **Step 2: Test Current Week (2025-W35)**
- **Expected**: Shows live/cached data for current week (Aug 24-31)
- **Data Source**: Smart cache or live Meta API
- **Console Log**: Look for `📊 🟡 CURRENT WEEK DETECTED - CHECKING WEEKLY SMART CACHE...`

### **Step 3: Test Historical Weeks**
Test these weeks in order:
- **Week 34 (Aug 17-23)**: `2025-W34`
- **Week 33 (Aug 10-16)**: `2025-W33` 
- **Week 32 (Aug 03-09)**: `2025-W32`
- **Week 31 (Jul 27-Aug 02)**: `2025-W31`
- **Week 30 (Jul 20-26)**: `2025-W30`

### **Expected Results for Historical Weeks**:
- **Different Data**: Each week should show unique metrics (not identical)
- **Database Source**: Console should show `📚 Historical week detected, using database lookup`
- **Fast Loading**: Should load quickly from database (not 10-30s API calls)

## 🔍 Console Logs to Watch For

### **Current Week (W35)**:
```
📅 Generated period ID for weekly cache: 2025-W35
📊 🟡 CURRENT WEEK DETECTED - CHECKING WEEKLY SMART CACHE...
✅ Returning fresh weekly cached data
```

### **Historical Weeks (W30-W34)**:
```
📅 Generated period ID for weekly cache: 2025-W30
📚 Historical week detected, should use database instead of smart cache
✅ Historical weekly data loaded from database
```

### **Error Logs (Should NOT See)**:
```
❌ Cannot fetch fresh data for historical week 2025-W30 - should use database
🚨 FORCING FRESH DATA for weekly reports
```

## 📊 Data Validation

### **What to Check**:
1. **Unique Data**: Each week shows different spend/clicks/impressions
2. **Realistic Ranges**: Historical weeks show reasonable historical amounts
3. **Current Week**: May show higher amounts if accumulating week-to-date
4. **Loading Speed**: Historical weeks load fast, current week may take longer

### **Red Flags (Issues)**:
- ❌ All weeks show identical 40k spend
- ❌ Historical weeks take 10-30 seconds to load
- ❌ Console shows "FORCING FRESH DATA" for historical weeks
- ❌ Error messages about "Cannot fetch fresh data for historical week"

## 🎯 Success Criteria

### **✅ Fixed Successfully If**:
1. **Current Week**: Shows live data, uses smart cache
2. **Historical Weeks**: Show unique data per week, load from database
3. **No Duplication**: Each week displays different metrics
4. **Fast Performance**: Historical weeks load quickly
5. **Proper Routing**: Console logs show correct data sources

### **❌ Still Broken If**:
1. All weeks still show identical data
2. Historical weeks still take long to load
3. Console shows errors about fetching historical data from API
4. Weeks show unrealistic data (like negative values or extreme amounts)

## 🔄 If Issues Persist

### **Check These**:
1. **Database Data**: Verify `campaign_summaries` table has weekly data
2. **Period ID Calculation**: Ensure week numbers match between frontend/backend
3. **Date Range Parsing**: Verify date ranges are calculated correctly
4. **Cache Keys**: Check if cache keys match between requests

### **Debug Commands**:
```sql
-- Check if weekly data exists in database
SELECT summary_date, summary_type, total_spend, total_clicks 
FROM campaign_summaries 
WHERE summary_type = 'weekly' 
ORDER BY summary_date DESC 
LIMIT 10;

-- Check current week cache
SELECT period_id, last_updated 
FROM current_week_cache 
ORDER BY last_updated DESC 
LIMIT 5;
```

## 📈 Expected Performance

- **Current Week**: 2-5 seconds (smart cache)
- **Historical Weeks**: 0.5-2 seconds (database)
- **Data Accuracy**: Each week shows period-specific metrics
- **User Experience**: Smooth navigation between weeks
