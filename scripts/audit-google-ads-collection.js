#!/usr/bin/env node

/**
 * Google Ads Data Collection Audit
 * 
 * This script audits the Google Ads data collection system to understand
 * why Google Ads data is only 15.6% of Meta data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditGoogleAdsCollection() {
  console.log('🔍 GOOGLE ADS DATA COLLECTION AUDIT\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Check system configuration
    console.log('🔧 SYSTEM CONFIGURATION');
    console.log('='.repeat(60));
    
    const { data: systemSettings } = await supabase
      .from('system_settings')
      .select('*')
      .eq('key', 'google_ads_api_enabled');
    
    const googleAdsEnabled = systemSettings?.[0]?.value === 'true';
    console.log(`Google Ads API Enabled: ${googleAdsEnabled ? '✅' : '❌'}`);
    
    // 2. Check client configurations
    console.log('\n👥 CLIENT GOOGLE ADS CONFIGURATION');
    console.log('='.repeat(60));
    
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, google_ads_customer_id, api_status, created_at')
      .eq('api_status', 'valid');
    
    const clientsWithGoogleAds = clients.filter(c => c.google_ads_customer_id);
    const clientsWithoutGoogleAds = clients.filter(c => !c.google_ads_customer_id);
    
    console.log(`Total Active Clients: ${clients.length}`);
    console.log(`Clients with Google Ads: ${clientsWithGoogleAds.length} (${(clientsWithGoogleAds.length/clients.length*100).toFixed(1)}%)`);
    console.log(`Clients without Google Ads: ${clientsWithoutGoogleAds.length} (${(clientsWithoutGoogleAds.length/clients.length*100).toFixed(1)}%)`);
    
    console.log('\n📊 CLIENTS WITH GOOGLE ADS:');
    clientsWithGoogleAds.forEach(client => {
      console.log(`   ${client.name}: ${client.google_ads_customer_id}`);
    });
    
    console.log('\n❌ CLIENTS WITHOUT GOOGLE ADS:');
    clientsWithoutGoogleAds.forEach(client => {
      console.log(`   ${client.name}: ${client.email}`);
    });
    
    // 3. Analyze Google Ads data collection patterns
    console.log('\n📊 GOOGLE ADS DATA COLLECTION ANALYSIS');
    console.log('='.repeat(60));
    
    const { data: googleAdsData } = await supabase
      .from('campaign_summaries')
      .select('client_id, summary_date, summary_type, platform, data_source')
      .eq('platform', 'google')
      .order('summary_date', { ascending: true });
    
    if (!googleAdsData || googleAdsData.length === 0) {
      console.log('❌ NO GOOGLE ADS DATA FOUND');
      return;
    }
    
    console.log(`Total Google Ads Records: ${googleAdsData.length}`);
    
    // Group by client
    const googleAdsByClient = {};
    googleAdsData.forEach(record => {
      if (!googleAdsByClient[record.client_id]) {
        googleAdsByClient[record.client_id] = {
          weekly: [],
          monthly: [],
          dataSources: new Set()
        };
      }
      googleAdsByClient[record.client_id][record.summary_type].push(record);
      if (record.data_source) {
        googleAdsByClient[record.client_id].dataSources.add(record.data_source);
      }
    });
    
    console.log('\n📊 GOOGLE ADS DATA BY CLIENT:');
    Object.entries(googleAdsByClient).forEach(([clientId, data]) => {
      const client = clients.find(c => c.id === clientId);
      const clientName = client ? client.name : `Client ${clientId}`;
      
      console.log(`\n🏢 ${clientName}`);
      console.log(`   Weekly Records: ${data.weekly.length}`);
      console.log(`   Monthly Records: ${data.monthly.length}`);
      console.log(`   Data Sources: ${Array.from(data.dataSources).join(', ') || 'Unknown'}`);
      
      if (data.weekly.length > 0) {
        const weeklyDates = data.weekly.map(w => w.summary_date).sort();
        console.log(`   Weekly Range: ${weeklyDates[0]} to ${weeklyDates[weeklyDates.length - 1]}`);
      }
      
      if (data.monthly.length > 0) {
        const monthlyDates = data.monthly.map(m => m.summary_date).sort();
        console.log(`   Monthly Range: ${monthlyDates[0]} to ${monthlyDates[monthlyDates.length - 1]}`);
      }
    });
    
    // 4. Compare with Meta data
    console.log('\n📊 META VS GOOGLE ADS COMPARISON');
    console.log('='.repeat(60));
    
    const { data: metaData } = await supabase
      .from('campaign_summaries')
      .select('client_id, summary_date, summary_type, platform')
      .eq('platform', 'meta')
      .order('summary_date', { ascending: true });
    
    const metaByClient = {};
    metaData.forEach(record => {
      if (!metaByClient[record.client_id]) {
        metaByClient[record.client_id] = { weekly: [], monthly: [] };
      }
      metaByClient[record.client_id][record.summary_type].push(record);
    });
    
    console.log('Client-by-Client Comparison:');
    clients.forEach(client => {
      const googleWeekly = googleAdsByClient[client.id]?.weekly.length || 0;
      const googleMonthly = googleAdsByClient[client.id]?.monthly.length || 0;
      const metaWeekly = metaByClient[client.id]?.weekly.length || 0;
      const metaMonthly = metaByClient[client.id]?.monthly.length || 0;
      
      const weeklyRatio = metaWeekly > 0 ? (googleWeekly / metaWeekly * 100).toFixed(1) : 0;
      const monthlyRatio = metaMonthly > 0 ? (googleMonthly / metaMonthly * 100).toFixed(1) : 0;
      
      console.log(`\n🏢 ${client.name}`);
      console.log(`   Weekly: Google=${googleWeekly}, Meta=${metaWeekly} (${weeklyRatio}%)`);
      console.log(`   Monthly: Google=${googleMonthly}, Meta=${metaMonthly} (${monthlyRatio}%)`);
      console.log(`   Google Ads ID: ${client.google_ads_customer_id || 'Not configured'}`);
    });
    
    // 5. Check for collection errors or issues
    console.log('\n🔍 COLLECTION ISSUES ANALYSIS');
    console.log('='.repeat(60));
    
    // Check if Google Ads data is more recent or older than Meta
    const googleAdsDates = googleAdsData.map(d => new Date(d.summary_date).getTime());
    const metaDates = metaData.map(d => new Date(d.summary_date).getTime());
    
    const googleAdsEarliest = new Date(Math.min(...googleAdsDates));
    const googleAdsLatest = new Date(Math.max(...googleAdsDates));
    const metaEarliest = new Date(Math.min(...metaDates));
    const metaLatest = new Date(Math.max(...metaDates));
    
    console.log(`Google Ads Date Range: ${googleAdsEarliest.toISOString().split('T')[0]} to ${googleAdsLatest.toISOString().split('T')[0]}`);
    console.log(`Meta Date Range: ${metaEarliest.toISOString().split('T')[0]} to ${metaLatest.toISOString().split('T')[0]}`);
    
    // Check data source patterns
    const dataSources = [...new Set(googleAdsData.map(d => d.data_source).filter(Boolean))];
    console.log(`Google Ads Data Sources: ${dataSources.join(', ') || 'Unknown'}`);
    
    // 6. Check recent collection activity
    console.log('\n📅 RECENT COLLECTION ACTIVITY');
    console.log('='.repeat(60));
    
    const recentGoogleAds = googleAdsData.filter(d => {
      const recordDate = new Date(d.summary_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return recordDate >= thirtyDaysAgo;
    });
    
    const recentMeta = metaData.filter(d => {
      const recordDate = new Date(d.summary_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return recordDate >= thirtyDaysAgo;
    });
    
    console.log(`Google Ads Records (Last 30 days): ${recentGoogleAds.length}`);
    console.log(`Meta Records (Last 30 days): ${recentMeta.length}`);
    
    // 7. Check for collection gaps
    console.log('\n🔍 COLLECTION GAPS ANALYSIS');
    console.log('='.repeat(60));
    
    // Find clients with Google Ads config but no data
    const clientsWithGoogleConfigButNoData = clientsWithGoogleAds.filter(client => 
      !googleAdsByClient[client.id] || 
      (googleAdsByClient[client.id].weekly.length === 0 && googleAdsByClient[client.id].monthly.length === 0)
    );
    
    if (clientsWithGoogleConfigButNoData.length > 0) {
      console.log(`❌ Clients with Google Ads config but NO DATA (${clientsWithGoogleConfigButNoData.length}):`);
      clientsWithGoogleConfigButNoData.forEach(client => {
        console.log(`   ${client.name}: ${client.google_ads_customer_id}`);
      });
    } else {
      console.log('✅ All clients with Google Ads config have data');
    }
    
    // 8. Summary and recommendations
    console.log('\n🎯 SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(60));
    
    const totalGoogleRecords = googleAdsData.length;
    const totalMetaRecords = metaData.length;
    const overallRatio = totalMetaRecords > 0 ? (totalGoogleRecords / totalMetaRecords * 100).toFixed(1) : 0;
    
    console.log(`Overall Google Ads vs Meta Ratio: ${overallRatio}%`);
    console.log(`Clients with Google Ads configured: ${clientsWithGoogleAds.length}/${clients.length}`);
    console.log(`Clients with Google Ads data: ${Object.keys(googleAdsByClient).length}/${clientsWithGoogleAds.length}`);
    
    if (clientsWithGoogleConfigButNoData.length > 0) {
      console.log('\n🔧 IMMEDIATE ACTIONS NEEDED:');
      console.log('1. Fix Google Ads data collection for clients with config but no data');
      console.log('2. Check Google Ads API credentials and permissions');
      console.log('3. Review Google Ads collection logs for errors');
    }
    
    if (overallRatio < 50) {
      console.log('\n🔧 OPTIMIZATION OPPORTUNITIES:');
      console.log('1. Increase Google Ads data collection frequency');
      console.log('2. Verify Google Ads API rate limits and quotas');
      console.log('3. Check if Google Ads campaigns are active and have data');
      console.log('4. Review Google Ads data collection timing vs Meta collection');
    }
    
    console.log('\n✅ GOOGLE ADS AUDIT COMPLETE');
    
  } catch (error) {
    console.error('❌ Google Ads audit failed:', error);
  }
}

// Run the Google Ads audit
auditGoogleAdsCollection();
