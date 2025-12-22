import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, canAccessClient, createErrorResponse } from '../../../lib/auth-middleware';
import logger from '../../../lib/logger';
import { MetaAPIService } from '../../../lib/meta-api-optimized';
import { GoogleAdsAPIService } from '../../../lib/google-ads-api';
import { enhanceCampaignsWithConversions } from '../../../lib/meta-actions-parser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    logger.info('Platform separated metrics fetch started');
    
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return createErrorResponse(authResult.error || 'Authentication failed', authResult.statusCode || 401);
    }

    const { user } = authResult;
    
    // Parse request body
    const { clientId, dateRange } = await request.json();
    
    if (!clientId) {
      return createErrorResponse('Client ID required', 400);
    }
    
    if (!dateRange?.start || !dateRange?.end) {
      return createErrorResponse('Date range with start and end dates is required', 400);
    }
    
    // Get client data
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
      
    if (clientError || !clientData) {
      return createErrorResponse('Client not found', 404);
    }
    
    // Check access
    if (!canAccessClient(user, clientData.email)) {
      return createErrorResponse('Access denied', 403);
    }

    const { start: startDate, end: endDate } = dateRange;
    
    // Fetch Meta data directly using MetaAPIService
    let metaData = null;
    let metaError = null;
    
    // ✅ FIX: Check for EITHER system_user_token OR meta_access_token
    const metaToken = clientData.system_user_token || clientData.meta_access_token;
    if (metaToken && clientData.ad_account_id) {
      try {
        logger.info('📊 Fetching Meta-only data directly...');
        
        // ✅ FIX: Use system_user_token if available, otherwise use meta_access_token
        const metaService = new MetaAPIService(metaToken);
        
        // Validate token
        const tokenValidation = await metaService.validateToken();
        if (!tokenValidation.valid) {
          metaError = `Invalid Meta token: ${tokenValidation.error}`;
        } else {
          // Get ad account ID
          const adAccountId = clientData.ad_account_id.startsWith('act_') 
            ? clientData.ad_account_id.substring(4) 
            : clientData.ad_account_id;
          
          // Fetch campaign insights
          const rawCampaigns = await metaService.getCampaignInsights(
            adAccountId,
            startDate,
            endDate,
            0 // No time increment
          );
          
          // ✅ Parse campaigns with conversion metrics from action_values
          // This extracts "Zakupy w witrynie - wartość konwersji" directly from API
          const campaigns = enhanceCampaignsWithConversions(rawCampaigns);
          
          // Calculate stats
          const totalSpend = campaigns.reduce((sum: number, c: any) => sum + parseFloat(c.spend || 0), 0);
          const totalImpressions = campaigns.reduce((sum: number, c: any) => sum + parseInt(c.impressions || 0), 0);
          const totalClicks = campaigns.reduce((sum: number, c: any) => sum + parseInt(c.clicks || 0), 0);
          const totalConversions = campaigns.reduce((sum: number, c: any) => sum + parseFloat(c.conversions || 0), 0);
          const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
          const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
          
          // ✅ Conversion metrics - direct from API action_values (no calculation)
          const totalReservationValue = campaigns.reduce((sum: number, c: any) => sum + (c.reservation_value || 0), 0);
          const totalReservations = campaigns.reduce((sum: number, c: any) => sum + (c.reservations || 0), 0);
          
          const conversionMetrics = {
            click_to_call: campaigns.reduce((sum: number, c: any) => sum + (c.click_to_call || 0), 0),
            email_contacts: campaigns.reduce((sum: number, c: any) => sum + (c.email_contacts || 0), 0),
            booking_step_1: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_1 || 0), 0),
            booking_step_2: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_2 || 0), 0),
            booking_step_3: campaigns.reduce((sum: number, c: any) => sum + (c.booking_step_3 || 0), 0),
            reservations: totalReservations,
            reservation_value: totalReservationValue,
            // ✅ Direct from API - "Zakupy w witrynie - wartość konwersji"
            conversion_value: totalReservationValue,
            total_conversion_value: totalReservationValue,
            roas: totalSpend > 0 && totalReservationValue > 0 ? totalReservationValue / totalSpend : 0,
            cost_per_reservation: totalReservations > 0 ? totalSpend / totalReservations : 0
          };
          
          logger.info('📊 Meta conversion metrics from API (action_values):', {
            totalSpend,
            totalReservationValue,
            totalReservations,
            roas: conversionMetrics.roas,
            source: 'action_values_direct'
          });
          
          metaData = {
            campaigns,
            stats: {
              totalSpend,
              totalImpressions,
              totalClicks,
              totalConversions,
              averageCtr,
              averageCpc
            },
            conversionMetrics,
            dateRange: { start: startDate, end: endDate },
            fromDatabase: false,
            platform: 'meta'
          };
          
          logger.info('✅ Meta data fetched successfully');
        }
      } catch (error) {
        logger.error('❌ Error fetching Meta data:', error);
        metaError = error instanceof Error ? error.message : 'Unknown Meta error';
      }
    }
    
    // Fetch Google Ads data directly using GoogleAdsAPIService
    let googleData = null;
    let googleError = null;
    
    if (clientData.google_ads_enabled && clientData.google_ads_customer_id) {
      try {
        logger.info('📊 Fetching Google Ads-only data directly...');
        
        // Get Google Ads system settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('system_settings')
          .select('key, value')
          .in('key', [
            'google_ads_client_id', 
            'google_ads_client_secret', 
            'google_ads_developer_token',
            'google_ads_manager_refresh_token',
            'google_ads_manager_customer_id'
          ]);

        if (settingsError || !settingsData) {
          googleError = 'Google Ads system configuration not found';
        } else {
          const settings = settingsData.reduce((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
          }, {} as Record<string, any>);

          // Prefer manager refresh token
          const refreshToken = settings.google_ads_manager_refresh_token || clientData.google_ads_refresh_token;
          
          if (!refreshToken) {
            googleError = 'Google Ads refresh token not found';
          } else {
            const googleAdsCredentials = {
              refreshToken,
              clientId: settings.google_ads_client_id,
              clientSecret: settings.google_ads_client_secret,
              developmentToken: settings.google_ads_developer_token,
              customerId: clientData.google_ads_customer_id,
              managerCustomerId: settings.google_ads_manager_customer_id,
            };

            const googleAdsService = new GoogleAdsAPIService(googleAdsCredentials);
            
            // Validate credentials
            const validation = await googleAdsService.validateCredentials();
            if (!validation.valid) {
              googleError = `Google Ads credentials invalid: ${validation.error}`;
            } else {
              // Fetch campaign data
              const campaigns = await googleAdsService.getCampaignData(startDate, endDate);
              
              // Calculate stats
              const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
              const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
              const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
              const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
              const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
              const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
              
              // Get real conversion metrics from daily_kpi_data
              const { data: dailyKpiData } = await supabase
                .from('daily_kpi_data')
                .select('*')
                .eq('client_id', clientId)
                .eq('platform', 'google')
                .gte('date', startDate)
                .lte('date', endDate);

              let conversionMetrics = {
                click_to_call: 0,
                email_contacts: 0,
                booking_step_1: 0,
                booking_step_2: 0,
                booking_step_3: 0,
                reservations: 0,
                reservation_value: 0,
                roas: 0,
                cost_per_reservation: 0
              };

              if (dailyKpiData && dailyKpiData.length > 0) {
                conversionMetrics = {
                  click_to_call: dailyKpiData.reduce((sum, day) => sum + (day.click_to_call || 0), 0),
                  email_contacts: dailyKpiData.reduce((sum, day) => sum + (day.email_contacts || 0), 0),
                  booking_step_1: dailyKpiData.reduce((sum, day) => sum + (day.booking_step_1 || 0), 0),
                  booking_step_2: dailyKpiData.reduce((sum, day) => sum + (day.booking_step_2 || 0), 0),
                  booking_step_3: dailyKpiData.reduce((sum, day) => sum + (day.booking_step_3 || 0), 0),
                  reservations: dailyKpiData.reduce((sum, day) => sum + (day.reservations || 0), 0),
                  reservation_value: dailyKpiData.reduce((sum, day) => sum + (day.reservation_value || 0), 0),
                  roas: totalSpend > 0 ? dailyKpiData.reduce((sum, day) => sum + (day.reservation_value || 0), 0) / totalSpend : 0,
                  cost_per_reservation: dailyKpiData.reduce((sum, day) => sum + (day.reservations || 0), 0) > 0 ? 
                    totalSpend / dailyKpiData.reduce((sum, day) => sum + (day.reservations || 0), 0) : 0
                };
              }
              
              googleData = {
                campaigns,
                stats: {
                  totalSpend,
                  totalImpressions,
                  totalClicks,
                  totalConversions,
                  averageCtr,
                  averageCpc
                },
                conversionMetrics,
                dateRange: { start: startDate, end: endDate },
                fromDatabase: false,
                platform: 'google'
              };
              
              logger.info('✅ Google Ads data fetched successfully');
            }
          }
        }
      } catch (error) {
        logger.error('❌ Error fetching Google Ads data:', error);
        googleError = error instanceof Error ? error.message : 'Unknown Google Ads error';
      }
    }
    
    // Structure the response with separated platform data
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      data: {
        dateRange: { start: startDate, end: endDate },
        platforms: {
          meta: {
            enabled: !!(clientData.meta_access_token && clientData.ad_account_id),
            data: metaData,
            error: metaError,
            stats: metaData?.stats || {
              totalSpend: 0,
              totalImpressions: 0,
              totalClicks: 0,
              totalConversions: 0,
              averageCtr: 0,
              averageCpc: 0
            },
            conversionMetrics: metaData?.conversionMetrics || {
              click_to_call: 0,
              email_contacts: 0,
              booking_step_1: 0,
              booking_step_2: 0,
              booking_step_3: 0,
              reservations: 0,
              reservation_value: 0,
              roas: 0,
              cost_per_reservation: 0
            },
            campaigns: metaData?.campaigns || []
          },
          google: {
            enabled: !!(clientData.google_ads_enabled && clientData.google_ads_customer_id),
            data: googleData,
            error: googleError,
            stats: googleData?.stats || {
              totalSpend: 0,
              totalImpressions: 0,
              totalClicks: 0,
              totalConversions: 0,
              averageCtr: 0,
              averageCpc: 0
            },
            conversionMetrics: googleData?.conversionMetrics || {
              click_to_call: 0,
              email_contacts: 0,
              booking_step_1: 0,
              booking_step_2: 0,
              booking_step_3: 0,
              reservations: 0,
              reservation_value: 0,
              roas: 0,
              cost_per_reservation: 0
            },
            campaigns: googleData?.campaigns || []
          }
        },
        // Combined totals for convenience
        combined: (() => {
          const combinedStats = {
            totalSpend: (metaData?.stats?.totalSpend || 0) + (googleData?.stats?.totalSpend || 0),
            totalImpressions: (metaData?.stats?.totalImpressions || 0) + (googleData?.stats?.totalImpressions || 0),
            totalClicks: (metaData?.stats?.totalClicks || 0) + (googleData?.stats?.totalClicks || 0),
            totalConversions: (metaData?.stats?.totalConversions || 0) + (googleData?.stats?.totalConversions || 0),
            averageCtr: 0,
            averageCpc: 0
          };
          
          // Calculate weighted averages
          combinedStats.averageCtr = combinedStats.totalImpressions > 0 ? 
            (combinedStats.totalClicks / combinedStats.totalImpressions) * 100 : 0;
          combinedStats.averageCpc = combinedStats.totalClicks > 0 ? 
            combinedStats.totalSpend / combinedStats.totalClicks : 0;
          
          const combinedConversionMetrics = {
            click_to_call: (metaData?.conversionMetrics?.click_to_call || 0) + (googleData?.conversionMetrics?.click_to_call || 0),
            email_contacts: (metaData?.conversionMetrics?.email_contacts || 0) + (googleData?.conversionMetrics?.email_contacts || 0),
            booking_step_1: (metaData?.conversionMetrics?.booking_step_1 || 0) + (googleData?.conversionMetrics?.booking_step_1 || 0),
            booking_step_2: (metaData?.conversionMetrics?.booking_step_2 || 0) + (googleData?.conversionMetrics?.booking_step_2 || 0),
            booking_step_3: (metaData?.conversionMetrics?.booking_step_3 || 0) + (googleData?.conversionMetrics?.booking_step_3 || 0),
            reservations: (metaData?.conversionMetrics?.reservations || 0) + (googleData?.conversionMetrics?.reservations || 0),
            reservation_value: (metaData?.conversionMetrics?.reservation_value || 0) + (googleData?.conversionMetrics?.reservation_value || 0),
            roas: 0,
            cost_per_reservation: 0
          };
          
          // Calculate derived metrics
          combinedConversionMetrics.roas = combinedStats.totalSpend > 0 ? 
            combinedConversionMetrics.reservation_value / combinedStats.totalSpend : 0;
          combinedConversionMetrics.cost_per_reservation = combinedConversionMetrics.reservations > 0 ? 
            combinedStats.totalSpend / combinedConversionMetrics.reservations : 0;
          
          return {
            stats: combinedStats,
            conversionMetrics: combinedConversionMetrics
          };
        })()
      },
      responseTime,
      debug: {
        metaEnabled: !!(clientData.meta_access_token && clientData.ad_account_id),
        googleEnabled: !!(clientData.google_ads_enabled && clientData.google_ads_customer_id),
        metaError,
        googleError
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Platform separated metrics fetch failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
