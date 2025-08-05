require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMetaRankingsSetup() {
  console.log('🔍 META RANKINGS SETUP DIAGNOSTIC\n');
  console.log('='.repeat(60));

  try {
    // 1. Get client data
    console.log('1️⃣ Getting client data...');
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (clientError || !client) {
      console.error('❌ Client not found:', clientError);
      return;
    }

    console.log('✅ Client found:', {
      name: client.name,
      email: client.email,
      adAccountId: client.ad_account_id,
      hasToken: !!client.meta_access_token,
      tokenLength: client.meta_access_token?.length || 0
    });

    // 2. Test token validity using built-in fetch
    console.log('\n2️⃣ Testing Meta API token...');
    const validateUrl = `https://graph.facebook.com/v18.0/me?access_token=${client.meta_access_token}`;
    
    try {
      const validateResponse = await fetch(validateUrl);
      const validateData = await validateResponse.json();

      if (validateData.error) {
        console.error('❌ Token validation failed:', validateData.error);
        return;
      }

      console.log('✅ Token is valid');
      console.log('   User ID:', validateData.id);
      console.log('   Name:', validateData.name);
    } catch (error) {
      console.error('❌ Token validation error:', error.message);
      return;
    }

    // 3. Get account information
    console.log('\n3️⃣ Getting account information...');
    const accountUrl = `https://graph.facebook.com/v18.0/${client.ad_account_id}?access_token=${client.meta_access_token}&fields=id,name,account_status,currency,timezone_name`;
    
    try {
      const accountResponse = await fetch(accountUrl);
      const accountData = await accountResponse.json();

      if (accountData.error) {
        console.error('❌ Account info failed:', accountData.error);
        return;
      }

      console.log('✅ Account info:', {
        id: accountData.id,
        name: accountData.name,
        status: accountData.account_status,
        currency: accountData.currency,
        timezone: accountData.timezone_name
      });
    } catch (error) {
      console.error('❌ Account info error:', error.message);
      return;
    }

    // 4. Get campaigns list
    console.log('\n4️⃣ Getting campaigns...');
    const campaignsUrl = `https://graph.facebook.com/v18.0/${client.ad_account_id}/campaigns?access_token=${client.meta_access_token}&fields=id,name,status,objective,created_time,start_time&limit=20`;
    
    try {
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();

      if (campaignsData.error) {
        console.error('❌ Campaigns fetch failed:', campaignsData.error);
        return;
      }

      const campaigns = campaignsData.data || [];
      console.log(`✅ Found ${campaigns.length} campaigns`);
      
      const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');
      console.log(`   Active campaigns: ${activeCampaigns.length}`);
      
      if (activeCampaigns.length > 0) {
        console.log('   Sample active campaign:', {
          id: activeCampaigns[0].id,
          name: activeCampaigns[0].name,
          objective: activeCampaigns[0].objective,
          created: activeCampaigns[0].created_time
        });
      }
    } catch (error) {
      console.error('❌ Campaigns fetch error:', error.message);
      return;
    }

    // 5. Test insights with different date ranges
    console.log('\n5️⃣ Testing insights with different date ranges...');
    
    const dateRanges = [
      { name: 'Last 7 days', start: '2025-08-01', end: '2025-08-07' },
      { name: 'Last 30 days', start: '2025-07-08', end: '2025-08-07' },
      { name: 'Last 90 days', start: '2025-05-08', end: '2025-08-07' }
    ];

    for (const range of dateRanges) {
      console.log(`\n   Testing ${range.name} (${range.start} to ${range.end})...`);
      
      const insightsUrl = `https://graph.facebook.com/v18.0/${client.ad_account_id}/insights?access_token=${client.meta_access_token}&fields=ad_name,spend,impressions,clicks,cpp,quality_ranking,engagement_rate_ranking,conversion_rate_ranking&time_range=${encodeURIComponent(JSON.stringify({since: range.start, until: range.end}))}&level=ad&limit=10`;
      
      try {
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();

        if (insightsData.error) {
          console.log(`   ❌ Error: ${insightsData.error.message}`);
          continue;
        }

        const ads = insightsData.data || [];
        console.log(`   ✅ Found ${ads.length} ads`);
        
        if (ads.length > 0) {
          const sampleAd = ads[0];
          console.log(`   📊 Sample ad: "${sampleAd.ad_name}"`);
          console.log(`      Spend: ${sampleAd.spend || '0'} PLN`);
          console.log(`      Impressions: ${sampleAd.impressions || '0'}`);
          console.log(`      Clicks: ${sampleAd.clicks || '0'}`);
          console.log(`      Quality ranking: ${sampleAd.quality_ranking || 'NOT_AVAILABLE'}`);
          console.log(`      Engagement ranking: ${sampleAd.engagement_rate_ranking || 'NOT_AVAILABLE'}`);
          console.log(`      Conversion ranking: ${sampleAd.conversion_rate_ranking || 'NOT_AVAILABLE'}`);
          
          // Check if any rankings are available
          const hasRankings = ads.some(ad => 
            ad.quality_ranking || 
            ad.engagement_rate_ranking || 
            ad.conversion_rate_ranking
          );
          
          if (hasRankings) {
            console.log(`   🎉 RANKINGS AVAILABLE for ${range.name}!`);
            const adsWithRankings = ads.filter(ad => 
              ad.quality_ranking || 
              ad.engagement_rate_ranking || 
              ad.conversion_rate_ranking
            );
            console.log(`   📈 ${adsWithRankings.length} ads have ranking data`);
          } else {
            console.log(`   ⚠️ No rankings available for ${range.name}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // 6. Recommendations
    console.log('\n6️⃣ RECOMMENDATIONS\n');
    console.log('='.repeat(60));
    
    console.log('✅ SETUP CHECKLIST:');
    console.log('   ✓ Meta API token is valid');
    console.log('   ✓ Ad account is accessible');
    console.log('   ✓ API permissions are working');
    
    console.log('\n📋 NEXT STEPS:');
    console.log('   1. Ensure campaigns are ACTIVE (not paused)');
    console.log('   2. Wait for campaigns to accumulate 1000+ impressions');
    console.log('   3. Use 30+ day date ranges for better ranking data');
    console.log('   4. Check that campaigns have sufficient budget and engagement');
    console.log('   5. Verify campaigns are in the same industry/vertical for comparisons');

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the diagnostic
checkMetaRankingsSetup(); 