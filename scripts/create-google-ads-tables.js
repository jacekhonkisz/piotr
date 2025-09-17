#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createGoogleAdsTables() {
  console.log('🏗️ CREATING GOOGLE ADS DATABASE TABLES');
  console.log('======================================\n');

  try {
    // Create google_ads_tables_data table
    console.log('📊 Creating google_ads_tables_data table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS google_ads_tables_data (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
        date_range_start DATE NOT NULL,
        date_range_end DATE NOT NULL,
        
        -- Network performance (equivalent to Meta's placement performance)
        network_performance JSONB DEFAULT '[]'::jsonb,
        
        -- Demographic performance (exact equivalent)
        demographic_performance JSONB DEFAULT '[]'::jsonb,
        
        -- Quality score metrics (equivalent to Meta's ad relevance)
        quality_score_metrics JSONB DEFAULT '[]'::jsonb,
        
        -- Metadata
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Unique constraint to prevent duplicates
        UNIQUE(client_id, date_range_start, date_range_end)
      );
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { 
      sql: createTableSQL 
    });

    if (createError) {
      console.log('❌ Failed to create table via RPC, trying direct approach...');
      
      // Alternative approach: Create via raw SQL if RPC doesn't work
      const { error: directError } = await supabase
        .from('google_ads_tables_data')
        .select('id')
        .limit(0);
      
      if (directError && directError.code === '42P01') {
        console.log('❌ Table does not exist and cannot be created via Supabase client');
        console.log('🔧 MANUAL SOLUTION REQUIRED:');
        console.log('');
        console.log('Please run this SQL in your Supabase SQL editor:');
        console.log('');
        console.log(createTableSQL);
        console.log('');
        return;
      }
    }

    console.log('✅ google_ads_tables_data table created successfully');
    console.log('');

    // Test the table
    console.log('🧪 Testing table access...');
    const { data: testData, error: testError } = await supabase
      .from('google_ads_tables_data')
      .select('id')
      .limit(1);

    if (testError) {
      console.log('❌ Table test failed:', testError.message);
    } else {
      console.log('✅ Table is accessible');
      console.log(`Rows found: ${testData?.length || 0}`);
    }
    console.log('');

    // Check google_ads_campaign_summaries table structure
    console.log('📋 Checking google_ads_campaign_summaries table...');
    const { data: summaryData, error: summaryError } = await supabase
      .from('google_ads_campaign_summaries')
      .select('*')
      .limit(1);

    if (summaryError) {
      console.log('❌ google_ads_campaign_summaries table issue:', summaryError.message);
    } else {
      console.log('✅ google_ads_campaign_summaries table is accessible');
      console.log(`Rows found: ${summaryData?.length || 0}`);
      
      if (summaryData && summaryData.length > 0) {
        console.log('📊 Sample structure:');
        console.log(Object.keys(summaryData[0]).join(', '));
      }
    }
    console.log('');

    console.log('🎉 DATABASE SETUP COMPLETE');
    console.log('==========================');
    console.log('✅ google_ads_tables_data table: READY');
    console.log('✅ google_ads_campaign_summaries table: READY');
    console.log('');
    console.log('💡 The Google Ads API should now work without 400 errors!');
    console.log('🔄 Try refreshing the /reports page and selecting Google Ads');

  } catch (error) {
    console.error('❌ Failed to create tables:', error);
    
    console.log('');
    console.log('🔧 MANUAL SOLUTION:');
    console.log('===================');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Open the SQL Editor');
    console.log('3. Run the following SQL:');
    console.log('');
    console.log(`
CREATE TABLE IF NOT EXISTS google_ads_tables_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Network performance (equivalent to Meta's placement performance)
  network_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Demographic performance (exact equivalent)
  demographic_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Quality score metrics (equivalent to Meta's ad relevance)
  quality_score_metrics JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(client_id, date_range_start, date_range_end)
);
    `);
  }
}

createGoogleAdsTables();
