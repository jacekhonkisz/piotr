const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCampaignsData() {
  console.log('🔍 Checking campaigns data for jac.honkisz@gmail.com...\n');

  try {
    // Get client data
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
      adAccountId: client.ad_account_id
    });

    // Get campaigns for this client
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', client.id)
      .order('date_range_start', { ascending: false });

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`\n📊 Campaigns found: ${campaigns?.length || 0}`);

    if (campaigns && campaigns.length > 0) {
      console.log('\n📈 Campaign Details:');
      campaigns.forEach((campaign, index) => {
        console.log(`${index + 1}. ${campaign.campaign_name || campaign.campaign_id}`);
        console.log(`   - Spend: $${campaign.spend || 0}`);
        console.log(`   - Impressions: ${campaign.impressions || 0}`);
        console.log(`   - Clicks: ${campaign.clicks || 0}`);
        console.log(`   - CTR: ${campaign.ctr || 0}%`);
        console.log(`   - Date Range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
        console.log('');
      });

      // Calculate totals
      const totals = campaigns.reduce((acc, campaign) => {
        acc.spend += campaign.spend || 0;
        acc.impressions += campaign.impressions || 0;
        acc.clicks += campaign.clicks || 0;
        return acc;
      }, { spend: 0, impressions: 0, clicks: 0 });

      console.log('📊 Database Totals:');
      console.log(`- Total Spend: $${totals.spend.toFixed(2)}`);
      console.log(`- Total Impressions: ${totals.impressions.toLocaleString()}`);
      console.log(`- Total Clicks: ${totals.clicks}`);
      console.log(`- Average CTR: ${totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : 0}%`);

    } else {
      console.log('⚠️ No campaigns found in database');
    }

    // Get reports for this client
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', client.id)
      .order('generated_at', { ascending: false });

    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
      return;
    }

    console.log(`\n📋 Reports found: ${reports?.length || 0}`);

    if (reports && reports.length > 0) {
      console.log('\n📄 Recent Reports:');
      reports.slice(0, 3).forEach((report, index) => {
        console.log(`${index + 1}. ${report.date_range_start} to ${report.date_range_end}`);
        console.log(`   - Generated: ${report.generated_at}`);
        console.log(`   - Status: ${report.status}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkCampaignsData(); 