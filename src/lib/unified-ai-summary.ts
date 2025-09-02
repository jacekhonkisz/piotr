/**
 * Unified AI Summary Generator for Meta Ads and Google Ads
 * Generates comprehensive AI summaries that include data from both platforms
 */

import { UnifiedReport, PlatformTotals } from './unified-campaign-types';

export interface UnifiedSummaryData {
  metaTotals: PlatformTotals;
  googleTotals: PlatformTotals;
  combinedTotals: PlatformTotals;
  dateRange: {
    start: string;
    end: string;
  };
  clientName: string;
  currency: string;
  metaCampaignCount: number;
  googleCampaignCount: number;
  totalCampaignCount: number;
}

export class UnifiedAISummaryGenerator {
  
  /**
   * Generate AI summary for unified report (Meta + Google Ads)
   */
  static async generateUnifiedSummary(report: UnifiedReport, clientName: string): Promise<string | null> {
    const summaryData: UnifiedSummaryData = {
      metaTotals: report.totals.meta,
      googleTotals: report.totals.google,
      combinedTotals: report.totals.combined,
      dateRange: {
        start: report.date_range_start,
        end: report.date_range_end
      },
      clientName,
      currency: 'PLN',
      metaCampaignCount: report.metaCampaigns.length,
      googleCampaignCount: report.googleCampaigns.length,
      totalCampaignCount: report.metaCampaigns.length + report.googleCampaigns.length
    };

    try {
      // Call OpenAI API to generate the summary
      const aiSummary = await this.callOpenAI(summaryData);
      return aiSummary || this.generateFallbackSummary(summaryData);

    } catch (error) {
      console.error('Error generating unified AI summary:', error);
      return this.generateFallbackSummary(summaryData);
    }
  }

  /**
   * Call OpenAI API with unified data
   */
  private static async callOpenAI(data: UnifiedSummaryData): Promise<string | null> {
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
        return new Intl.NumberFormat('pl-PL').format(Math.round(num));
      };

      const formatPercentage = (num: number) => {
        return `${num.toFixed(2)}%`;
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

      // Prepare the unified prompt for OpenAI
      const prompt = `Napisz miesięczne podsumowanie wyników kampanii reklamowych w języku polskim, obejmujące zarówno Meta Ads (Facebook/Instagram) jak i Google Ads.

Pisz z perspektywy zespołu ("zrobiliśmy", "wydaliśmy", "zaobserwowaliśmy").

Nie używaj nazwy klienta, firmy ani nazw platform w tekście podsumowania - pisz ogólnie o "kampaniach reklamowych" lub "działaniach marketingowych".

Nie wymyślaj danych ani zdarzeń – opieraj się tylko na dostarczonych liczbach.

Skup się na porównaniu wyników między platformami i łącznych rezultatach.

DANE DO ANALIZY:
Okres: ${formatDateRange(data.dateRange.start, data.dateRange.end)}

ŁĄCZNE WYNIKI (Meta + Google):
- Łączne wydatki: ${formatCurrency(data.combinedTotals.totalSpend)}
- Łączne wyświetlenia: ${formatNumber(data.combinedTotals.totalImpressions)}
- Łączne kliknięcia: ${formatNumber(data.combinedTotals.totalClicks)}
- Średni CTR: ${formatPercentage(data.combinedTotals.averageCtr)}
- Średni CPC: ${formatCurrency(data.combinedTotals.averageCpc)}
- Łączne rezerwacje: ${formatNumber(data.combinedTotals.totalReservations)}
- Wartość rezerwacji: ${formatCurrency(data.combinedTotals.totalReservationValue)}
- Liczba kampanii: ${data.totalCampaignCount}

META ADS (Facebook/Instagram):
- Wydatki: ${formatCurrency(data.metaTotals.totalSpend)}
- Wyświetlenia: ${formatNumber(data.metaTotals.totalImpressions)}
- Kliknięcia: ${formatNumber(data.metaTotals.totalClicks)}
- CTR: ${formatPercentage(data.metaTotals.averageCtr)}
- CPC: ${formatCurrency(data.metaTotals.averageCpc)}
- Rezerwacje: ${formatNumber(data.metaTotals.totalReservations)}
- Wartość rezerwacji: ${formatCurrency(data.metaTotals.totalReservationValue)}
- Liczba kampanii: ${data.metaCampaignCount}

GOOGLE ADS:
- Wydatki: ${formatCurrency(data.googleTotals.totalSpend)}
- Wyświetlenia: ${formatNumber(data.googleTotals.totalImpressions)}
- Kliknięcia: ${formatNumber(data.googleTotals.totalClicks)}
- CTR: ${formatPercentage(data.googleTotals.averageCtr)}
- CPC: ${formatCurrency(data.googleTotals.averageCpc)}
- Rezerwacje: ${formatNumber(data.googleTotals.totalReservations)}
- Wartość rezerwacji: ${formatCurrency(data.googleTotals.totalReservationValue)}
- Liczba kampanii: ${data.googleCampaignCount}

WYMAGANIA:
1. Zacznij od ogólnego podsumowania łącznych wyników
2. Porównaj wyniki między platformami (która była bardziej efektywna)
3. Wskaż najważniejsze insights i różnice w performance
4. Zakończ rekomendacjami dotyczącymi optymalizacji
5. Użyj profesjonalnego, ale przystępnego języka
6. Długość: 150-200 słów
7. Nie używaj bullet pointów - pisz w formie płynnego tekstu

Napisz podsumowanie:`;

      // Check if OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️ OpenAI API key not available, using fallback summary');
        return this.generateFallbackSummary(data);
      }

      // Make the API call to OpenAI
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
              content: 'Jesteś ekspertem od marketingu cyfrowego specjalizującym się w analizie wyników kampanii reklamowych Meta Ads i Google Ads. Piszesz profesjonalne podsumowania w języku polskim.'
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
        console.error('OpenAI API error:', response.status, response.statusText);
        return this.generateFallbackSummary(data);
      }

      const result = await response.json();
      return result.choices?.[0]?.message?.content || this.generateFallbackSummary(data);

    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      return this.generateFallbackSummary(data);
    }
  }

  /**
   * Generate fallback summary when OpenAI is unavailable
   */
  static generateFallbackSummary(data: UnifiedSummaryData): string {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: data.currency,
        minimumFractionDigits: 2,
      }).format(amount);
    };

    const formatNumber = (num: number) => {
      return new Intl.NumberFormat('pl-PL').format(Math.round(num));
    };

    const formatDateRange = (start: string, end: string) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      return `${startDate.toLocaleDateString('pl-PL')} - ${endDate.toLocaleDateString('pl-PL')}`;
    };

    // Calculate platform performance comparison
    const metaShare = data.combinedTotals.totalSpend > 0 ? 
      (data.metaTotals.totalSpend / data.combinedTotals.totalSpend) * 100 : 0;
    const googleShare = 100 - metaShare;

    const betterCTR = data.metaTotals.averageCtr > data.googleTotals.averageCtr ? 'Meta Ads' : 'Google Ads';
    const betterCPC = data.metaTotals.averageCpc < data.googleTotals.averageCpc ? 'Meta Ads' : 'Google Ads';

    return `W okresie ${formatDateRange(data.dateRange.start, data.dateRange.end)} przeprowadziliśmy ${data.totalCampaignCount} kampanii reklamowych na dwóch głównych platformach. 

Łącznie wydaliśmy ${formatCurrency(data.combinedTotals.totalSpend)}, generując ${formatNumber(data.combinedTotals.totalImpressions)} wyświetleń i ${formatNumber(data.combinedTotals.totalClicks)} kliknięć. Średni wskaźnik klikalności wyniósł ${data.combinedTotals.averageCtr.toFixed(2)}%, a koszt kliknięcia ${formatCurrency(data.combinedTotals.averageCpc)}.

Meta Ads odpowiadał za ${metaShare.toFixed(0)}% budżetu (${formatCurrency(data.metaTotals.totalSpend)}), podczas gdy Google Ads za ${googleShare.toFixed(0)}% (${formatCurrency(data.googleTotals.totalSpend)}). Pod względem CTR lepsze wyniki osiągnął ${betterCTR}, natomiast niższy CPC zapewnił ${betterCPC}.

Łącznie wygenerowaliśmy ${formatNumber(data.combinedTotals.totalReservations)} rezerwacji o wartości ${formatCurrency(data.combinedTotals.totalReservationValue)}. Wyniki wskazują na potrzebę dalszej optymalizacji budżetu między platformami w celu maksymalizacji ROI.`;
  }
}
