/**
 * Check funnel metrics specifically for all clients
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFunnelMetrics() {
  console.log('🔍 FUNNEL METRICS DETAILED CHECK');
  console.log('='.repeat(80));

  // Get all clients
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .order('name');

  const currentMonth = new Date().toISOString().slice(0, 7);

  // =====================================================
  // GOOGLE ADS FUNNEL CHECK
  // =====================================================
  console.log('\n📊 GOOGLE ADS FUNNEL METRICS (Current Month - ' + currentMonth + ')');
  console.log('='.repeat(80));

  const { data: googleCache } = await supabase
    .from('google_ads_current_month_cache')
    .select('*')
    .eq('period_id', currentMonth);

  if (googleCache) {
    console.log(`\n${googleCache.length} clients in Google cache:\n`);
    
    googleCache.forEach(entry => {
      const client = clients?.find(c => c.id === entry.client_id);
      const stats = entry.cache_data?.stats || {};
      const metrics = entry.cache_data?.conversionMetrics || {};
      const campaigns = entry.cache_data?.campaigns || [];
      
      console.log(`📍 ${client?.name || 'Unknown'}`);
      console.log(`   Stats: Spend: ${stats.totalSpend?.toFixed(2) || 0} | Impressions: ${stats.totalImpressions || 0} | Clicks: ${stats.totalClicks || 0}`);
      console.log(`   Funnel: Step1: ${metrics.booking_step_1 || 0} | Step2: ${metrics.booking_step_2 || 0} | Step3: ${metrics.booking_step_3 || 0}`);
      console.log(`   Reservations: ${metrics.reservations || 0} | Value: ${metrics.reservation_value || 0}`);
      console.log(`   Campaigns: ${campaigns.length}`);
      
      // Check if campaigns have funnel data
      const campaignsWithStep1 = campaigns.filter(c => (c.booking_step_1 || 0) > 0).length;
      console.log(`   Campaigns with Step1 > 0: ${campaignsWithStep1}`);
      console.log('');
    });
  }

  // =====================================================
  // META ADS FUNNEL CHECK
  // =====================================================
  console.log('\n📊 META ADS FUNNEL METRICS (Current Month - ' + currentMonth + ')');
  console.log('='.repeat(80));

  const { data: metaCache } = await supabase
    .from('current_month_cache')
    .select('*')
    .eq('period_id', currentMonth);

  if (metaCache) {
    console.log(`\n${metaCache.length} clients in Meta cache:\n`);
    
    metaCache.forEach(entry => {
      const client = clients?.find(c => c.id === entry.client_id);
      const stats = entry.cache_data?.stats || {};
      const metrics = entry.cache_data?.conversionMetrics || {};
      const campaigns = entry.cache_data?.campaigns || [];
      
      console.log(`📍 ${client?.name || 'Unknown'}`);
      console.log(`   Stats: Spend: ${stats.totalSpend?.toFixed(2) || 0} | Impressions: ${stats.totalImpressions || 0} | Clicks: ${stats.totalClicks || 0}`);
      console.log(`   Funnel: Step1: ${metrics.booking_step_1 || 0} | Step2: ${metrics.booking_step_2 || 0} | Step3: ${metrics.booking_step_3 || 0}`);
      console.log(`   Reservations: ${metrics.reservations || 0} | Value: ${metrics.reservation_value || 0}`);
      console.log(`   Campaigns: ${campaigns.length}`);
      
      // Check if campaigns have funnel data
      const campaignsWithStep1 = campaigns.filter(c => (c.booking_step_1 || 0) > 0).length;
      console.log(`   Campaigns with Step1 > 0: ${campaignsWithStep1}`);
      console.log('');
    });
  }

  // =====================================================
  // HAVET SPECIFIC CHECK
  // =====================================================
  console.log('\n📍 HAVET DETAILED CHECK');
  console.log('='.repeat(80));

  const havet = clients?.find(c => c.name.toLowerCase().includes('havet'));
  if (havet) {
    const { data: havetGoogle } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .eq('client_id', havet.id)
      .eq('period_id', currentMonth)
      .single();

    if (havetGoogle) {
      console.log('\nGoogle Ads Cache Content:');
      console.log('  Stats:', JSON.stringify(havetGoogle.cache_data?.stats, null, 2));
      console.log('  ConversionMetrics:', JSON.stringify(havetGoogle.cache_data?.conversionMetrics, null, 2));
      console.log('  Number of campaigns:', havetGoogle.cache_data?.campaigns?.length);
      
      // Check first 3 campaigns
      const campaigns = havetGoogle.cache_data?.campaigns?.slice(0, 3) || [];
      console.log('\n  First 3 campaigns:');
      campaigns.forEach((c, i) => {
        console.log(`    ${i+1}. ${c.campaignName}`);
        console.log(`       spend: ${c.spend}, clicks: ${c.clicks}`);
        console.log(`       step1: ${c.booking_step_1}, step2: ${c.booking_step_2}, step3: ${c.booking_step_3}`);
      });
    }

    const { data: havetMeta } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', havet.id)
      .eq('period_id', currentMonth)
      .single();

    if (havetMeta) {
      console.log('\nMeta Ads Cache Content:');
      console.log('  Stats:', JSON.stringify(havetMeta.cache_data?.stats, null, 2));
      console.log('  ConversionMetrics:', JSON.stringify(havetMeta.cache_data?.conversionMetrics, null, 2));
      console.log('  Number of campaigns:', havetMeta.cache_data?.campaigns?.length);
    }
  }

  // =====================================================
  // SUMMARY
  // =====================================================
  console.log('\n\n📋 FUNNEL DATA SUMMARY');
  console.log('='.repeat(80));

  let googleWithFunnel = 0;
  let googleWithoutFunnel = 0;
  let metaWithFunnel = 0;
  let metaWithoutFunnel = 0;

  googleCache?.forEach(entry => {
    const metrics = entry.cache_data?.conversionMetrics || {};
    const hasData = (metrics.booking_step_1 || 0) > 0 || (metrics.reservations || 0) > 0;
    if (hasData) googleWithFunnel++;
    else googleWithoutFunnel++;
  });

  metaCache?.forEach(entry => {
    const metrics = entry.cache_data?.conversionMetrics || {};
    const hasData = (metrics.booking_step_1 || 0) > 0 || (metrics.reservations || 0) > 0;
    if (hasData) metaWithFunnel++;
    else metaWithoutFunnel++;
  });

  console.log(`\n  GOOGLE ADS:`);
  console.log(`  ├── With funnel data: ${googleWithFunnel}`);
  console.log(`  └── Without funnel data: ${googleWithoutFunnel}`);
  
  console.log(`\n  META ADS:`);
  console.log(`  ├── With funnel data: ${metaWithFunnel}`);
  console.log(`  └── Without funnel data: ${metaWithoutFunnel}`);

  console.log('\n' + '='.repeat(80));
}

checkFunnelMetrics().catch(console.error);

