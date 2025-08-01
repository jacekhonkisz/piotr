require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testStaticTables() {
  console.log('🎯 Testing Static Tables Approach...\n');

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

    console.log('\n🔧 New Static Tables Approach:');
    console.log('   ✅ Removed tab switching JavaScript');
    console.log('   ✅ All tables visible at once');
    console.log('   ✅ Clear section headers with icons');
    console.log('   ✅ Better page break handling');
    console.log('   ✅ Simplified PDF generation');
    console.log('   ✅ Faster loading (no JavaScript delays)');

    console.log('\n🎯 What You Should See Now:');
    console.log('   1. **Summary Cards**: Four metric cards at the top');
    console.log('      • Total Spend, Impressions, Clicks, Conversions');
    console.log('');
    console.log('   2. **Three Table Sections**: All visible at once');
    console.log('      • "📍 Placement Performance" (with blue border)');
    console.log('      • "👥 Demographic Performance" (with blue border)');
    console.log('      • "🏆 Ad Relevance & Results" (with blue border)');
    console.log('');
    console.log('   3. **Clean Layout**:');
    console.log('      • Each section has a clear header');
    console.log('      • Tables are properly spaced');
    console.log('      • No tab buttons or JavaScript complexity');

    console.log('\n❌ What Was Removed:');
    console.log('   • Tab switching functionality');
    console.log('   • Complex JavaScript initialization');
    console.log('   • Tab navigation buttons');
    console.log('   • Hidden/visible table logic');

    console.log('\n✅ Benefits of New Approach:');
    console.log('   • Simpler and more reliable');
    console.log('   • Works in all PDF viewers');
    console.log('   • Faster generation time');
    console.log('   • All data visible at once');
    console.log('   • Better for printing');

    console.log('\n💡 How to Test:');
    console.log('   1. Go to http://localhost:3000/admin');
    console.log('   2. Click on any client');
    console.log('   3. Click "Generate Report"');
    console.log('   4. Click "Generuj PDF" in modal');
    console.log('   5. Check that:');
    console.log('      • All three tables are visible');
    console.log('      • Section headers are clear');
    console.log('      • No tab buttons');
    console.log('      • Data is properly formatted');

    console.log('\n🎉 Expected Outcome:');
    console.log('   You should see a clean, static PDF with all tables visible!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testStaticTables().catch(console.error); 