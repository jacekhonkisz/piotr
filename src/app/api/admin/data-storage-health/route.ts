import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CampaignDataHealth {
  clientId: string;
  clientName: string;
  period: string;
  summaryType: 'weekly' | 'monthly';
  totalSpend: number;
  campaignCount: number;
  hasCampaignData: boolean;
  status: 'healthy' | 'warning' | 'critical';
  issue?: string;
}

interface DataStorageHealthReport {
  timestamp: string;
  overall: {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    totalPeriods: number;
    healthyPeriods: number;
    issuesFound: number;
  };
  campaignDataIssues: {
    totalWithEmptyData: number;
    totalWithData: number;
    percentageHealthy: number;
    criticalIssue: boolean;
  };
  recentPeriods: CampaignDataHealth[];
  belmonteSpecific?: {
    periodsFound: number;
    emptyDataCount: number;
    lastMonthStatus: string;
    lastWeekStatus: string;
  };
  recommendations: string[];
}

/**
 * GET /api/admin/data-storage-health
 * 
 * Enhanced monitoring for data storage health, specifically tracking:
 * 1. Campaign detail completeness (campaign_data JSONB arrays)
 * 2. Historical data quality
 * 3. Belmonte Hotel specific metrics
 * 
 * Based on audit findings: CRITICAL ISSUE - campaign_data arrays are empty
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📊 Starting data storage health check...');

    // Get all recent campaign summaries (last 3 months)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    const { data: summaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select(`
        id,
        client_id,
        summary_type,
        summary_date,
        total_spend,
        campaign_data,
        clients (
          name
        )
      `)
      .gte('summary_date', threeMonthsAgo.toISOString().split('T')[0])
      .order('summary_date', { ascending: false })
      .limit(100);

    if (summariesError) {
      throw summariesError;
    }

    // Analyze campaign data completeness
    const recentPeriods: CampaignDataHealth[] = [];
    let totalWithEmptyData = 0;
    let totalWithData = 0;

    for (const summary of summaries || []) {
      const campaignData = summary.campaign_data as any[];
      const campaignCount = Array.isArray(campaignData) ? campaignData.length : 0;
      const hasCampaignData = campaignCount > 0;

      if (!hasCampaignData) {
        totalWithEmptyData++;
      } else {
        totalWithData++;
      }

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let issue: string | undefined;

      if (!hasCampaignData && summary.total_spend > 0) {
        status = 'critical';
        issue = `Campaign data is empty despite ${summary.total_spend} PLN spend - CRITICAL ISSUE`;
      } else if (!hasCampaignData) {
        status = 'warning';
        issue = 'Campaign data array is empty';
      }

      recentPeriods.push({
        clientId: summary.client_id,
        clientName: (summary.clients as any)?.name || 'Unknown',
        period: summary.summary_date,
        summaryType: summary.summary_type as 'weekly' | 'monthly',
        totalSpend: summary.total_spend,
        campaignCount,
        hasCampaignData,
        status,
        issue
      });
    }

    // Check Belmonte specifically (as per audit example)
    const { data: belmonteClient } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', '%belmonte%')
      .single();

    let belmonteSpecific;
    if (belmonteClient) {
      const belmonteSummaries = recentPeriods.filter(p => p.clientId === belmonteClient.id);
      const belmonteEmpty = belmonteSummaries.filter(p => !p.hasCampaignData).length;
      
      // Get last month and last week status
      const lastMonth = belmonteSummaries.find(p => p.summaryType === 'monthly');
      const lastWeek = belmonteSummaries.find(p => p.summaryType === 'weekly');

      belmonteSpecific = {
        periodsFound: belmonteSummaries.length,
        emptyDataCount: belmonteEmpty,
        lastMonthStatus: lastMonth 
          ? `${lastMonth.period} - ${lastMonth.campaignCount} campaigns (${lastMonth.status})`
          : 'Not found',
        lastWeekStatus: lastWeek
          ? `${lastWeek.period} - ${lastWeek.campaignCount} campaigns (${lastWeek.status})`
          : 'Not found'
      };
    }

    // Calculate overall health
    const totalPeriods = recentPeriods.length;
    const healthyPeriods = recentPeriods.filter(p => p.status === 'healthy').length;
    const issuesFound = recentPeriods.filter(p => p.status !== 'healthy').length;
    const percentageHealthy = totalPeriods > 0 ? (totalWithData / totalPeriods) * 100 : 0;

    let overallStatus: 'healthy' | 'warning' | 'critical';
    if (percentageHealthy >= 80) {
      overallStatus = 'healthy';
    } else if (percentageHealthy >= 50) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'critical';
    }

    const score = Math.round(percentageHealthy);

    // Generate recommendations based on findings
    const recommendations: string[] = [];
    
    if (totalWithEmptyData > 0) {
      recommendations.push(
        `🚨 CRITICAL: ${totalWithEmptyData} periods have empty campaign_data arrays despite having spend data`
      );
      recommendations.push(
        `Fix: Update src/lib/background-data-collector.ts:285 to store campaign_data: campaignInsights instead of empty array`
      );
      recommendations.push(
        `Impact: "Top 5 Campaigns" feature cannot work until campaign details are stored`
      );
    }

    if (percentageHealthy < 80) {
      recommendations.push(
        `⚠️ Only ${percentageHealthy.toFixed(1)}% of periods have complete campaign data - should be >80%`
      );
    }

    if (belmonteSpecific && belmonteSpecific.emptyDataCount > 0) {
      recommendations.push(
        `📊 Belmonte Hotel has ${belmonteSpecific.emptyDataCount} periods with missing campaign details`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ All campaign data is being stored correctly - system is healthy');
    }

    // Compile report
    const report: DataStorageHealthReport = {
      timestamp: new Date().toISOString(),
      overall: {
        status: overallStatus,
        score,
        totalPeriods,
        healthyPeriods,
        issuesFound
      },
      campaignDataIssues: {
        totalWithEmptyData,
        totalWithData,
        percentageHealthy,
        criticalIssue: totalWithEmptyData > 0
      },
      recentPeriods: recentPeriods.slice(0, 20), // Return only 20 most recent
      belmonteSpecific,
      recommendations
    };

    return NextResponse.json(report);

  } catch (error) {
    console.error('❌ Data storage health check error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check data storage health',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}





