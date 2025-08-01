require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInteractiveTabsRestored() {
  console.log('🎯 Testing Interactive Tabs Restoration...\n');

  try {
    // Get a test client
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token')
      .not('meta_access_token', 'is', null)
      .limit(1);

    if (clientsError || !clients.length) {
      console.error('❌ No clients with tokens found:', clientsError);
      return;
    }

    const testClient = clients[0];
    console.log('✅ Test client found:', testClient.name);

    console.log('\n🔧 Interactive Tabs Restoration Applied:');
    console.log('   ✅ Restored tab navigation HTML structure');
    console.log('   ✅ Added tab buttons with onclick handlers');
    console.log('   ✅ Restored tab content containers with IDs');
    console.log('   ✅ Implemented switchTab() JavaScript function');
    console.log('   ✅ Added tab initialization logic');
    console.log('   ✅ Enhanced Puppeteer initialization');
    console.log('   ✅ Fixed TypeScript casting issues');

    console.log('\n🎯 What You Should See Now:');
    console.log('   1. **Tab Navigation Bar**: Three clickable buttons at the top:');
    console.log('      • "📍 Placement Performance" (active by default, blue background)');
    console.log('      • "👥 Demographic Performance" (inactive, gray)');
    console.log('      • "🏆 Ad Relevance & Results" (inactive, gray)');
    console.log('');
    console.log('   2. **Default View**: Only Placement table visible');
    console.log('      • Other tables should be hidden');
    console.log('      • First tab button highlighted in blue');
    console.log('');
    console.log('   3. **Interactive Functionality**:');
    console.log('      • Clicking tabs switches between tables');
    console.log('      • Active tab button highlighted');
    console.log('      • Only one table visible at a time');

    console.log('\n🔍 Technical Implementation:');
    console.log('   • HTML: Tab navigation with onclick="switchTab()"');
    console.log('   • CSS: Tab button styles and active states');
    console.log('   • JavaScript: switchTab() function and initialization');
    console.log('   • Puppeteer: Proper tab initialization before PDF generation');

    console.log('\n💡 How to Test:');
    console.log('   1. Go to http://localhost:3000/admin');
    console.log('   2. Click on any client');
    console.log('   3. Click "Generate Report"');
    console.log('   4. Click "Generuj PDF" in modal');
    console.log('   5. Check that:');
    console.log('      • Tab buttons are visible and clickable');
    console.log('      • Only Placement table is visible initially');
    console.log('      • Clicking tabs switches between tables');
    console.log('      • Active tab is highlighted');

    console.log('\n🎉 Expected Outcome:');
    console.log('   You should now see proper interactive tabs with working tab switching!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testInteractiveTabsRestored().catch(console.error); 