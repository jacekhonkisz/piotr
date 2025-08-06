import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

async function generateAISummary(data: ExecutiveSummaryData): Promise<string> {
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
    const prompt = `Napisz krótkie podsumowanie miesięczne wyników kampanii Meta Ads dla klienta. Użyj zebranych danych:

Dane klienta: ${data.clientName}
Okres: ${formatDateRange(data.dateRange.start, data.dateRange.end)}

Metryki:
- Całkowity koszt reklam: ${formatCurrency(data.totalSpend)}
- Liczba wyświetleń: ${formatNumber(data.totalImpressions)}
- Liczba kliknięć: ${formatNumber(data.totalClicks)}
- Liczba konwersji: ${formatNumber(data.totalConversions)}
- Średni CTR: ${formatPercentage(data.averageCtr)}
- Średni CPC: ${formatCurrency(data.averageCpc)}
- Średni CPA: ${formatCurrency(data.averageCpa)}

${data.reservations ? `- Liczba rezerwacji: ${formatNumber(data.reservations)}` : ''}
${data.reservationValue ? `- Wartość rezerwacji: ${formatCurrency(data.reservationValue)}` : ''}
${data.roas ? `- ROAS: ${formatPercentage(data.roas)}` : ''}
${data.microConversions ? `- Liczba mikrokonwersji: ${formatNumber(data.microConversions)}` : ''}
${data.costPerReservation ? `- Koszt pozyskania rezerwacji: ${formatCurrency(data.costPerReservation)}` : ''}

Pisz krótko (1–2 akapity), w stylu doradczym i przystępnym. Zacznij od ogólnej oceny miesiąca, potem podaj najważniejsze liczby. Jeśli jest dostępne porównanie rok do roku, skomentuj wynik. Dodaj informację o mikrokonwersjach i potencjalnym wpływie offline. Zakończ stwierdzeniem o całkowitej wartości rezerwacji (online + offline).

Unikaj wzmianki o Google Ads – podsumowuj wyłącznie Meta Ads. Wszystkie liczby podaj w odpowiednich formatach i walucie. Styl wzoruj na poniższym przykładzie:

"Podsumowanie ogólne

Za nami ciężki miesiąc, który ostatecznie był tylko trochę gorszy rok do roku pod kątem pozyskania rezerwacji online w kampaniach Meta Ads. Wygenerowaliśmy za to mnóstwo telefonów i innych mikrokonwersji.

Porównanie wyników rok do roku: wartość rezerwacji jest niższa o 22%.

W lipcu pozyskaliśmy 70 rezerwacji online o łącznej wartości ponad 442 tys. zł. Koszt pozyskania jednej rezerwacji wyniósł: 9,77%.

Dodatkowo pozyskaliśmy 383 mikrokonwersje (telefony, e-maile, formularze), które prawdopodobnie przyczyniły się do dodatkowych rezerwacji offline. Nawet jeśli tylko 20% z nich zakończyło się rezerwacją, to daje ok. 482 tys. zł.

Sumując rezerwacje online i szacunkowo offline, łączna wartość rezerwacji za lipiec wynosi ok. 924 tys. zł."`;

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
            content: 'Jesteś ekspertem ds. marketingu cyfrowego i Meta Ads. Tworzysz profesjonalne, zwięzłe podsumowania wyników kampanii reklamowych w języku polskim. Używasz stylu doradczego, przystępnego i nieformalnego. Wszystkie liczby podaj w formacie polskim z walutą PLN (zł). Używaj polskich nazw miesięcy (stycznia, lutego, marca, itd.) i polskiego formatowania liczb (spacje jako separatory tysięcy, przecinki jako separatory dziesiętne).'
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

    return summary;

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    
    // Fallback summary if OpenAI fails
    return `Podsumowanie ogólne

W analizowanym okresie ${data.clientName} wydał ${new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(data.totalSpend)} na kampanie Meta Ads, osiągając ${new Intl.NumberFormat('pl-PL').format(data.totalImpressions)} wyświetleń i ${new Intl.NumberFormat('pl-PL').format(data.totalClicks)} kliknięć.

Średni CTR wyniósł ${new Intl.NumberFormat('pl-PL', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(data.averageCtr / 100)}, a średni koszt kliknięcia to ${new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(data.averageCpc)}.

${data.totalConversions > 0 ? `Pozyskano ${new Intl.NumberFormat('pl-PL').format(data.totalConversions)} konwersji o średnim koszcie ${new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(data.averageCpa)}.` : 'Nie odnotowano konwersji w tym okresie.'}`;
  }
} 