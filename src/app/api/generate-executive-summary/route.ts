import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ExecutiveSummaryCacheService } from '../../../lib/executive-summary-cache';

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

    if (!clientId || !dateRange || !reportData) {
      return NextResponse.json({ 
        error: 'Missing required parameters: clientId, dateRange, reportData' 
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

    // Prepare data for AI summary
    const summaryData: ExecutiveSummaryData = {
      totalSpend: reportData.account_summary?.total_spend || 0,
      totalImpressions: reportData.account_summary?.total_impressions || 0,
      totalClicks: reportData.account_summary?.total_clicks || 0,
      totalConversions: reportData.account_summary?.total_conversions || 0,
      averageCtr: reportData.account_summary?.average_ctr || 0,
      averageCpc: reportData.account_summary?.average_cpc || 0,
      averageCpa: reportData.account_summary?.average_cpa || 0,
      currency: 'PLN', // Hardcoded to PLN for Polish market
      dateRange: dateRange,
      clientName: client.name,
      // Extract conversion tracking data if available
      reservations: reportData.account_summary?.total_conversions || 0,
      reservationValue: reportData.account_summary?.total_conversion_value || 0,
      roas: reportData.account_summary?.roas || 0,
      microConversions: reportData.account_summary?.micro_conversions || 0,
      costPerReservation: reportData.account_summary?.average_cpa || 0
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
      console.log('💾 Saved AI Executive Summary to cache');
    } else {
      console.log('⚠️ Summary not saved to cache (outside 12-month retention period)');
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
    const prompt = `Napisz miesięczne podsumowanie wyników kampanii Meta Ads w języku polskim.

Pisz z perspektywy zespołu ("zrobiliśmy", "wydaliśmy", "zaobserwowaliśmy").

Nie używaj nazwy klienta, firmy ani nazw platformy w tekście podsumowania.

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

${data.reservations ? `Liczba rezerwacji: ${formatNumber(data.reservations)}` : ''}
${data.reservationValue ? `Wartość rezerwacji: ${formatCurrency(data.reservationValue)}` : ''}
${data.roas ? `ROAS: ${formatPercentage(data.roas)}` : ''}
${data.microConversions ? `Liczba mikrokonwersji: ${formatNumber(data.microConversions)}` : ''}
${data.costPerReservation ? `Koszt pozyskania rezerwacji: ${formatCurrency(data.costPerReservation)}` : ''}

Przykład stylu:

W kwietniu wydaliśmy 246,94 zł na kampanie reklamowe, które wygenerowały 8 099 wyświetleń i 143 kliknięcia, co dało CTR na poziomie 1,77%. Średni koszt kliknięcia wyniósł 1,73 zł. W tym okresie nie zanotowaliśmy żadnych konwersji, dlatego CPA wyniósł 0,00 zł. W porównaniu do poprzedniego miesiąca liczba kliknięć spadła o 8%.
Pomimo braku konwersji, działania mogły przyczynić się do zwiększenia świadomości marki oraz potencjalnych kontaktów offline.

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