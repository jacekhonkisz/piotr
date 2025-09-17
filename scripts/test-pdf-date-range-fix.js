#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPDFDateRangeFix() {
  console.log('🔍 TESTING PDF DATE RANGE FIX\n');
  
  try {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('google_ads_enabled', true)
      .limit(1);
      
    if (!clients || clients.length === 0) {
      console.log('❌ No clients found');
      return;
    }
    
    const client = clients[0];
    const clientId = client.id;
    console.log('📊 Client:', client.name);
    
    // Simulate the date range that would be used in a report
    const dateRange = {
      start: '2025-08-01',
      end: '2025-08-29'  // Today (current end date logic)
    };
    
    console.log('📅 Testing date range:', dateRange.start, 'to', dateRange.end);
    
    // Test the OLD query logic (should find 0 campaigns)
    console.log('\n❌ OLD QUERY LOGIC (broken):');
    const { data: oldResults, error: oldError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .gte('date_range_start', dateRange.start)
      .lte('date_range_end', dateRange.end);
      
    console.log('   Found campaigns:', oldResults?.length || 0);
    if (oldResults && oldResults.length > 0) {
      const totalSpend = oldResults.reduce((sum, c) => sum + parseFloat(c.spend || 0), 0);
      console.log('   Total spend:', totalSpend.toFixed(2), 'PLN');
    }
    
    // Test the NEW query logic (should find campaigns)
    console.log('\n✅ NEW QUERY LOGIC (fixed):');
    const { data: newResults, error: newError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .lte('date_range_start', dateRange.end)    // Campaign starts before or on report end
      .gte('date_range_end', dateRange.start);   // Campaign ends after or on report start
      
    console.log('   Found campaigns:', newResults?.length || 0);
    if (newResults && newResults.length > 0) {
      const totalSpend = newResults.reduce((sum, c) => sum + parseFloat(c.spend || 0), 0);
      console.log('   Total spend:', totalSpend.toFixed(2), 'PLN');
      
      console.log('\n   📊 Campaign details:');
      newResults.forEach((campaign, i) => {
        console.log(`      ${i + 1}. ${campaign.campaign_name}: ${campaign.spend} PLN`);
        console.log(`         Date range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
      });
      
      // Test the conversion function
      try {
        const { convertGoogleCampaignToUnified, calculatePlatformTotals } = require('../src/lib/unified-campaign-types');
        
        const unifiedCampaigns = newResults.map(convertGoogleCampaignToUnified);
        const platformTotals = calculatePlatformTotals(unifiedCampaigns);
        
        console.log('\n   🔄 Conversion test:');
        console.log(`      Unified campaigns: ${unifiedCampaigns.length}`);
        console.log(`      Platform totals:`);
        console.log(`         Total Spend: ${platformTotals.totalSpend.toFixed(2)} PLN`);
        console.log(`         Total Impressions: ${platformTotals.totalImpressions.toLocaleString()}`);
        console.log(`         Total Clicks: ${platformTotals.totalClicks.toLocaleString()}`);
        console.log(`         Total Reservations: ${platformTotals.totalReservations}`);
        
      } catch (conversionError) {
        console.log('   ❌ Conversion error:', conversionError.message);
      }
    }
    
    console.log('\n🎯 CONCLUSION:');
    if ((oldResults?.length || 0) === 0 && (newResults?.length || 0) > 0) {
      console.log('   ✅ FIX SUCCESSFUL! The new overlapping date range logic works correctly.');
      console.log('   ✅ Google Ads data should now appear in generated reports.');
    } else {
      console.log('   ⚠️ Unexpected results. Please check the data and query logic.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPDFDateRangeFix().catch(console.error);
