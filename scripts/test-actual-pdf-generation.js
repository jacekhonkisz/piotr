require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testActualPDFGeneration() {
  try {
    console.log('🧪 Testing actual PDF generation with jacek\'s data...\n');

    // Get jacek's client data
    const { data: jacek, error: jacekError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com')
      .single();

    if (jacekError || !jacek) {
      console.error('❌ Error fetching jacek:', jacekError);
      return;
    }

    console.log('✅ jacek client data:');
    console.log(`   Name: ${jacek.name}`);
    console.log(`   Email: ${jacek.email}`);
    console.log(`   ID: ${jacek.id}`);

    // Get jacek's latest report
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', jacek.id)
      .order('generated_at', { ascending: false })
      .limit(1);

    if (reportsError || !reports || reports.length === 0) {
      console.error('❌ No reports found for jacek');
      return;
    }

    const latestReport = reports[0];
    console.log(`\n📊 Latest report: ${latestReport.id}`);
    console.log(`   Date range: ${latestReport.date_range_start} to ${latestReport.date_range_end}`);

    // Generate month ID
    const startDate = new Date(latestReport.date_range_start);
    const monthId = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

    console.log(`\n📅 Month ID: ${monthId}`);

    // Simulate the exact data that would be passed to PDF generation
    const monthStartDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
    const monthEndDate = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;

    // Get campaigns for this period
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .eq('date_range_start', monthStartDate)
      .eq('date_range_end', monthEndDate);

    if (campaignsError) {
      console.error('❌ Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`\n📈 Found ${campaigns?.length || 0} campaigns`);

    // Calculate totals
    const totals = campaigns?.reduce((acc, campaign) => ({
      spend: acc.spend + (campaign.spend || 0),
      impressions: acc.impressions + (campaign.impressions || 0),
      clicks: acc.clicks + (campaign.clicks || 0),
      conversions: acc.conversions + (campaign.conversions || 0)
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 }) || { spend: 0, impressions: 0, clicks: 0, conversions: 0 };

    const calculatedTotals = {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
    };

    // Prepare the exact report data structure that would be passed to PDF generation
    const reportData = {
      client: jacek,
      dateRange: {
        start: monthStartDate,
        end: monthEndDate
      },
      campaigns: campaigns?.map(campaign => ({
        id: `${campaign.campaign_id}-${monthId}`,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        spend: campaign.spend || 0,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        conversions: campaign.conversions || 0,
        ctr: campaign.ctr || 0,
        cpc: campaign.cpc || 0,
        cpp: campaign.cpp,
        frequency: campaign.frequency,
        reach: campaign.reach,
        date_range_start: monthStartDate,
        date_range_end: monthEndDate,
        status: campaign.status,
        objective: campaign.objective
      })) || [],
      totals: calculatedTotals,
      trends: {
        spend: 5.2,
        conversions: 3.1,
        ctr: 1.5
      }
    };

    console.log('\n📄 Final report data structure:');
    console.log(`   Client Name: "${reportData.client.name}"`);
    console.log(`   Client Email: "${reportData.client.email}"`);
    console.log(`   Client ID: "${reportData.client.id}"`);
    console.log(`   Date Range: ${reportData.dateRange.start} to ${reportData.dateRange.end}`);
    console.log(`   Campaigns Count: ${reportData.campaigns.length}`);
    console.log(`   Total Spend: ${reportData.totals.spend}`);

    // Test the HTML generation with this data
    console.log('\n🔍 Testing HTML generation...');
    
    // Import the HTML generation function (simplified version)
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      const months = [
        'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
      ];
      return `${months[date.getMonth()]} ${date.getFullYear()}`;
    };

    // Generate a simplified version of the HTML to test the client name
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Raport Meta Ads - ${reportData.client.name}</title>
      </head>
      <body>
        <h1>📊 Raport Meta Ads</h1>
        <p>${reportData.client.name} - Premium Analytics Dashboard</p>
        <div>Date Range: ${formatDate(reportData.dateRange.start)} - ${formatDate(reportData.dateRange.end)}</div>
        <div>Client ID: ${reportData.client.id}</div>
        <div>Client Email: ${reportData.client.email}</div>
      </body>
      </html>
    `;

    console.log('\n📄 Generated HTML preview:');
    console.log('Title:', `Raport Meta Ads - ${reportData.client.name}`);
    console.log('Client name in body:', reportData.client.name);
    console.log('Client ID:', reportData.client.id);

    // Check if there's any issue with the client data
    if (reportData.client.name !== 'jacek') {
      console.error('❌ ISSUE FOUND: Client name is not "jacek"!');
      console.error(`   Expected: "jacek"`);
      console.error(`   Found: "${reportData.client.name}"`);
    } else {
      console.log('✅ Client name is correct: "jacek"');
    }

    // Check if there's any issue with the client ID
    if (reportData.client.id !== jacek.id) {
      console.error('❌ ISSUE FOUND: Client ID mismatch!');
      console.error(`   Expected: "${jacek.id}"`);
      console.error(`   Found: "${reportData.client.id}"`);
    } else {
      console.log('✅ Client ID is correct');
    }

    console.log('\n✅ Test completed!');
    console.log('If the client name is correct here but wrong in the PDF, the issue is in the PDF generation process.');

  } catch (error) {
    console.error('❌ Error testing PDF generation:', error);
  }
}

testActualPDFGeneration(); 