#!/usr/bin/env node

/**
 * Test manual insert of October 2025 data to diagnose RLS/constraint issues
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Using service role to bypass RLS
);

const BELMONTE_ID = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

async function testManualInsert() {
  console.log('🧪 TESTING MANUAL INSERT OF OCTOBER 2025 DATA\n');

  try {
    // 1. Create test data
    const testData = {
      client_id: BELMONTE_ID,
      summary_type: 'monthly',
      summary_date: '2025-10-01',
      platform: 'google',
      total_spend: 4530.78,
      total_impressions: 1477,
      total_clicks: 144,
      total_conversions: 78,
      active_campaigns: 16,
      data_source: 'google_ads_api',
      last_updated: new Date().toISOString()
    };

    console.log('1️⃣ Test data:', JSON.stringify(testData, null, 2));

    // 2. Try to insert/upsert
    console.log('\n2️⃣ Attempting upsert...');
    const { data, error } = await supabase
      .from('campaign_summaries')
      .upsert(testData, {
        onConflict: 'client_id,summary_type,summary_date,platform'
      })
      .select();

    if (error) {
      console.error('❌ UPSERT FAILED:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      return;
    }

    console.log('✅ UPSERT SUCCESS!');
    console.log('   Inserted/Updated:', data);

    // 3. Verify the data
    console.log('\n3️⃣ Verifying data in database...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', BELMONTE_ID)
      .eq('summary_date', '2025-10-01')
      .eq('platform', 'google');

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      return;
    }

    if (verifyData && verifyData.length > 0) {
      console.log('✅ DATA FOUND IN DATABASE:');
      verifyData.forEach(r => {
        console.log(`   Date: ${r.summary_date}`);
        console.log(`   Platform: ${r.platform}`);
        console.log(`   Spend: $${r.total_spend}`);
        console.log(`   Source: ${r.data_source}`);
        console.log(`   Updated: ${r.last_updated}`);
      });
    } else {
      console.log('❌ Data NOT found in database after insert!');
    }

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testManualInsert()
  .then(() => {
    console.log('\n🏁 Test completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });

