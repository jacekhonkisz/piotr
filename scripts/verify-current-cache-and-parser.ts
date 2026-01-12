/**
 * VERIFY CURRENT CACHE AND PARSER
 * 
 * Purpose: Check what's currently in cache and what the parser returns
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { parseMetaActions, enhanceCampaignsWithConversions, aggregateConversionMetrics } from '../src/lib/meta-actions-parser';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCacheAndParser() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 VERIFYING CURRENT CACHE AND PARSER');
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Get Havet client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%havet%')
      .single();
    
    if (clientError || !client) {
      console.error('❌ Failed to find Havet client:', clientError);
      return;
    }
    
    console.log('✅ Found Havet client:', client.name);

    // 2. Check current cache
    const periodId = '2026-01';
    const { data: cache } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', periodId)
      .single();

    if (cache) {
      const cachePhones = cache.cache_data?.conversionMetrics?.click_to_call || 0;
      const cacheCampaigns = cache.cache_data?.campaigns || [];
      const sumFromCampaigns = cacheCampaigns.reduce((sum: number, c: any) => {
        return sum + (parseInt(c.click_to_call) || 0);
      }, 0);
      
      console.log('📦 CURRENT CACHE:');
      console.log(`   conversionMetrics.click_to_call: ${cachePhones}`);
      console.log(`   Sum from campaigns: ${sumFromCampaigns}`);
      console.log(`   Last updated: ${cache.last_updated}`);
      console.log(`   Campaign count: ${cacheCampaigns.length}`);
      
      if (cachePhones === 12) {
        console.log('   ⚠️ Cache still shows 12 phones!');
      }
    } else {
      console.log('📦 No cache found (was cleared)');
    }

    // 3. Fetch fresh from Meta API and parse
    console.log('\n🔄 FETCHING FRESH FROM META API...');
    
    const metaToken = client.system_user_token || client.meta_access_token;
    if (!metaToken) {
      console.error('❌ No Meta token available');
      return;
    }

    const metaService = new MetaAPIServiceOptimized(metaToken);
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;

    const startDate = '2026-01-01';
    const endDate = new Date().toISOString().split('T')[0];
    
    // Clear API cache
    metaService.clearCache();
    
    // Fetch raw
    const rawCampaignInsights = await metaService.getCampaignInsights(
      adAccountId,
      startDate,
      endDate,
      0
    );
    
    console.log(`✅ Fetched ${rawCampaignInsights.length} campaigns\n`);
    
    // Parse with current parser
    const parsedCampaigns = enhanceCampaignsWithConversions(rawCampaignInsights);
    const aggregated = aggregateConversionMetrics(parsedCampaigns);
    
    console.log('🔧 PARSER RESULTS:');
    console.log(`   Total click_to_call: ${aggregated.click_to_call}`);
    console.log(`   Expected: 2 (from PBM events only)`);
    
    if (aggregated.click_to_call === 12) {
      console.log('   ❌ Parser still returns 12 (double-counting issue)');
    } else if (aggregated.click_to_call === 2) {
      console.log('   ✅ Parser correctly returns 2 (PBM only)');
    }
    
    // 4. Analyze phone events in raw API response
    console.log('\n📞 ANALYZING PHONE EVENTS IN RAW API:');
    
    let totalPBM = 0;
    let totalStandard = 0;
    
    for (const campaign of rawCampaignInsights) {
      const actions = campaign.actions || [];
      const campaignName = campaign.campaign_name || campaign.name || 'Unknown';
      
      const pbmEvents = actions.filter((a: any) => 
        String(a.action_type || '').toLowerCase() === 'offsite_conversion.custom.1470262077092668'
      );
      const standardEvents = actions.filter((a: any) => {
        const type = String(a.action_type || '').toLowerCase();
        return (type.includes('click_to_call') || type.includes('phone')) &&
               !type.includes('1470262077092668');
      });
      
      const pbmCount = pbmEvents.reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
      const standardCount = standardEvents.reduce((sum: number, a: any) => sum + (parseInt(a.value) || 0), 0);
      
      totalPBM += pbmCount;
      totalStandard += standardCount;
      
      if (pbmCount > 0 || standardCount > 0) {
        console.log(`\n   Campaign: ${campaignName}`);
        if (pbmCount > 0) {
          console.log(`      PBM events: ${pbmCount}`);
          pbmEvents.forEach((e: any) => {
            console.log(`         - ${e.action_type}: ${e.value}`);
          });
        }
        if (standardCount > 0) {
          console.log(`      Standard events: ${standardCount}`);
          standardEvents.forEach((e: any) => {
            console.log(`         - ${e.action_type}: ${e.value}`);
          });
        }
        
        // Check what parser returned for this campaign
        const parsed = parsedCampaigns.find((c: any) => 
          (c.campaign_name || c.name) === campaignName
        );
        if (parsed) {
          console.log(`      → Parser result: ${parsed.click_to_call} phones`);
        }
      }
    }
    
    console.log('\n📊 SUMMARY:');
    console.log(`   PBM events total: ${totalPBM}`);
    console.log(`   Standard events total: ${totalStandard}`);
    console.log(`   Parser result: ${aggregated.click_to_call}`);
    console.log(`   Expected: 2 (PBM only)`);
    
    if (aggregated.click_to_call !== totalPBM) {
      console.log('\n   ❌ ISSUE: Parser result does not match PBM events!');
      console.log(`      Parser: ${aggregated.click_to_call}`);
      console.log(`      PBM events: ${totalPBM}`);
      if (aggregated.click_to_call === (totalPBM + totalStandard)) {
        console.log(`      → Parser is double-counting (PBM + Standard)`);
      }
    } else {
      console.log('\n   ✅ Parser correctly uses only PBM events');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Verification complete!');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

verifyCacheAndParser().catch(console.error);

