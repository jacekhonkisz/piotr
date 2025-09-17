#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDateRangeQuery() {
  console.log('🔍 TESTING DATE RANGE QUERY MISMATCH\n');
  
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
    console.log('📊 Client:', client.name);
    
    // First, show what's actually in the database
    const { data: allCampaigns } = await supabase
      .from('google_ads_campaigns')
      .select('date_range_start, date_range_end, spend')
      .eq('client_id', client.id);
      
    console.log('\n📋 Campaigns in database:');
    allCampaigns?.forEach((campaign, i) => {
      console.log(`   ${i + 1}. ${campaign.date_range_start} to ${campaign.date_range_end} (${campaign.spend} PLN)`);
    });
    
    // Test the exact query that would be used by the report (with today as end date)
    const reportDateRange = {
      start: '2025-08-01',
      end: '2025-08-29'  // Today
    };
    
    console.log('\n🎯 Testing report date range query:');
    console.log(`   Query: date_range_start >= '${reportDateRange.start}' AND date_range_end <= '${reportDateRange.end}'`);
    
    const { data: reportCampaigns, error: reportError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', client.id)
      .gte('date_range_start', reportDateRange.start)
      .lte('date_range_end', reportDateRange.end);
      
    console.log('   Found campaigns:', reportCampaigns?.length || 0);
    
    if (reportError) {
      console.log('   ❌ Query error:', reportError);
    }
    
    // Test with overlapping range query (should work)
    console.log('\n🔄 Testing overlapping range query:');
    console.log(`   Query: date_range_start <= '${reportDateRange.end}' AND date_range_end >= '${reportDateRange.start}'`);
    
    const { data: overlapCampaigns, error: overlapError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', client.id)
      .lte('date_range_start', reportDateRange.end)  // Campaign starts before or on report end
      .gte('date_range_end', reportDateRange.start); // Campaign ends after or on report start
      
    console.log('   Found overlapping campaigns:', overlapCampaigns?.length || 0);
    
    if (overlapCampaigns && overlapCampaigns.length > 0) {
      const totalSpend = overlapCampaigns.reduce((sum, c) => sum + parseFloat(c.spend || 0), 0);
      console.log('   Total spend from overlapping campaigns:', totalSpend.toFixed(2), 'PLN');
      
      console.log('\n   📊 Campaign details:');
      overlapCampaigns.forEach((campaign, i) => {
        console.log(`      ${i + 1}. ${campaign.campaign_name}: ${campaign.spend} PLN`);
        console.log(`         Date range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
      });
    }
    
    console.log('\n🎯 CONCLUSION:');
    console.log('   The issue is likely that the report query uses:');
    console.log('   gte(date_range_start) AND lte(date_range_end)');
    console.log('   But it should use overlapping range logic for proper date matching.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDateRangeQuery().catch(console.error);
