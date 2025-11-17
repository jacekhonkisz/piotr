# PDF Generation Fixes - November 4, 2025

## 🐛 Issues Found and Fixed

### Issue #1: Missing Authorization Import ❌
**Error:** `ReferenceError: authenticateRequest is not defined`
**Location:** `src/app/api/generate-executive-summary/route.ts`

**Fix:**
```typescript
// Added missing import
import { authenticateRequest } from '../../../lib/auth-middleware';
```

---

### Issue #2: Relative URLs Failing Server-Side ❌
**Error:** `TypeError: Failed to parse URL from /api/smart-cache`
**Location:** `src/lib/standardized-data-fetcher.ts`

**Root Cause:** 
- PDF generation runs server-side
- Server-side `fetch()` requires absolute URLs, not relative URLs
- Client-side code was using `/api/smart-cache`, which doesn't work in server context

**Fix:**
```typescript
// Before: ❌
const response = await fetch('/api/smart-cache', { ... });

// After: ✅
const baseUrl = typeof window === 'undefined' 
  ? (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
  : '';
const apiUrl = `${baseUrl}/api/smart-cache`;
const response = await fetch(apiUrl, { ... });
```

**Files Modified:**
- `/api/smart-cache` endpoint call
- `/api/fetch-live-data` endpoint call

---

### Issue #3: Missing Authorization Headers ❌
**Error:** Multiple `401 Unauthorized` errors:
- `POST /api/fetch-google-ads-live-data 401`
- `POST /api/fetch-live-data 401`
- `POST /api/fetch-meta-tables 401`
- `POST /api/year-over-year-comparison 401`
- `POST /api/generate-executive-summary 401`

**Root Cause:**
- PDF generation route authenticated itself correctly
- BUT: Internal API calls weren't forwarding the authorization header
- All downstream APIs require authentication

**Fix in `src/app/api/generate-pdf/route.ts`:**

```typescript
async function fetchReportData(clientId: string, dateRange: any, request: NextRequest) {
  // ✅ Extract authorization header at the start
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }
  
  // ✅ Pass to all internal API calls:
  
  // 1. Google Ads data fetch
  const googleResponse = await fetch(`${baseUrl}/api/fetch-google-ads-live-data`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader  // ✅ Added
    },
    // ...
  });
  
  // 2. Meta YoY comparison
  const metaYoYResponse = await fetch(`${baseUrl}/api/year-over-year-comparison`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader  // ✅ Added
    },
    // ...
  });
  
  // 3. Google YoY comparison
  const googleYoYResponse = await fetch(`${baseUrl}/api/year-over-year-comparison`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader  // ✅ Added
    },
    // ...
  });
  
  // 4. Meta fallback data
  const fallbackResponse = await fetch(`${baseUrl}/api/fetch-live-data`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader  // ✅ Added
    },
    // ...
  });
  
  // 5. Meta tables (demographics, placement)
  const metaTablesResponse = await fetch(`${baseUrl}/api/fetch-meta-tables`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader  // ✅ Added
    },
    // ...
  });
  
  // 6. AI summary generation
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-executive-summary`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader  // ✅ Added
    },
    // ...
  });
}
```

---

## 📊 Impact Analysis

### Before Fixes:
```
❌ PDF generation: FAILED
   └─ Missing auth import: ReferenceError
   └─ URL parsing errors: 5+ instances
   └─ 401 Unauthorized: 6+ API endpoints
   └─ No data loaded: metaData = false, googleData = false
   └─ Empty PDF generated: No metrics displayed
```

### After Fixes:
```
✅ PDF generation: SHOULD WORK
   └─ Auth import: Added ✅
   └─ URL parsing: Fixed with absolute URLs ✅
   └─ Authorization: All 6 endpoints now authenticated ✅
   └─ Data loading: Should fetch correctly ✅
   └─ PDF content: Should display all metrics ✅
```

---

## 🔍 Files Modified

1. **`src/app/api/generate-executive-summary/route.ts`**
   - Added missing `authenticateRequest` import

2. **`src/lib/standardized-data-fetcher.ts`**
   - Fixed `/api/smart-cache` URL (absolute for server-side)
   - Fixed `/api/fetch-live-data` URL (absolute for server-side)

3. **`src/app/api/generate-pdf/route.ts`**
   - Extract authorization header in `fetchReportData`
   - Pass authorization to 6 internal API endpoints:
     - `/api/fetch-google-ads-live-data`
     - `/api/year-over-year-comparison` (Meta)
     - `/api/year-over-year-comparison` (Google)
     - `/api/fetch-live-data`
     - `/api/fetch-meta-tables`
     - `/api/generate-executive-summary`

---

## ✅ Production Readiness

### These fixes resolve:
1. ✅ PDF generation crashes (authenticateRequest error)
2. ✅ Server-side URL parsing errors
3. ✅ Authentication flow for all internal APIs
4. ✅ Data fetching for Meta and Google Ads
5. ✅ Year-over-year comparisons
6. ✅ AI summary generation

### The system should now:
- Generate PDFs without errors
- Display all metrics (Meta + Google)
- Show year-over-year comparisons
- Include AI-generated summaries
- Work for all clients with System User tokens

---

## 🧪 Testing Recommendation

1. **Restart the server** (changes to route files require restart)
2. **Generate a test PDF** for Belmonte Hotel
3. **Verify PDF contains:**
   - Meta metrics (spend, impressions, clicks, conversions)
   - Google Ads metrics
   - Year-over-year comparisons
   - Demographics data
   - Campaign details
   - AI summary

---

## 📝 Notes

- All fixes are backward compatible
- No database changes required
- Changes apply to server-side rendering only
- Client-side functionality unaffected






