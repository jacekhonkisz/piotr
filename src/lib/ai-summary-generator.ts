/**
 * AI Summary Generator
 * 
 * Extracted from the generate-executive-summary API to be used by PDF generation
 * and other components that need AI summary generation without making API calls.
 */

import logger from './logger';

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
  reservations?: number;
  reservationValue?: number;
  roas?: number;
  microConversions?: number;
  costPerReservation?: number;
  platformAttribution?: string;
  platformSources?: string[];
  platformBreakdown?: any;
}

export async function generateAISummary(data: ExecutiveSummaryData): Promise<string | null> {
  try {
    // Check if we're in development mode or cheap mode is enabled
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_URL?.includes('localhost');
    const isCheapMode = process.env.AI_CHEAP_MODE === 'true';
    
    // Return fallback summary in development mode or cheap mode to save costs
    if (isDevelopment || isCheapMode) {
      logger.info(`🔄 [${isDevelopment ? 'DEV' : 'CHEAP'} MODE] Using fallback AI summary to save costs`);
      return generateFallbackSummary(data);
    }
    
    logger.info('🤖 Starting OpenAI API call for executive summary generation');
    logger.info('🔑 OpenAI API Key check:', {
      hasApiKey: !!process.env.OPENAI_API_KEY,
      keyLength: process.env.OPENAI_API_KEY?.length || 0,
      keyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) || 'missing'
    });
    logger.info('📊 Summary data for AI generation:', {
      totalSpend: data.totalSpend,
      totalImpressions: data.totalImpressions,
      totalConversions: data.totalConversions,
      clientName: data.clientName,
      dateRange: `${data.dateRange.start} to ${data.dateRange.end}`,
      hasValidData: data.totalSpend > 0 || data.totalImpressions > 0
    });
    
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
    const prompt = `Podsumuj wyniki kampanii (${formatDateRange(data.dateRange.start, data.dateRange.end)}):

Budżet: ${formatCurrency(data.totalSpend)}
Wyświetlenia: ${formatNumber(data.totalImpressions)}
Kliknięcia: ${formatNumber(data.totalClicks)}
CTR: ${formatPercentage(data.averageCtr)}
CPC: ${formatCurrency(data.averageCpc)}
${(data.reservations || 0) > 0 ? `Rezerwacje: ${formatNumber(data.reservations || 0)}, wartość: ${formatCurrency(data.reservationValue || 0)}, ROAS: ${(data.roas || 0).toFixed(2)}x` : `Konwersje: ${formatNumber(data.totalConversions)}`}

Napisz zwięzłe podsumowanie z perspektywy zespołu ("wydaliśmy", "osiągnęliśmy"). Bez nazw firm. Tylko fakty.`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Jesteś ekspertem ds. marketingu cyfrowego. Tworzysz zwięzłe podsumowania kampanii reklamowych w języku polskim. Pisz z perspektywy zespołu ("zrobiliśmy", "wydaliśmy"). Nie używaj nazw firm. Opieraj się tylko na danych. Tekst ma być zwięzły. Liczby w formacie polskim z PLN (zł).'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.5
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
    
    // If OpenAI fails (rate limit, etc.), provide a fallback summary
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('Too Many Requests'))) {
      logger.warn('⚠️ OpenAI rate limit hit, generating fallback summary');
      
      const formatCurrency = (amount: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
      const formatNumber = (num: number) => new Intl.NumberFormat('pl-PL').format(num);
      
      return `W okresie od ${data.dateRange.start} do ${data.dateRange.end} kampanie reklamowe dla ${data.clientName} wygenerowały wydatki w wysokości ${formatCurrency(data.totalSpend)}. Łącznie odnotowano ${formatNumber(data.totalImpressions)} wyświetleń i ${formatNumber(data.totalClicks)} kliknięć, co dało średni CTR na poziomie ${data.averageCtr.toFixed(2)}%. Kampanie przyniosły ${formatNumber(data.totalConversions)} konwersji${(data.reservationValue && data.reservationValue > 0) ? ` o wartości ${formatCurrency(data.reservationValue)}` : ''}.`;
    }
    
    // Return null if OpenAI fails - no summary will be generated
    return null;
  }
}

// Generate fallback summary for development mode
function generateFallbackSummary(data: ExecutiveSummaryData): string {
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return `W okresie od ${formatDate(data.dateRange.start)} do ${formatDate(data.dateRange.end)} przeprowadziliśmy kampanie reklamowe o łącznym budżecie ${formatCurrency(data.totalSpend)}. Kampanie wygenerowały ${formatNumber(data.totalImpressions)} wyświetleń i ${formatNumber(data.totalClicks)} kliknięć, osiągając CTR na poziomie ${(data.averageCtr * 100).toFixed(2)}%.

Działania reklamowe przyniosły ${formatNumber(data.reservations || 0)} rezerwacji o łącznej wartości ${formatCurrency(data.reservationValue || 0)}, co dało ROAS na poziomie ${(data.roas || 0).toFixed(2)}x. Średni koszt pozyskania rezerwacji wyniósł ${formatCurrency(data.costPerReservation || 0)}.

[DEV MODE - Fallback Summary]`;
}
