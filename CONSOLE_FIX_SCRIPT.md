# 🔧 Console Fix Script - Corrected Version

## The Issue
The original script failed because `window.supabase` doesn't exist. The supabase client is imported as a module.

## ✅ WORKING SCRIPT

Open browser console (F12 → Console tab) and paste this:

```javascript
(async () => {
  try {
    console.log('🔄 Testing Meta Tables API...');
    
    // Import supabase from the module
    const { supabase } = await import('/src/lib/supabase.ts');
    
    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.error('❌ No authentication session found. Please log in first.');
      return;
    }
    
    console.log('✅ Authentication OK');
    
    // Call API with force refresh
    const response = await fetch('/api/fetch-meta-tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: { start: '2025-11-01', end: '2025-11-30' },
        clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
        forceRefresh: true
      })
    });
    
    const result = await response.json();
    
    console.log('📊 API Response:', result);
    console.log('');
    console.log('=== DEMOGRAPHICS DATA ===');
    console.log('Count:', result.data?.metaTables?.demographicPerformance?.length || 0);
    console.log('Placement Count:', result.data?.metaTables?.placementPerformance?.length || 0);
    console.log('Source:', result.debug?.source);
    console.log('');
    
    if (result.data?.metaTables?.demographicPerformance?.length > 0) {
      console.log('✅ DEMOGRAPHICS DATA FOUND!');
      console.log('Sample:', result.data.metaTables.demographicPerformance.slice(0, 2));
      console.log('');
      console.log('Refreshing page...');
      setTimeout(() => location.reload(), 1000);
    } else {
      console.log('❌ NO DEMOGRAPHICS DATA IN RESPONSE');
      console.log('Full response:', result);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error details:', error.message);
  }
})();
```

## If Import Doesn't Work

Try this simpler version that creates a fresh client:

```javascript
(async () => {
  try {
    console.log('🔄 Creating Supabase client...');
    
    // Create a new Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    // Get URL and key from page
    const supabaseUrl = document.querySelector('meta[property="supabase:url"]')?.content || 
                       'YOUR_SUPABASE_URL_HERE';  // Replace if needed
    const supabaseKey = document.querySelector('meta[property="supabase:anon-key"]')?.content ||
                       'YOUR_SUPABASE_KEY_HERE';   // Replace if needed
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.error('❌ Not logged in');
      return;
    }
    
    console.log('✅ Session found');
    
    // Call API
    const response = await fetch('/api/fetch-meta-tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        dateRange: { start: '2025-11-01', end: '2025-11-30' },
        clientId: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
        forceRefresh: true
      })
    });
    
    const result = await response.json();
    console.log('📊 Response:', result);
    console.log('Demographics:', result.data?.metaTables?.demographicPerformance?.length || 0);
    
    if (result.data?.metaTables?.demographicPerformance?.length > 0) {
      console.log('✅ DATA FOUND! Reloading...');
      location.reload();
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
```

## Even Simpler: Just Check the Console Logs

Instead of running a script, just:

1. **Reload the page** (F5)
2. **Open console** (F12)
3. **Look for these messages:**

```
🔍 MetaAdsTables received data: { demographicDataLength: ?? }
🔍 RAW DEMOGRAPHIC DATA FROM API: { count: ?? }
```

**Tell me what numbers you see!**

- If you see `demographicDataLength: 20` → Data IS there, just not displaying
- If you see `demographicDataLength: 0` → Data is NOT reaching frontend

This will tell me exactly where the issue is!

