#!/usr/bin/env node

/**
 * Test PDF Generation Environment
 * This script tests the exact environment and imports used in PDF generation
 */

require('dotenv').config({ path: '.env.local' });

async function testPDFGenerationEnvironment() {
  console.log('🧪 Testing PDF Generation Environment...\n');

  try {
    // Test 1: Check if we're in the right directory
    console.log('📁 Current working directory:', process.cwd());
    
    // Test 2: Test the exact import path used in PDF generation
    console.log('\n📦 Testing module imports...');
    
    try {
      // This is the exact import path from the PDF generation file
      const unifiedTypes = require('../src/lib/unified-campaign-types');
      console.log('✅ unified-campaign-types (TS) imported successfully');
      console.log('   Available functions:', Object.keys(unifiedTypes));
    } catch (error) {
      console.log('❌ unified-campaign-types (TS) import failed:', error.message);
      
      try {
        // Try the JS version
        const unifiedTypesJS = require('../src/lib/unified-campaign-types.js');
        console.log('✅ unified-campaign-types (JS) imported successfully');
        console.log('   Available functions:', Object.keys(unifiedTypesJS));
      } catch (jsError) {
        console.log('❌ unified-campaign-types (JS) import also failed:', jsError.message);
      }
    }

    // Test 3: Test other imports from the PDF generation file
    console.log('\n📦 Testing other PDF generation imports...');
    
    const imports = [
      { name: 'supabase-js', path: '@supabase/supabase-js' },
      { name: 'logger', path: '../src/lib/logger' },
      { name: 'executive-summary-cache', path: '../src/lib/executive-summary-cache' },
      { name: 'unified-data-fetcher', path: '../src/lib/unified-data-fetcher' }
    ];

    for (const imp of imports) {
      try {
        const mod = require(imp.path);
        console.log(`✅ ${imp.name} imported successfully`);
      } catch (error) {
        console.log(`❌ ${imp.name} import failed: ${error.message}`);
      }
    }

    // Test 4: Simulate the exact data conversion that happens in PDF generation
    console.log('\n🔄 Testing data conversion...');
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch Google Ads data
    const { data: googleCampaigns, error: googleError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa')
      .gte('date_range_start', '2025-08-01')
      .lte('date_range_end', '2025-08-31');

    if (googleError) {
      console.log('❌ Failed to fetch Google Ads data:', googleError.message);
      return;
    }

    console.log(`📊 Fetched ${googleCampaigns?.length || 0} Google Ads campaigns`);

    if (googleCampaigns && googleCampaigns.length > 0) {
      // Try to convert using the JS version (since TS import failed)
      try {
        const { convertGoogleCampaignToUnified, calculatePlatformTotals } = require('../src/lib/unified-campaign-types.js');
        
        const convertedCampaigns = googleCampaigns.map(convertGoogleCampaignToUnified);
        console.log(`✅ Converted ${convertedCampaigns.length} Google campaigns using JS module`);
        
        const platformTotals = calculatePlatformTotals(convertedCampaigns);
        console.log(`✅ Calculated platform totals: ${platformTotals.totalSpend} PLN spend`);
        
        // Test the HTML source logic
        const sourceText = convertedCampaigns && convertedCampaigns.length > 0 
          ? 'Źródło: Meta Ads API & Google Ads API' 
          : 'Źródło: Meta Ads API';
        
        console.log(`✅ HTML source logic result: "${sourceText}"`);
        
        console.log('\n🎯 CONCLUSION: The conversion logic works with JS module!');
        console.log('   The issue is that the PDF generation is trying to import the TS module');
        console.log('   but it should be using the compiled version or the JS module.');
        
      } catch (conversionError) {
        console.log('❌ Conversion failed:', conversionError.message);
      }
    }

    // Test 5: Check Next.js compilation
    console.log('\n🏗️ Checking Next.js environment...');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   Next.js should handle TS compilation automatically');
    
    // The issue might be that the PDF generation is running in a different context
    // where TypeScript compilation isn't available

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testPDFGenerationEnvironment().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = { testPDFGenerationEnvironment };
