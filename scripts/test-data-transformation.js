// Test script to verify data transformation logic

// Simulate API response structure
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

// Simulate the transformation logic
const transformCampaigns = (rawCampaigns) => {
  return rawCampaigns.map((campaign, index) => ({
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
};

console.log('Testing data transformation...');
console.log('Original API response:', JSON.stringify(mockApiResponse, null, 2));

const rawCampaigns = mockApiResponse.data?.campaigns || mockApiResponse.campaigns || [];
console.log('\nRaw campaigns:', rawCampaigns);

const transformedCampaigns = transformCampaigns(rawCampaigns);
console.log('\nTransformed campaigns:', JSON.stringify(transformedCampaigns, null, 2));

// Test totals calculation
const totals = transformedCampaigns.reduce((acc, campaign) => {
  acc.totalSpend += campaign.spend;
  acc.totalImpressions += campaign.impressions;
  acc.totalClicks += campaign.clicks;
  acc.totalConversions += campaign.conversions;
  return acc;
}, { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalConversions: 0 });

console.log('\nCalculated totals:', totals);

// Test if any values are zero when they shouldn't be
const zeroValues = transformedCampaigns.filter(campaign => 
  campaign.spend === 0 && campaign.impressions === 0 && campaign.clicks === 0
);

if (zeroValues.length > 0) {
  console.log('\n⚠️ WARNING: Found campaigns with all zero values:', zeroValues);
} else {
  console.log('\n✅ All campaigns have non-zero values');
} 