#!/usr/bin/env node

/**
 * Test PDF generation exactly as the frontend does it - with direct campaign data
 * This will help us see why comparison data isn't being attached properly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDirectPDFGeneration() {
  console.log('🧪 TESTING DIRECT PDF GENERATION (FRONTEND SIMULATION)\n');

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const dateRange = {
    start: '2025-08-01',
    end: '2025-08-31'
  };

  try {
    // First, get the client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError) {
      throw new Error('Failed to get client: ' + clientError.message);
    }

    // Get campaign data for the current month (simulating frontend data fetch)
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientId)
      .gte('date_range_start', dateRange.start)
      .lte('date_range_end', dateRange.end);

    if (campaignError) {
      throw new Error('Failed to get campaigns: ' + campaignError.message);
    }

    // Calculate totals (simulating frontend calculation)
    const totals = campaigns.reduce((acc, campaign) => ({
      spend: acc.spend + (campaign.spend || 0),
      impressions: acc.impressions + (campaign.impressions || 0),
      clicks: acc.clicks + (campaign.clicks || 0),
      conversions: acc.conversions + (campaign.conversions || 0),
      ctr: 0, // Will be calculated
      cpc: 0, // Will be calculated
      cpm: 0  // Will be calculated
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, cpm: 0 });

    // Calculate derived metrics
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    totals.cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    totals.cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;

    console.log('📊 Simulated Frontend Data:');
    console.log('   Client:', client.name);
    console.log('   Campaigns:', campaigns.length);
    console.log('   Total Spend:', totals.spend.toFixed(2) + ' zł');
    console.log('   Total Impressions:', totals.impressions.toLocaleString());
    console.log('   Total Clicks:', totals.clicks.toLocaleString());

    // Create the same request body as the frontend
    const requestBody = {
      clientId,
      dateRange,
      campaigns,  // This triggers the direct data path
      totals,
      client
      // Note: no metaTables for this test
    };

    console.log('\n📝 Making PDF generation request with DIRECT DATA...');
    console.log('   This should trigger parallel comparison data fetching');

    // Make the request
    const response = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-token-for-testing'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('\n📄 PDF Generation Response:');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('   Error Response:', errorText);
      return;
    }

    console.log('   ✅ PDF generated successfully!');
    console.log('\n🔍 IMPORTANT: Check the server console logs for:');
    console.log('   - "🚀 Using direct data - starting monthly and year database lookups in parallel"');
    console.log('   - "🔍 COMPARISON DATA RESULTS:"');
    console.log('   - "📊 Previous Month Data Details:"');
    console.log('   - "🔍 YEAR-OVER-YEAR VALIDATION DEBUG:"');
    console.log('   - "🔍 PERIOD COMPARISON VALIDATION DEBUG:"');

  } catch (error) {
    console.error('❌ Error testing direct PDF generation:', error.message);
  }
}

// Run the test
testDirectPDFGeneration(); 