/**
 * AI Summary Generator
 * 
 * Extracted from the generate-executive-summary API to be used by PDF generation
 * and other components that need AI summary generation without making API calls.
 */

import logger from './logger';
import { getAISummaryConfig, validateConfig } from './ai-summary-config';
import AISummaryRateLimiter from './ai-summary-rate-limiter';
import AISummaryCostTracker from './ai-summary-cost-tracker';
import { ctrPercentFromStats } from './ctr-from-stats';

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
  // Detailed funnel data
  bookingStep1?: number;
  bookingStep2?: number;
  bookingStep3?: number;
  emailContacts?: number;
  clickToCall?: number;
}

export async function generateAISummary(data: ExecutiveSummaryData, clientId?: string): Promise<string | null> {
  const startTime = Date.now();
  const rateLimiter = AISummaryRateLimiter.getInstance();
  const costTracker = AISummaryCostTracker.getInstance();
  
  try {
    // Get and validate configuration
    const config = getAISummaryConfig();
    const configValidation = validateConfig(config);
    if (!configValidation.isValid) {
      logger.error('❌ AI Summary configuration invalid:', configValidation.errors);
      return generateFallbackSummary(data);
    }
    
    // Check rate limits
    const rateLimitIdentifier = clientId || 'global';
    const rateLimitCheck = rateLimiter.checkRateLimit(rateLimitIdentifier);
    if (!rateLimitCheck.allowed) {
      logger.warn('⚠️ Rate limit exceeded:', {
        identifier: rateLimitIdentifier,
        reason: rateLimitCheck.reason,
        resetTime: rateLimitCheck.resetTime
      });
      return generateFallbackSummary(data);
    }
    
    // Check cost limits
    const today = new Date().toISOString().split('T')[0];
    const dailyLimitCheck = costTracker.checkDailyLimit(today);
    if (dailyLimitCheck.exceeded) {
      logger.warn('⚠️ Daily cost limit exceeded:', {
        current: dailyLimitCheck.current,
        limit: dailyLimitCheck.limit
      });
      return generateFallbackSummary(data);
    }
    
    // Check if we're in development mode or cheap mode is enabled
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_URL?.includes('localhost');
    const isCheapMode = process.env.AI_CHEAP_MODE === 'true';
    
    // Debug logging for environment detection (remove in production)
    if (process.env.NODE_ENV === 'development') {
      logger.info('🔍 Environment detection:', {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        AI_CHEAP_MODE: process.env.AI_CHEAP_MODE,
        isDevelopment,
        isCheapMode,
        configFallbackEnabled: config.fallback.enabled,
        configUseInDev: config.fallback.useInDevelopment,
        configUseInCheapMode: config.fallback.useInCheapMode
      });
    }
    
    // Return fallback summary in development mode or cheap mode to save costs
    if ((isDevelopment && config.fallback.useInDevelopment) || (isCheapMode && config.fallback.useInCheapMode)) {
      logger.info(`🔄 [${isDevelopment ? 'DEV' : 'CHEAP'} MODE] Using fallback AI summary to save costs`);
      return generateFallbackSummary(data);
    }
    
    // Validate input data
    if (!isValidSummaryData(data)) {
      logger.warn('⚠️ Invalid summary data provided, using fallback');
      return generateFallbackSummary(data);
    }
    
    // Record the request for rate limiting
    rateLimiter.recordRequest(rateLimitIdentifier);
    
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
    let prompt = `Podsumuj wyniki kampanii (${formatDateRange(data.dateRange.start, data.dateRange.end)}):`;

    // Add platform-specific data breakdown (Google first — matches required output order)
    if (data.platformBreakdown && data.platformBreakdown.meta && data.platformBreakdown.google) {
      const metaData = data.platformBreakdown.meta;
      const googleData = data.platformBreakdown.google;
      
      prompt += `
**Google Ads (dane źródłowe):**
Wydatki: ${formatCurrency(googleData.spend || 0)}
Wyświetlenia: ${formatNumber(googleData.impressions || 0)}
Kliknięcia: ${formatNumber(googleData.clicks || 0)}
CTR: ${ctrPercentFromStats(
        googleData.averageCtr,
        googleData.clicks || 0,
        googleData.impressions || 0
      ).toFixed(2)}%
Rezerwacje: ${formatNumber(googleData.conversions || 0)}

**Meta Ads (dane źródłowe):**
Wydatki: ${formatCurrency(metaData.spend || 0)}
Wyświetlenia: ${formatNumber(metaData.impressions || 0)}
Kliknięcia: ${formatNumber(metaData.clicks || 0)}
CTR: ${ctrPercentFromStats(
        metaData.averageCtr,
        metaData.clicks || 0,
        metaData.impressions || 0
      ).toFixed(2)}%
Rezerwacje: ${formatNumber(metaData.conversions || 0)}

**Łączne wyniki (do ewentualnego krótkiego podsumowania na końcu):**
Budżet łącznie: ${formatCurrency(data.totalSpend)}
Wyświetlenia łącznie: ${formatNumber(data.totalImpressions)}
Kliknięcia łącznie: ${formatNumber(data.totalClicks)}
CTR łącznie: ${formatPercentage(data.averageCtr)}
${(data.reservations || 0) > 0 ? `Rezerwacje łącznie: ${formatNumber(data.reservations || 0)}, wartość: ${formatCurrency(data.reservationValue || 0)}, ROAS: ${(data.roas || 0).toFixed(2)}x` : `Konwersje łącznie: ${formatNumber(data.totalConversions)}`}`;
    } else {
      prompt += `
Budżet: ${formatCurrency(data.totalSpend)}
Wyświetlenia: ${formatNumber(data.totalImpressions)}
Kliknięcia: ${formatNumber(data.totalClicks)}
CTR: ${formatPercentage(data.averageCtr)}
CPC: ${formatCurrency(data.averageCpc)}
${(data.reservations || 0) > 0 ? `Rezerwacje: ${formatNumber(data.reservations || 0)}, wartość: ${formatCurrency(data.reservationValue || 0)}, ROAS: ${(data.roas || 0).toFixed(2)}x` : `Konwersje: ${formatNumber(data.totalConversions)}`}`;
    }

    // Add funnel data if available
    if (data.bookingStep1 || data.bookingStep2 || data.bookingStep3) {
      prompt += `
Lejek konwersji: ${formatNumber(data.bookingStep1 || 0)} kroków pierwszego etapu, ${formatNumber(data.bookingStep2 || 0)} kroków drugiego etapu, ${formatNumber(data.bookingStep3 || 0)} kroków trzeciego etapu`;
    }

    // Add contact data if available
    if (data.emailContacts || data.clickToCall) {
      prompt += `
Kontakty: ${formatNumber(data.emailContacts || 0)} email, ${formatNumber(data.clickToCall || 0)} telefoniczne`;
    }

    const hasBothPlatforms = !!(
      data.platformBreakdown &&
      data.platformBreakdown.meta &&
      data.platformBreakdown.google
    );

    if (hasBothPlatforms) {
      prompt += `

Napisz podsumowanie z perspektywy zespołu ("wydaliśmy", "osiągnęliśmy"). Bez nazw firm. Tylko fakty z danych powyżej.

WYMAGANA STRUKTURA (użyj podwójnej nowej linii między akapitami):
1) Opcjonalnie jedno krótkie zdanie wstępu o analizowanym okresie — bez liczb konkretnych platform.
2) Akapit: pierwsza linia to dokładnie "Google Ads" — wyłącznie wyniki Google Ads (zero danych Meta w tym akapicie).
3) Akapit: pierwsza linia to dokładnie "Meta Ads" — wyłącznie wyniki Meta Ads (zero danych Google w tym akapicie).
4) Opcjonalnie krótki akapit "Podsumowanie łączne" ze skrótem budżetu łącznego i ROAS — bez powtarzania szczegółów z punktów 2–3.

Uwzględnij lejek konwersji i kontakty w podsumowaniu łącznym lub osobno pod platformami, jeśli da się to uzasadnić danymi.`;
    } else {
      prompt += `

Napisz zwięzłe podsumowanie z perspektywy zespołu ("wydaliśmy", "osiągnęliśmy"). Bez nazw firm. Tylko fakty.
Zacznij jeden akapit od nagłówka "Google Ads" lub "Meta Ads" — zgodnie z tym, której platformy dotyczą dane (tylko jedna platforma w zestawieniu). Uwzględnij lejek konwersji i kontakty jeśli dostępne.`;
    }

    // Call OpenAI API with retry logic
    const summary = await callOpenAIWithRetry(prompt, config.openai.maxRetries);

    if (!summary) {
      throw new Error('No summary generated from OpenAI after retries');
    }

    // Clean up the summary to ensure proper formatting
    const cleanedSummary = summary.trim();
    
    // Record cost
    const estimatedTokens = estimateTokenCount(prompt, cleanedSummary);
    costTracker.recordCost(estimatedTokens);
    
    // Log performance metrics
    const duration = Date.now() - startTime;
    logger.info('✅ AI summary generated successfully:', {
      duration: `${duration}ms`,
      summaryLength: cleanedSummary.length,
      estimatedTokens,
      estimatedCost: estimateTokenCost(prompt, cleanedSummary),
      clientId: rateLimitIdentifier
    });
    
    return cleanedSummary;

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    
    // If OpenAI fails (rate limit, etc.), provide a fallback summary
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('Too Many Requests'))) {
      logger.warn('⚠️ OpenAI rate limit hit, generating fallback summary');
      
      const formatCurrency = (amount: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount);
      const formatNumber = (num: number) => new Intl.NumberFormat('pl-PL').format(num);
      
      return `W okresie od ${data.dateRange.start} do ${data.dateRange.end} kampanie reklamowe dla ${data.clientName} wygenerowały wydatki w wysokości ${formatCurrency(data.totalSpend)}. Łącznie odnotowano ${formatNumber(data.totalImpressions)} wyświetleń i ${formatNumber(data.totalClicks)} kliknięć, co dało średni CTR na poziomie ${data.averageCtr.toFixed(2)}%. Kampanie przyniosły ${formatNumber(data.totalConversions)} konwersji${(data.reservationValue && data.reservationValue > 0) ? ` o wartości ${formatCurrency(data.reservationValue)}` : ''}.`;
    }
    
    // For any other OpenAI failure (including 401 Unauthorized), provide a fallback summary
    logger.warn('⚠️ OpenAI API failed, generating fallback summary:', error instanceof Error ? error.message : 'Unknown error');
    return generateFallbackSummary(data);
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

  // Format date range for Polish locale (like the example)
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

  // Czytelna struktura: wstęp → Google Ads (tylko Google) → Meta Ads (tylko Meta) → opcjonalnie łącznie
  const platformText = data.platformAttribution || 'kampanie reklamowe';
  let summary = `W okresie ${formatDateRange(data.dateRange.start, data.dateRange.end)} analizowaliśmy ${platformText}.`;
  
  // Add platform-specific narrative if both platforms are present
  if (data.platformBreakdown && data.platformBreakdown.meta && data.platformBreakdown.google) {
    const metaData = data.platformBreakdown.meta;
    const googleData = data.platformBreakdown.google;
    
    // Sanitize NaN values to prevent "NaN zł" in output
    const metaSpendSafe = Number.isFinite(metaData.spend) ? metaData.spend : 0;
    const metaImpressionsSafe = Number.isFinite(metaData.impressions) ? metaData.impressions : 0;
    const metaClicksSafe = Number.isFinite(metaData.clicks) ? metaData.clicks : 0;
    const metaConversionsSafe = Number.isFinite(metaData.conversions) ? metaData.conversions : 0;
    
    const googleSpendSafe = Number.isFinite(googleData.spend) ? googleData.spend : 0;
    const googleImpressionsSafe = Number.isFinite(googleData.impressions) ? googleData.impressions : 0;
    const googleClicksSafe = Number.isFinite(googleData.clicks) ? googleData.clicks : 0;
    const googleConversionsSafe = Number.isFinite(googleData.conversions) ? googleData.conversions : 0;
    
    const googleCtr = ctrPercentFromStats(
      googleData.averageCtr,
      googleClicksSafe,
      googleImpressionsSafe
    ).toFixed(2);
    const metaCtr = ctrPercentFromStats(
      metaData.averageCtr,
      metaClicksSafe,
      metaImpressionsSafe
    ).toFixed(2);

    summary += `\n\nGoogle Ads\n`;
    summary += `Wydaliśmy ${formatCurrency(googleSpendSafe)}. Wygenerowaliśmy ${formatNumber(googleImpressionsSafe)} wyświetleń i ${formatNumber(googleClicksSafe)} kliknięć (CTR ${googleCtr}%). Rezerwacje: ${formatNumber(googleConversionsSafe)}.`;

    summary += `\n\nMeta Ads\n`;
    summary += `Wydaliśmy ${formatCurrency(metaSpendSafe)}. Wygenerowaliśmy ${formatNumber(metaImpressionsSafe)} wyświetleń i ${formatNumber(metaClicksSafe)} kliknięć (CTR ${metaCtr}%). Rezerwacje: ${formatNumber(metaConversionsSafe)}.`;

    summary += `\n\nPodsumowanie łączne\n`;
    summary += `Łącznie: ${formatNumber(data.reservations || 0)} rezerwacji, wartość ${formatCurrency(data.reservationValue || 0)}, ROAS ${(data.roas || 0).toFixed(2)}x, średni koszt rezerwacji ${formatCurrency(data.averageCpa || 0)}.`;
  } else {
    // Fallback to combined format if only one platform
    summary += ` o łącznym budżecie ${formatCurrency(data.totalSpend)}. Kampanie wygenerowały ${formatNumber(data.totalImpressions)} wyświetleń i ${formatNumber(data.totalClicks)} kliknięć, osiągając CTR na poziomie ${data.averageCtr.toFixed(2)}%. Działania reklamowe przyniosły ${formatNumber(data.reservations || 0)} rezerwacji o łącznej wartości ${formatCurrency(data.reservationValue || 0)}, co dało ROAS na poziomie ${(data.roas || 0).toFixed(2)}x. Średni koszt pozyskania rezerwacji wyniósł ${formatCurrency(data.costPerReservation || 0)}.`;
  }
  
  // Add funnel data if available (łącznie — brak podziału per platforma w danych wejściowych)
  if (data.bookingStep1 || data.bookingStep2 || data.bookingStep3) {
    summary += `\n\nLejek konwersji (łącznie)\n`;
    summary += `Odnotowaliśmy ${formatNumber(data.bookingStep1 || 0)} kroków pierwszego etapu, ${formatNumber(data.bookingStep2 || 0)} drugiego i ${formatNumber(data.bookingStep3 || 0)} trzeciego etapu.`;
  }

  if (data.emailContacts || data.clickToCall) {
    summary += `\n\nKontakty (łącznie)\n`;
    summary += `${formatNumber(data.emailContacts || 0)} kontaktów e-mail i ${formatNumber(data.clickToCall || 0)} telefonicznych.`;
  }
  
  return summary;
}

// Environment configuration validation
function validateEnvironmentConfig(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is not set');
  } else if (process.env.OPENAI_API_KEY.length < 20) {
    errors.push('OPENAI_API_KEY appears to be invalid (too short)');
  }
  
  if (!process.env.NODE_ENV) {
    errors.push('NODE_ENV is not set');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Input data validation
function isValidSummaryData(data: ExecutiveSummaryData): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  if (!data.clientName || typeof data.clientName !== 'string') {
    return false;
  }
  
  if (!data.dateRange || !data.dateRange.start || !data.dateRange.end) {
    return false;
  }
  
  if (typeof data.totalSpend !== 'number' || data.totalSpend < 0) {
    return false;
  }
  
  if (typeof data.totalImpressions !== 'number' || data.totalImpressions < 0) {
    return false;
  }
  
  return true;
}

// OpenAI API call with retry logic
async function callOpenAIWithRetry(prompt: string, maxRetries: number = 3): Promise<string | null> {
  const config = getAISummaryConfig();
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`🔄 OpenAI API attempt ${attempt}/${maxRetries}`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: config.openai.model,
          messages: [
            {
              role: 'system',
              content: 'Jesteś ekspertem ds. marketingu cyfrowego. Podsumowania po polsku. Gdy są dane z Google Ads i Meta Ads: dwa osobne akapity — najpierw "Google Ads" (wyłącznie Google), potem "Meta Ads" (wyłącznie Meta), potem ewentualnie krótkie podsumowanie łączne. Perspektywa zespołu ("wydaliśmy"). Bez nazw firm. Liczby po polsku (zł).'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: config.openai.maxTokens,
          temperature: config.openai.temperature
        })
      });

      if (response.ok) {
        const result = await response.json();
        const summary = result.choices[0]?.message?.content;
        
        if (summary) {
          logger.info(`✅ OpenAI API success on attempt ${attempt}`);
          return summary;
        }
      } else if (response.status === 429) {
        // Rate limit - wait and retry
        const retryAfter = response.headers.get('retry-after');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * config.openai.retryDelayMs;
        
        logger.warn(`⚠️ OpenAI rate limit hit, waiting ${waitTime}ms before retry ${attempt + 1}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      } else {
        logger.error(`❌ OpenAI API error on attempt ${attempt}:`, {
          status: response.status,
          statusText: response.statusText
        });
        
        if (attempt === maxRetries) {
          throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      logger.error(`❌ OpenAI API attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      const waitTime = Math.pow(2, attempt) * config.openai.retryDelayMs;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  return null;
}

// Estimate token count for cost tracking
function estimateTokenCount(prompt: string, response: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English, 1 token ≈ 2 characters for Polish
  const promptTokens = Math.ceil(prompt.length / 2);
  const responseTokens = Math.ceil(response.length / 2);
  return promptTokens + responseTokens;
}

// Estimate token cost for monitoring
function estimateTokenCost(prompt: string, response: string): string {
  const totalTokens = estimateTokenCount(prompt, response);
  
  // GPT-3.5-turbo pricing: $0.0015 per 1K tokens
  const cost = (totalTokens / 1000) * 0.0015;
  
  return `~${totalTokens} tokens (~$${cost.toFixed(4)})`;
}
