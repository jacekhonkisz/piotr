#!/usr/bin/env node

/**
 * Test PDF Google Ads Integration
 * This script tests the core data fetching logic that the PDF generation uses
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mock the conversion functions (same as in PDF generation)
function convertMetaCampaignToUnified(campaign) {
  return {
    campaign_name: campaign.campaign_name || 'Unknown Campaign',
    spend: parseFloat(campaign.spend) || 0,
    impressions: parseInt(campaign.impressions) || 0,
    clicks: parseInt(campaign.clicks) || 0,
    ctr: parseFloat(campaign.ctr) || 0,
    cpc: parseFloat(campaign.cpc) || 0,
    reservations: parseInt(campaign.reservations) || 0,
    reservation_value: parseFloat(campaign.reservation_value) || 0,
    roas: parseFloat(campaign.roas) || 0,
    platform: 'meta'
  };
}

function convertGoogleCampaignToUnified(campaign) {
  return {
    campaign_name: campaign.campaign_name || 'Unknown Campaign',
    spend: parseFloat(campaign.spend) || 0,
    impressions: parseInt(campaign.impressions) || 0,
    clicks: parseInt(campaign.clicks) || 0,
    ctr: parseFloat(campaign.ctr) || 0,
    cpc: parseFloat(campaign.cpc) || 0,
    reservations: parseInt(campaign.reservations) || 0,
    reservation_value: parseFloat(campaign.reservation_value) || 0,
    roas: parseFloat(campaign.roas) || 0,
    platform: 'google'
  };
}

function calculatePlatformTotals(campaigns) {
  if (!campaigns || campaigns.length === 0) {
    return {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalReservations: 0,
      totalReservationValue: 0,
      averageCtr: 0,
      averageCpc: 0,
      averageCpm: 0,
      averageRoas: 0
    };
  }

  const totals = campaigns.reduce((acc, campaign) => {
    return {
      totalSpend: acc.totalSpend + campaign.spend,
      totalImpressions: acc.totalImpressions + campaign.impressions,
      totalClicks: acc.totalClicks + campaign.clicks,
      totalReservations: acc.totalReservations + campaign.reservations,
      totalReservationValue: acc.totalReservationValue + campaign.reservation_value
    };
  }, {
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalReservations: 0,
    totalReservationValue: 0
  });

  // Calculate averages
  totals.averageCtr = totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0;
  totals.averageCpc = totals.totalClicks > 0 ? totals.totalSpend / totals.totalClicks : 0;
  totals.averageCpm = totals.totalImpressions > 0 ? (totals.totalSpend / totals.totalImpressions) * 1000 : 0;
  totals.averageRoas = totals.totalSpend > 0 ? totals.totalReservationValue / totals.totalSpend : 0;

  return totals;
}

async function testPDFGoogleAdsIntegration() {
  console.log('🧪 Testing PDF Google Ads Integration Logic...\n');

  try {
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
    const dateRange = { start: '2025-08-01', end: '2025-08-31' };

    console.log(`📋 Test Parameters:`);
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Date Range: ${dateRange.start} to ${dateRange.end}\n`);

    // Step 1: Check client configuration
    console.log(`🔍 Step 1: Checking client configuration...`);
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, google_ads_enabled, google_ads_customer_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('❌ Could not find client:', clientError);
      return;
    }

    console.log(`✅ Client: ${client.name}`);
    console.log(`   Google Ads enabled: ${client.google_ads_enabled}`);
    console.log(`   Customer ID: ${client.google_ads_customer_id}\n`);

    // Step 2: Simulate the PDF generation data fetching logic
    console.log(`🔍 Step 2: Simulating PDF generation data fetching...`);
    
    let googleCampaigns = [];
    let metaCampaigns = [];
    let platformTotals;

    // Simulate the "ensured fetch" logic from the PDF generation
    if (client.google_ads_enabled && client.google_ads_customer_id) {
      console.log(`   Fetching Google Ads campaigns...`);
      
      const { data: cachedGoogleCampaigns, error: cacheError } = await supabase
        .from('google_ads_campaigns')
        .select('*')
        .eq('client_id', clientId)
        .gte('date_range_start', dateRange.start)
        .lte('date_range_end', dateRange.end);
      
      if (!cacheError && cachedGoogleCampaigns && cachedGoogleCampaigns.length > 0) {
        try {
          googleCampaigns = cachedGoogleCampaigns.map(convertGoogleCampaignToUnified);
          console.log(`   ✅ Fetched ${googleCampaigns.length} Google Ads campaigns`);
        } catch (conversionError) {
          console.error(`   ❌ Error converting Google campaigns:`, conversionError);
          googleCampaigns = [];
        }
      } else {
        console.log(`   ℹ️ No Google Ads campaigns found in database for this period`);
      }
    } else {
      console.log(`   ℹ️ Google Ads not enabled or configured for this client`);
    }

    // Simulate Meta campaigns fetching (from campaigns table)
    console.log(`   Fetching Meta campaigns...`);
    const { data: metaCampaignsData, error: metaError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientId)
      .gte('date_range_start', dateRange.start)
      .lte('date_range_end', dateRange.end);

    if (!metaError && metaCampaignsData && metaCampaignsData.length > 0) {
      try {
        metaCampaigns = metaCampaignsData.map(convertMetaCampaignToUnified);
        console.log(`   ✅ Fetched ${metaCampaigns.length} Meta campaigns`);
      } catch (conversionError) {
        console.error(`   ❌ Error converting Meta campaigns:`, conversionError);
        metaCampaigns = [];
      }
    } else {
      console.log(`   ℹ️ No Meta campaigns found in database for this period`);
    }

    console.log(`\n📊 Data Fetching Results:`);
    console.log(`   Meta campaigns: ${metaCampaigns.length}`);
    console.log(`   Google campaigns: ${googleCampaigns.length}`);

    // Step 3: Calculate platform totals (same logic as PDF generation)
    console.log(`\n🧮 Step 3: Calculating platform totals...`);
    try {
      const metaTotals = calculatePlatformTotals(metaCampaigns);
      const googleTotals = calculatePlatformTotals(googleCampaigns);
      const allCampaigns = [...metaCampaigns, ...googleCampaigns];
      const combinedTotals = calculatePlatformTotals(allCampaigns);
      
      platformTotals = {
        meta: metaTotals,
        google: googleTotals,
        combined: combinedTotals
      };
      
      console.log(`✅ Platform totals calculated successfully`);
      console.log(`   Meta campaigns: ${metaCampaigns.length}, Google campaigns: ${googleCampaigns.length}`);
      console.log(`   Combined total spend: ${combinedTotals.totalSpend.toFixed(2)} PLN`);
    } catch (error) {
      console.error(`❌ Error calculating platform totals:`, error);
      platformTotals = undefined;
    }

    // Step 4: Test the HTML generation logic
    console.log(`\n🔍 Step 4: Testing HTML generation logic...`);
    
    // Test the source determination logic
    const sourceText = googleCampaigns && googleCampaigns.length > 0 
      ? 'Źródło: Meta Ads API & Google Ads API' 
      : 'Źródło: Meta Ads API';
    
    console.log(`   Source text: ${sourceText}`);
    console.log(`   Has Google campaigns: ${!!googleCampaigns && googleCampaigns.length > 0}`);
    console.log(`   Google campaigns length: ${googleCampaigns.length}`);

    // Test platform totals usage in cover KPIs
    if (platformTotals) {
      console.log(`\n📈 Platform Totals for Cover KPIs:`);
      console.log(`   Combined Spend: ${platformTotals.combined.totalSpend.toFixed(2)} PLN`);
      console.log(`   Combined Impressions: ${platformTotals.combined.totalImpressions.toLocaleString()}`);
      console.log(`   Combined Clicks: ${platformTotals.combined.totalClicks.toLocaleString()}`);
      console.log(`   Combined Reservations: ${platformTotals.combined.totalReservations}`);
    }

    // Step 5: Final verification
    console.log(`\n🎯 Final Integration Test Results:`);
    console.log(`   ✅ Google Ads data fetched: ${googleCampaigns.length > 0}`);
    console.log(`   ✅ Meta Ads data fetched: ${metaCampaigns.length > 0}`);
    console.log(`   ✅ Platform totals calculated: ${!!platformTotals}`);
    console.log(`   ✅ Source text correct: ${sourceText.includes('Google Ads API') === (googleCampaigns.length > 0)}`);
    
    if (googleCampaigns.length > 0) {
      console.log(`\n🚀 Google Ads Integration Working!`);
      console.log(`   The PDF should now show: "${sourceText}"`);
      console.log(`   Cover KPIs should use combined platform totals`);
      console.log(`   Platform comparison section should be visible`);
    } else {
      console.log(`\n⚠️ Google Ads Integration Issue Detected`);
      console.log(`   The PDF will show: "${sourceText}"`);
      console.log(`   Check if Google Ads data exists for this period`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testPDFGoogleAdsIntegration().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { testPDFGoogleAdsIntegration };
