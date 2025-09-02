require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkGoogleAdsDateRange() {
  console.log('🧪 Checking Google Ads Data for Date Range...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const dateRange = {
    start: '2025-08-01',
    end: '2025-08-31'
  };

  try {
    console.log('🔍 Checking Google Ads campaigns in database...');
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Date Range: ${dateRange.start} to ${dateRange.end}`);

    // Check all Google Ads campaigns for this client
    const { data: allGoogleCampaigns, error: allError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', clientId);

    if (allError) {
      console.error('❌ Error fetching all Google Ads campaigns:', allError);
      return;
    }

    console.log(`\n📊 All Google Ads campaigns for client: ${allGoogleCampaigns.length}`);
    allGoogleCampaigns.forEach(campaign => {
      console.log(`   - ${campaign.campaign_name}: ${campaign.date_range_start} to ${campaign.date_range_end}`);
    });

    // Check with the exact same query used in PDF generation
    const { data: filteredCampaigns, error: filterError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .gte('date_range_start', dateRange.start)
      .lte('date_range_end', dateRange.end);

    if (filterError) {
      console.error('❌ Error with filtered query:', filterError);
      return;
    }

    console.log(`\n🎯 Filtered Google Ads campaigns (PDF query): ${filteredCampaigns.length}`);
    if (filteredCampaigns.length === 0) {
      console.log('❌ NO CAMPAIGNS FOUND with the PDF generation query!');
      console.log('   This explains why Google Ads data is missing from PDFs');
      
      console.log('\n🔍 Debugging the date range filter:');
      console.log(`   Looking for campaigns where:`);
      console.log(`   - date_range_start >= '${dateRange.start}'`);
      console.log(`   - date_range_end <= '${dateRange.end}'`);
      
      if (allGoogleCampaigns.length > 0) {
        console.log('\n💡 Possible solutions:');
        console.log('   1. Fix the date range query logic');
        console.log('   2. Use overlapping date range instead of exact match');
        console.log('   3. Check if Google Ads data has different date format');
      }
    } else {
      filteredCampaigns.forEach(campaign => {
        console.log(`   ✅ ${campaign.campaign_name}: ${campaign.date_range_start} to ${campaign.date_range_end}`);
      });
    }

    // Test alternative query (overlapping dates)
    console.log('\n🔍 Testing alternative query (overlapping dates)...');
    const { data: overlappingCampaigns, error: overlapError } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', clientId)
      .lte('date_range_start', dateRange.end)
      .gte('date_range_end', dateRange.start);

    if (!overlapError) {
      console.log(`   📊 Overlapping campaigns found: ${overlappingCampaigns.length}`);
      if (overlappingCampaigns.length > 0) {
        console.log('   ✅ This query finds campaigns! Consider using overlapping logic');
      }
    }

  } catch (error) {
    console.error('❌ Error checking Google Ads date range:', error.message);
  }
}

checkGoogleAdsDateRange();
