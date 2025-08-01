require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDateRangeFiltering() {
  try {
    console.log('🔍 Testing date range filtering...\n');
    
    // Get the TechCorp client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'client@techcorp.com')
      .single();
    
    if (clientError || !client) {
      console.error('❌ TechCorp client not found:', clientError);
      return;
    }
    
    // Test with July 2024 date range
    const julyDateRange = {
      start: '2024-07-01',
      end: '2024-07-31'
    };
    
    console.log(`🧪 Testing July 2024 date range: ${julyDateRange.start} to ${julyDateRange.end}`);
    
    // Check if there's already a report for this date range
    const { data: existingReport, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', client.id)
      .eq('date_range_start', julyDateRange.start)
      .eq('date_range_end', julyDateRange.end)
      .single();
    
    if (reportError && reportError.code !== 'PGRST116') {
      console.error('❌ Error checking existing report:', reportError);
      return;
    }
    
    if (existingReport) {
      console.log('📋 Found existing report for July 2024:');
      console.log(`   - Report ID: ${existingReport.id}`);
      console.log(`   - Date Range: ${existingReport.date_range_start} to ${existingReport.date_range_end}`);
      console.log(`   - Generated: ${existingReport.generated_at}`);
      
      // Get campaign data for this report
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', client.id)
        .eq('date_range_start', julyDateRange.start)
        .eq('date_range_end', julyDateRange.end);
      
      if (campaignsError) {
        console.error('❌ Error fetching campaigns:', campaignsError);
        return;
      }
      
      console.log(`\n📊 Campaign data for July 2024:`);
      console.log(`   - Total campaigns: ${campaigns.length}`);
      
      campaigns.forEach((campaign, index) => {
        console.log(`\n   ${index + 1}. ${campaign.campaign_name} (${campaign.campaign_id})`);
        console.log(`      - Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
        console.log(`      - Impressions: ${campaign.impressions}`);
        console.log(`      - Clicks: ${campaign.clicks}`);
        console.log(`      - Spend: $${campaign.spend}`);
        console.log(`      - Frequency: ${campaign.frequency || 'N/A'}`);
        console.log(`      - Reach: ${campaign.reach || 'N/A'}`);
        console.log(`      - Created: ${campaign.created_at}`);
      });
      
      // Calculate totals
      const totalSpend = campaigns.reduce((sum, c) => sum + parseFloat(c.spend || 0), 0);
      const totalImpressions = campaigns.reduce((sum, c) => sum + parseInt(c.impressions || 0), 0);
      const totalClicks = campaigns.reduce((sum, c) => sum + parseInt(c.clicks || 0), 0);
      const totalReach = campaigns.reduce((sum, c) => sum + parseInt(c.reach || 0), 0);
      
      console.log(`\n📈 July 2024 Totals:`);
      console.log(`   - Total Spend: $${totalSpend.toFixed(2)}`);
      console.log(`   - Total Impressions: ${totalImpressions}`);
      console.log(`   - Total Clicks: ${totalClicks}`);
      console.log(`   - Total Reach: ${totalReach}`);
      
      // Check if there are campaigns with frequency data
      const campaignsWithFrequency = campaigns.filter(c => c.frequency && c.frequency > 0);
      console.log(`\n🔍 Frequency Analysis:`);
      console.log(`   - Campaigns with frequency data: ${campaignsWithFrequency.length}`);
      
      if (campaignsWithFrequency.length > 0) {
        console.log('   - This explains why you see frequency = 3.0');
        console.log('   - The data is coming from existing campaign records');
      } else {
        console.log('   - No frequency data found in existing campaigns');
      }
      
    } else {
      console.log('📋 No existing report found for July 2024');
      console.log('💡 This means the frequency data is coming from a different source');
    }
    
    // Check all reports for this client to see what date ranges exist
    console.log('\n🔍 Checking all reports for this client...');
    const { data: allReports, error: allReportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', client.id)
      .order('date_range_start', { ascending: false });
    
    if (allReportsError) {
      console.error('❌ Error fetching all reports:', allReportsError);
      return;
    }
    
    console.log(`\n📊 All reports for ${client.name}:`);
    allReports.forEach((report, index) => {
      console.log(`   ${index + 1}. ${report.date_range_start} to ${report.date_range_end} (ID: ${report.id})`);
    });
    
    // Check if there are any campaigns with frequency data
    console.log('\n🔍 Checking all campaigns for frequency data...');
    const { data: allCampaigns, error: allCampaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .not('frequency', 'is', null)
      .order('created_at', { ascending: false });
    
    if (allCampaignsError) {
      console.error('❌ Error fetching campaigns with frequency:', allCampaignsError);
      return;
    }
    
    console.log(`\n📊 Campaigns with frequency data:`);
    allCampaigns.forEach((campaign, index) => {
      console.log(`   ${index + 1}. ${campaign.campaign_name}`);
      console.log(`      - Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
      console.log(`      - Frequency: ${campaign.frequency}`);
      console.log(`      - Created: ${campaign.created_at}`);
    });
    
  } catch (error) {
    console.error('💥 Error testing date range filtering:', error);
  }
}

// Run the test
testDateRangeFiltering(); 