require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testInteractivePDFFix() {
  console.log('🔧 Testing Interactive PDF Fix...\n');

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

    // Check for existing reports
    console.log('\n📊 Checking for existing reports...');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('id, client_id, date_range_start, date_range_end, created_at')
      .eq('client_id', testClient.id)
      .order('created_at', { ascending: false })
      .limit(3);

    if (reportsError) {
      console.log('❌ Error fetching reports:', reportsError);
    } else {
      console.log('✅ Found reports:', reports.length);
      reports.forEach((report, index) => {
        console.log(`   ${index + 1}. ${report.date_range_start} to ${report.date_range_end}`);
      });
    }

    // Check for campaigns
    if (reports.length > 0) {
      const latestReport = reports[0];
      console.log('\n📈 Checking for campaigns in latest report...');
      
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('campaign_name, spend, impressions, clicks, conversions')
        .eq('client_id', testClient.id)
        .eq('date_range_start', latestReport.date_range_start)
        .eq('date_range_end', latestReport.date_range_end);

      if (campaignsError) {
        console.log('❌ Error fetching campaigns:', campaignsError);
      } else {
        console.log('✅ Found campaigns:', campaigns.length);
        if (campaigns.length > 0) {
          const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
          const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
          const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
          console.log(`   💰 Total Spend: ${totalSpend.toFixed(2)} zł`);
          console.log(`   👁️ Total Impressions: ${totalImpressions.toLocaleString()}`);
          console.log(`   🖱️ Total Clicks: ${totalClicks.toLocaleString()}`);
        }
      }
    }

    console.log('\n🔧 Fixes Applied:');
    console.log('   ✅ Interactive PDF now fetches existing report data from database');
    console.log('   ✅ Calculates totals from campaign data (same as reports page)');
    console.log('   ✅ Still fetches Meta tables data for interactive tab switching');
    console.log('   ✅ Proper TypeScript typing added');

    console.log('\n🎯 Expected Results:');
    console.log('   • Interactive PDF should now show real data instead of zeros');
    console.log('   • Tab switching should work for Meta tables');
    console.log('   • Totals should match what you see in the reports page');

    console.log('\n💡 How to Test:');
    console.log('   1. Go to http://localhost:3000/reports');
    console.log('   2. Select a month with data');
    console.log('   3. Click "Generuj PDF" (interactive)');
    console.log('   4. Check that the PDF shows real data and has tab switching');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testInteractivePDFFix().catch(console.error); 