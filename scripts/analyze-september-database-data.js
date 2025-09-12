#!/usr/bin/env node

/**
 * Analyze September Database Data
 * 
 * This script analyzes what's currently in the database for September 2025
 * to understand the data patterns and sources
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeSeptemberDatabaseData() {
  console.log('🔍 ANALYZING SEPTEMBER DATABASE DATA\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Get all September 2025 data
    const septemberStart = '2025-09-01';
    const septemberEnd = '2025-09-30';
    const currentDate = new Date().toISOString().split('T')[0];
    const actualEnd = currentDate < septemberEnd ? currentDate : septemberEnd;
    
    console.log(`📅 SEPTEMBER 2025 DATE RANGE: ${septemberStart} to ${actualEnd}`);
    
    const { data: septemberData } = await supabase
      .from('campaign_summaries')
      .select('*')
      .gte('summary_date', septemberStart)
      .lte('summary_date', actualEnd)
      .order('client_id, summary_date, platform');
    
    console.log(`📊 TOTAL SEPTEMBER RECORDS: ${septemberData?.length || 0}`);
    
    if (!septemberData || septemberData.length === 0) {
      console.log('❌ No September data found in database');
      return;
    }
    
    // 2. Analyze by platform
    console.log('\n📊 PLATFORM ANALYSIS');
    console.log('='.repeat(60));
    
    const metaData = septemberData.filter(d => (d.platform || 'meta') === 'meta');
    const googleData = septemberData.filter(d => d.platform === 'google');
    
    console.log(`Meta Records: ${metaData.length}`);
    console.log(`Google Ads Records: ${googleData.length}`);
    console.log(`Ratio: ${metaData.length > 0 ? (googleData.length / metaData.length * 100).toFixed(1) : 0}%`);
    
    // 3. Analyze data sources
    console.log('\n🔧 DATA SOURCE ANALYSIS');
    console.log('='.repeat(60));
    
    const metaSources = [...new Set(metaData.map(d => d.data_source).filter(Boolean))];
    const googleSources = [...new Set(googleData.map(d => d.data_source).filter(Boolean))];
    
    console.log(`Meta Data Sources: ${metaSources.join(', ')}`);
    console.log(`Google Ads Data Sources: ${googleSources.join(', ')}`);
    
    // 4. Analyze by client
    console.log('\n👥 CLIENT ANALYSIS');
    console.log('='.repeat(60));
    
    const clients = [...new Set(septemberData.map(d => d.client_id))];
    console.log(`Clients with September data: ${clients.length}`);
    
    // Get client names
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, ad_account_id, google_ads_customer_id')
      .in('id', clients);
    
    const clientMap = {};
    clientData?.forEach(client => {
      clientMap[client.id] = client;
    });
    
    console.log('\n📊 DETAILED CLIENT BREAKDOWN:');
    clients.forEach(clientId => {
      const client = clientMap[clientId];
      const clientName = client ? client.name : `Client ${clientId}`;
      
      const clientMetaData = metaData.filter(d => d.client_id === clientId);
      const clientGoogleData = googleData.filter(d => d.client_id === clientId);
      
      console.log(`\n🏢 ${clientName}`);
      console.log(`   📧 ${client?.email || 'Unknown'}`);
      console.log(`   🔧 Meta: ${client?.meta_access_token ? '✅' : '❌'} (${client?.ad_account_id || 'None'})`);
      console.log(`   🔧 Google: ${client?.google_ads_customer_id ? '✅' : '❌'} (${client?.google_ads_customer_id || 'None'})`);
      console.log(`   📊 Meta Records: ${clientMetaData.length}`);
      console.log(`   📊 Google Records: ${clientGoogleData.length}`);
      
      if (clientMetaData.length > 0) {
        const metaSources = [...new Set(clientMetaData.map(d => d.data_source).filter(Boolean))];
        console.log(`   🔧 Meta Sources: ${metaSources.join(', ')}`);
        
        // Show sample Meta data
        const sampleMeta = clientMetaData[0];
        console.log(`   📊 Meta Sample: ${sampleMeta.summary_date} - Spend: ${sampleMeta.total_spend}, Impressions: ${sampleMeta.total_impressions}`);
      }
      
      if (clientGoogleData.length > 0) {
        const googleSources = [...new Set(clientGoogleData.map(d => d.data_source).filter(Boolean))];
        console.log(`   🔧 Google Sources: ${googleSources.join(', ')}`);
        
        // Show sample Google data
        const sampleGoogle = clientGoogleData[0];
        console.log(`   📊 Google Sample: ${sampleGoogle.summary_date} - Spend: ${sampleGoogle.total_spend}, Impressions: ${sampleGoogle.total_impressions}`);
      }
    });
    
    // 5. Analyze data patterns
    console.log('\n📈 DATA PATTERN ANALYSIS');
    console.log('='.repeat(60));
    
    // Check if data looks like test data
    const isTestData = googleData.some(d => 
      d.data_source?.includes('simulation') || 
      d.data_source?.includes('test') ||
      d.data_source?.includes('current_month')
    );
    
    console.log(`Google Ads appears to be test data: ${isTestData ? '✅' : '❌'}`);
    
    if (isTestData) {
      console.log(`   This explains why Google Ads data is limited`);
      console.log(`   Real campaigns would have different data sources`);
    }
    
    // Check data freshness
    const creationDates = septemberData.map(d => d.created_at.split('T')[0]).sort();
    const uniqueCreationDates = [...new Set(creationDates)];
    
    console.log(`\n📅 DATA CREATION TIMELINE:`);
    uniqueCreationDates.forEach(date => {
      const count = creationDates.filter(d => d === date).length;
      const metaCount = septemberData.filter(d => d.created_at.startsWith(date) && (d.platform || 'meta') === 'meta').length;
      const googleCount = septemberData.filter(d => d.created_at.startsWith(date) && d.platform === 'google').length;
      console.log(`   ${date}: ${count} total (${metaCount} Meta, ${googleCount} Google)`);
    });
    
    // 6. Check for real vs simulated data indicators
    console.log('\n🔍 REAL VS SIMULATED DATA INDICATORS');
    console.log('='.repeat(60));
    
    // Check spend patterns
    const metaSpend = metaData.reduce((sum, d) => sum + (d.total_spend || 0), 0);
    const googleSpend = googleData.reduce((sum, d) => sum + (d.total_spend || 0), 0);
    
    console.log(`Total Meta Spend: ${metaSpend.toFixed(2)} PLN`);
    console.log(`Total Google Spend: ${googleSpend.toFixed(2)} PLN`);
    console.log(`Google/Meta Spend Ratio: ${metaSpend > 0 ? (googleSpend / metaSpend * 100).toFixed(1) : 0}%`);
    
    // Check if Google data has realistic values
    const googleSpendValues = googleData.map(d => d.total_spend || 0).filter(s => s > 0);
    const avgGoogleSpend = googleSpendValues.length > 0 ? googleSpendValues.reduce((a, b) => a + b, 0) / googleSpendValues.length : 0;
    
    console.log(`Average Google Spend per record: ${avgGoogleSpend.toFixed(2)} PLN`);
    console.log(`Google Spend Range: ${Math.min(...googleSpendValues)} - ${Math.max(...googleSpendValues)} PLN`);
    
    // 7. Summary and recommendations
    console.log('\n🎯 SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(60));
    
    console.log(`📊 SEPTEMBER DATA SUMMARY:`);
    console.log(`   Total Records: ${septemberData.length}`);
    console.log(`   Meta Records: ${metaData.length}`);
    console.log(`   Google Records: ${googleData.length}`);
    console.log(`   Clients with Data: ${clients.length}`);
    console.log(`   Google Ads Test Data: ${isTestData ? 'Yes' : 'No'}`);
    
    if (isTestData) {
      console.log(`\n🔧 RECOMMENDATIONS:`);
      console.log(`   1. Google Ads data is test/simulation data`);
      console.log(`   2. Need to switch to real campaign data collection`);
      console.log(`   3. Verify Google Ads campaigns are active`);
      console.log(`   4. Check Google Ads API integration`);
    } else {
      console.log(`\n✅ Google Ads data appears to be real campaign data`);
    }
    
    console.log(`\n✅ SEPTEMBER ANALYSIS COMPLETE`);
    
  } catch (error) {
    console.error('❌ September analysis failed:', error);
  }
}

// Run the analysis
analyzeSeptemberDatabaseData();
