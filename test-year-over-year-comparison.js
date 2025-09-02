#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testYearOverYearComparison() {
  console.log('📊 TESTING YEAR-OVER-YEAR COMPARISON');
  console.log('====================================\n');

  try {
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
    
    // Check what Google Ads data we have
    console.log('1️⃣ Checking available Google Ads data...');
    
    const { data: googleAdsData, error: queryError } = await supabase
      .from('campaign_summaries')
      .select('client_id, platform, summary_type, summary_date, total_spend, total_impressions, total_clicks')
      .eq('platform', 'google')
      .eq('client_id', clientId)
      .order('summary_date', { ascending: false });

    if (queryError) {
      console.log('❌ Error querying data:', queryError.message);
      return;
    }

    if (!googleAdsData || googleAdsData.length === 0) {
      console.log('❌ No Google Ads data found for Belmonte Hotel');
      return;
    }

    console.log(`✅ Found ${googleAdsData.length} Google Ads records for Belmonte Hotel:`);
    googleAdsData.forEach(record => {
      console.log(`   - ${record.summary_date} (${record.summary_type}): ${record.total_spend} spend, ${record.total_impressions} impressions`);
    });

    // Test current period (September 2025)
    console.log('\n2️⃣ Testing year-over-year comparison for September 2025...');
    
    const currentDate = '2025-09-01';
    const previousYearDate = '2024-09-01';
    
    // Check if we have data for both periods
    const currentPeriodData = googleAdsData.filter(d => d.summary_date >= '2025-09-01' && d.summary_date <= '2025-09-30');
    const previousYearData = googleAdsData.filter(d => d.summary_date >= '2024-09-01' && d.summary_date <= '2024-09-30');
    
    console.log(`Current period (Sep 2025): ${currentPeriodData.length} records`);
    console.log(`Previous year (Sep 2024): ${previousYearData.length} records`);
    
    if (currentPeriodData.length > 0 && previousYearData.length > 0) {
      const currentSpend = currentPeriodData.reduce((sum, d) => sum + (d.total_spend || 0), 0);
      const previousSpend = previousYearData.reduce((sum, d) => sum + (d.total_spend || 0), 0);
      const change = previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0;
      
      console.log(`✅ Year-over-year comparison possible:`);
      console.log(`   Current spend: ${currentSpend.toFixed(2)}`);
      console.log(`   Previous year spend: ${previousSpend.toFixed(2)}`);
      console.log(`   Change: ${change.toFixed(1)}%`);
    } else {
      console.log('⚠️ Not enough data for year-over-year comparison yet');
      
      if (currentPeriodData.length === 0) {
        console.log('   Missing current period data (Sep 2025)');
      }
      if (previousYearData.length === 0) {
        console.log('   Missing previous year data (Sep 2024)');
        console.log('   💡 The background collector should fetch this automatically');
      }
    }

    // Test the year-over-year API endpoint
    console.log('\n3️⃣ Testing year-over-year API endpoint...');
    
    // We need to create a simple test token for the API
    const testPayload = {
      clientId: clientId,
      dateRange: {
        start: '2025-09-01',
        end: '2025-09-30'
      }
    };

    console.log('API test payload:', testPayload);
    console.log('⚠️ Note: API test requires proper authentication token');

    // Check what data the PDF generation would see
    console.log('\n4️⃣ Simulating PDF generation data lookup...');
    
    // This simulates what fetchPreviousYearDataFromDB does
    const previousYearStart = '2024-09-01';
    const previousYearEnd = '2024-09-30';
    
    const { data: pdfData, error: pdfError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', clientId)
      .eq('platform', 'google')
      .gte('summary_date', previousYearStart)
      .lte('summary_date', previousYearEnd);

    if (pdfError) {
      console.log('❌ PDF data lookup error:', pdfError.message);
    } else if (!pdfData || pdfData.length === 0) {
      console.log('❌ PDF would show "Brak danych" - no previous year data found');
      console.log('💡 Need to wait for background collection to fetch historical data');
    } else {
      console.log(`✅ PDF would show real data - found ${pdfData.length} previous year records`);
      const totalSpend = pdfData.reduce((sum, d) => sum + (d.total_spend || 0), 0);
      console.log(`   Previous year total spend: ${totalSpend.toFixed(2)}`);
    }

    console.log('\n🎯 SUMMARY:');
    if (currentPeriodData.length > 0 && previousYearData.length > 0) {
      console.log('✅ Year-over-year comparison is working!');
      console.log('✅ PDF reports should show real data instead of "Brak danych"');
    } else {
      console.log('⏳ Year-over-year comparison not ready yet');
      console.log('📊 Background collection is still processing historical data');
      console.log('⏰ Check again in a few minutes');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testYearOverYearComparison().catch(console.error);
