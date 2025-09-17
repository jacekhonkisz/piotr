#!/usr/bin/env node

/**
 * Push Google Ads Tables to Supabase
 * This script executes the Google Ads table creation SQL directly
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function pushGoogleAdsTables() {
  console.log('🚀 Pushing Google Ads tables to Supabase...');

  try {
    // Step 1: Create google_ads_campaigns table
    console.log('📝 Creating google_ads_campaigns table...');
    
    const campaignsSQL = `
-- Create google_ads_campaigns table
CREATE TABLE IF NOT EXISTS google_ads_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  impressions BIGINT DEFAULT 0 NOT NULL,
  clicks BIGINT DEFAULT 0 NOT NULL,
  cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  form_submissions BIGINT DEFAULT 0 NOT NULL,
  phone_calls BIGINT DEFAULT 0 NOT NULL,
  email_clicks BIGINT DEFAULT 0 NOT NULL,
  phone_clicks BIGINT DEFAULT 0 NOT NULL,
  booking_step_1 BIGINT DEFAULT 0 NOT NULL,
  booking_step_2 BIGINT DEFAULT 0 NOT NULL,
  booking_step_3 BIGINT DEFAULT 0 NOT NULL,
  reservations BIGINT DEFAULT 0 NOT NULL,
  reservation_value DECIMAL(12,2) DEFAULT 0 NOT NULL,
  roas DECIMAL(8,2) DEFAULT 0 NOT NULL,
  demographics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(client_id, campaign_id, date_range_start, date_range_end)
);`;

    const { error: campaignsError } = await supabase.rpc('exec', { sql: campaignsSQL });
    
    if (campaignsError && !campaignsError.message?.includes('already exists')) {
      console.error('❌ Error creating campaigns table:', campaignsError);
      // Try alternative approach
      console.log('🔄 Trying direct table creation...');
      
      const { error: directError } = await supabase
        .from('google_ads_campaigns')
        .select('id')
        .limit(1);
        
      if (directError && directError.code === '42P01') {
        console.log('❌ Table does not exist. Please run this SQL in Supabase SQL Editor:');
        console.log('\n' + '='.repeat(80));
        console.log(campaignsSQL);
        console.log('='.repeat(80));
        return;
      }
    }

    console.log('✅ google_ads_campaigns table ready');

    // Step 2: Create indexes
    console.log('📝 Creating indexes...');
    
    const indexesSQL = [
      'CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_id ON google_ads_campaigns(client_id);',
      'CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_date_range ON google_ads_campaigns(date_range_start, date_range_end);',
      'CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_date ON google_ads_campaigns(client_id, date_range_start, date_range_end);'
    ];

    for (const indexSQL of indexesSQL) {
      const { error } = await supabase.rpc('exec', { sql: indexSQL });
      if (error && !error.message?.includes('already exists')) {
        console.warn('⚠️ Index creation warning:', error.message);
      }
    }

    console.log('✅ Indexes created');

    // Step 3: Enable RLS and create policies
    console.log('📝 Setting up RLS policies...');
    
    const rlsSQL = `
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage Google Ads campaigns" ON google_ads_campaigns;
CREATE POLICY "Service role can manage Google Ads campaigns" ON google_ads_campaigns
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can view client Google Ads campaigns" ON google_ads_campaigns;
CREATE POLICY "Admins can view client Google Ads campaigns" ON google_ads_campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaigns.client_id 
      AND clients.admin_id = auth.uid()
    )
  );`;

    const { error: rlsError } = await supabase.rpc('exec', { sql: rlsSQL });
    if (rlsError && !rlsError.message?.includes('already exists')) {
      console.warn('⚠️ RLS setup warning:', rlsError.message);
    }

    console.log('✅ RLS policies set up');

    // Step 4: Create campaign summaries table
    console.log('📝 Creating google_ads_campaign_summaries table...');
    
    const summariesSQL = `
CREATE TABLE IF NOT EXISTS google_ads_campaign_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'custom')),
  total_spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  total_impressions BIGINT DEFAULT 0 NOT NULL,
  total_clicks BIGINT DEFAULT 0 NOT NULL,
  total_conversions BIGINT DEFAULT 0 NOT NULL,
  average_ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  average_cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  average_cpm DECIMAL(8,2) DEFAULT 0 NOT NULL,
  total_form_submissions BIGINT DEFAULT 0 NOT NULL,
  total_phone_calls BIGINT DEFAULT 0 NOT NULL,
  total_email_clicks BIGINT DEFAULT 0 NOT NULL,
  total_phone_clicks BIGINT DEFAULT 0 NOT NULL,
  total_booking_step_1 BIGINT DEFAULT 0 NOT NULL,
  total_booking_step_2 BIGINT DEFAULT 0 NOT NULL,
  total_booking_step_3 BIGINT DEFAULT 0 NOT NULL,
  total_reservations BIGINT DEFAULT 0 NOT NULL,
  total_reservation_value DECIMAL(12,2) DEFAULT 0 NOT NULL,
  average_roas DECIMAL(8,2) DEFAULT 0 NOT NULL,
  campaign_count INTEGER DEFAULT 0 NOT NULL,
  data_source TEXT DEFAULT 'google_ads_api' NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(client_id, period_start, period_end, period_type)
);`;

    const { error: summariesError } = await supabase.rpc('exec', { sql: summariesSQL });
    if (summariesError && !summariesError.message?.includes('already exists')) {
      console.error('❌ Error creating summaries table:', summariesError);
    } else {
      console.log('✅ google_ads_campaign_summaries table ready');
    }

    // Step 5: Test table access
    console.log('🔍 Testing table access...');
    
    const { data: testCampaigns, error: testError } = await supabase
      .from('google_ads_campaigns')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Cannot access google_ads_campaigns table:', testError);
      return;
    }

    console.log('✅ Tables are accessible');

    console.log('\n🎉 Google Ads tables successfully pushed to Supabase!');
    console.log('\n📋 Next steps:');
    console.log('1. Run: node scripts/simple-google-ads-setup.js');
    console.log('2. This will add sample data for testing');
    console.log('3. Then test the unified PDF generation');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
if (require.main === module) {
  pushGoogleAdsTables().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { pushGoogleAdsTables };
