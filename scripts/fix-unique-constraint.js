#!/usr/bin/env node

/**
 * Fix unique constraint to include platform field
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixUniqueConstraint() {
  console.log('🔧 FIXING UNIQUE CONSTRAINT TO INCLUDE PLATFORM\n');

  try {
    // 1. Check current constraints using RPC or direct SQL
    console.log('1️⃣ Checking current constraints...');
    console.log('   (This requires SQL access - will be done via Supabase dashboard)\n');

    // 2. Drop old constraint and add new one with platform
    console.log('2️⃣ SQL commands to run in Supabase dashboard:\n');
    console.log('```sql');
    console.log('-- Drop old constraint (without platform)');
    console.log('ALTER TABLE campaign_summaries');
    console.log('DROP CONSTRAINT IF EXISTS campaign_summaries_client_id_summary_type_summary_date_key;');
    console.log('');
    console.log('-- Add new constraint (with platform)');
    console.log('ALTER TABLE campaign_summaries');
    console.log('ADD CONSTRAINT campaign_summaries_client_id_summary_type_summary_date_platform_key');
    console.log('UNIQUE (client_id, summary_type, summary_date, platform);');
    console.log('```\n');

    // 3. Verify the issue
    console.log('3️⃣ Verifying the issue - checking for months with both platforms:');
    
    const { data, error } = await supabase
      .from('campaign_summaries')
      .select('summary_date, platform, summary_type')
      .eq('client_id', 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa')
      .gte('summary_date', '2025-10-01')
      .lte('summary_date', '2025-10-31')
      .order('summary_date');

    if (error) {
      console.error('   Error:', error.message);
      return;
    }

    const byDate = {};
    data.forEach(r => {
      const key = `${r.summary_date}_${r.summary_type}`;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(r.platform);
    });

    console.log('\n   October 2025 records:');
    Object.entries(byDate).forEach(([key, platforms]) => {
      const [date, type] = key.split('_');
      console.log(`      ${date} (${type}): ${platforms.join(', ')}`);
    });

    const hasMultiplePlatforms = Object.values(byDate).some(p => p.length > 1);
    if (hasMultiplePlatforms) {
      console.log('\n   ✅ Both platforms exist - constraint will work!');
    } else {
      console.log('\n   ⚠️ Only one platform exists - constraint needs to be fixed first');
    }

    console.log('\n📋 INSTRUCTIONS:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run the SQL commands shown above');
    console.log('3. Then run: node scripts/test-manual-insert-october.js');
    console.log('4. It should now succeed!');

  } catch (error) {
    console.error('\n💥 Error:', error.message);
  }
}

fixUniqueConstraint()
  .then(() => {
    console.log('\n🏁 Analysis completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Fatal error:', err);
    process.exit(1);
  });

