/**
 * Test cache creation with detailed logging to find where booking steps are lost
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { fetchFreshGoogleAdsCurrentMonthData } from '../src/lib/google-ads-smart-cache-helper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('🧪 TESTING CACHE CREATION WITH LOGGING\n');
  console.log('='.repeat(80));

  // Get Havet client
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .ilike('name', '%havet%')
    .limit(1);

  if (!clients || clients.length === 0) {
    console.error('❌ Havet not found');
    process.exit(1);
  }

  const client = clients[0];
  console.log(`✅ Client: ${client.name}\n`);

  // Delete existing cache
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const periodId = `${year}-${String(month).padStart(2, '0')}`;

  console.log('🗑️ Deleting existing cache...');
  await supabase
    .from('google_ads_current_month_cache')
    .delete()
    .eq('client_id', client.id)
    .eq('period_id', periodId);
  console.log('✅ Cache deleted\n');

  // Trigger cache creation
  console.log('🔄 Triggering cache creation (watch logs for DEBUG messages)...\n');
  console.log('='.repeat(80));
  
  try {
    await fetchFreshGoogleAdsCurrentMonthData(client);
    console.log('\n✅ Cache creation complete\n');
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }

  // Verify cache
  console.log('='.repeat(80));
  console.log('📊 VERIFYING CACHE\n');
  console.log('='.repeat(80));

  const { data: newCache } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('client_id', client.id)
    .eq('period_id', periodId)
    .single();

  if (newCache) {
    const cacheTotals = {
      step1: parseFloat(newCache.cache_data?.conversionMetrics?.booking_step_1 || '0') || 0,
      step2: parseFloat(newCache.cache_data?.conversionMetrics?.booking_step_2 || '0') || 0,
      step3: parseFloat(newCache.cache_data?.conversionMetrics?.booking_step_3 || '0') || 0
    };

    const cacheCampaigns = newCache.cache_data?.campaigns || [];
    const campaignsWithSteps = cacheCampaigns.filter((c: any) => (parseFloat(c.booking_step_1 || '0') || 0) > 0);

    console.log(`Cache Totals:`);
    console.log(`   Step 1: ${cacheTotals.step1}`);
    console.log(`   Step 2: ${cacheTotals.step2}`);
    console.log(`   Step 3: ${cacheTotals.step3}\n`);

    console.log(`Campaigns in cache: ${cacheCampaigns.length}`);
    console.log(`Campaigns with booking_step_1 > 0: ${campaignsWithSteps.length}\n`);

    if (campaignsWithSteps.length > 0) {
      const topCampaign = campaignsWithSteps[0];
      console.log(`Top campaign in cache:`);
      console.log(`   Name: ${topCampaign.campaignName}`);
      console.log(`   Step 1: ${topCampaign.booking_step_1}`);
      console.log(`   Step 2: ${topCampaign.booking_step_2}`);
      console.log(`   Step 3: ${topCampaign.booking_step_3}\n`);
    }

    if (cacheTotals.step1 > 400) {
      console.log('✅ SUCCESS: Cache has correct booking steps!');
    } else {
      console.log('❌ ISSUE: Cache has wrong booking steps');
      console.log(`   Expected: ~476, Got: ${cacheTotals.step1}`);
    }
  } else {
    console.log('❌ Cache not found after creation');
  }
}

main().catch(console.error);

