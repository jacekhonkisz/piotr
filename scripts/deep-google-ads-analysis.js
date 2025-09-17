#!/usr/bin/env node

/**
 * Deep Google Ads Analysis
 * 
 * This script performs a comprehensive analysis of Google Ads data collection
 * to understand why it's only 15.6% of Meta data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deepGoogleAdsAnalysis() {
  console.log('🔍 DEEP GOOGLE ADS ANALYSIS\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Check system settings discrepancy
    console.log('🔧 SYSTEM SETTINGS VERIFICATION');
    console.log('='.repeat(60));
    
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_enabled', 'google_ads_api_enabled']);
    
    console.log('System Settings:');
    settings?.forEach(setting => {
      console.log(`   ${setting.key}: ${setting.value}`);
    });
    
    // 2. Analyze Google Ads data in detail
    console.log('\n📊 GOOGLE ADS DATA DEEP ANALYSIS');
    console.log('='.repeat(60));
    
    const { data: googleAdsData } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('platform', 'google')
      .order('created_at', { ascending: true });
    
    console.log(`Total Google Ads Records: ${googleAdsData?.length || 0}`);
    
    if (googleAdsData && googleAdsData.length > 0) {
      // Analyze data patterns
      const dataSources = [...new Set(googleAdsData.map(d => d.data_source).filter(Boolean))];
      const summaryTypes = [...new Set(googleAdsData.map(d => d.summary_type))];
      const clientIds = [...new Set(googleAdsData.map(d => d.client_id))];
      
      console.log(`Data Sources: ${dataSources.join(', ')}`);
      console.log(`Summary Types: ${summaryTypes.join(', ')}`);
      console.log(`Clients with Google Ads Data: ${clientIds.length}`);
      
      // Check creation patterns
      const creationDates = googleAdsData.map(d => d.created_at.split('T')[0]).sort();
      const uniqueCreationDates = [...new Set(creationDates)];
      
      console.log(`\nCreation Timeline:`);
      uniqueCreationDates.forEach(date => {
        const count = creationDates.filter(d => d === date).length;
        console.log(`   ${date}: ${count} records`);
      });
      
      // Check summary date patterns
      const summaryDates = googleAdsData.map(d => d.summary_date).sort();
      const uniqueSummaryDates = [...new Set(summaryDates)];
      
      console.log(`\nSummary Date Range: ${summaryDates[0]} to ${summaryDates[summaryDates.length - 1]}`);
      console.log(`Unique Summary Dates: ${uniqueSummaryDates.length}`);
      
      // Check if data looks like test data
      const isTestData = dataSources.includes('current_month_simulation') || 
                        dataSources.includes('test') ||
                        dataSources.includes('simulation');
      
      console.log(`\nData Quality Assessment:`);
      console.log(`   Appears to be test/simulation data: ${isTestData ? '✅' : '❌'}`);
      console.log(`   Data sources: ${dataSources.join(', ')}`);
      
      // Sample a few records to see structure
      console.log(`\nSample Records:`);
      googleAdsData.slice(0, 3).forEach((record, i) => {
        console.log(`\nRecord ${i + 1}:`);
        console.log(`   Client ID: ${record.client_id}`);
        console.log(`   Summary Date: ${record.summary_date}`);
        console.log(`   Summary Type: ${record.summary_type}`);
        console.log(`   Data Source: ${record.data_source}`);
        console.log(`   Created: ${record.created_at}`);
        console.log(`   Spend: ${record.total_spend || 'N/A'}`);
        console.log(`   Impressions: ${record.total_impressions || 'N/A'}`);
      });
    }
    
    // 3. Compare with Meta data patterns
    console.log('\n📊 META VS GOOGLE ADS COMPARISON');
    console.log('='.repeat(60));
    
    const { data: metaData } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('platform', 'meta')
      .order('created_at', { ascending: true });
    
    console.log(`Meta Records: ${metaData?.length || 0}`);
    console.log(`Google Ads Records: ${googleAdsData?.length || 0}`);
    console.log(`Ratio: ${metaData?.length > 0 ? ((googleAdsData?.length || 0) / metaData.length * 100).toFixed(1) : 0}%`);
    
    if (metaData && metaData.length > 0) {
      const metaDataSources = [...new Set(metaData.map(d => d.data_source).filter(Boolean))];
      const metaSummaryDates = metaData.map(d => d.summary_date).sort();
      
      console.log(`\nMeta Data Sources: ${metaDataSources.join(', ')}`);
      console.log(`Meta Summary Range: ${metaSummaryDates[0]} to ${metaSummaryDates[metaSummaryDates.length - 1]}`);
      
      // Check if Meta has more historical data
      const metaHistorical = metaSummaryDates.filter(date => {
        const summaryDate = new Date(date);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return summaryDate < sixMonthsAgo;
      }).length;
      
      const googleHistorical = googleAdsData ? googleAdsData.map(d => d.summary_date).filter(date => {
        const summaryDate = new Date(date);
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        return summaryDate < sixMonthsAgo;
      }).length : 0;
      
      console.log(`\nHistorical Data (6+ months old):`);
      console.log(`   Meta: ${metaHistorical} records`);
      console.log(`   Google Ads: ${googleHistorical} records`);
    }
    
    // 4. Check for collection issues
    console.log('\n🔍 COLLECTION ISSUES ANALYSIS');
    console.log('='.repeat(60));
    
    // Check if Google Ads collection is actually running
    const { data: recentGoogleAds } = await supabase
      .from('campaign_summaries')
      .select('created_at')
      .eq('platform', 'google')
      .order('created_at', { ascending: false })
      .limit(1);
    
    const { data: recentMeta } = await supabase
      .from('campaign_summaries')
      .select('created_at')
      .eq('platform', 'meta')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (recentGoogleAds && recentGoogleAds.length > 0) {
      const lastGoogleAds = new Date(recentGoogleAds[0].created_at);
      const lastMeta = recentMeta && recentMeta.length > 0 ? new Date(recentMeta[0].created_at) : null;
      
      console.log(`Last Google Ads Collection: ${lastGoogleAds.toISOString()}`);
      if (lastMeta) {
        console.log(`Last Meta Collection: ${lastMeta.toISOString()}`);
        
        const timeDiff = Math.abs(lastGoogleAds - lastMeta) / (1000 * 60 * 60 * 24);
        console.log(`Time Difference: ${timeDiff.toFixed(1)} days`);
      }
    }
    
    // 5. Check client configurations
    console.log('\n👥 CLIENT CONFIGURATION ANALYSIS');
    console.log('='.repeat(60));
    
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, google_ads_customer_id, google_ads_enabled, api_status');
    
    const clientsWithGoogleConfig = clients?.filter(c => c.google_ads_customer_id) || [];
    const clientsWithGoogleEnabled = clients?.filter(c => c.google_ads_enabled) || [];
    const clientsWithGoogleData = [...new Set(googleAdsData?.map(d => d.client_id) || [])];
    
    console.log(`Total Clients: ${clients?.length || 0}`);
    console.log(`Clients with Google Ads Customer ID: ${clientsWithGoogleConfig.length}`);
    console.log(`Clients with Google Ads Enabled: ${clientsWithGoogleEnabled.length}`);
    console.log(`Clients with Google Ads Data: ${clientsWithGoogleData.length}`);
    
    // Check for clients with config but no data
    const clientsWithConfigButNoData = clientsWithGoogleConfig.filter(client => 
      !clientsWithGoogleData.includes(client.id)
    );
    
    if (clientsWithConfigButNoData.length > 0) {
      console.log(`\n❌ Clients with Google Ads config but NO DATA:`);
      clientsWithConfigButNoData.forEach(client => {
        console.log(`   ${client.name}: ${client.google_ads_customer_id} (enabled: ${client.google_ads_enabled})`);
      });
    }
    
    // 6. Final diagnosis
    console.log('\n🎯 DIAGNOSIS & RECOMMENDATIONS');
    console.log('='.repeat(60));
    
    const isTestData = googleAdsData?.some(d => 
      d.data_source?.includes('simulation') || 
      d.data_source?.includes('test') ||
      d.data_source?.includes('current_month')
    );
    
    const hasRecentData = googleAdsData?.some(d => {
      const summaryDate = new Date(d.summary_date);
      const now = new Date();
      const daysDiff = (now - summaryDate) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    });
    
    console.log(`🔍 ROOT CAUSE ANALYSIS:`);
    console.log(`   Google Ads data appears to be test/simulation: ${isTestData ? '✅' : '❌'}`);
    console.log(`   Google Ads has recent data: ${hasRecentData ? '✅' : '❌'}`);
    console.log(`   Google Ads collection is active: ${recentGoogleAds && recentGoogleAds.length > 0 ? '✅' : '❌'}`);
    
    if (isTestData) {
      console.log(`\n🔧 ISSUE: Google Ads data is test/simulation data, not real campaign data`);
      console.log(`   - This explains the low volume compared to Meta`);
      console.log(`   - Real Google Ads campaigns may not be active`);
      console.log(`   - Or Google Ads API integration needs to be fixed`);
    }
    
    if (!hasRecentData) {
      console.log(`\n🔧 ISSUE: Google Ads data is not recent`);
      console.log(`   - Collection may have stopped`);
      console.log(`   - Or there are no active Google Ads campaigns`);
    }
    
    console.log(`\n💡 RECOMMENDATIONS:`);
    console.log(`   1. Verify Google Ads campaigns are active and have data`);
    console.log(`   2. Check Google Ads API integration and credentials`);
    console.log(`   3. Review Google Ads data collection logs`);
    console.log(`   4. Test Google Ads API connection with real campaigns`);
    
    console.log(`\n✅ DEEP ANALYSIS COMPLETE`);
    
  } catch (error) {
    console.error('❌ Deep analysis failed:', error);
  }
}

// Run the deep analysis
deepGoogleAdsAnalysis();
