const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearMetaApiCache() {
  console.log('🧹 Clearing Meta API cache...\n');
  
  try {
    // The cache is stored in memory, so we need to restart the server
    // or clear it programmatically. Let me create a simple cache clear function
    
    console.log('📝 To clear the Meta API cache, you need to:');
    console.log('1. Restart your Next.js development server');
    console.log('2. Or wait 5 minutes for the cache to expire automatically');
    console.log('3. Or clear the browser cache');
    
    console.log('\n🔧 Alternative: Clear browser cache and restart server');
    console.log('   - Stop the development server (Ctrl+C)');
    console.log('   - Clear browser cache for localhost:3000');
    console.log('   - Restart the server: npm run dev');
    
    console.log('\n🎯 After clearing cache, test the reports page again');
    console.log('   - Go to: http://localhost:3000/reports?clientId=93d46876-addc-4b99-b1e1-437428dd54f1');
    console.log('   - Select "Current Month" or "August 2025"');
    console.log('   - Check if the conversion data now shows real values for the period');
    
    console.log('\n📊 Expected behavior after cache clear:');
    console.log('   - Current month (Aug 1-7) should show ~15 phone contacts, 48 reservations');
    console.log('   - This represents real data for that specific period');
    console.log('   - Not estimated percentages of all-time data');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

clearMetaApiCache(); 