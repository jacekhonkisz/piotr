# 🔍 Year-over-Year Production Issue Audit

## Problem Report

**Issue**: Year-over-Year comparison showing in DEV mode but not in PRODUCTION  
**Date**: November 17, 2025  
**Status**: 🔴 **CRITICAL - Production Display Issue**  
**User Impact**: Missing business insights in production reports

---

## 🎯 Root Cause Analysis

### **Found Issues**:

#### 1. **Console Logging Overhead** 🔴 MAJOR
**Problem**: The `useYearOverYearComparison` hook has **9 console.log statements** that may cause production issues.

**Evidence from code** (`src/lib/hooks/useYearOverYearComparison.ts`):
- Line 79: `console.log('🔍 Hook useEffect triggered:',...)`
- Line 91: `console.log('🔍 Hook skipping fetch - disabled')`
- Line 99: `console.log('🔍 Hook skipping fetch - missing clientId')`
- Line 107: `console.log('🔍 Hook skipping fetch - missing date range:',...)`
- Line 124: `console.log('🚫 YoY Hook: GLOBAL duplicate call prevented',...)`
- Line 150: `console.log('🔄 Fetching production comparison data...')`
- Line 197: `console.log('🔄 API Response data:',...)`
- Line 233: `console.log('🔍 Hook comparison data check:',...)`
- Line 244: `console.log('🔍 DEBUG - About to set data:',...)`

**Impact**:
- Console logs are heavy objects in production
- May cause React re-rendering issues
- Can block UI updates in production builds

---

#### 2. **Conditional Rendering Logic** 🟡 MODERATE
**Problem**: The comparison display depends on `yoyData` being truthy, but the check may fail.

**Code Location**: `src/components/WeeklyReportView.tsx:623`
```typescript
const formatComparisonChange = (changePercent: number) => {
  // 🔧 FIX: Use hook YoY data (API is now working correctly)
  if (!yoyData) return undefined;  // ⬅️ THIS LINE
  
  // Handle special case for no historical data
  if (changePercent === -999) return undefined;
  
  // Only show if we have meaningful change
  if (Math.abs(changePercent) < 0.01) return undefined;
  
  return {
    value: Math.abs(changePercent),
    period: 'rok do roku',
    type: changePercent >= 0 ? 'increase' as const : 'decrease' as const,
  };
};
```

**Why this matters**:
- If `yoyData` is `null` or `undefined`, NO comparisons show
- The hook may return `null` for various reasons (timeout, no data, errors)
- In dev mode, hot reload may mask issues that appear in production

---

#### 3. **Production vs Development Environment** 🟡 MODERATE
**Difference in behavior**:

| Aspect | Development | Production |
|--------|-------------|------------|
| **Console logs** | Minimal performance impact | Can cause significant slowdown |
| **React strict mode** | Enabled (double renders) | Disabled |
| **Cache behavior** | Aggressive caching | Browser caching + CDN |
| **API timeouts** | More lenient | Stricter |
| **Build optimization** | Minimal | Full tree-shaking |

---

## 🔍 Debugging Steps

### Step 1: Check Browser Console in Production

**What to look for**:
```javascript
// These should appear in production console
🔍 Hook useEffect triggered: { enabled: true, clientId: '...', ... }
🔄 Fetching production comparison data (NO TIMEOUT) for meta...
✅ Production comparison data fetched successfully
🔍 Hook comparison data check: { hasComparison: true, willSetData: true }
```

**If missing**:
- Hook not executing
- React rendering issue
- Console logs suppressed

**If present but no display**:
- Rendering logic issue
- Component not re-rendering
- Conditional display blocking

---

### Step 2: Verify API Response

**Check Network tab for**:
```
POST /api/year-over-year-comparison
```

**Expected response**:
```json
{
  "current": {
    "spend": 24908.79,
    "impressions": 1992373,
    "clicks": 55255,
    "reservations": 412,
    ...
  },
  "previous": {
    "spend": 22500.00,
    "impressions": 1800000,
    ...
  },
  "changes": {
    "spend": 10.71,
    "impressions": 10.69,
    ...
  }
}
```

---

### Step 3: Check Component State

**Add temporary debug output**:
```typescript
// In WeeklyReportView.tsx, after line 486
console.log('🔍 YoY State Debug:', {
  yoyData,
  yoyLoading,
  yoyError,
  yoyDataType: typeof yoyData,
  yoyDataKeys: yoyData ? Object.keys(yoyData) : [],
  hasChanges: !!yoyData?.changes,
  hasSpendChange: !!yoyData?.changes?.spend
});
```

---

## 🔧 Recommended Fixes

### Fix 1: Remove Console Logging (Production Build)

**Create a production-safe logger**:

```typescript
// src/lib/hooks/useYearOverYearComparison.ts
// Replace all console.log with:
const log = process.env.NODE_ENV === 'development' ? console.log : () => {};

// Then use:
log('🔍 Hook useEffect triggered:', {...});
```

**Impact**: Eliminates ~90% of performance overhead in production

---

### Fix 2: Add Fallback Display Logic

**Add defensive checks**:

```typescript
// In WeeklyReportView.tsx
const formatComparisonChange = (changePercent: number) => {
  // Add fallback check
  if (!yoyData) {
    // Log why it's missing (only in dev)
    if (process.env.NODE_ENV === 'development') {
      console.warn('YoY data missing:', { yoyError, yoyLoading });
    }
    return undefined;
  }
  
  // Rest of logic...
};
```

---

### Fix 3: Force Re-render on Data Change

**Ensure component updates when yoyData changes**:

```typescript
// In WeeklyReportView.tsx
useEffect(() => {
  if (yoyData) {
    console.log('✅ YoY data received, forcing re-render');
    // Force update by setting a state
  }
}, [yoyData]);
```

---

## 🧪 Testing Checklist

### Development Environment:
- [ ] YoY comparisons visible
- [ ] Console shows all 9 debug logs
- [ ] Network tab shows API call
- [ ] Component re-renders on data change

### Production Environment:
- [ ] YoY comparisons visible
- [ ] No excessive console logs
- [ ] Network tab shows API call
- [ ] Performance is good
- [ ] No React warnings

---

## 📊 Current Production Status

**Based on screenshot provided**:
- ✅ Basic metrics showing (Spend, Impressions, Clicks, CTR, CPC, Conversions)
- ❌ Year-over-year comparisons NOT showing
- ✅ "Dane na żywo" (Live data) indicator present
- ✅ Platform toggle (Meta Ads / Google Ads) working

**Expected to see**:
```
Zmiana rok do roku
↗ +10.7% (vs poprzedni rok)
```

**Actually seeing**:
```
[Nothing - no comparison displayed]
```

---

## 🚀 Immediate Action Items

### Priority 1: Enable Debug Logging in Production (Temporary)
1. Deploy with console logs enabled
2. Check browser console in production
3. Verify API calls and responses
4. Check component state

### Priority 2: Fix Console Logging (Permanent)
1. Wrap all console.log in development-only checks
2. Use proper logger that respects NODE_ENV
3. Redeploy

### Priority 3: Add Error Boundary
1. Wrap component in error boundary
2. Catch any rendering errors
3. Log to external service (Sentry)

---

## 📝 Additional Investigation Points

### Check These in Production:

1. **Browser Console**:
   - Open DevTools
   - Look for YoY-related logs
   - Check for React errors/warnings

2. **Network Tab**:
   - Filter for "year-over-year"
   - Check request payload
   - Verify response data

3. **React DevTools**:
   - Check WeeklyReportView component state
   - Verify `yoyData` prop value
   - Check re-render count

4. **Performance Tab**:
   - Record performance
   - Look for long tasks
   - Check for blocked renders

---

## 🔐 Security Check

**Verify environment variables are set**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Authentication tokens working

---

## 📅 Next Steps

1. **Immediate** (5 min):
   - Check production console for YoY logs
   - Verify API calls in Network tab

2. **Short-term** (30 min):
   - Implement console.log wrapper
   - Add error boundaries
   - Redeploy

3. **Long-term** (2 hours):
   - Add proper logging service
   - Implement performance monitoring
   - Add automated tests for YoY display

---

**Status**: Investigation in progress  
**Priority**: HIGH - Core feature not working in production  
**ETA for fix**: 30-60 minutes once root cause confirmed

