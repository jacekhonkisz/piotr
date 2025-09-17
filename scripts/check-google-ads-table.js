#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGoogleAdsTable() {
  console.log('🗄️ CHECKING GOOGLE ADS DATABASE TABLES');
  console.log('======================================\n');

  try {
    // Test 1: Check if google_ads_campaign_summaries table exists
    console.log('📊 TEST 1: google_ads_campaign_summaries table');
    console.log('==============================================');
    
    try {
      const { data, error } = await supabase
        .from('google_ads_campaign_summaries')
        .select('id')
        .limit(1);
      
      if (error) {
        console.log('❌ Table does not exist or has permission issues');
        console.log(`Error: ${error.message}`);
        console.log(`Code: ${error.code}`);
        console.log(`Details: ${error.details}`);
        
        if (error.code === '42P01') {
          console.log('🔧 SOLUTION: Create the google_ads_campaign_summaries table');
        }
      } else {
        console.log('✅ Table exists and is accessible');
        console.log(`Rows found: ${data?.length || 0}`);
      }
    } catch (tableError) {
      console.log('❌ Exception accessing table:', tableError.message);
    }
    console.log('');

    // Test 2: Check if google_ads_tables_data table exists
    console.log('📈 TEST 2: google_ads_tables_data table');
    console.log('=======================================');
    
    try {
      const { data, error } = await supabase
        .from('google_ads_tables_data')
        .select('id')
        .limit(1);
      
      if (error) {
        console.log('❌ Table does not exist or has permission issues');
        console.log(`Error: ${error.message}`);
        console.log(`Code: ${error.code}`);
        
        if (error.code === '42P01') {
          console.log('🔧 SOLUTION: Create the google_ads_tables_data table');
        }
      } else {
        console.log('✅ Table exists and is accessible');
        console.log(`Rows found: ${data?.length || 0}`);
      }
    } catch (tableError) {
      console.log('❌ Exception accessing table:', tableError.message);
    }
    console.log('');

    // Test 3: Check existing tables for reference
    console.log('📋 TEST 3: Existing campaign_summaries table (for reference)');
    console.log('===========================================================');
    
    try {
      const { data, error } = await supabase
        .from('campaign_summaries')
        .select('id')
        .limit(1);
      
      if (error) {
        console.log('❌ Meta Ads table also missing:', error.message);
      } else {
        console.log('✅ Meta Ads campaign_summaries table exists');
        console.log(`Rows found: ${data?.length || 0}`);
      }
    } catch (tableError) {
      console.log('❌ Exception accessing Meta table:', tableError.message);
    }
    console.log('');

    console.log('🎯 ANALYSIS');
    console.log('===========');
    console.log('The 400 error is likely caused by missing database tables.');
    console.log('The Google Ads API route tries to query google_ads_campaign_summaries');
    console.log('which probably doesn\'t exist yet.');
    console.log('');
    
    console.log('🔧 SOLUTION');
    console.log('===========');
    console.log('1. Create the missing Google Ads database tables');
    console.log('2. Or modify the API route to handle missing tables gracefully');
    console.log('3. The tables should mirror the Meta Ads table structure');
    console.log('');
    
    console.log('📝 REQUIRED TABLES:');
    console.log('===================');
    console.log('1. google_ads_campaign_summaries');
    console.log('   - Same structure as campaign_summaries');
    console.log('   - All conversion metrics columns');
    console.log('   - google_ads_tables JSONB field');
    console.log('');
    console.log('2. google_ads_tables_data');
    console.log('   - network_performance JSONB');
    console.log('   - demographic_performance JSONB');
    console.log('   - quality_score_metrics JSONB');

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkGoogleAdsTable();
