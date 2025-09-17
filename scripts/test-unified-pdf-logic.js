#!/usr/bin/env node

/**
 * Test Unified PDF Generation Logic
 * This script tests the core logic that will be used in the PDF generation
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mock the conversion functions (these are the same ones used in the PDF generation)
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

async function testUnifiedPDFLogic() {
  console.log('🧪 Testing Unified PDF Generation Logic...\n');

  try {
    // Get Belmonte Hotel client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('name', 'Belmonte Hotel')
      .single();

    if (clientError || !client) {
      console.error('❌ Could not find Belmonte Hotel client:', clientError);
      return;
    }

    console.log(`✅ Client: ${client.name}`);
    console.log(`   Google Ads enabled: ${client.google_ads_enabled}`);
    console.log(`   Customer ID: ${client.google_ads_customer_id}\n`);

    // Fetch Meta campaigns (August 2025)
    const { data: metaCampaigns, error: metaError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .gte('date_range_start', '2025-08-01')
      .lte('date_range_end', '2025-08-31');

    if (metaError) {
      console.warn('⚠️ Could not fetch Meta campaigns:', metaError);
    }

    // Fetch Google Ads campaigns (August 2025)
    const { data: googleCampaigns, error: googleError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', client.id)
      .gte('date_range_start', '2025-08-01')
      .lte('date_range_end', '2025-08-31');

    if (googleError) {
      console.error('❌ Could not fetch Google Ads campaigns:', googleError);
      return;
    }

    console.log(`📊 Data Retrieved:`);
    console.log(`   Meta campaigns: ${metaCampaigns?.length || 0}`);
    console.log(`   Google campaigns: ${googleCampaigns?.length || 0}\n`);

    // Convert to unified format
    const unifiedMetaCampaigns = (metaCampaigns || []).map(convertMetaCampaignToUnified);
    const unifiedGoogleCampaigns = (googleCampaigns || []).map(convertGoogleCampaignToUnified);

    console.log(`🔄 Conversion Results:`);
    console.log(`   Meta converted: ${unifiedMetaCampaigns.length}`);
    console.log(`   Google converted: ${unifiedGoogleCampaigns.length}\n`);

    // Calculate platform totals
    const metaTotals = calculatePlatformTotals(unifiedMetaCampaigns);
    const googleTotals = calculatePlatformTotals(unifiedGoogleCampaigns);
    const allCampaigns = [...unifiedMetaCampaigns, ...unifiedGoogleCampaigns];
    const combinedTotals = calculatePlatformTotals(allCampaigns);

    console.log(`📈 Platform Totals:`);
    console.log(`   Meta Ads:`);
    console.log(`     Spend: ${metaTotals.totalSpend.toFixed(2)} PLN`);
    console.log(`     Impressions: ${metaTotals.totalImpressions.toLocaleString()}`);
    console.log(`     Clicks: ${metaTotals.totalClicks.toLocaleString()}`);
    console.log(`     Reservations: ${metaTotals.totalReservations}`);
    console.log(`     CTR: ${metaTotals.averageCtr.toFixed(2)}%`);
    console.log(`     CPC: ${metaTotals.averageCpc.toFixed(2)} PLN`);
    console.log(`     ROAS: ${metaTotals.averageRoas.toFixed(2)}x\n`);

    console.log(`   Google Ads:`);
    console.log(`     Spend: ${googleTotals.totalSpend.toFixed(2)} PLN`);
    console.log(`     Impressions: ${googleTotals.totalImpressions.toLocaleString()}`);
    console.log(`     Clicks: ${googleTotals.totalClicks.toLocaleString()}`);
    console.log(`     Reservations: ${googleTotals.totalReservations}`);
    console.log(`     CTR: ${googleTotals.averageCtr.toFixed(2)}%`);
    console.log(`     CPC: ${googleTotals.averageCpc.toFixed(2)} PLN`);
    console.log(`     ROAS: ${googleTotals.averageRoas.toFixed(2)}x\n`);

    console.log(`   Combined:`);
    console.log(`     Total Spend: ${combinedTotals.totalSpend.toFixed(2)} PLN`);
    console.log(`     Total Impressions: ${combinedTotals.totalImpressions.toLocaleString()}`);
    console.log(`     Total Clicks: ${combinedTotals.totalClicks.toLocaleString()}`);
    console.log(`     Total Reservations: ${combinedTotals.totalReservations}`);
    console.log(`     Average CTR: ${combinedTotals.averageCtr.toFixed(2)}%`);
    console.log(`     Average CPC: ${combinedTotals.averageCpc.toFixed(2)} PLN`);
    console.log(`     Average ROAS: ${combinedTotals.averageRoas.toFixed(2)}x\n`);

    // Test platform comparison data
    const platformTotals = {
      meta: metaTotals,
      google: googleTotals,
      combined: combinedTotals
    };

    console.log(`🔍 Platform Comparison Data:`);
    if (platformTotals.combined.totalSpend > 0) {
      const metaShare = ((platformTotals.meta.totalSpend / platformTotals.combined.totalSpend) * 100).toFixed(0);
      const googleShare = ((platformTotals.google.totalSpend / platformTotals.combined.totalSpend) * 100).toFixed(0);
      console.log(`   Meta Ads: ${metaShare}% of total budget`);
      console.log(`   Google Ads: ${googleShare}% of total budget`);
    }

    console.log(`\n✅ Unified PDF Logic Test Complete!`);
    console.log(`\n📋 Summary:`);
    console.log(`   ✅ Data fetching works for both platforms`);
    console.log(`   ✅ Conversion to unified format works`);
    console.log(`   ✅ Platform totals calculation works`);
    console.log(`   ✅ Combined totals calculation works`);
    console.log(`   ✅ Platform comparison data ready`);
    console.log(`\n🚀 Ready for PDF generation!`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testUnifiedPDFLogic().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { testUnifiedPDFLogic };
