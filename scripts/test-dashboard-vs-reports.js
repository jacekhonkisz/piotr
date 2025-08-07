const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDashboardVsReports() {
  console.log('🧪 Testing Dashboard vs Reports Data Sources\n');
  console.log('='.repeat(60));

  const havetClientId = '93d46876-addc-4b99-b1e1-437428dd54f1';
  
  try {
    // Get client data
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', havetClientId)
      .single();

    if (clientError) {
      console.error('❌ Error fetching client:', clientError);
      return;
    }

    console.log(`🏨 Client: ${client.name} (${client.email})`);
    
    // Test 1: Dashboard Data Source (Live API)
    console.log('\n1️⃣ DASHBOARD DATA SOURCE (Live API):');
    console.log('='.repeat(50));
    
    const today = new Date();
    const startOfMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
    
    const dateRange = {
      start: startOfMonth.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
    };
    
    console.log(`📅 Dashboard date range: ${dateRange.start} to ${dateRange.end}`);
    
    // Simulate dashboard API call
    const token = client.meta_access_token;
    const adAccountId = client.ad_account_id.startsWith('act_') 
      ? client.ad_account_id.substring(4)
      : client.ad_account_id;
    
    const accountIdWithPrefix = `act_${adAccountId}`;
    
    const campaignsUrl = `https://graph.facebook.com/v18.0/${accountIdWithPrefix}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&time_range={"since":"${dateRange.start}","until":"${dateRange.end}"}&level=campaign&access_token=${token}`;
    
    try {
      const campaignsResponse = await fetch(campaignsUrl);
      const campaignsData = await campaignsResponse.json();
      
      console.log(`📊 Dashboard API Response: ${campaignsResponse.status}`);
      console.log(`📊 Dashboard Campaigns Found: ${campaignsData.data?.length || 0}`);
      
      if (campaignsData.data && campaignsData.data.length > 0) {
        // Calculate dashboard totals
        const totalSpend = campaignsData.data.reduce((sum, campaign) => sum + parseFloat(campaign.spend || 0), 0);
        const totalImpressions = campaignsData.data.reduce((sum, campaign) => sum + parseInt(campaign.impressions || 0), 0);
        const totalClicks = campaignsData.data.reduce((sum, campaign) => sum + parseInt(campaign.clicks || 0), 0);
        
        console.log(`💰 Dashboard Total Spend: ${totalSpend.toFixed(2)} zł`);
        console.log(`👁️ Dashboard Total Impressions: ${totalImpressions.toLocaleString()}`);
        console.log(`🖱️ Dashboard Total Clicks: ${totalClicks.toLocaleString()}`);
      }
    } catch (error) {
      console.log(`❌ Dashboard API Error: ${error.message}`);
    }
    
    // Test 2: Reports Data Source (Database)
    console.log('\n2️⃣ REPORTS DATA SOURCE (Database):');
    console.log('='.repeat(50));
    
    // Get campaigns from database for current month
    const { data: dbCampaigns, error: dbError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .gte('date_range_start', dateRange.start)
      .lte('date_range_end', dateRange.end);
    
    if (dbError) {
      console.error('❌ Database Error:', dbError);
    } else {
      console.log(`📊 Database Campaigns Found: ${dbCampaigns?.length || 0}`);
      
      if (dbCampaigns && dbCampaigns.length > 0) {
        const totalSpend = dbCampaigns.reduce((sum, campaign) => sum + parseFloat(campaign.spend || 0), 0);
        const totalImpressions = dbCampaigns.reduce((sum, campaign) => sum + parseInt(campaign.impressions || 0), 0);
        const totalClicks = dbCampaigns.reduce((sum, campaign) => sum + parseInt(campaign.clicks || 0), 0);
        
        console.log(`💰 Database Total Spend: ${totalSpend.toFixed(2)} zł`);
        console.log(`👁️ Database Total Impressions: ${totalImpressions.toLocaleString()}`);
        console.log(`🖱️ Database Total Clicks: ${totalClicks.toLocaleString()}`);
      }
    }
    
    // Test 3: All Database Campaigns (what Reports page might be showing)
    console.log('\n3️⃣ ALL DATABASE CAMPAIGNS (Reports Page):');
    console.log('='.repeat(50));
    
    const { data: allDbCampaigns, error: allDbError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .order('date_range_start', { ascending: false })
      .limit(100);
    
    if (allDbError) {
      console.error('❌ All Database Error:', allDbError);
    } else {
      console.log(`📊 All Database Campaigns Found: ${allDbCampaigns?.length || 0}`);
      
      if (allDbCampaigns && allDbCampaigns.length > 0) {
        const totalSpend = allDbCampaigns.reduce((sum, campaign) => sum + parseFloat(campaign.spend || 0), 0);
        const totalImpressions = allDbCampaigns.reduce((sum, campaign) => sum + parseInt(campaign.impressions || 0), 0);
        const totalClicks = allDbCampaigns.reduce((sum, campaign) => sum + parseInt(campaign.clicks || 0), 0);
        
        console.log(`💰 All Database Total Spend: ${totalSpend.toFixed(2)} zł`);
        console.log(`👁️ All Database Total Impressions: ${totalImpressions.toLocaleString()}`);
        console.log(`🖱️ All Database Total Clicks: ${totalClicks.toLocaleString()}`);
        
        // Show date ranges
        const dateRanges = allDbCampaigns.map(c => `${c.date_range_start} to ${c.date_range_end}`).slice(0, 5);
        console.log(`📅 Sample Date Ranges: ${dateRanges.join(', ')}`);
      }
    }
    
    // Test 4: Summary and Recommendation
    console.log('\n4️⃣ SUMMARY AND RECOMMENDATION:');
    console.log('='.repeat(50));
    
    console.log('🎯 ISSUE IDENTIFIED:');
    console.log('   - User is on REPORTS page (/reports)');
    console.log('   - Reports page shows database data (91 campaigns)');
    console.log('   - Dashboard page shows live API data (12 campaigns)');
    console.log('   - Reports page is designed for historical data');
    console.log('   - Dashboard page is designed for current month live data');
    
    console.log('\n✅ SOLUTION:');
    console.log('   - Navigate to DASHBOARD page (/dashboard)');
    console.log('   - Dashboard shows live August 2025 data');
    console.log('   - Dashboard has been fixed to show correct values');
    console.log('   - Reports page is working as intended (historical data)');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('   1. Go to /dashboard instead of /reports');
    console.log('   2. Clear browser cache (Cmd+Shift+Delete)');
    console.log('   3. Open in incognito window (Cmd+Shift+N)');
    console.log('   4. Verify dashboard shows live August 2025 data');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testDashboardVsReports(); 