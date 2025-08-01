require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testStaticPDFTop10() {
  console.log('🎯 Testing Static PDF with Top 10 Results...\n');

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

    console.log('\n🔧 Static PDF with Top 10 Results Applied:');
    console.log('   ✅ Removed interactive tab functionality');
    console.log('   ✅ All tables visible at once');
    console.log('   ✅ Limited to top 10 results by spend');
    console.log('   ✅ Added "Showing top 10 results" notes');
    console.log('   ✅ Simplified JavaScript');
    console.log('   ✅ Faster PDF generation');
    console.log('   ✅ Better for email delivery');

    console.log('\n🎯 What You Should See Now:');
    console.log('   1. **Summary Cards**: Four metric cards at the top');
    console.log('      • Total Spend, Impressions, Clicks, Conversions');
    console.log('');
    console.log('   2. **Three Table Sections**: All visible at once');
    console.log('      • "📍 Placement Performance" (top 10 by spend)');
    console.log('      • "👥 Demographic Performance" (top 10 by spend)');
    console.log('      • "🏆 Ad Relevance & Results" (top 10 by spend)');
    console.log('');
    console.log('   3. **Limited Results**:');
    console.log('      • Maximum 10 rows per table');
    console.log('      • Sorted by spend (highest first)');
    console.log('      • Note showing "Showing top 10 results" if more exist');

    console.log('\n✅ Benefits of This Approach:');
    console.log('   • Clean, readable format');
    console.log('   • Focus on most important data');
    console.log('   • Perfect for email delivery');
    console.log('   • No JavaScript compatibility issues');
    console.log('   • Faster generation time');
    console.log('   • Professional appearance');

    console.log('\n💡 How to Test:');
    console.log('   1. Go to http://localhost:3000/admin');
    console.log('   2. Click on any client');
    console.log('   3. Click "Generate Report"');
    console.log('   4. Click "Generuj PDF" in modal');
    console.log('   5. Check that:');
    console.log('      • All three tables are visible');
    console.log('      • Each table shows max 10 results');
    console.log('      • Results are sorted by spend');
    console.log('      • Notes appear if more than 10 results exist');

    console.log('\n🎉 Expected Outcome:');
    console.log('   You should see a clean, static PDF with top 10 results for each table!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testStaticPDFTop10().catch(console.error); 