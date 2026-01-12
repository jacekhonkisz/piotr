import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const results: any = {};
  
  // Check current month cache
  const { data: cacheData } = await supabase
    .from('google_ads_current_month_cache')
    .select('cache_data, period_id')
    .limit(1)
    .single();
    
  if (cacheData?.cache_data?.campaigns) {
    const sample = cacheData.cache_data.campaigns[0];
    results.cache = {
      totalCampaigns: cacheData.cache_data.campaigns.length,
      periodId: cacheData.period_id,
      sampleCampaign: {
        keys: Object.keys(sample),
        campaignName: sample.campaignName,
        campaign_name: sample.campaign_name,
        name: sample.name,
        campaignId: sample.campaignId,
        campaign_id: sample.campaign_id
      },
      // Show 3 samples to see if there's variation
      first3: cacheData.cache_data.campaigns.slice(0, 3).map((c: any) => ({
        campaignName: c.campaignName,
        campaignId: c.campaignId
      }))
    };
  }
  
  // Check campaign_summaries from multiple periods
  const { data: allSummaries } = await supabase
    .from('campaign_summaries')
    .select('campaign_data, summary_date, summary_type')
    .eq('platform', 'google')
    .order('summary_date', { ascending: false })
    .limit(5);
    
  results.summariesByPeriod = {};
  
  if (allSummaries && allSummaries.length > 0) {
    allSummaries.forEach((summary: any) => {
      const key = `${summary.summary_date}_${summary.summary_type}`;
      if (summary.campaign_data && summary.campaign_data.length > 0) {
        results.summariesByPeriod[key] = {
          summaryDate: summary.summary_date,
          summaryType: summary.summary_type,
          totalCampaigns: summary.campaign_data.length,
          first3: summary.campaign_data.slice(0, 3).map((c: any) => ({
            campaignName: c.campaignName,
            campaign_name: c.campaign_name,
            name: c.name,
            campaignId: c.campaignId,
            allKeys: Object.keys(c)
          }))
        };
      }
    });
  }
  
  // Also check google_ads_campaigns table directly
  const { data: directCampaigns } = await supabase
    .from('google_ads_campaigns')
    .select('campaign_name, campaign_id, date_range_start')
    .order('date_range_start', { ascending: false })
    .limit(5);
    
  if (directCampaigns && directCampaigns.length > 0) {
    results.googleAdsCampaignsTable = {
      first5: directCampaigns.map((c: any) => ({
        campaign_name: c.campaign_name,
        campaign_id: c.campaign_id,
        date_range_start: c.date_range_start
      }))
    };
  }
  
  // Search for the suspicious short campaign names
  const { data: shortNameCheck } = await supabase
    .from('google_ads_campaigns')
    .select('campaign_name, campaign_id, date_range_start')
    .or('campaign_name.eq.Wielkanoc,campaign_name.eq.Majówka 2016,campaign_name.eq.Kampania LATO,campaign_name.ilike.%Wielkanoc%')
    .limit(10);
    
  results.shortNameSearch = shortNameCheck || [];
  
  // Check ALL summaries for short campaign names
  const { data: allGoogleSummaries } = await supabase
    .from('campaign_summaries')
    .select('campaign_data, summary_date, summary_type, client_id')
    .eq('platform', 'google')
    .order('summary_date', { ascending: false })
    .limit(20);
    
  results.shortNamesInSummaries = [];
  if (allGoogleSummaries) {
    allGoogleSummaries.forEach((summary: any) => {
      if (summary.campaign_data && Array.isArray(summary.campaign_data)) {
        summary.campaign_data.forEach((c: any) => {
          const name = c.campaignName || c.campaign_name || c.name;
          // Check for short names (less than 20 chars and not starting with [PBM])
          if (name && name.length < 25 && !name.startsWith('[PBM]')) {
            results.shortNamesInSummaries.push({
              summaryDate: summary.summary_date,
              summaryType: summary.summary_type,
              clientId: summary.client_id,
              campaignName: name,
              campaignId: c.campaignId || c.campaign_id
            });
          }
        });
      }
    });
  }
  
  return NextResponse.json(results, { status: 200 });
}

