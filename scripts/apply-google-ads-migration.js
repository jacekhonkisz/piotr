#!/usr/bin/env node

/**
 * Apply Google Ads Migration
 * 
 * This script applies the Google Ads migration by uploading it to the Supabase project.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Applying Google Ads Migration...');
  
  try {
    // Read the migration file
    const migrationSQL = fs.readFileSync('supabase/migrations/035_add_google_ads_columns.sql', 'utf8');
    console.log('📖 Read migration file successfully');
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Since we can't execute DDL directly via the API, we'll simulate applying the migration
    // and provide the user with the SQL to run manually
    
    console.log('\n📋 Migration SQL to execute:');
    console.log('==============================');
    statements.forEach((statement, index) => {
      console.log(`${index + 1}. ${statement};`);
    });
    
    console.log('\n🔧 Manual Steps Required:');
    console.log('==========================');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Execute the SQL');
    console.log('5. Then run the Belmonte update script');
    
    console.log('\n🌐 Quick Link: ' + supabaseUrl.replace('/rest/v1', '') + '/project/_/sql');
    
  } catch (error) {
    console.error('❌ Error reading migration file:', error);
    throw error;
  }
}

async function createMigrationForSupabase() {
  console.log('\n📄 Creating formatted SQL for copy-paste:');
  console.log('==========================================');
  
  const sql = `
-- Google Ads Migration for Clients Table
-- Execute this in Supabase SQL Editor

BEGIN;

-- Add Google Ads columns to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_ads_enabled BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN clients.google_ads_customer_id IS 'Google Ads Customer ID (format: XXX-XXX-XXXX)';
COMMENT ON COLUMN clients.google_ads_refresh_token IS 'OAuth refresh token for Google Ads API';
COMMENT ON COLUMN clients.google_ads_access_token IS 'OAuth access token for Google Ads API';
COMMENT ON COLUMN clients.google_ads_token_expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN clients.google_ads_enabled IS 'Enable/disable Google Ads for this client';

-- Update system settings for Google Ads (using the values we already have)
INSERT INTO system_settings (key, value, description) VALUES
  ('google_ads_client_id', '', 'Google Ads API Client ID'),
  ('google_ads_client_secret', '', 'Google Ads API Client Secret'),
  ('google_ads_developer_token', 'WCX04VxQqB0fsV0YDX0w1g', 'Google Ads API Developer Token'),
  ('google_ads_manager_customer_id', '293-100-0497', 'Google Ads Manager Customer ID'),
  ('google_ads_enabled', 'true', 'Enable/disable Google Ads integration globally')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

COMMIT;
  `;
  
  console.log(sql);
  
  // Save to file for easy copy
  fs.writeFileSync('google-ads-migration-to-execute.sql', sql);
  console.log('\n💾 SQL saved to: google-ads-migration-to-execute.sql');
}

async function main() {
  console.log('🎯 Google Ads Migration Application');
  console.log('===================================\n');
  
  try {
    await applyMigration();
    await createMigrationForSupabase();
    
    console.log('\n🎉 Migration preparation completed!');
    console.log('\n📝 Next Steps:');
    console.log('1. Copy the SQL from above (or from google-ads-migration-to-execute.sql)');
    console.log('2. Execute it in Supabase SQL Editor');
    console.log('3. Run: node scripts/add-google-ads-to-belmonte.js');
    
  } catch (error) {
    console.error('❌ Error during migration preparation:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  applyMigration,
  createMigrationForSupabase
}; 