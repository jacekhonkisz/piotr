/**
 * AUDIT: Meta API Phone Click Parsing
 * 
 * Purpose: Debug why Meta API returns 10 phones when Meta Business Suite shows 2
 * Issue: Cache shows 10 phones (both conversionMetrics and sum of campaigns match)
 *        But Meta Business Suite shows 2 phones (correct value)
 * 
 * This script will:
 * 1. Fetch raw Meta API response for Havet current month
 * 2. Log all phone-related actions from the API
 * 3. Show how the parser processes these actions
 * 4. Identify if there's double-counting or incorrect parsing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MetaAPIServiceOptimized } from '../src/lib/meta-api-optimized';
import { parseMetaActions, enhanceCampaignsWithConversions } from '../src/lib/meta-actions-parser';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  console.error('   Make sure .env.local contains:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditMetaAPIPhoneParsing() {
  console.log('\n🔍 AUDIT: Meta API Phone Click Parsing for Havet\n');
  console.log('=' .repeat(80));
  
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
    
    console.log('✅ Found Havet client:', {
      id: client.id,
      name: client.name,
      hasMetaToken: !!client.meta_access_token,
      hasSystemUserToken: !!client.system_user_token,
      adAccountId: client.ad_account_id
    });
    
    // 2. Get current month date range
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = now.toISOString().split('T')[0];
    
    console.log('\n📅 Date Range:', { startDate, endDate });
    
    // 3. Initialize Meta API service
    const metaToken = client.system_user_token || client.meta_access_token;
    if (!metaToken) {
      console.error('❌ No Meta token available');
      return;
    }
    
    const metaService = new MetaAPIServiceOptimized(metaToken);
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    console.log('\n🔄 Fetching raw campaign insights from Meta API...');
    
    // 4. Fetch raw campaign insights (before parsing)
    const rawCampaignInsights = await metaService.getCampaignInsights(
      adAccountId,
      startDate,
      endDate,
      0 // timeIncrement: 0 for monthly aggregate
    );
    
    console.log(`\n✅ Fetched ${rawCampaignInsights.length} campaigns from Meta API\n`);
    
    // 5. Analyze phone-related actions for each campaign
    let totalPhoneClicksFromAPI = 0;
    let totalPhoneClicksFromParser = 0;
    const phoneActionBreakdown: any[] = [];
    
    for (const campaign of rawCampaignInsights) {
      const campaignName = campaign.campaign_name || campaign.name || 'Unknown';
      const actions = campaign.actions || [];
      const actionValues = campaign.action_values || [];
      
      // Find all phone-related actions
      const phoneActions = actions.filter((action: any) => {
        const actionType = String(action.action_type || '').toLowerCase();
        return actionType.includes('click_to_call') || 
               actionType.includes('phone') ||
               actionType.includes('1470262077092668'); // Havet PBM custom event
      });
      
      if (phoneActions.length > 0) {
        console.log(`\n📞 Campaign: ${campaignName}`);
        console.log(`   Total actions in array: ${actions.length}`);
        console.log(`   Phone-related actions: ${phoneActions.length}`);
        
        const campaignPhoneBreakdown: any = {
          campaignName,
          totalActions: actions.length,
          phoneActions: []
        };
        
        phoneActions.forEach((action: any) => {
          const actionType = action.action_type;
          const value = parseInt(action.value || '0', 10);
          
          console.log(`   - ${actionType}: ${value}`);
          
          totalPhoneClicksFromAPI += value;
          
          campaignPhoneBreakdown.phoneActions.push({
            actionType,
            value,
            rawAction: action
          });
        });
        
        // Now parse this campaign to see what the parser returns
        const parsed = parseMetaActions(
          actions,
          actionValues,
          campaignName
        );
        
        console.log(`   → Parser result: ${parsed.click_to_call} phones`);
        totalPhoneClicksFromParser += parsed.click_to_call;
        
        campaignPhoneBreakdown.parserResult = parsed.click_to_call;
        phoneActionBreakdown.push(campaignPhoneBreakdown);
      }
    }
    
    // 6. Summary
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY:\n');
    console.log(`Total phone clicks from API actions array: ${totalPhoneClicksFromAPI}`);
    console.log(`Total phone clicks from parser: ${totalPhoneClicksFromParser}`);
    console.log(`Expected (from Meta Business Suite): 2`);
    console.log(`\n❌ DISCREPANCY: ${totalPhoneClicksFromParser} vs expected 2`);
    
    // 7. Detailed breakdown
    console.log('\n📋 DETAILED BREAKDOWN BY CAMPAIGN:\n');
    phoneActionBreakdown.forEach((breakdown, idx) => {
      console.log(`${idx + 1}. ${breakdown.campaignName}`);
      console.log(`   Phone actions found: ${breakdown.phoneActions.length}`);
      breakdown.phoneActions.forEach((pa: any) => {
        console.log(`      - ${pa.actionType}: ${pa.value}`);
      });
      console.log(`   → Parser counted: ${breakdown.parserResult}`);
      console.log('');
    });
    
    // 8. Check for potential issues
    console.log('\n🔍 POTENTIAL ISSUES:\n');
    
    if (totalPhoneClicksFromAPI > 2) {
      console.log('⚠️ ISSUE 1: API is returning more phone clicks than expected');
      console.log(`   - API total: ${totalPhoneClicksFromAPI}`);
      console.log(`   - Expected: 2`);
      console.log(`   - Possible cause: Duplicate events in actions array`);
    }
    
    if (totalPhoneClicksFromParser !== totalPhoneClicksFromAPI) {
      console.log('⚠️ ISSUE 2: Parser result differs from API actions sum');
      console.log(`   - API sum: ${totalPhoneClicksFromAPI}`);
      console.log(`   - Parser: ${totalPhoneClicksFromParser}`);
    }
    
    // Check for PBM vs standard event double-counting
    const pbmEvents = phoneActionBreakdown.flatMap(b => 
      b.phoneActions.filter((pa: any) => 
        pa.actionType.includes('1470262077092668') || pa.actionType.includes('PBM')
      )
    );
    const standardEvents = phoneActionBreakdown.flatMap(b => 
      b.phoneActions.filter((pa: any) => 
        !pa.actionType.includes('1470262077092668') && 
        !pa.actionType.includes('PBM') &&
        (pa.actionType.includes('click_to_call') || pa.actionType.includes('phone'))
      )
    );
    
    if (pbmEvents.length > 0 && standardEvents.length > 0) {
      console.log('\n⚠️ ISSUE 3: Both PBM and standard phone events found!');
      console.log(`   - PBM events: ${pbmEvents.length} (total: ${pbmEvents.reduce((sum, e) => sum + e.value, 0)})`);
      console.log(`   - Standard events: ${standardEvents.length} (total: ${standardEvents.reduce((sum, e) => sum + e.value, 0)})`);
      console.log(`   - Possible cause: Parser should only count PBM events for Havet, but may be counting both`);
    }
    
    // 9. Show what the parser logic should do
    console.log('\n📖 PARSER LOGIC CHECK:\n');
    console.log('For Havet campaigns with [PBM] in name:');
    console.log('  ✅ Should ONLY count: offsite_conversion.custom.1470262077092668');
    console.log('  ❌ Should IGNORE: click_to_call_call_confirm and other standard events');
    console.log('\nFor non-PBM campaigns:');
    console.log('  ✅ Should count: click_to_call_call_confirm');
    console.log('  ❌ Should IGNORE: PBM custom events');
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Audit complete!\n');
    
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the audit
auditMetaAPIPhoneParsing().catch(console.error);

