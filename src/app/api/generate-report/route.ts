import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../lib/meta-api';
import logger from '../../../lib/logger';
import { performanceMonitor } from '../../../lib/performance';
import { validateDateRange } from '../../../lib/date-range-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('Report generation started', { endpoint: '/api/generate-report' });
    
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Create a new Supabase client with the user's access token
    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Get the user from the token
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      logger.error('Token verification failed', { error: authError?.message });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body first (can only be done once)
    const { clientId, dateRange } = await request.json();

    logger.info('📅 Generate Report - Received date range:', dateRange);
    logger.info('📅 Generate Report - Client ID:', clientId);
    logger.info('📅 Generate Report - Date range type:', typeof dateRange);
    logger.info('📅 Generate Report - Date range is null/undefined:', dateRange == null);
    logger.info('📅 Generate Report - Date range has start:', !!dateRange?.start);
    logger.info('📅 Generate Report - Date range has end:', !!dateRange?.end);
    logger.info('📅 Generate Report - Full request body:', JSON.stringify({ clientId, dateRange }, null, 2));

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'client' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get client data based on role
    let client: any = null;
    if (profile.role === 'client') {
      // Client accessing their own data
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user.email)
        .single();

      if (clientError || !clientData) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      client = clientData;
    } else if (profile.role === 'admin') {
      // Admin can access any client data, but we need to validate the clientId
      if (!clientId) {
        return NextResponse.json({ error: 'Client ID is required for admin access' }, { status: 400 });
      }
      
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError || !clientData) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
      client = clientData;
    }
    
    // For admin role, we already have the target client
    // For client role, targetClient is the same as client
    const targetClient = client;
    
    // Use provided date range or default to last 30 days
    const defaultEndDate = new Date().toISOString().split('T')[0] || '';
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
    
    const startDate = dateRange?.start || defaultStartDate;
    const endDate = dateRange?.end || defaultEndDate;
    
    // Validate the date range
    const validation = validateDateRange(startDate, endDate);
    if (!validation.isValid) {
      return NextResponse.json({ 
        error: 'Invalid date range', 
        details: validation.error 
      }, { status: 400 });
    }

    // Initialize Meta API service
    const metaService = new MetaAPIService(targetClient.meta_access_token);
    
    // Validate token
    const tokenValidation = await metaService.validateToken();
    if (!tokenValidation.valid) {
      return NextResponse.json({ 
        error: 'Invalid Meta Ads token', 
        details: tokenValidation.error 
      }, { status: 400 });
    }

    // Generate report
    const startTime = Date.now();
    
    // Ensure ad account ID has proper format (remove act_ prefix if present)
    const adAccountId = targetClient.ad_account_id.startsWith('act_') 
      ? targetClient.ad_account_id.substring(4) 
      : targetClient.ad_account_id;
      
    const report = await metaService.generateClientReport(
      adAccountId,
      startDate,
      endDate
    );
    const generationTime = Date.now() - startTime;

    // Fetch Meta Ads tables data for consistency across all report generation methods
    let metaTablesData: any = null;
    try {
      logger.info('🔍 Fetching Meta Ads tables data for report generation...');
      
      // Fetch placement performance
      const placementData = await metaService.getPlacementPerformance(targetClient.ad_account_id, startDate, endDate);
      logger.info('Success', placementData.length, 'records');
      
      // Fetch demographic performance
      const demographicData = await metaService.getDemographicPerformance(targetClient.ad_account_id, startDate, endDate);
      logger.info('Success', demographicData.length, 'records');
      
      // Fetch ad relevance results
      const adRelevanceData = await metaService.getAdRelevanceResults(targetClient.ad_account_id, startDate, endDate);
      logger.info('Success', adRelevanceData.length, 'records');
      
      metaTablesData = {
        placementPerformance: placementData,
        demographicPerformance: demographicData,
        adRelevanceResults: adRelevanceData
      };
      
      logger.info('✅ Meta Ads tables data fetched successfully for report generation');
    } catch (error) {
      logger.warn('Warning', error);
      // Continue without Meta tables data - this is not critical for report generation
    }

    // Store report in database
    const { data: reportRecord, error: reportError } = await supabase
      .from('reports')
      .insert({
        client_id: targetClient.id,
        date_range_start: startDate,
        date_range_end: endDate,
        generated_at: new Date().toISOString(),
        generation_time_ms: generationTime,
        email_sent: false,
        meta_tables: metaTablesData // Include Meta tables data in database
      })
      .select()
      .single();

    if (reportError) {
      console.error('Report save error:', reportError);
      
      // Check if it's a duplicate constraint violation
      if (reportError.code === '23505' && reportError.message.includes('reports_client_id_date_range_start_date_range_end_key')) {
        // Find the existing report
        const { data: existingReport, error: fetchError } = await supabase
          .from('reports')
          .select('*')
          .eq('client_id', targetClient.id)
          .eq('date_range_start', startDate)
          .eq('date_range_end', endDate)
          .single();
        
        if (fetchError || !existingReport) {
          return NextResponse.json({ 
            error: 'Report already exists but could not be retrieved',
            details: 'A report for this client and date range already exists, but there was an error retrieving it.',
            code: 'DUPLICATE_REPORT_FETCH_ERROR'
          }, { status: 409 });
        }
        
        // Get campaign data for the existing report - we need to check if the requested date range
        // is within the existing report's date range and filter accordingly
        const { data: allExistingCampaigns, error: campaignsError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('client_id', targetClient.id)
          .eq('date_range_start', existingReport.date_range_start)
          .eq('date_range_end', existingReport.date_range_end);
        
        if (campaignsError) {
          console.error('Error fetching existing campaigns:', campaignsError);
        }
        
        // Check if the requested date range is different from the existing report's date range
        const isDateRangeDifferent = startDate !== existingReport.date_range_start || endDate !== existingReport.date_range_end;
        
        let filteredCampaigns = allExistingCampaigns || [];
        
        if (isDateRangeDifferent) {
          console.log(`📅 Date range mismatch detected:`);
          console.log(`   - Requested: ${startDate} to ${endDate}`);
          console.log(`   - Existing: ${existingReport.date_range_start} to ${existingReport.date_range_end}`);
          console.log(`   - Need to generate new data for the specific date range`);
          
          // If the date ranges don't match, we need to generate new data for the specific period
          // This means we should NOT return existing data, but instead generate fresh data
          const metaService = new MetaAPIService(targetClient.meta_access_token);
          
          // Ensure ad account ID has proper format
          const adAccountId = targetClient.ad_account_id.startsWith('act_') 
            ? targetClient.ad_account_id.substring(4) 
            : targetClient.ad_account_id;
          
          // Generate fresh report for the specific date range
          const freshReport = await metaService.generateClientReport(
            adAccountId,
            startDate,
            endDate
          );
          
          // Fetch Meta Ads tables data for the fresh report
          let freshMetaTablesData: any = null;
          try {
            logger.info('🔍 Fetching Meta Ads tables data for fresh report...');
            
            const placementData = await metaService.getPlacementPerformance(targetClient.ad_account_id, startDate, endDate);
            const demographicData = await metaService.getDemographicPerformance(targetClient.ad_account_id, startDate, endDate);
            const adRelevanceData = await metaService.getAdRelevanceResults(targetClient.ad_account_id, startDate, endDate);
            
            freshMetaTablesData = {
              placementPerformance: placementData,
              demographicPerformance: demographicData,
              adRelevanceResults: adRelevanceData
            };
            
            logger.info('✅ Meta Ads tables data fetched successfully for fresh report');
          } catch (error) {
            logger.warn('Warning', error);
          }
          
          // Store the new report
          const { data: newReportRecord, error: newReportError } = await supabase
            .from('reports')
            .insert({
              client_id: targetClient.id,
              date_range_start: startDate,
              date_range_end: endDate,
              generated_at: new Date().toISOString(),
              generation_time_ms: 0, // We don't track time for this case
              email_sent: false
            })
            .select()
            .single();
          
          if (newReportError) {
            console.error('Error saving new report:', newReportError);
            return NextResponse.json({ 
              error: 'Failed to save new report',
              details: newReportError.message
            }, { status: 500 });
          }
          
          // Store campaign data for the new report
          if (freshReport.campaigns.length > 0) {
            const campaignData = freshReport.campaigns.map(campaign => ({
              client_id: targetClient.id,
              campaign_id: campaign.campaign_id,
              campaign_name: campaign.campaign_name,
              date_range_start: startDate,
              date_range_end: endDate,
              impressions: campaign.impressions,
              clicks: campaign.clicks,
              spend: campaign.spend,
              conversions: campaign.conversions,
              ctr: campaign.ctr,
              cpc: campaign.cpc,
              cpp: campaign.cpp,
              frequency: campaign.frequency,
              reach: campaign.reach,
              status: 'ACTIVE',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));
            
            const { error: campaignError } = await supabase
              .from('campaigns')
              .insert(campaignData);
            
            if (campaignError) {
              console.error('Error saving new campaigns:', campaignError);
            }
          }
          
          // Update client's last report date
          await supabase
            .from('clients')
            .update({ last_report_date: new Date().toISOString() })
            .eq('id', targetClient.id);
          
          return NextResponse.json({
            success: true,
            report: {
              id: newReportRecord.id,
              date_range: freshReport.date_range,
              generated_at: freshReport.generated_at,
              generation_time_ms: 0,
              account_summary: freshReport.account_summary,
              campaign_count: freshReport.campaigns.length,
              is_existing: false,
              meta_tables: freshMetaTablesData
            }
          });
        }
        
        // If date ranges match, use the existing data
        const totalSpend = filteredCampaigns.reduce((sum, campaign) => sum + parseFloat(campaign.spend || 0), 0);
        const totalImpressions = filteredCampaigns.reduce((sum, campaign) => sum + parseInt(campaign.impressions || 0), 0);
        const totalClicks = filteredCampaigns.reduce((sum, campaign) => sum + parseInt(campaign.clicks || 0), 0);
        const totalConversions = filteredCampaigns.reduce((sum, campaign) => sum + parseInt(campaign.conversions || 0), 0);
        
        const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const averageCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
        
        const accountSummary = {
          total_spend: totalSpend,
          total_impressions: totalImpressions,
          total_clicks: totalClicks,
          total_conversions: totalConversions,
          average_ctr: averageCtr,
          average_cpc: averageCpc,
          average_cpa: averageCpa,
          active_campaigns: filteredCampaigns.filter(c => c.status === 'ACTIVE').length,
          total_campaigns: filteredCampaigns.length,
        };
        
        return NextResponse.json({
          success: true,
          report: {
            id: existingReport.id,
            date_range: {
              start: existingReport.date_range_start,
              end: existingReport.date_range_end,
            },
            generated_at: existingReport.generated_at,
            generation_time_ms: existingReport.generation_time_ms || 0,
            account_summary: accountSummary,
            campaign_count: filteredCampaigns.length,
            is_existing: true,
            meta_tables: metaTablesData
          }
        });
      }
      
      return NextResponse.json({ 
        error: 'Failed to save report',
        details: reportError.message
      }, { status: 500 });
    }

    // Store campaign data
    if (report.campaigns.length > 0) {
      const campaignData = report.campaigns.map(campaign => ({
        client_id: targetClient.id,
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        date_range_start: startDate,
        date_range_end: endDate,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        spend: campaign.spend,
        conversions: campaign.conversions,
        ctr: campaign.ctr,
        cpc: campaign.cpc,
        cpp: campaign.cpp,
        frequency: campaign.frequency,
        reach: campaign.reach,
        status: 'ACTIVE', // We'll need to get this from Meta API
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignData);

      if (campaignError) {
        logger.error('Error saving campaigns', { error: campaignError.message });
      }
    }

    // Update client's last report date
    await supabase
      .from('clients')
      .update({ last_report_date: new Date().toISOString() })
      .eq('id', targetClient.id);

    const responseTime = Date.now() - startTime;
    performanceMonitor.recordAPICall('generate-report', responseTime);
    
    logger.info('Report generation completed successfully', {
      clientId: targetClient.id,
      reportId: reportRecord.id,
      responseTime,
      campaignCount: report.campaigns.length
    });
    
    return NextResponse.json({
      success: true,
      report: {
        id: reportRecord.id,
        date_range: report.date_range,
        generated_at: report.generated_at,
        generation_time_ms: generationTime,
        account_summary: report.account_summary,
        campaign_count: report.campaigns.length,
        meta_tables: metaTablesData
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Report generation failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      responseTime
    });
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 