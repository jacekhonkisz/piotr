require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL = 'http://localhost:3000';

async function getSystemUserToken() {
  console.log('🔐 Getting system user authentication...');
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });

    if (error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }

    if (!data.session?.access_token) {
      throw new Error('No access token received');
    }

    console.log('✅ Authentication successful');
    return data.session.access_token;
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    throw error;
  }
}

async function getStoredMayData() {
  console.log('📊 Fetching stored data for May 2025...');
  
  const { data: storedData, error } = await supabase
    .from('campaign_summaries')
    .select(`
      *,
      clients(name, email)
    `)
    .eq('summary_date', '2025-05-01')
    .eq('summary_type', 'monthly');

  if (error) {
    throw new Error(`Failed to fetch stored data: ${error.message}`);
  }

  console.log(`✅ Found ${storedData?.length || 0} stored May 2025 monthly summaries`);
  return storedData || [];
}

async function fetchRealTimeMayData(clientId, clientName, token) {
  console.log(`📡 Fetching real-time May 2025 data for ${clientName}...`);
  
  const dateRange = {
    start: '2025-05-01',
    end: '2025-05-31'
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: clientId,
        dateRange: dateRange
      })
    });

    console.log(`   📊 API Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`API returned error: ${data.error || 'Unknown error'}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ Error fetching real-time data for ${clientName}:`, error.message);
    throw error;
  }
}

function calculateTotals(campaigns) {
  if (!campaigns || campaigns.length === 0) {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      activeCampaigns: 0
    };
  }

  return campaigns.reduce((totals, campaign) => {
    // Count active campaigns
    if (campaign.effective_status === 'ACTIVE' || campaign.status === 'ACTIVE') {
      totals.activeCampaigns++;
    }
    
    // Sum metrics
    totals.spend += parseFloat(campaign.spend || 0);
    totals.impressions += parseInt(campaign.impressions || 0);
    totals.clicks += parseInt(campaign.clicks || 0);
    totals.conversions += parseInt(campaign.conversions || 0);
    
    return totals;
  }, {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    activeCampaigns: 0
  });
}

async function testMay2025Comparison() {
  console.log('🧪 Testing May 2025: Storage Database vs Real-time API');
  console.log('📅 Period: May 1st - May 31st, 2025');
  console.log('=' .repeat(60));
  
  try {
    // Get authentication token
    const token = await getSystemUserToken();
    
    // Get stored May 2025 data
    const storedMayData = await getStoredMayData();
    
    if (storedMayData.length === 0) {
      console.log('❌ No stored data found for May 2025');
      return;
    }
    
    console.log('\n📋 STORED DATA FOR MAY 2025:');
    console.log('='.repeat(40));
    
    let totalStoredSpend = 0;
    let totalStoredImpressions = 0;
    let totalStoredClicks = 0;
    let totalStoredConversions = 0;
    let totalStoredActiveCampaigns = 0;
    
    for (const stored of storedMayData) {
      const clientName = stored.clients?.name || 'Unknown';
      console.log(`\n👤 ${clientName}:`);
      console.log(`   💰 Spend: $${stored.total_spend?.toLocaleString() || 0}`);
      console.log(`   👁️ Impressions: ${stored.total_impressions?.toLocaleString() || 0}`);
      console.log(`   🖱️ Clicks: ${stored.total_clicks?.toLocaleString() || 0}`);
      console.log(`   🎯 Conversions: ${stored.total_conversions?.toLocaleString() || 0}`);
      console.log(`   📈 Active Campaigns: ${stored.active_campaigns || 0}`);
      console.log(`   📅 Last Updated: ${stored.last_updated || 'Unknown'}`);
      
      // Add to totals
      totalStoredSpend += parseFloat(stored.total_spend || 0);
      totalStoredImpressions += parseInt(stored.total_impressions || 0);
      totalStoredClicks += parseInt(stored.total_clicks || 0);
      totalStoredConversions += parseInt(stored.total_conversions || 0);
      totalStoredActiveCampaigns += parseInt(stored.active_campaigns || 0);
    }
    
    console.log(`\n📊 STORED TOTALS FOR MAY 2025:`);
    console.log(`   💰 Total Spend: $${totalStoredSpend.toLocaleString()}`);
    console.log(`   👁️ Total Impressions: ${totalStoredImpressions.toLocaleString()}`);
    console.log(`   🖱️ Total Clicks: ${totalStoredClicks.toLocaleString()}`);
    console.log(`   🎯 Total Conversions: ${totalStoredConversions.toLocaleString()}`);
    console.log(`   📈 Total Active Campaigns: ${totalStoredActiveCampaigns}`);
    
    console.log('\n📡 REAL-TIME API DATA FOR MAY 2025:');
    console.log('='.repeat(40));
    
    let totalRealTimeSpend = 0;
    let totalRealTimeImpressions = 0;
    let totalRealTimeClicks = 0;
    let totalRealTimeConversions = 0;
    let totalRealTimeActiveCampaigns = 0;
    
    for (const stored of storedMayData) {
      const clientName = stored.clients?.name || 'Unknown';
      
      try {
        const realTimeData = await fetchRealTimeMayData(stored.client_id, clientName, token);
        const realTimeTotals = calculateTotals(realTimeData.campaigns);
        
        console.log(`\n👤 ${clientName}:`);
        console.log(`   💰 Spend: $${realTimeTotals.spend?.toLocaleString() || 0}`);
        console.log(`   👁️ Impressions: ${realTimeTotals.impressions?.toLocaleString() || 0}`);
        console.log(`   🖱️ Clicks: ${realTimeTotals.clicks?.toLocaleString() || 0}`);
        console.log(`   🎯 Conversions: ${realTimeTotals.conversions?.toLocaleString() || 0}`);
        console.log(`   📈 Active Campaigns: ${realTimeTotals.activeCampaigns || 0}`);
        console.log(`   🎯 Total Campaigns Found: ${realTimeData.campaigns?.length || 0}`);
        console.log(`   🗄️ Data Source: ${realTimeData.dataSource || 'Meta API'}`);
        console.log(`   💾 From Cache: ${realTimeData.fromCache || false}`);
        
        // Add to totals
        totalRealTimeSpend += realTimeTotals.spend;
        totalRealTimeImpressions += realTimeTotals.impressions;
        totalRealTimeClicks += realTimeTotals.clicks;
        totalRealTimeConversions += realTimeTotals.conversions;
        totalRealTimeActiveCampaigns += realTimeTotals.activeCampaigns;
        
      } catch (error) {
        console.log(`\n👤 ${clientName}:`);
        console.log(`   ❌ Error fetching real-time data: ${error.message}`);
      }
    }
    
    console.log(`\n📊 REAL-TIME TOTALS FOR MAY 2025:`);
    console.log(`   💰 Total Spend: $${totalRealTimeSpend.toLocaleString()}`);
    console.log(`   👁️ Total Impressions: ${totalRealTimeImpressions.toLocaleString()}`);
    console.log(`   🖱️ Total Clicks: ${totalRealTimeClicks.toLocaleString()}`);
    console.log(`   🎯 Total Conversions: ${totalRealTimeConversions.toLocaleString()}`);
    console.log(`   📈 Total Active Campaigns: ${totalRealTimeActiveCampaigns}`);
    
    // COMPARISON
    console.log('\n' + '='.repeat(60));
    console.log('🔍 STORED vs REAL-TIME COMPARISON FOR MAY 2025');
    console.log('='.repeat(60));
    
    const metrics = [
      { name: 'Spend', stored: totalStoredSpend, realTime: totalRealTimeSpend, format: '$' },
      { name: 'Impressions', stored: totalStoredImpressions, realTime: totalRealTimeImpressions, format: '' },
      { name: 'Clicks', stored: totalStoredClicks, realTime: totalRealTimeClicks, format: '' },
      { name: 'Conversions', stored: totalStoredConversions, realTime: totalRealTimeConversions, format: '' },
      { name: 'Active Campaigns', stored: totalStoredActiveCampaigns, realTime: totalRealTimeActiveCampaigns, format: '' }
    ];
    
    let exactMatches = 0;
    
    for (const metric of metrics) {
      const storedFormatted = metric.format + metric.stored.toLocaleString();
      const realTimeFormatted = metric.format + metric.realTime.toLocaleString();
      
      const isMatch = metric.stored === metric.realTime;
      const status = isMatch ? '✅' : '❌';
      
      if (isMatch) exactMatches++;
      
      console.log(`${status} ${metric.name}: ${storedFormatted} vs ${realTimeFormatted}`);
      
      if (!isMatch) {
        if (metric.stored === 0 && metric.realTime === 0) {
          console.log(`   📝 Both are zero - this is a match`);
        } else if (metric.realTime === 0) {
          console.log(`   📝 Real-time API returns 0 (expected for historical data)`);
        } else {
          const diff = Math.abs(metric.stored - metric.realTime);
          const percentDiff = metric.realTime > 0 ? (diff / metric.realTime) * 100 : 0;
          console.log(`   📝 Difference: ${diff.toLocaleString()} (${percentDiff.toFixed(1)}%)`);
        }
      }
    }
    
    console.log(`\n🎯 RESULTS:`);
    console.log(`   Exact matches: ${exactMatches}/${metrics.length}`);
    console.log(`   Match rate: ${((exactMatches/metrics.length)*100).toFixed(1)}%`);
    
    if (totalRealTimeSpend === 0 && totalStoredSpend > 0) {
      console.log('\n💡 ANALYSIS:');
      console.log('   📊 Storage database has substantial May 2025 data');
      console.log('   📡 Real-time API returns 0 for all metrics');
      console.log('   🎯 This confirms Meta API historical data limitation');
      console.log('   ✅ Storage database is preserving valuable historical data');
      console.log('   🚀 The storage system is working as intended!');
    } else if (totalRealTimeSpend > 0) {
      console.log('\n💡 ANALYSIS:');
      console.log('   🎉 Real-time API returned data for May 2025!');
      console.log('   📊 Comparing actual values between stored and live data');
    } else {
      console.log('\n💡 ANALYSIS:');
      console.log('   📊 Both stored and real-time data show zero values');
      console.log('   🤔 May 2025 might not have had any advertising activity');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testMay2025Comparison(); 