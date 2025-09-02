#!/usr/bin/env node

/**
 * Add Google Ads Columns to Clients Table
 * 
 * This script adds the necessary Google Ads columns to the clients table.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addGoogleAdsColumns() {
  console.log('🔧 Adding Google Ads columns to clients table...');
  
  const columnsToAdd = [
    {
      name: 'google_ads_customer_id',
      type: 'TEXT',
      comment: 'Google Ads Customer ID (format: XXX-XXX-XXXX)'
    },
    {
      name: 'google_ads_refresh_token',
      type: 'TEXT',
      comment: 'OAuth refresh token for Google Ads API'
    },
    {
      name: 'google_ads_access_token',
      type: 'TEXT',
      comment: 'OAuth access token for Google Ads API'
    },
    {
      name: 'google_ads_token_expires_at',
      type: 'TIMESTAMPTZ',
      comment: 'Token expiration timestamp'
    },
    {
      name: 'google_ads_enabled',
      type: 'BOOLEAN',
      default: 'false',
      comment: 'Enable/disable Google Ads for this client'
    }
  ];
  
  for (const column of columnsToAdd) {
    try {
      console.log(`📝 Adding column: ${column.name}...`);
      
      // Try to add the column (will fail if it already exists, which is fine)
      let sql = `ALTER TABLE clients ADD COLUMN IF NOT EXISTS ${column.name} ${column.type}`;
      if (column.default) {
        sql += ` DEFAULT ${column.default}`;
      }
      
      // We'll use a workaround since we can't execute DDL directly
      // Let's check if the column exists first by trying to select it
      try {
        const { data, error } = await supabase
          .from('clients')
          .select(column.name)
          .limit(1);
        
        if (error && error.message.includes('column') && error.message.includes('does not exist')) {
          console.log(`   Column ${column.name} doesn't exist, needs to be added manually`);
          console.log(`   SQL: ${sql}`);
        } else {
          console.log(`   ✅ Column ${column.name} already exists`);
        }
      } catch (err) {
        console.log(`   Column ${column.name} doesn't exist, needs to be added manually`);
        console.log(`   SQL: ${sql}`);
      }
      
    } catch (error) {
      console.log(`   ⚠️  Error with column ${column.name}:`, error.message);
    }
  }
  
  console.log('\n📋 Required SQL to run manually:');
  console.log('================================');
  console.log(`
-- Add Google Ads columns to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_ads_enabled BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN clients.google_ads_customer_id IS 'Google Ads Customer ID (format: XXX-XXX-XXXX)';
COMMENT ON COLUMN clients.google_ads_refresh_token IS 'OAuth refresh token for Google Ads API';
COMMENT ON COLUMN clients.google_ads_access_token IS 'OAuth access token for Google Ads API';
COMMENT ON COLUMN clients.google_ads_token_expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN clients.google_ads_enabled IS 'Enable/disable Google Ads for this client';
  `);
}

async function checkTableStructure() {
  console.log('🔍 Checking current clients table structure...');
  
  try {
    // Try to get a sample client to see what columns exist
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error fetching clients:', error);
      return;
    }
    
    if (clients && clients.length > 0) {
      console.log('📋 Current columns in clients table:');
      Object.keys(clients[0]).forEach(column => {
        console.log(`   - ${column}`);
      });
      
      // Check for Google Ads columns
      const googleAdsColumns = Object.keys(clients[0]).filter(col => col.startsWith('google_ads_'));
      console.log(`\n🎯 Google Ads columns found: ${googleAdsColumns.length}`);
      googleAdsColumns.forEach(column => {
        console.log(`   ✅ ${column}`);
      });
      
      if (googleAdsColumns.length === 0) {
        console.log('❌ No Google Ads columns found - migration needed');
      } else if (googleAdsColumns.length < 5) {
        console.log('⚠️  Some Google Ads columns missing - partial migration needed');
      } else {
        console.log('✅ All Google Ads columns present');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking table structure:', error);
  }
}

async function main() {
  console.log('🎯 Google Ads Columns Addition Script');
  console.log('=====================================\n');
  
  try {
    await checkTableStructure();
    await addGoogleAdsColumns();
    
    console.log('\n🎉 Column addition script completed!');
    console.log('\nℹ️  Since we cannot execute DDL via the API, you may need to:');
    console.log('1. Run the SQL manually in Supabase SQL Editor');
    console.log('2. Or use Supabase CLI with local development');
    console.log('3. Then run the Belmonte update script again');
    
  } catch (error) {
    console.error('❌ Error during column addition:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  addGoogleAdsColumns,
  checkTableStructure
}; 