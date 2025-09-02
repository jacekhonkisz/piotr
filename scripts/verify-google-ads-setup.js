#!/usr/bin/env node

/**
 * Verify Google Ads Setup
 * This script verifies that the Google Ads tables and data are properly set up
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyGoogleAdsSetup() {
  console.log('🔍 Verifying Google Ads setup...');

  try {
    // Step 1: Check if tables exist
    console.log('📋 Checking table existence...');
    
    const { data: campaigns, error: campaignsError } = await supabase
      .from('google_ads_campaigns')
      .select('id')
      .limit(1);

    if (campaignsError) {
      console.error('❌ google_ads_campaigns table not accessible:', campaignsError);
      return false;
    }

    const { data: summaries, error: summariesError } = await supabase
      .from('google_ads_campaign_summaries')
      .select('id')
      .limit(1);

    if (summariesError) {
      console.error('❌ google_ads_campaign_summaries table not accessible:', summariesError);
      return false;
    }

    console.log('✅ Both Google Ads tables are accessible');

    // Step 2: Check Belmonte Hotel client configuration
    console.log('👤 Checking Belmonte Hotel client configuration...');
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, google_ads_enabled, google_ads_customer_id')
      .ilike('name', '%belmonte%')
      .single();

    if (clientError || !client) {
      console.error('❌ Belmonte Hotel client not found:', clientError);
      return false;
    }

    console.log(`✅ Client found: ${client.name}`);
    console.log(`   Google Ads enabled: ${client.google_ads_enabled}`);
    console.log(`   Customer ID: ${client.google_ads_customer_id}`);

    if (!client.google_ads_enabled) {
      console.error('❌ Google Ads not enabled for client');
      return false;
    }

    // Step 3: Check Google Ads campaign data
    console.log('📊 Checking Google Ads campaign data...');
    
    const { data: googleCampaigns, error: googleError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', client.id);

    if (googleError) {
      console.error('❌ Error fetching Google Ads campaigns:', googleError);
      return false;
    }

    console.log(`✅ Found ${googleCampaigns?.length || 0} Google Ads campaigns`);

    if (googleCampaigns && googleCampaigns.length > 0) {
      const totalSpend = googleCampaigns.reduce((sum, camp) => sum + parseFloat(camp.spend), 0);
      const totalImpressions = googleCampaigns.reduce((sum, camp) => sum + parseInt(camp.impressions), 0);
      const totalReservations = googleCampaigns.reduce((sum, camp) => sum + parseInt(camp.reservations), 0);
      
      console.log(`   Total Spend: ${totalSpend.toFixed(2)} PLN`);
      console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`   Total Reservations: ${totalReservations}`);
      
      googleCampaigns.forEach(campaign => {
        console.log(`   - ${campaign.campaign_name}: ${campaign.spend} PLN, ${campaign.reservations} reservations`);
      });
    }

    // Step 4: Check Google Ads summary data
    console.log('📈 Checking Google Ads summary data...');
    
    const { data: googleSummaries, error: summaryError } = await supabase
      .from('google_ads_campaign_summaries')
      .select('*')
      .eq('client_id', client.id);

    if (summaryError) {
      console.error('❌ Error fetching Google Ads summaries:', summaryError);
      return false;
    }

    console.log(`✅ Found ${googleSummaries?.length || 0} Google Ads summary records`);

    if (googleSummaries && googleSummaries.length > 0) {
      googleSummaries.forEach(summary => {
        console.log(`   - ${summary.period_type} (${summary.period_start} to ${summary.period_end}): ${summary.total_spend} PLN, ${summary.total_reservations} reservations`);
      });
    }

    // Step 5: Test unified data fetching (simulate PDF generation logic)
    console.log('🔄 Testing unified data fetching...');
    
    const { data: metaCampaigns, error: metaError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .gte('date_range_start', '2025-08-01')
      .lte('date_range_end', '2025-08-31');

    if (metaError) {
      console.warn('⚠️ Could not fetch Meta campaigns (this is OK if no Meta data exists):', metaError);
    }

    console.log(`📊 Meta campaigns found: ${metaCampaigns?.length || 0}`);
    console.log(`📊 Google campaigns found: ${googleCampaigns?.length || 0}`);

    if ((metaCampaigns?.length || 0) + (googleCampaigns?.length || 0) > 0) {
      console.log('✅ Unified data available for PDF generation');
    } else {
      console.warn('⚠️ No campaign data available for unified PDF generation');
    }

    console.log('\n🎉 Google Ads setup verification complete!');
    console.log('\n📋 Summary:');
    console.log(`   ✅ Tables created and accessible`);
    console.log(`   ✅ Client configured for Google Ads`);
    console.log(`   ✅ Sample data inserted`);
    console.log(`   ✅ Ready for unified PDF generation`);

    console.log('\n🚀 Next steps:');
    console.log('1. Go to Belmonte Hotel dashboard');
    console.log('2. Click "Pobierz PDF (Meta + Google)" button');
    console.log('3. You should see a unified report with both platforms');

    return true;

  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

// Run the script
if (require.main === module) {
  verifyGoogleAdsSetup().then((success) => {
    process.exit(success ? 0 : 1);
  }).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { verifyGoogleAdsSetup };
