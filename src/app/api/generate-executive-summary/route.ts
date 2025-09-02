import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ExecutiveSummaryCacheService } from '../../../lib/executive-summary-cache';
import logger from '../../../lib/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ExecutiveSummaryData {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  averageCpa: number;
  currency: string;
  dateRange: {
    start: string;
    end: string;
  };
  clientName: string;
  // Conversion tracking data (if available)
  reservations?: number;
  reservationValue?: number;
  roas?: number;
  microConversions?: number;
  costPerReservation?: number;
  yearOverYearComparison?: {
    reservationValue: number;
    percentageChange: number;
  };
  estimatedOfflineImpact?: number;
  // Platform attribution
  platformAttribution?: string;
  platformSources?: string[];
  platformBreakdown?: {
    meta?: {
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
    };
    google?: {
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { clientId, dateRange, reportData } = await request.json();

    if (!clientId || !dateRange) {
      return NextResponse.json({ 
        error: 'Missing required parameters: clientId, dateRange' 
      }, { status: 400 });
    }

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch data from smart cache/database instead of relying on passed data
    let actualReportData;
    let kpiData: any[] = [];
    
    if (reportData && reportData.account_summary) {
      // If reportData is provided and has valid data, use it
      actualReportData = reportData;
      logger.info('📊 Using provided report data for AI summary');
    } else {
      // Fetch data from the same source as reports (smart cache/database)
      logger.info('📊 Fetching data from smart cache for AI summary...');
      
      try {
        // Import the smart cache helper
        const { getUnifiedSmartCacheData } = await import('../../../lib/unified-smart-cache-helper');
        
        // Determine if this is current month to use smart cache
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const isCurrentMonth = dateRange.start.startsWith(currentMonth);
        
        if (isCurrentMonth) {
          // Use smart cache for current month
          const cacheResult = await getUnifiedSmartCacheData(clientId, false);
          
          // Extract platform-specific data
          const metaStats = cacheResult.data.meta?.stats || {};
          const googleStats = cacheResult.data.googleAds?.stats || {};
          
          actualReportData = {
            account_summary: {
              total_spend: cacheResult.data.combined?.totalSpend || 0,
              total_impressions: cacheResult.data.combined?.totalImpressions || 0,
              total_clicks: cacheResult.data.combined?.totalClicks || 0,
              total_conversions: cacheResult.data.combined?.totalConversions || 0,
              average_ctr: cacheResult.data.combined?.averageCtr || 0,
              average_cpc: cacheResult.data.combined?.averageCpc || 0,
              average_cpa: cacheResult.data.combined?.totalConversions > 0 ? 
                (cacheResult.data.combined.totalSpend / cacheResult.data.combined.totalConversions) : 0,
              total_conversion_value: 0,
              roas: 0,
              micro_conversions: 0,
              // Add platform-specific breakdown
              meta_spend: metaStats.totalSpend || 0,
              meta_impressions: metaStats.totalImpressions || 0,
              meta_clicks: metaStats.totalClicks || 0,
              meta_conversions: metaStats.totalConversions || 0,
              google_spend: googleStats.totalSpend || 0,
              google_impressions: googleStats.totalImpressions || 0,
              google_clicks: googleStats.totalClicks || 0,
              google_conversions: googleStats.totalConversions || 0
            }
          };
          
          logger.info('✅ Fetched data from smart cache:', {
            spend: actualReportData.account_summary.total_spend,
            impressions: actualReportData.account_summary.total_impressions,
            metaSpend: actualReportData.account_summary.meta_spend,
            googleSpend: actualReportData.account_summary.google_spend,
            source: cacheResult.source
          });
        } else {
          // For historical data, fetch from database
          const { data: fetchedKpiData, error: kpiError } = await supabase
            .from('daily_kpi_data')
            .select('*')
            .eq('client_id', clientId)
            .gte('date', dateRange.start)
            .lte('date', dateRange.end);
            
          if (kpiError) {
            throw new Error(`Failed to fetch historical data: ${kpiError.message}`);
          }
          
          kpiData = fetchedKpiData || [];
          
          // Calculate totals from KPI data
          const totals = kpiData.reduce((acc, day) => ({
            spend: acc.spend + (day.total_spend || 0),
            impressions: acc.impressions + (day.total_impressions || 0),
            clicks: acc.clicks + (day.total_clicks || 0),
            conversions: acc.conversions + (day.total_conversions || 0)
          }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });
          
          actualReportData = {
            account_summary: {
              total_spend: totals.spend,
              total_impressions: totals.impressions,
              total_clicks: totals.clicks,
              total_conversions: totals.conversions,
              average_ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
              average_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
              average_cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
              total_conversion_value: 0,
              roas: 0,
              micro_conversions: 0
            }
          };
          
          logger.info('✅ Fetched historical data from database:', {
            spend: totals.spend,
            impressions: totals.impressions,
            records: kpiData.length
          });
        }
      } catch (error) {
        logger.error('❌ Failed to fetch data for AI summary:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch report data for AI summary generation'
        }, { status: 500 });
      }
    }

    // Validate that we have actual data
    const hasValidData = actualReportData?.account_summary?.total_spend > 0 || 
                        actualReportData?.account_summary?.total_impressions > 0 || 
                        actualReportData?.account_summary?.total_clicks > 0;
    
    if (!hasValidData) {
      logger.warn('⚠️ No valid data found for AI summary generation', {
        clientId,
        dateRange,
        data: actualReportData?.account_summary
      });
      
      return NextResponse.json({
        success: false,
        error: 'No advertising data found for the specified period. AI summary cannot be generated without campaign data.'
      }, { status: 400 });
    }

    // Detect platform sources for attribution
    let platformAttribution = 'kampanie reklamowe'; // default generic
    let platformSources: string[] = [];
    let platformBreakdown: any = null;
    
    // Check if we have platform-specific data in actualReportData
    const metaSpend = actualReportData.account_summary?.meta_spend || 0;
    const googleSpend = actualReportData.account_summary?.google_spend || 0;
    const hasMetaData = metaSpend > 0 || (actualReportData.account_summary?.meta_impressions || 0) > 0;
    const hasGoogleData = googleSpend > 0 || (actualReportData.account_summary?.google_impressions || 0) > 0;
    
    if (hasMetaData || hasGoogleData) {
      // We have platform-specific data from smart cache
      if (hasMetaData && hasGoogleData) {
        platformAttribution = 'kampanie Meta Ads i Google Ads';
        platformSources = ['meta', 'google'];
        platformBreakdown = {
          meta: {
            spend: actualReportData.account_summary.meta_spend || 0,
            impressions: actualReportData.account_summary.meta_impressions || 0,
            clicks: actualReportData.account_summary.meta_clicks || 0,
            conversions: actualReportData.account_summary.meta_conversions || 0
          },
          google: {
            spend: actualReportData.account_summary.google_spend || 0,
            impressions: actualReportData.account_summary.google_impressions || 0,
            clicks: actualReportData.account_summary.google_clicks || 0,
            conversions: actualReportData.account_summary.google_conversions || 0
          }
        };
      } else if (hasMetaData) {
        platformAttribution = 'kampanie Meta Ads';
        platformSources = ['meta'];
      } else if (hasGoogleData) {
        platformAttribution = 'kampanie Google Ads';
        platformSources = ['google'];
      }
      
      logger.info('📊 Platform attribution from smart cache data:', {
        attribution: platformAttribution,
        hasMetaData,
        hasGoogleData,
        metaSpend,
        googleSpend
      });
    } else if (kpiData && kpiData.length > 0) {
      // Fallback to analyzing data sources from KPI data
      const sources = [...new Set(kpiData.map((day: any) => day.data_source))];
      const hasMetaSource = sources.some((s: string) => s && s.includes('meta'));
      const hasGoogleSource = sources.some((s: string) => s && s.includes('google'));
      
      if (hasMetaSource && hasGoogleSource) {
        platformAttribution = 'kampanie Meta Ads i Google Ads';
        platformSources = ['meta', 'google'];
      } else if (hasMetaSource) {
        platformAttribution = 'kampanie Meta Ads';
        platformSources = ['meta'];
      } else if (hasGoogleSource) {
        platformAttribution = 'kampanie Google Ads';
        platformSources = ['google'];
      }
      
      logger.info('📊 Platform attribution from KPI data sources:', {
        sources,
        attribution: platformAttribution,
        hasMetaSource,
        hasGoogleSource
      });
    }

    // If no platform data detected, skip AI summary generation
    if (platformSources.length === 0) {
      logger.info('⚠️ No platform data detected - skipping AI summary generation');
      return NextResponse.json({
        success: false,
        error: 'No platform data available for AI summary generation',
        skipSummary: true
      }, { status: 400 });
    }

    // Prepare data for AI summary
    const summaryData: ExecutiveSummaryData = {
      totalSpend: actualReportData.account_summary?.total_spend || 0,
      totalImpressions: actualReportData.account_summary?.total_impressions || 0,
      totalClicks: actualReportData.account_summary?.total_clicks || 0,
      totalConversions: actualReportData.account_summary?.total_conversions || 0,
      averageCtr: actualReportData.account_summary?.average_ctr || 0,
      averageCpc: actualReportData.account_summary?.average_cpc || 0,
      averageCpa: actualReportData.account_summary?.average_cpa || 0,
      currency: 'PLN', // Hardcoded to PLN for Polish market
      dateRange: dateRange,
      clientName: client.name,
      // Extract conversion tracking data if available
      reservations: actualReportData.account_summary?.total_conversions || 0,
      reservationValue: actualReportData.account_summary?.total_conversion_value || 0,
      roas: actualReportData.account_summary?.roas || 0,
      microConversions: actualReportData.account_summary?.micro_conversions || 0,
      costPerReservation: actualReportData.account_summary?.average_cpa || 0,
      // Add platform attribution
      platformAttribution: platformAttribution,
      platformSources: platformSources,
      platformBreakdown: platformBreakdown
    };

    // Generate AI summary using OpenAI
    const aiSummary = await generateAISummary(summaryData);

    // If OpenAI failed, return error response
    if (!aiSummary) {
      return NextResponse.json({
        success: false,
        error: 'Failed to generate AI summary - OpenAI service unavailable'
      }, { status: 503 });
    }

    // Save to cache if within retention period (12 months)
    const cacheService = ExecutiveSummaryCacheService.getInstance();
    if (cacheService.isWithinRetentionPeriod(dateRange)) {
      await cacheService.saveSummary(clientId, dateRange, aiSummary);
      logger.info('💾 Saved AI Executive Summary to cache');
    } else {
      logger.info('⚠️ Summary not saved to cache (outside 12-month retention period)');
    }

    return NextResponse.json({
      success: true,
      summary: aiSummary
    });

  } catch (error) {
    console.error('Error generating executive summary:', error);
    return NextResponse.json({ 
      error: 'Failed to generate executive summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function generateAISummary(data: ExecutiveSummaryData): Promise<string | null> {
  try {
    // Format numbers for Polish locale
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: data.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    };

    const formatNumber = (num: number) => {
      return new Intl.NumberFormat('pl-PL').format(num);
    };

    const formatPercentage = (num: number) => {
      return new Intl.NumberFormat('pl-PL', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num / 100);
    };

    // Format date range for Polish locale
    const formatDateRange = (start: string, end: string) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const monthNames = [
        'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
        'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
      ];
      
      const startMonth = monthNames[startDate.getMonth()];
      const endMonth = monthNames[endDate.getMonth()];
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      
      if (startYear === endYear && startDate.getMonth() === endDate.getMonth()) {
        return `${startDate.getDate()}-${endDate.getDate()} ${startMonth} ${startYear}`;
      } else if (startYear === endYear) {
        return `${startDate.getDate()} ${startMonth} - ${endDate.getDate()} ${endMonth} ${startYear}`;
      } else {
        return `${startDate.getDate()} ${startMonth} ${startYear} - ${endDate.getDate()} ${endMonth} ${endYear}`;
      }
    };

    // Prepare the prompt for OpenAI
    const platformText = data.platformAttribution || 'kampanie reklamowe';
    const prompt = `Napisz miesięczne podsumowanie wyników ${platformText} w języku polskim.

Pisz z perspektywy zespołu ("zrobiliśmy", "wydaliśmy", "zaobserwowaliśmy").

Nie używaj nazwy klienta ani firmy w tekście podsumowania. Możesz używać nazw platform reklamowych (Meta Ads, Google Ads) jeśli są one określone w danych.

Nie wymyślaj danych ani zdarzeń – opieraj się tylko na dostarczonych liczbach.

Jeśli są dane historyczne (poprzedni miesiąc, rok, 3-miesięczna zmiana), porównaj je rzeczowo (np. "W porównaniu do marca, liczba kliknięć wzrosła o 10%").

Skup się na najważniejszych wskaźnikach: wydatki, wyświetlenia, kliknięcia, CTR, CPC, konwersje, CPA, zmiany miesiąc do miesiąca.

Jeśli nie ma konwersji – zaznacz to krótko i rzeczowo, ewentualnie odnieś się do potencjalnych efektów pośrednich (np. wzrost świadomości marki).

Nie dodawaj żadnych zwrotów grzecznościowych, podziękowań, ani formułek typu "cieszymy się", "dziękujemy" itp.

Nie dopisuj planów na przyszłość, jeśli nie wynikają bezpośrednio z danych (np. "skupimy się na..." tylko jeśli wynika to z analizy spadków/wzrostów).

Tekst ma być spójny, zwięzły, bez zbędnych akapitów czy pustych linii. Nie rozpoczynaj tekstu pustą linią, nie kończ pustą linią. Nie dodawaj żadnych spacji na początku tekstu.

Dane do analizy:
Okres: ${formatDateRange(data.dateRange.start, data.dateRange.end)}
Całkowity koszt reklam: ${formatCurrency(data.totalSpend)}
Liczba wyświetleń: ${formatNumber(data.totalImpressions)}
Liczba kliknięć: ${formatNumber(data.totalClicks)}
CTR: ${formatPercentage(data.averageCtr)}
CPC: ${formatCurrency(data.averageCpc)}
Liczba konwersji: ${formatNumber(data.totalConversions)}
CPA: ${formatCurrency(data.averageCpa)}

${data.platformBreakdown ? `
Podział według platform:
Meta Ads: ${formatCurrency(data.platformBreakdown.meta?.spend || 0)} (${formatNumber(data.platformBreakdown.meta?.impressions || 0)} wyświetleń, ${formatNumber(data.platformBreakdown.meta?.clicks || 0)} kliknięć, ${formatNumber(data.platformBreakdown.meta?.conversions || 0)} konwersji)
Google Ads: ${formatCurrency(data.platformBreakdown.google?.spend || 0)} (${formatNumber(data.platformBreakdown.google?.impressions || 0)} wyświetleń, ${formatNumber(data.platformBreakdown.google?.clicks || 0)} kliknięć, ${formatNumber(data.platformBreakdown.google?.conversions || 0)} konwersji)
` : ''}

${data.reservations ? `Liczba rezerwacji: ${formatNumber(data.reservations)}` : ''}
${data.reservationValue ? `Wartość rezerwacji: ${formatCurrency(data.reservationValue)}` : ''}
${data.roas ? `ROAS: ${formatPercentage(data.roas)}` : ''}
${data.microConversions ? `Liczba mikrokonwersji: ${formatNumber(data.microConversions)}` : ''}
${data.costPerReservation ? `Koszt pozyskania rezerwacji: ${formatCurrency(data.costPerReservation)}` : ''}

Przykład stylu:

${data.platformBreakdown ? 
`W sierpniu wydaliśmy łącznie ${formatCurrency(data.totalSpend)} na ${platformText}. W ramach Meta Ads wydaliśmy ${formatCurrency(data.platformBreakdown.meta?.spend || 0)}, a na Google Ads ${formatCurrency(data.platformBreakdown.google?.spend || 0)}. Łącznie kampanie wygenerowały ${formatNumber(data.totalImpressions)} wyświetleń i ${formatNumber(data.totalClicks)} kliknięć, co dało CTR na poziomie ${data.averageCtr.toFixed(2)}%. W wyniku tych działań zanotowaliśmy ${formatNumber(data.totalConversions)} konwersji.` :
`W sierpniu wydaliśmy ${formatCurrency(data.totalSpend)} na ${platformText}, które wygenerowały ${formatNumber(data.totalImpressions)} wyświetleń i ${formatNumber(data.totalClicks)} kliknięć, co dało CTR na poziomie ${data.averageCtr.toFixed(2)}%. Średni koszt kliknięcia wyniósł ${formatCurrency(data.averageCpc)}. W wyniku tych działań zanotowaliśmy ${formatNumber(data.totalConversions)} konwersji, co dało nam koszt pozyskania konwersji na poziomie ${formatCurrency(data.averageCpa)}.`}
Działania przyniosły pozytywne rezultaty w zakresie pozyskiwania nowych klientów.

Jeśli nie ma danych porównawczych, pomiń zdania porównujące. Zakończ podsumowanie, gdy przekażesz najważniejsze fakty.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Jesteś ekspertem ds. marketingu cyfrowego specjalizującym się w Meta Ads. Tworzysz zwięzłe, rzeczowe podsumowania wyników kampanii reklamowych w języku polskim. Pisz z perspektywy zespołu ("zrobiliśmy", "wydaliśmy", "zaobserwowaliśmy"). Nie używaj nazw klientów, firm ani platform w tekście. Opieraj się tylko na dostarczonych danych. Nie dodawaj zwrotów grzecznościowych, podziękowań ani formułek. Nie dopisuj planów na przyszłość, jeśli nie wynikają bezpośrednio z danych. Tekst ma być spójny, zwięzły, bez zbędnych akapitów. Wszystkie liczby podaj w formacie polskim z walutą PLN (zł). Używaj polskich nazw miesięcy i polskiego formatowania liczb.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const summary = result.choices[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated from OpenAI');
    }

    // Clean up the summary to ensure proper formatting
    return summary.trim();

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    
    // Return null if OpenAI fails - no summary will be generated
    return null;
  }
} 