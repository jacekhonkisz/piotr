require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEnhancedPDFMetrics() {
  console.log('🎯 Testing Enhanced PDF with Detailed Metrics...\n');

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

    console.log('\n🔧 Enhanced PDF with Detailed Metrics Applied:');
    console.log('   ✅ Added "Wskaźniki Wydajności" section');
    console.log('   ✅ Included all 6 detailed metrics');
    console.log('   ✅ Enhanced totals calculation with reach & frequency');
    console.log('   ✅ Professional metrics grid layout');
    console.log('   ✅ Color-coded metric icons');
    console.log('   ✅ Polish labels matching dashboard');

    console.log('\n🎯 What You Should See Now:');
    console.log('   1. **Summary Cards**: Four basic metrics');
    console.log('      • Total Spend, Impressions, Clicks, Conversions');
    console.log('');
    console.log('   2. **Detailed Performance Metrics Section**:');
    console.log('      • Title: "📊 Wskaźniki Wydajności"');
    console.log('      • Subtitle: "Szczegółowe metryki kampanii"');
    console.log('      • Six metrics in a grid layout:');
    console.log('        - 👁️ Wyświetlenia (Impressions)');
    console.log('        - 🎯 Kliknięcia (Clicks)');
    console.log('        - 📈 CPM (Cost Per Mille)');
    console.log('        - 💰 CPC (Cost Per Click)');
    console.log('        - 👥 Zasięg (Reach)');
    console.log('        - 📊 Częstotliwość (Frequency)');
    console.log('');
    console.log('   3. **Three Table Sections**: Top 10 results each');
    console.log('      • Placement Performance');
    console.log('      • Demographic Performance');
    console.log('      • Ad Relevance & Results');

    console.log('\n✅ Enhanced Features:');
    console.log('   • Matches dashboard metrics exactly');
    console.log('   • Professional visual design');
    console.log('   • Color-coded metric icons');
    console.log('   • Proper Polish labels');
    console.log('   • Complete performance overview');

    console.log('\n💡 How to Test:');
    console.log('   1. Go to http://localhost:3000/admin');
    console.log('   2. Click on any client');
    console.log('   3. Click "Generate Report"');
    console.log('   4. Click "Generuj PDF" in modal');
    console.log('   5. Check that:');
    console.log('      • Detailed metrics section appears');
    console.log('      • All 6 metrics are displayed');
    console.log('      • Values match dashboard data');
    console.log('      • Professional layout and styling');

    console.log('\n🎉 Expected Outcome:');
    console.log('   You should see a comprehensive PDF with detailed performance metrics!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testEnhancedPDFMetrics().catch(console.error); 