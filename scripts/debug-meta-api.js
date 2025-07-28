const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMetaAPI() {
  try {
    console.log('🔍 Starting Meta API Debug...\n');

    // Get Jacek's client data
    console.log('📊 Fetching client data for jac.honkisz@gmail.com...');
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
      id: client.id,
      name: client.name,
      email: client.email,
      adAccountId: client.ad_account_id,
      hasMetaToken: !!client.meta_access_token,
      tokenPreview: client.meta_access_token ? 
        client.meta_access_token.substring(0, 30) + '...' : 'none'
    });

    // Test Meta API token validation
    console.log('\n🔐 Testing Meta API token validation...');
    const validateUrl = `https://graph.facebook.com/v18.0/me?access_token=${client.meta_access_token}`;
    
    try {
      const validateResponse = await fetch(validateUrl);
      const validateData = await validateResponse.json();
      
      console.log('📥 Token validation response:', {
        status: validateResponse.status,
        ok: validateResponse.ok,
        data: validateData
      });
    } catch (error) {
      console.error('❌ Token validation failed:', error.message);
    }

    // Test campaigns list
    console.log('\n📋 Testing campaigns list...');
    const campaignsUrl = `https://graph.facebook.com/v18.0/${client.ad_account_id}/campaigns?access_token=${client.meta_access_token}&fields=id,name,status,objective,created_time&limit=10`;
    
    try {
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();
      
      console.log('📥 Campaigns response:', {
        status: campaignsResponse.status,
        ok: campaignsResponse.ok,
        hasData: !!campaignsData.data,
        dataLength: campaignsData.data?.length || 0,
        hasError: !!campaignsData.error,
        error: campaignsData.error
      });

      if (campaignsData.data) {
        console.log('📊 Found campaigns:');
        campaignsData.data.forEach((campaign, index) => {
          console.log(`  ${index + 1}. ${campaign.name} (${campaign.id}) - Status: ${campaign.status}`);
        });
      }
    } catch (error) {
      console.error('❌ Campaigns fetch failed:', error.message);
    }

    // Test campaign insights with different date ranges
    const dateRanges = [
      {
        name: 'Last 7 days',
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      {
        name: 'Last 30 days',
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      {
        name: 'Last 90 days',
        start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      }
    ];

    for (const dateRange of dateRanges) {
      console.log(`\n📈 Testing campaign insights for ${dateRange.name} (${dateRange.start} to ${dateRange.end})...`);
      
      const insightsUrl = `https://graph.facebook.com/v18.0/${client.ad_account_id}/insights?access_token=${client.meta_access_token}&fields=campaign_id,campaign_name,impressions,clicks,spend,conversions,ctr,cpc&time_range=${encodeURIComponent(JSON.stringify({since: dateRange.start, until: dateRange.end}))}&level=campaign&limit=50`;
      
      try {
        const insightsResponse = await fetch(insightsUrl);
        const insightsData = await insightsResponse.json();
        
        console.log('📥 Insights response:', {
          status: insightsResponse.status,
          ok: insightsResponse.ok,
          hasData: !!insightsData.data,
          dataLength: insightsData.data?.length || 0,
          hasError: !!insightsData.error,
          error: insightsData.error
        });

        if (insightsData.data && insightsData.data.length > 0) {
          console.log('📊 Found campaign insights:');
          insightsData.data.forEach((insight, index) => {
            console.log(`  ${index + 1}. ${insight.campaign_name} - Spend: $${insight.spend || '0'}, Impressions: ${insight.impressions || '0'}, Clicks: ${insight.clicks || '0'}`);
          });
          break; // Found data, no need to test other date ranges
        } else {
          console.log('⚠️ No insights data found for this date range');
        }
      } catch (error) {
        console.error('❌ Insights fetch failed:', error.message);
      }
    }

    // Test account-level insights
    console.log('\n🏢 Testing account-level insights...');
    const accountInsightsUrl = `https://graph.facebook.com/v18.0/${client.ad_account_id}/insights?access_token=${client.meta_access_token}&fields=impressions,clicks,spend,conversions,ctr,cpc&time_range=${encodeURIComponent(JSON.stringify({since: dateRanges[1].start, until: dateRanges[1].end}))}&level=account`;
    
    try {
      const accountResponse = await fetch(accountInsightsUrl);
      const accountData = await accountResponse.json();
      
      console.log('📥 Account insights response:', {
        status: accountResponse.status,
        ok: accountResponse.ok,
        hasData: !!accountData.data,
        dataLength: accountData.data?.length || 0,
        hasError: !!accountData.error,
        error: accountData.error
      });

      if (accountData.data && accountData.data.length > 0) {
        const insight = accountData.data[0];
        console.log('📊 Account totals:', {
          spend: insight.spend || '0',
          impressions: insight.impressions || '0',
          clicks: insight.clicks || '0',
          conversions: insight.conversions || '0',
          ctr: insight.ctr || '0',
          cpc: insight.cpc || '0'
        });
      }
    } catch (error) {
      console.error('❌ Account insights fetch failed:', error.message);
    }

    console.log('\n✅ Debug complete! Check the logs above to understand what might be causing the zero data issue.');

  } catch (error) {
    console.error('💥 Debug script error:', error);
  }
}

// Run the debug
debugMetaAPI(); 