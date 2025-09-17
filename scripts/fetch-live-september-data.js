#!/usr/bin/env node

/**
 * Fetch Live September Data for All Clients
 * 
 * This script fetches live data for September 2025 for each client
 * and compares it with what's currently in the database
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchLiveSeptemberData() {
  console.log('🔍 FETCHING LIVE SEPTEMBER DATA FOR ALL CLIENTS\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Get all active clients with their platform configurations
    console.log('👥 GETTING CLIENT CONFIGURATIONS...');
    
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, ad_account_id, google_ads_customer_id, api_status')
      .eq('api_status', 'valid');
    
    if (!clients || clients.length === 0) {
      console.log('❌ No active clients found');
      return;
    }
    
    console.log(`Found ${clients.length} active clients`);
    
    // 2. Define September 2025 date range
    const septemberStart = '2025-09-01';
    const septemberEnd = '2025-09-30';
    const currentDate = new Date().toISOString().split('T')[0];
    const actualEnd = currentDate < septemberEnd ? currentDate : septemberEnd;
    
    console.log(`\n📅 SEPTEMBER 2025 DATE RANGE: ${septemberStart} to ${actualEnd}`);
    
    // 3. Get current database data for September
    console.log('\n📊 GETTING CURRENT DATABASE DATA...');
    
    const { data: dbData } = await supabase
      .from('campaign_summaries')
      .select('client_id, summary_date, summary_type, platform, total_spend, total_impressions, total_clicks, total_conversions, data_source')
      .gte('summary_date', septemberStart)
      .lte('summary_date', actualEnd)
      .order('client_id, summary_date');
    
    console.log(`Found ${dbData?.length || 0} database records for September`);
    
    // 4. Fetch live data for each client
    console.log('\n🔄 FETCHING LIVE DATA FOR EACH CLIENT...');
    console.log('='.repeat(60));
    
    const results = [];
    
    for (const client of clients) {
      console.log(`\n🏢 ${client.name}`);
      console.log(`   📧 ${client.email}`);
      console.log(`   🔧 Meta: ${client.meta_access_token ? '✅' : '❌'}`);
      console.log(`   🔧 Google Ads: ${client.google_ads_customer_id ? '✅' : '❌'}`);
      
      const clientResult = {
        client: client,
        meta: { live: null, db: null, error: null },
        google: { live: null, db: null, error: null }
      };
      
      // Get database data for this client
      const clientDbData = dbData?.filter(d => d.client_id === client.id) || [];
      const metaDbData = clientDbData.filter(d => (d.platform || 'meta') === 'meta');
      const googleDbData = clientDbData.filter(d => d.platform === 'google');
      
      clientResult.meta.db = metaDbData;
      clientResult.google.db = googleDbData;
      
      console.log(`   📊 Database - Meta: ${metaDbData.length} records, Google: ${googleDbData.length} records`);
      
      // Fetch live Meta data
      if (client.meta_access_token && client.ad_account_id) {
        try {
          console.log(`   🔄 Fetching live Meta data...`);
          const metaLiveData = await fetchLiveMetaData(client, septemberStart, actualEnd);
          clientResult.meta.live = metaLiveData;
          console.log(`   ✅ Meta live data: ${metaLiveData?.length || 0} records`);
        } catch (error) {
          console.log(`   ❌ Meta error: ${error.message}`);
          clientResult.meta.error = error.message;
        }
      } else {
        console.log(`   ⏭️  Skipping Meta (no credentials)`);
      }
      
      // Fetch live Google Ads data
      if (client.google_ads_customer_id) {
        try {
          console.log(`   🔄 Fetching live Google Ads data...`);
          const googleLiveData = await fetchLiveGoogleAdsData(client, septemberStart, actualEnd);
          clientResult.google.live = googleLiveData;
          console.log(`   ✅ Google Ads live data: ${googleLiveData?.length || 0} records`);
        } catch (error) {
          console.log(`   ❌ Google Ads error: ${error.message}`);
          clientResult.google.error = error.message;
        }
      } else {
        console.log(`   ⏭️  Skipping Google Ads (no customer ID)`);
      }
      
      results.push(clientResult);
    }
    
    // 5. Generate comparison report
    console.log('\n📊 LIVE DATA COMPARISON REPORT');
    console.log('='.repeat(60));
    
    generateComparisonReport(results);
    
    console.log('\n✅ LIVE DATA FETCH COMPLETE');
    
  } catch (error) {
    console.error('❌ Live data fetch failed:', error);
  }
}

async function fetchLiveMetaData(client, startDate, endDate) {
  try {
    // Use the existing fetch-live-data API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        clientId: client.id,
        startDate: startDate,
        endDate: endDate,
        platform: 'meta'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    throw new Error(`Meta API error: ${error.message}`);
  }
}

async function fetchLiveGoogleAdsData(client, startDate, endDate) {
  try {
    // Use the existing fetch-google-ads-live-data API endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/fetch-google-ads-live-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        clientId: client.id,
        startDate: startDate,
        endDate: endDate
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    throw new Error(`Google Ads API error: ${error.message}`);
  }
}

function generateComparisonReport(results) {
  console.log('\n📊 DETAILED COMPARISON BY CLIENT:');
  console.log('='.repeat(60));
  
  let totalMetaLive = 0;
  let totalMetaDb = 0;
  let totalGoogleLive = 0;
  let totalGoogleDb = 0;
  let clientsWithMetaData = 0;
  let clientsWithGoogleData = 0;
  
  results.forEach((result, index) => {
    const client = result.client;
    const metaLive = result.meta.live?.length || 0;
    const metaDb = result.meta.db?.length || 0;
    const googleLive = result.google.live?.length || 0;
    const googleDb = result.google.db?.length || 0;
    
    totalMetaLive += metaLive;
    totalMetaDb += metaDb;
    totalGoogleLive += googleLive;
    totalGoogleDb += googleDb;
    
    if (metaLive > 0) clientsWithMetaData++;
    if (googleLive > 0) clientsWithGoogleData++;
    
    console.log(`\n${index + 1}. ${client.name}`);
    console.log(`   Meta: Live=${metaLive}, DB=${metaDb} ${metaLive > metaDb ? '📈' : metaLive < metaDb ? '📉' : '✅'}`);
    console.log(`   Google: Live=${googleLive}, DB=${googleDb} ${googleLive > googleDb ? '📈' : googleLive < googleDb ? '📉' : '✅'}`);
    
    if (result.meta.error) {
      console.log(`   ❌ Meta Error: ${result.meta.error}`);
    }
    if (result.google.error) {
      console.log(`   ❌ Google Error: ${result.google.error}`);
    }
    
    // Show sample data if available
    if (metaLive > 0) {
      const sampleMeta = result.meta.live[0];
      console.log(`   📊 Meta Sample: ${sampleMeta.summary_date} - Spend: ${sampleMeta.total_spend}, Impressions: ${sampleMeta.total_impressions}`);
    }
    
    if (googleLive > 0) {
      const sampleGoogle = result.google.live[0];
      console.log(`   📊 Google Sample: ${sampleGoogle.summary_date} - Spend: ${sampleGoogle.total_spend}, Impressions: ${sampleGoogle.total_impressions}`);
    }
  });
  
  console.log('\n📊 SUMMARY STATISTICS:');
  console.log('='.repeat(60));
  console.log(`Total Clients: ${results.length}`);
  console.log(`Clients with Meta Live Data: ${clientsWithMetaData}`);
  console.log(`Clients with Google Live Data: ${clientsWithGoogleData}`);
  console.log(`\nMeta Data:`);
  console.log(`   Live Records: ${totalMetaLive}`);
  console.log(`   Database Records: ${totalMetaDb}`);
  console.log(`   Difference: ${totalMetaLive - totalMetaDb} (${totalMetaLive > totalMetaDb ? 'Live has more' : totalMetaLive < totalMetaDb ? 'DB has more' : 'Equal'})`);
  console.log(`\nGoogle Ads Data:`);
  console.log(`   Live Records: ${totalGoogleLive}`);
  console.log(`   Database Records: ${totalGoogleDb}`);
  console.log(`   Difference: ${totalGoogleLive - totalGoogleDb} (${totalGoogleLive > totalGoogleDb ? 'Live has more' : totalGoogleLive < totalGoogleDb ? 'DB has more' : 'Equal'})`);
  
  // Check if we found real Google Ads data
  if (totalGoogleLive > 0) {
    console.log('\n🎉 SUCCESS: Found live Google Ads data!');
    console.log('   This means Google Ads campaigns are active and have real data.');
  } else {
    console.log('\n⚠️  WARNING: No live Google Ads data found');
    console.log('   This confirms that Google Ads campaigns may not be active or have data.');
  }
}

// Run the live data fetch
fetchLiveSeptemberData();
