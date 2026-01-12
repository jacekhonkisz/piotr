/**
 * AUDIT: PBM Phone Event Detection
 * 
 * Purpose: Verify if parser is correctly detecting and counting PBM phone events
 * - Show all phone-related events from Meta API
 * - Show what parser does with each event
 * - Verify PBM detection logic
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

async function auditPBMDetection() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 AUDIT: PBM PHONE EVENT DETECTION');
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

    // 2. Fetch fresh from Meta API
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
    
    console.log(`📅 Fetching from Meta API: ${startDate} to ${endDate}\n`);
    
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
    
    // 3. Analyze each campaign's phone events
    console.log('='.repeat(80));
    console.log('📞 PHONE EVENTS ANALYSIS BY CAMPAIGN');
    console.log('='.repeat(80) + '\n');
    
    let totalPBMFromAPI = 0;
    let totalStandardFromAPI = 0;
    let totalFromParser = 0;
    
    for (const campaign of rawCampaignInsights) {
      const campaignName = campaign.campaign_name || campaign.name || 'Unknown';
      const actions = campaign.actions || [];
      
      // Find all phone-related actions
      const allPhoneActions = actions.filter((a: any) => {
        const type = String(a.action_type || '').toLowerCase();
        return type.includes('click_to_call') || 
               type.includes('phone') ||
               type.includes('1470262077092668') ||
               type.includes('call');
      });
      
      if (allPhoneActions.length > 0) {
        console.log(`📋 Campaign: ${campaignName}`);
        console.log(`   Total actions in array: ${actions.length}`);
        console.log(`   Phone-related actions found: ${allPhoneActions.length}\n`);
        
        // Categorize phone actions
        const pbmEvents: any[] = [];
        const standardEvents: any[] = [];
        
        allPhoneActions.forEach((action: any) => {
          const actionType = action.action_type;
          const actionTypeLower = String(actionType || '').toLowerCase();
          const value = parseInt(action.value || '0', 10);
          
          if (actionTypeLower.includes('1470262077092668') || 
              actionTypeLower === 'offsite_conversion.custom.1470262077092668') {
            pbmEvents.push({ actionType, value, raw: action });
            totalPBMFromAPI += value;
          } else {
            standardEvents.push({ actionType, value, raw: action });
            totalStandardFromAPI += value;
          }
        });
        
        // Show PBM events
        if (pbmEvents.length > 0) {
          console.log(`   ✅ PBM Events (${pbmEvents.length}):`);
          pbmEvents.forEach((e, idx) => {
            console.log(`      ${idx + 1}. ${e.actionType}: ${e.value}`);
            console.log(`         → Should be counted by parser`);
          });
          console.log(`   Total PBM: ${pbmEvents.reduce((sum, e) => sum + e.value, 0)}`);
        }
        
        // Show standard events
        if (standardEvents.length > 0) {
          console.log(`   ⚠️ Standard Events (${standardEvents.length}):`);
          standardEvents.forEach((e, idx) => {
            console.log(`      ${idx + 1}. ${e.actionType}: ${e.value}`);
            console.log(`         → Should be IGNORED if PBM events exist`);
          });
          console.log(`   Total Standard: ${standardEvents.reduce((sum, e) => sum + e.value, 0)}`);
        }
        
        // Test parser on this campaign
        console.log(`\n   🔧 PARSER TEST:`);
        const parsed = parseMetaActions(
          actions,
          campaign.action_values || [],
          campaignName
        );
        
        console.log(`      Parser result: ${parsed.click_to_call} phones`);
        
        // Check if parser logic is correct
        const expectedPBM = pbmEvents.reduce((sum, e) => sum + e.value, 0);
        if (parsed.click_to_call === expectedPBM) {
          console.log(`      ✅ CORRECT: Parser counts only PBM events (${expectedPBM})`);
        } else if (parsed.click_to_call === (expectedPBM + standardEvents.reduce((sum, e) => sum + e.value, 0))) {
          console.log(`      ❌ WRONG: Parser is double-counting (PBM + Standard)`);
        } else {
          console.log(`      ⚠️ UNEXPECTED: Parser result (${parsed.click_to_call}) doesn't match expected (${expectedPBM})`);
        }
        
        totalFromParser += parsed.click_to_call;
        console.log('');
      }
    }
    
    // 4. Test full aggregation
    console.log('='.repeat(80));
    console.log('🔧 FULL PARSER AGGREGATION TEST');
    console.log('='.repeat(80) + '\n');
    
    const parsedCampaigns = enhanceCampaignsWithConversions(rawCampaignInsights);
    const aggregated = aggregateConversionMetrics(parsedCampaigns);
    
    console.log('📊 Results:');
    console.log(`   PBM events from API: ${totalPBMFromAPI}`);
    console.log(`   Standard events from API: ${totalStandardFromAPI}`);
    console.log(`   Parser aggregated result: ${aggregated.click_to_call}`);
    console.log(`   Expected (PBM only): ${totalPBMFromAPI}`);
    console.log(`   Expected (if double-counting): ${totalPBMFromAPI + totalStandardFromAPI}`);
    
    console.log('\n🔍 Analysis:');
    if (aggregated.click_to_call === totalPBMFromAPI) {
      console.log('   ✅ CORRECT: Parser uses only PBM events');
    } else if (aggregated.click_to_call === (totalPBMFromAPI + totalStandardFromAPI)) {
      console.log('   ❌ WRONG: Parser is double-counting (PBM + Standard)');
      console.log('   → This is the bug! Parser should ignore standard events when PBM exists');
    } else {
      console.log(`   ⚠️ UNEXPECTED: Parser result doesn't match any expected value`);
      console.log(`   → Need to investigate further`);
    }
    
    // 5. Check actionMap detection
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ACTIONMAP DETECTION TEST');
    console.log('='.repeat(80) + '\n');
    
    // Test on first campaign with phone events
    const testCampaign = rawCampaignInsights.find((c: any) => {
      const actions = c.actions || [];
      return actions.some((a: any) => 
        String(a.action_type || '').toLowerCase().includes('1470262077092668') ||
        String(a.action_type || '').toLowerCase().includes('click_to_call')
      );
    });
    
    if (testCampaign) {
      const actions = testCampaign.actions || [];
      
      // Build actionMap like parser does
      const actionMap = new Map<string, number>();
      actions.forEach((action: any) => {
        const actionType = String(action.action_type || '').toLowerCase();
        const value = parseInt(action.value || '0', 10);
        if (!isNaN(value) && value >= 0) {
          actionMap.set(actionType, (actionMap.get(actionType) || 0) + value);
        }
      });
      
      const pbmKey = 'offsite_conversion.custom.1470262077092668'.toLowerCase();
      const hasPBM = actionMap.has(pbmKey);
      
      console.log(`Test Campaign: ${testCampaign.campaign_name || testCampaign.name}`);
      console.log(`   actionMap.has('${pbmKey}'): ${hasPBM}`);
      console.log(`   actionMap keys (phone-related):`);
      
      for (const [key, value] of actionMap.entries()) {
        if (key.includes('phone') || key.includes('call') || key.includes('1470262077092668')) {
          console.log(`      - ${key}: ${value}`);
          if (key === pbmKey) {
            console.log(`        ✅ PBM key found in actionMap!`);
          }
        }
      }
      
      if (!hasPBM) {
        console.log(`\n   ❌ ISSUE: PBM key not found in actionMap!`);
        console.log(`   → This means hasPBMPhoneEvent will be false`);
        console.log(`   → Parser will count standard events (wrong!)`);
        console.log(`   → Need to check why PBM key is not in actionMap`);
      } else {
        console.log(`\n   ✅ PBM key found in actionMap`);
        console.log(`   → hasPBMPhoneEvent should be true`);
        console.log(`   → Parser should ignore standard events`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Audit complete!');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

auditPBMDetection().catch(console.error);

