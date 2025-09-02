#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugDateRangeMismatch() {
  console.log('🔍 DEBUGGING DATE RANGE MISMATCH\n');
  
  try {
    // Get client
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('google_ads_enabled', true)
      .limit(1);
      
    if (!clients || clients.length === 0) {
      console.log('❌ No Google Ads enabled clients found');
      return;
    }
    
    const client = clients[0];
    console.log('📊 Client:', client.name);
    
    // Check what date ranges exist in the database
    const { data: campaigns } = await supabase
      .from('google_ads_campaigns')
      .select('date_range_start, date_range_end, spend, impressions, clicks')
      .eq('client_id', client.id)
      .order('date_range_start', { ascending: false });
      
    console.log('\n📅 Available date ranges in database:');
    if (campaigns && campaigns.length > 0) {
      campaigns.forEach((campaign, i) => {
        console.log(`   ${i + 1}. ${campaign.date_range_start} to ${campaign.date_range_end} (Spend: ${campaign.spend} PLN)`);
      });
    } else {
      console.log('   No campaigns found');
    }
    
    // Check what the current date logic would generate
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    console.log('\n🗓️ Current date logic:');
    console.log('   Current date:', now.toISOString().split('T')[0]);
    console.log('   Current month:', currentMonth);
    console.log('   Current year:', currentYear);
    
    // Test different date range scenarios
    const scenarios = [
      {
        name: 'Current Month (Default)',
        startDate: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`,
        endDate: new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]
      },
      {
        name: 'August 2025 (Test Data)',
        startDate: '2025-08-01',
        endDate: '2025-08-30'
      },
      {
        name: 'August 2025 (End of Month)',
        startDate: '2025-08-01',
        endDate: '2025-08-31'
      },
      {
        name: 'Last 30 Days',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0]
      }
    ];
    
    console.log('\n📋 Testing different date range scenarios:');
    
    for (const scenario of scenarios) {
      console.log(`\n   ${scenario.name}:`);
      console.log(`   Date range: ${scenario.startDate} to ${scenario.endDate}`);
      
      // Test database query with this date range
      const { data: testCampaigns } = await supabase
        .from('google_ads_campaigns')
        .select('campaign_name, spend, impressions, clicks')
        .eq('client_id', client.id)
        .gte('date_range_start', scenario.startDate)
        .lte('date_range_end', scenario.endDate);
        
      console.log(`   Found campaigns: ${testCampaigns?.length || 0}`);
      
      if (testCampaigns && testCampaigns.length > 0) {
        const totalSpend = testCampaigns.reduce((sum, c) => sum + parseFloat(c.spend || 0), 0);
        console.log(`   Total spend: ${totalSpend.toFixed(2)} PLN`);
        console.log(`   Sample campaign: ${testCampaigns[0].campaign_name}`);
      }
    }
    
    // Test the exact query that PDF generation would use
    console.log('\n🎯 Testing PDF generation query logic:');
    
    // Simulate what the PDF generation would do
    const pdfDateRange = {
      start: '2025-08-01',
      end: '2025-08-30'
    };
    
    console.log(`   PDF Date Range: ${pdfDateRange.start} to ${pdfDateRange.end}`);
    
    const { data: pdfCampaigns, error: pdfError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', client.id)
      .gte('date_range_start', pdfDateRange.start)
      .lte('date_range_end', pdfDateRange.end);
      
    if (pdfError) {
      console.log('   ❌ PDF query error:', pdfError);
    } else {
      console.log(`   ✅ PDF query found: ${pdfCampaigns?.length || 0} campaigns`);
      
      if (pdfCampaigns && pdfCampaigns.length > 0) {
        // Test the conversion function
        try {
          const { convertGoogleCampaignToUnified, calculatePlatformTotals } = require('../src/lib/unified-campaign-types');
          
          const unifiedCampaigns = pdfCampaigns.map(convertGoogleCampaignToUnified);
          const platformTotals = calculatePlatformTotals(unifiedCampaigns);
          
          console.log('   📊 Converted totals:');
          console.log(`      Total Spend: ${platformTotals.totalSpend.toFixed(2)} PLN`);
          console.log(`      Total Impressions: ${platformTotals.totalImpressions.toLocaleString()}`);
          console.log(`      Total Clicks: ${platformTotals.totalClicks.toLocaleString()}`);
          console.log(`      Total Reservations: ${platformTotals.totalReservations}`);
          
        } catch (conversionError) {
          console.log('   ❌ Conversion error:', conversionError.message);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error in debug:', error);
  }
}

debugDateRangeMismatch().catch(console.error);
