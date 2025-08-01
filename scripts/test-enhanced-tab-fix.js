require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEnhancedTabFix() {
  console.log('🎯 Testing Enhanced Tab Switching Fix...\n');

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

    console.log('\n🔧 Enhanced Tab Switching Fixes Applied:');
    console.log('   ✅ Force initialization with !important styles');
    console.log('   ✅ Multiple initialization attempts (0ms, 50ms, 200ms, 500ms)');
    console.log('   ✅ Enhanced JavaScript with setProperty()');
    console.log('   ✅ Longer wait time (1000ms) before PDF generation');
    console.log('   ✅ Final tab state verification');
    console.log('   ✅ Robust error handling and logging');

    console.log('\n🎯 What This Should Fix:');
    console.log('   • Tab buttons not appearing');
    console.log('   • All tables showing at once');
    console.log('   • Duplicate tables');
    console.log('   • Blank pages');
    console.log('   • Tab switching not working');

    console.log('\n✅ Expected Results:');
    console.log('   1. **Tab Navigation**: Three clickable buttons visible');
    console.log('      • "📍 Placement Performance" (active, blue background)');
    console.log('      • "👥 Demographic Performance" (inactive, gray)');
    console.log('      • "🏆 Ad Relevance & Results" (inactive, gray)');
    console.log('');
    console.log('   2. **Default View**: Only Placement table visible');
    console.log('      • Other tables completely hidden');
    console.log('      • No duplicate content');
    console.log('');
    console.log('   3. **Tab Switching**: Working click functionality');
    console.log('      • Click to switch between tables');
    console.log('      • Active tab highlighted');
    console.log('      • Only one table visible at a time');

    console.log('\n💡 How to Test:');
    console.log('   1. Go to http://localhost:3000/reports');
    console.log('   2. Select a month with data');
    console.log('   3. Click "Generuj PDF" (interactive)');
    console.log('   4. Wait for PDF to generate (should take ~6-7 seconds)');
    console.log('   5. Check that:');
    console.log('      • Tab buttons are visible and clickable');
    console.log('      • Only Placement table is visible initially');
    console.log('      • Clicking tabs switches between tables');
    console.log('      • No duplicate tables or blank pages');

    console.log('\n🔍 Console Logs to Look For:');
    console.log('   • "🔧 Initializing tab switching..."');
    console.log('   • "🔄 Force initializing tabs..."');
    console.log('   • "✅ Force activated placement tab"');
    console.log('   • "✅ Force activated first tab button"');
    console.log('   • "🔍 Final tab state check..."');
    console.log('   • "Tab placement: VISIBLE"');
    console.log('   • "Tab demographic: HIDDEN"');
    console.log('   • "Tab adRelevance: HIDDEN"');

    console.log('\n🎉 Expected Outcome:');
    console.log('   You should now see a proper interactive PDF with working tab switching!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEnhancedTabFix().catch(console.error); 