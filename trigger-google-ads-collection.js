#!/usr/bin/env node

async function triggerGoogleAdsCollection() {
  console.log('🔄 TRIGGERING GOOGLE ADS BACKGROUND COLLECTION');
  console.log('==============================================\n');
  
  console.log('Using the same system as Meta Ads:');
  console.log('- Monthly summaries for the last 12 months');
  console.log('- Weekly summaries for the last 52 weeks');
  console.log('- Automatic cleanup of data older than 1 year');
  console.log('- Uses existing BackgroundDataCollector class');
  console.log('');

  try {
    // Trigger monthly collection (this will now include Google Ads)
    console.log('1️⃣ Triggering monthly collection...');
    
    const monthlyResponse = await fetch('http://localhost:3000/api/background/collect-monthly', {
      method: 'GET' // Use GET for cron job endpoint (no auth required)
    });

    if (monthlyResponse.ok) {
      const monthlyResult = await monthlyResponse.json();
      console.log('✅ Monthly collection started:', monthlyResult.message);
    } else {
      const errorText = await monthlyResponse.text();
      console.log(`❌ Monthly collection failed: ${monthlyResponse.status} - ${errorText}`);
    }

    // Wait a bit before triggering weekly
    console.log('\n⏳ Waiting 5 seconds before triggering weekly collection...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Trigger weekly collection (this will now include Google Ads)
    console.log('2️⃣ Triggering weekly collection...');
    
    const weeklyResponse = await fetch('http://localhost:3000/api/background/collect-weekly', {
      method: 'GET' // Use GET for cron job endpoint (no auth required)
    });

    if (weeklyResponse.ok) {
      const weeklyResult = await weeklyResponse.json();
      console.log('✅ Weekly collection started:', weeklyResult.message);
    } else {
      const errorText = await weeklyResponse.text();
      console.log(`❌ Weekly collection failed: ${weeklyResponse.status} - ${errorText}`);
    }

    console.log('\n⏳ Waiting 30 seconds for collections to process...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Check results
    console.log('3️⃣ Checking collection results...');
    
    const { createClient } = require('@supabase/supabase-js');
    require('dotenv').config();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: googleAdsData, error: queryError } = await supabase
      .from('campaign_summaries')
      .select('client_id, platform, summary_type, summary_date, total_spend')
      .eq('platform', 'google')
      .order('summary_date', { ascending: false })
      .limit(20);

    if (queryError) {
      console.log('❌ Error checking results:', queryError.message);
    } else if (!googleAdsData || googleAdsData.length === 0) {
      console.log('⚠️ No Google Ads data found yet. Collection may still be running in background.');
    } else {
      console.log(`✅ Found ${googleAdsData.length} Google Ads records:`);
      
      const monthly = googleAdsData.filter(d => d.summary_type === 'monthly');
      const weekly = googleAdsData.filter(d => d.summary_type === 'weekly');
      
      console.log(`   Monthly records: ${monthly.length}`);
      console.log(`   Weekly records: ${weekly.length}`);
      
      if (monthly.length > 0) {
        const monthlySpend = monthly.reduce((sum, d) => sum + (d.total_spend || 0), 0);
        console.log(`   Total monthly spend: ${monthlySpend.toFixed(2)}`);
      }
      
      if (weekly.length > 0) {
        const weeklySpend = weekly.reduce((sum, d) => sum + (d.total_spend || 0), 0);
        console.log(`   Total weekly spend: ${weeklySpend.toFixed(2)}`);
      }
    }

    console.log('\n🎯 COLLECTION STATUS:');
    console.log('✅ Background collection processes have been triggered');
    console.log('📊 Data collection runs in background for all Google Ads clients');
    console.log('⏰ Collections will continue processing for several minutes');
    console.log('🔄 Check the server logs for detailed progress');

  } catch (error) {
    console.error('❌ Collection trigger error:', error);
  }
}

triggerGoogleAdsCollection().catch(console.error);
