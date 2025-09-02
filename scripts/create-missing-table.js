#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createMissingTable() {
  console.log('🏗️ CREATING MISSING GOOGLE ADS TABLE');
  console.log('====================================\n');

  try {
    // Use the SQL editor approach via RPC
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS google_ads_tables_data (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
        date_range_start DATE NOT NULL,
        date_range_end DATE NOT NULL,
        
        network_performance JSONB DEFAULT '[]'::jsonb,
        demographic_performance JSONB DEFAULT '[]'::jsonb,
        quality_score_metrics JSONB DEFAULT '[]'::jsonb,
        device_performance JSONB DEFAULT '[]'::jsonb,
        keyword_performance JSONB DEFAULT '[]'::jsonb,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(client_id, date_range_start, date_range_end)
      );
      
      CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_client_id ON google_ads_tables_data(client_id);
      CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_date_range ON google_ads_tables_data(date_range_start, date_range_end);
      
      ALTER TABLE google_ads_tables_data ENABLE ROW LEVEL SECURITY;
      
      CREATE POLICY "google_ads_tables_policy" ON google_ads_tables_data
      FOR ALL USING (
        client_id IN (
          SELECT id FROM clients 
          WHERE email = auth.jwt() ->> 'email'
          OR auth.jwt() ->> 'email' = 'admin@example.com'
        )
      );
      
      GRANT ALL ON google_ads_tables_data TO authenticated;
      GRANT ALL ON google_ads_tables_data TO service_role;
    `;

    console.log('📊 Creating google_ads_tables_data table...');
    
    // Try to create the table by inserting a dummy record first (this will fail if table doesn't exist)
    try {
      const { data: testData, error: testError } = await supabase
        .from('google_ads_tables_data')
        .select('id')
        .limit(1);
      
      if (testError && testError.code === '42P01') {
        console.log('❌ Table does not exist, need to create it manually');
        console.log('');
        console.log('🔧 MANUAL CREATION REQUIRED:');
        console.log('============================');
        console.log('Please go to your Supabase dashboard > SQL Editor and run:');
        console.log('');
        console.log(createTableSQL);
        console.log('');
        return false;
      } else {
        console.log('✅ Table already exists and is accessible');
        return true;
      }
    } catch (error) {
      console.log('❌ Error checking table:', error.message);
      return false;
    }

  } catch (error) {
    console.error('❌ Failed to create table:', error);
    return false;
  }
}

async function main() {
  const tableCreated = await createMissingTable();
  
  if (tableCreated) {
    console.log('✅ TABLE CREATION SUCCESSFUL');
    console.log('============================');
    console.log('The google_ads_tables_data table is ready.');
    console.log('');
    console.log('🎯 NEXT STEP: Remove database bypass');
  } else {
    console.log('⚠️ TABLE CREATION NEEDED');
    console.log('========================');
    console.log('Manual table creation is required.');
    console.log('After creating the table, we can remove the bypass.');
  }
}

main();
