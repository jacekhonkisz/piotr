// Test script to simulate the full data flow

// Simulate the exact API response from the logs
const mockApiResponse = {
  success: true,
  data: {
    campaigns: [
      {
        campaign_id: '120207742278550356',
        campaign_name: 'Polski 1',
        spend: 49.99,
        impressions: 1938,
        clicks: 43,
        conversions: 0,
        ctr: 2.22,
        cpc: 1.16,
        date_start: '2024-03-01',
        date_stop: '2024-03-31'
      },
      {
        campaign_id: '120207913722810356',
        campaign_name: 'Polski 1 – kopia',
        spend: 18.05,
        impressions: 968,
        clicks: 5,
        conversions: 0,
        ctr: 0.52,
        cpc: 3.61,
        date_start: '2024-03-01',
        date_stop: '2024-03-31'
      }
    ],
    stats: {
      totalSpend: 68.04,
      totalImpressions: 2906,
      totalClicks: 48,
      totalConversions: 0,
      averageCtr: 1.65,
      averageCpc: 1.42
    }
  }
};

// Simulate the frontend transformation logic
const transformApiResponse = (data, periodId, periodStartDate, periodEndDate) => {
  console.log('🔄 Transforming API response...');
  console.log('Input data:', JSON.stringify(data, null, 2));
  
  // Extract campaigns from nested structure
  const rawCampaigns = data.data?.campaigns || data.campaigns || [];
  console.log('Raw campaigns:', rawCampaigns.length);
  
  // Transform campaigns to match frontend interface
  const campaigns = rawCampaigns.map((campaign, index) => ({
    id: campaign.campaign_id || `campaign-${index}`,
    campaign_id: campaign.campaign_id || '',
    campaign_name: campaign.campaign_name || 'Unknown Campaign',
    spend: parseFloat(campaign.spend || '0'),
    impressions: parseInt(campaign.impressions || '0'),
    clicks: parseInt(campaign.clicks || '0'),
    conversions: parseInt(campaign.conversions || '0'),
    ctr: parseFloat(campaign.ctr || '0'),
    cpc: parseFloat(campaign.cpc || '0'),
    cpa: campaign.cpa ? parseFloat(campaign.cpa) : undefined,
    frequency: campaign.frequency ? parseFloat(campaign.frequency) : undefined,
    reach: campaign.reach ? parseInt(campaign.reach) : undefined,
    relevance_score: campaign.relevance_score ? parseFloat(campaign.relevance_score) : undefined,
    landing_page_view: campaign.landing_page_view ? parseInt(campaign.landing_page_view) : undefined,
    ad_type: campaign.ad_type || undefined,
    objective: campaign.objective || undefined
  }));
  
  console.log('Transformed campaigns:', campaigns.length);
  
  // Create report object
  const report = {
    id: periodId,
    date_range_start: periodStartDate,
    date_range_end: periodEndDate,
    generated_at: new Date().toISOString(),
    campaigns: campaigns
  };
  
  console.log('Final report:', JSON.stringify(report, null, 2));
  
  return report;
};

// Simulate the totals calculation
const calculateTotals = (report) => {
  console.log('📊 Calculating totals...');
  
  if (!report || !report.campaigns.length) {
    console.log('⚠️ No report or no campaigns, returning zeros');
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      ctr: 0,
      cpc: 0,
      cpa: 0
    };
  }
  
  console.log('Campaigns for totals calculation:', report.campaigns);
  
  const totals = report.campaigns.reduce((acc, campaign) => ({
    spend: acc.spend + (campaign.spend || 0),
    impressions: acc.impressions + (campaign.impressions || 0),
    clicks: acc.clicks + (campaign.clicks || 0),
    conversions: acc.conversions + (campaign.conversions || 0)
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
  
  // Calculate derived metrics
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  
  const result = { ...totals, ctr, cpc, cpa };
  console.log('📊 Calculated totals:', result);
  
  return result;
};

// Run the full test
console.log('🧪 Testing full data flow...\n');

const periodId = '2024-03';
const periodStartDate = '2024-03-01';
const periodEndDate = '2024-03-31';

// Step 1: Transform API response
const report = transformApiResponse(mockApiResponse, periodId, periodStartDate, periodEndDate);

console.log('\n' + '='.repeat(50) + '\n');

// Step 2: Calculate totals
const totals = calculateTotals(report);

console.log('\n' + '='.repeat(50) + '\n');

// Step 3: Verify results
console.log('✅ Final verification:');
console.log('Report has campaigns:', report.campaigns.length > 0);
console.log('Campaigns have data:', report.campaigns.every(c => c.spend > 0 || c.impressions > 0 || c.clicks > 0));
console.log('Totals are non-zero:', totals.spend > 0 || totals.impressions > 0 || totals.clicks > 0);

if (totals.spend > 0 || totals.impressions > 0 || totals.clicks > 0) {
  console.log('✅ SUCCESS: Data flow is working correctly!');
} else {
  console.log('❌ FAILURE: Data flow is not working correctly!');
} 