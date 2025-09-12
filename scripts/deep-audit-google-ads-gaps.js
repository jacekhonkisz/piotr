#!/usr/bin/env node

/**
 * Deep Audit: Google Ads Data Gaps
 * 
 * This script investigates why Google Ads data is significantly less than Meta Ads data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deepAuditGoogleAdsGaps() {
  console.log('🔍 DEEP AUDIT: Google Ads Data Gaps\n');
  
  try {
    // Get all clients with their platform configurations
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, ad_account_id, google_ads_customer_id, google_ads_refresh_token')
      .eq('api_status', 'valid');
    
    if (!clients || clients.length === 0) {
      console.log('❌ No clients found');
      return;
    }
    
    console.log(`📊 Analyzing ${clients.length} clients for Google Ads configuration\n`);
    
    // Analyze each client's platform configuration
    const platformAnalysis = {
      metaOnly: 0,
      googleOnly: 0,
      bothPlatforms: 0,
      noPlatforms: 0,
      clients: []
    };
    
    for (const client of clients) {
      const hasMeta = !!(client.meta_access_token && client.ad_account_id);
      const hasGoogle = !!(client.google_ads_customer_id && client.google_ads_refresh_token);
      
      let platformType = 'none';
      if (hasMeta && hasGoogle) {
        platformType = 'both';
        platformAnalysis.bothPlatforms++;
      } else if (hasMeta && !hasGoogle) {
        platformType = 'meta-only';
        platformAnalysis.metaOnly++;
      } else if (!hasMeta && hasGoogle) {
        platformType = 'google-only';
        platformAnalysis.googleOnly++;
      } else {
        platformType = 'none';
        platformAnalysis.noPlatforms++;
      }
      
      platformAnalysis.clients.push({
        name: client.name,
        email: client.email,
        hasMeta,
        hasGoogle,
        platformType
      });
    }
    
    console.log('📊 Platform Configuration Analysis:');
    console.log(`   Meta Only: ${platformAnalysis.metaOnly} clients`);
    console.log(`   Google Only: ${platformAnalysis.googleOnly} clients`);
    console.log(`   Both Platforms: ${platformAnalysis.bothPlatforms} clients`);
    console.log(`   No Platforms: ${platformAnalysis.noPlatforms} clients`);
    
    // Get data counts by platform
    const { data: platformCounts } = await supabase
      .from('campaign_summaries')
      .select('summary_type, platform')
      .order('summary_type, platform');
    
    const counts = {};
    platformCounts.forEach(record => {
      const key = `${record.summary_type}_${record.platform || 'meta'}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    
    console.log('\n📊 Data Counts by Platform:');
    Object.entries(counts).forEach(([key, count]) => {
      console.log(`   ${key}: ${count} records`);
    });
    
    // Calculate ratios
    const weeklyMeta = counts['weekly_meta'] || 0;
    const weeklyGoogle = counts['weekly_google'] || 0;
    const monthlyMeta = counts['monthly_meta'] || 0;
    const monthlyGoogle = counts['monthly_google'] || 0;
    
    console.log('\n📊 Platform Data Ratios:');
    console.log(`   Weekly: Meta ${weeklyMeta} vs Google ${weeklyGoogle} (${(weeklyGoogle/weeklyMeta*100).toFixed(1)}% of Meta)`);
    console.log(`   Monthly: Meta ${monthlyMeta} vs Google ${monthlyGoogle} (${(monthlyGoogle/monthlyMeta*100).toFixed(1)}% of Meta)`);
    
    // Analyze specific clients with both platforms
    console.log('\n🔍 Detailed Analysis of Clients with Both Platforms:');
    const bothPlatformClients = platformAnalysis.clients.filter(c => c.platformType === 'both');
    
    for (const client of bothPlatformClients.slice(0, 5)) { // Analyze first 5
      console.log(`\n📊 ${client.name}:`);
      
      // Get weekly data counts
      const { data: weeklyData } = await supabase
        .from('campaign_summaries')
        .select('platform')
        .eq('client_id', client.id)
        .eq('summary_type', 'weekly');
      
      const weeklyMetaCount = weeklyData.filter(r => (r.platform || 'meta') === 'meta').length;
      const weeklyGoogleCount = weeklyData.filter(r => r.platform === 'google').length;
      
      // Get monthly data counts
      const { data: monthlyData } = await supabase
        .from('campaign_summaries')
        .select('platform')
        .eq('client_id', client.id)
        .eq('summary_type', 'monthly');
      
      const monthlyMetaCount = monthlyData.filter(r => (r.platform || 'meta') === 'meta').length;
      const monthlyGoogleCount = monthlyData.filter(r => r.platform === 'google').length;
      
      console.log(`   Weekly: Meta ${weeklyMetaCount} vs Google ${weeklyGoogleCount} (${(weeklyGoogleCount/weeklyMetaCount*100).toFixed(1)}% of Meta)`);
      console.log(`   Monthly: Meta ${monthlyMetaCount} vs Google ${monthlyGoogleCount} (${(monthlyGoogleCount/monthlyMetaCount*100).toFixed(1)}% of Meta)`);
    }
    
    // Check Google Ads system settings
    console.log('\n🔍 Google Ads System Settings:');
    const { data: googleSettings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['google_ads_client_id', 'google_ads_client_secret', 'google_ads_developer_token', 'google_ads_manager_refresh_token', 'google_ads_manager_customer_id']);
    
    if (googleSettings && googleSettings.length > 0) {
      googleSettings.forEach(setting => {
        const hasValue = setting.value && setting.value !== 'null' && setting.value !== '';
        console.log(`   ${setting.key}: ${hasValue ? '✅ Configured' : '❌ Missing'}`);
      });
    } else {
      console.log('   ❌ No Google Ads system settings found');
    }
    
    // Check for Google Ads data collection errors
    console.log('\n🔍 Google Ads Data Collection Analysis:');
    
    // Get all Google Ads data and analyze date patterns
    const { data: googleAdsData } = await supabase
      .from('campaign_summaries')
      .select('summary_date, summary_type, client_id')
      .eq('platform', 'google')
      .order('summary_date', { ascending: true });
    
    if (googleAdsData && googleAdsData.length > 0) {
      const googleAdsByDate = {};
      googleAdsData.forEach(record => {
        if (!googleAdsByDate[record.summary_date]) {
          googleAdsByDate[record.summary_date] = [];
        }
        googleAdsByDate[record.summary_date].push(record.client_id);
      });
      
      const googleAdsDates = Object.keys(googleAdsByDate).sort();
      console.log(`   Google Ads data dates: ${googleAdsDates.length} unique dates`);
      console.log(`   Date range: ${googleAdsDates[0]} to ${googleAdsDates[googleAdsDates.length - 1]}`);
      
      // Check for gaps in Google Ads data
      const gaps = [];
      for (let i = 1; i < googleAdsDates.length; i++) {
        const prevDate = new Date(googleAdsDates[i - 1]);
        const currDate = new Date(googleAdsDates[i]);
        const daysDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 14) { // More than 2 weeks gap
          gaps.push({
            start: googleAdsDates[i - 1],
            end: googleAdsDates[i],
            days: daysDiff
          });
        }
      }
      
      console.log(`   Gaps in Google Ads data: ${gaps.length}`);
      gaps.forEach(gap => {
        console.log(`     ${gap.start} to ${gap.end} (${gap.days.toFixed(0)} days)`);
      });
      
      // Check which clients have Google Ads data
      const clientsWithGoogleAds = [...new Set(googleAdsData.map(r => r.client_id))];
      console.log(`   Clients with Google Ads data: ${clientsWithGoogleAds.length}/${clients.length}`);
      
      // Check for clients that should have Google Ads but don't
      const clientsWithGoogleConfig = clients.filter(c => c.google_ads_customer_id && c.google_ads_refresh_token);
      const clientsWithoutGoogleData = clientsWithGoogleConfig.filter(c => !clientsWithGoogleAds.includes(c.id));
      
      console.log(`   Clients with Google config but no data: ${clientsWithoutGoogleData.length}`);
      clientsWithoutGoogleData.forEach(client => {
        console.log(`     - ${client.name} (${client.email})`);
      });
      
    } else {
      console.log('   ❌ No Google Ads data found in database');
    }
    
    // Summary of Google Ads issues
    console.log('\n📋 SUMMARY OF GOOGLE ADS ISSUES:');
    
    if (weeklyGoogle < weeklyMeta * 0.5) {
      console.log('   🚨 CRITICAL: Google Ads weekly data is less than 50% of Meta Ads data');
    }
    
    if (monthlyGoogle < monthlyMeta * 0.5) {
      console.log('   🚨 CRITICAL: Google Ads monthly data is less than 50% of Meta Ads data');
    }
    
    if (platformAnalysis.bothPlatforms > 0 && weeklyGoogle === 0) {
      console.log('   🚨 CRITICAL: Clients configured for both platforms but no Google Ads weekly data');
    }
    
    if (platformAnalysis.bothPlatforms > 0 && monthlyGoogle === 0) {
      console.log('   🚨 CRITICAL: Clients configured for both platforms but no Google Ads monthly data');
    }
    
    console.log('\n💡 ROOT CAUSE ANALYSIS:');
    console.log('   1. Check Google Ads API configuration and credentials');
    console.log('   2. Verify Google Ads data collection is running');
    console.log('   3. Check for Google Ads API rate limiting or errors');
    console.log('   4. Verify client Google Ads tokens are valid');
    console.log('   5. Check background data collection logs for Google Ads failures');
    
  } catch (error) {
    console.error('❌ Deep audit failed:', error);
  }
}

// Run the deep audit
deepAuditGoogleAdsGaps();
