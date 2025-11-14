# 🧪 Test API Endpoint Directly

Since logs aren't showing up, let's call the API directly and see what it returns.

## Run This in Browser Console:

```javascript
// First, open the page where you see the issue
// Then open console (F12) and run this:

(async () => {
  try {
    console.log('🧪 Testing /api/fetch-meta-tables directly...');
    
    // Get your auth token
    const authHeader = document.cookie.split(';')
      .find(c => c.trim().startsWith('sb-'))
      ?.split('=')[1];
    
    if (!authHeader) {
      console.log('⚠️ No auth found in cookies, trying alternate method...');
    }
    
    // Make the request
    const response = await fetch('/api/fetch-meta-tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRange: {
          start: '2025-11-01',
          end: '2025-11-30'
        },
        clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'  // Belmonte
      })
    });
    
    const result = await response.json();
    
    console.log('📊 API Response:');
    console.log('Success:', result.success);
    console.log('Source:', result.debug?.source);
    console.log('Demographics count:', result.data?.metaTables?.demographicPerformance?.length);
    console.log('Placement count:', result.data?.metaTables?.placementPerformance?.length);
    console.log('');
    console.log('Full response:', result);
    console.log('');
    
    if (result.data?.metaTables?.demographicPerformance) {
      console.log('Demographics array:', result.data.metaTables.demographicPerformance);
      if (result.data.metaTables.demographicPerformance.length === 0) {
        console.log('❌ ARRAY IS EMPTY!');
      } else {
        console.log('✅ Array has', result.data.metaTables.demographicPerformance.length, 'items');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
```

## What to Look For:

1. **Demographics count:** Should be 20, probably showing 0
2. **Source:** Should be 'smart-cache'
3. **Full response:** Expand and look at the actual arrays

## Copy and paste the ENTIRE console output here!

This will show us exactly what the API is returning.

