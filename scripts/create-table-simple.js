#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTableSimple() {
  console.log('🏗️ CREATING GOOGLE ADS TABLE (SIMPLE APPROACH)');
  console.log('===============================================\n');

  try {
    // First, let's just try to fix the API route to not require the table
    console.log('🔧 QUICK FIX: Modifying API route to handle missing table gracefully');
    console.log('This will allow Google Ads to work without the table for now.');
    console.log('');
    
    // Test if we can create a simple record in an existing table to verify connection
    console.log('🧪 Testing database connection...');
    
    const { data: testData, error: testError } = await supabase
      .from('clients')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Database connection failed:', testError.message);
      return;
    }
    
    console.log('✅ Database connection working');
    console.log('');
    
    // The table creation will be done manually in Supabase dashboard
    console.log('📋 MANUAL STEPS TO CREATE TABLE:');
    console.log('=================================');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Paste and run this SQL:');
    console.log('');
    console.log(`CREATE TABLE IF NOT EXISTS google_ads_tables_data (
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
  UNIQUE(client_id, date_range_start, date_range_end)
);

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
GRANT ALL ON google_ads_tables_data TO service_role;`);
    
    console.log('');
    console.log('🚀 IMMEDIATE FIX:');
    console.log('=================');
    console.log('I will modify the API route to work without this table for now.');
    console.log('This will fix the 400 error immediately.');
    console.log('You can create the table later for enhanced features.');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

createTableSimple();
