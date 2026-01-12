/**
 * Check Havet's Meta Ads CTR and CPC for January 2026
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const HAVET_ID = '93d46876-addc-4b99-b1e1-437428dd54f1';

async function checkHavetJanuary2026() {
  console.log('🔍 HAVET JANUARY 2026 CTR & CPC CHECK');
  console.log('='.repeat(80));
  console.log();

  // Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', HAVET_ID)
    .single();

  if (!client) {
    console.log('❌ Client not found');
    return;
  }

  console.log(`📋 Client: ${client.name} (${client.id})`);
  console.log();

  // Check campaign_summaries (archived monthly data)
  console.log('1️⃣ CAMPAIGN SUMMARIES (Archived Monthly Data):');
  const { data: summary, error: summaryError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', HAVET_ID)
    .eq('summary_type', 'monthly')
    .eq('summary_date', '2026-01-01')
    .eq('platform', 'meta')
    .order('last_updated', { ascending: false })
    .limit(1)
    .single();

  if (summaryError) {
    if (summaryError.code === 'PGRST116') {
      console.log('   ⚠️ No data found in campaign_summaries for January 2026');
    } else {
      console.log(`   ❌ Error: ${summaryError.message}`);
    }
  } else if (summary) {
    console.log(`   ✅ Found data (last updated: ${new Date(summary.last_updated).toLocaleString()})`);
    console.log();
    console.log('   📊 METRICS:');
    console.log(`      Total Spend: ${parseFloat(summary.total_spend || 0).toFixed(2)} zł`);
    console.log(`      Total Impressions: ${(summary.total_impressions || 0).toLocaleString()}`);
    console.log(`      Total Clicks: ${(summary.total_clicks || 0).toLocaleString()}`);
    console.log();
    console.log('   🎯 CTR & CPC:');
    console.log(`      Average CTR: ${parseFloat(summary.average_ctr || 0).toFixed(2)}%`);
    console.log(`      Average CPC: ${parseFloat(summary.average_cpc || 0).toFixed(2)} zł`);
    console.log();
    
    // Calculate from totals for verification
    const calculatedCtr = summary.total_impressions > 0 
      ? (summary.total_clicks / summary.total_impressions) * 100 
      : 0;
    const calculatedCpc = summary.total_clicks > 0 
      ? summary.total_spend / summary.total_clicks 
      : 0;
    
    console.log('   🔍 VERIFICATION (Calculated from totals):');
    console.log(`      Calculated CTR: ${calculatedCtr.toFixed(2)}%`);
    console.log(`      Calculated CPC: ${calculatedCpc.toFixed(2)} zł`);
    console.log();
    
    if (Math.abs(calculatedCtr - parseFloat(summary.average_ctr || 0)) > 0.01) {
      console.log('   ⚠️ WARNING: Stored CTR differs from calculated CTR!');
    }
    if (Math.abs(calculatedCpc - parseFloat(summary.average_cpc || 0)) > 0.01) {
      console.log('   ⚠️ WARNING: Stored CPC differs from calculated CPC!');
    }
  }

  console.log();

  // Check current_month_cache (if January 2026 is current month)
  console.log('2️⃣ CURRENT MONTH CACHE:');
  const { data: cache, error: cacheError } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('client_id', HAVET_ID)
    .order('last_updated', { ascending: false })
    .limit(1)
    .single();

  if (cacheError) {
    if (cacheError.code === 'PGRST116') {
      console.log('   ⚠️ No data in current_month_cache');
    } else {
      console.log(`   ❌ Error: ${cacheError.message}`);
    }
  } else if (cache) {
    console.log(`   ✅ Found cache data (last updated: ${new Date(cache.last_updated).toLocaleString()})`);
    console.log();
    console.log('   📊 METRICS:');
    console.log(`      Total Spend: ${parseFloat(cache.total_spend || 0).toFixed(2)} zł`);
    console.log(`      Total Impressions: ${(cache.total_impressions || 0).toLocaleString()}`);
    console.log(`      Total Clicks: ${(cache.total_clicks || 0).toLocaleString()}`);
    console.log();
    console.log('   🎯 CTR & CPC:');
    console.log(`      Average CTR: ${parseFloat(cache.average_ctr || 0).toFixed(2)}%`);
    console.log(`      Average CPC: ${parseFloat(cache.average_cpc || 0).toFixed(2)} zł`);
  }

  console.log();
  console.log('='.repeat(80));
  console.log();
  console.log('📝 SUMMARY:');
  if (summary) {
    console.log(`   Main CTR for January 2026: ${parseFloat(summary.average_ctr || 0).toFixed(2)}%`);
    console.log(`   Main CPC for January 2026: ${parseFloat(summary.average_cpc || 0).toFixed(2)} zł`);
  } else {
    console.log('   ⚠️ No data found for January 2026 in campaign_summaries');
    console.log('   💡 Data may need to be collected or fetched from Meta API');
  }
}

checkHavetJanuary2026().catch(console.error);

