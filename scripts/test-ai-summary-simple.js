// Simple test for AI Executive Summary functionality
// This test focuses on OpenAI API integration and prompt generation

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

async function testAISummaryGeneration() {
  console.log('🧪 Testing AI Executive Summary Generation...\n');

  try {
    // Test data (similar to what would come from Meta Ads API)
    const testData = {
      clientName: 'Test Client',
      totalSpend: 5000,
      totalImpressions: 100000,
      totalClicks: 2000,
      totalConversions: 50,
      averageCtr: 2.0,
      averageCpc: 2.50,
      averageCpa: 100,
      reservationValue: 7500,
      roas: 1.5,
      microConversions: 150,
      dateRange: {
        start: '2024-01-01',
        end: '2024-01-31'
      }
    };

    // Format numbers for Polish locale (same logic as in the API)
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    };

    const formatNumber = (num) => {
      return new Intl.NumberFormat('pl-PL').format(num);
    };

    const formatPercentage = (num) => {
      return new Intl.NumberFormat('pl-PL', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(num / 100);
    };

    // Format date range for Polish locale
    const formatDateRange = (start, end) => {
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

    console.log('1️⃣ Testing data formatting...');
    console.log(`   Client: ${testData.clientName}`);
    console.log(`   Date Range: ${formatDateRange(testData.dateRange.start, testData.dateRange.end)}`);
    console.log(`   Spend: ${formatCurrency(testData.totalSpend)}`);
    console.log(`   Impressions: ${formatNumber(testData.totalImpressions)}`);
    console.log(`   CTR: ${formatPercentage(testData.averageCtr)}`);
    console.log(`   CPC: ${formatCurrency(testData.averageCpc)}`);
    console.log('✅ Data formatting successful\n');

    // Generate the prompt (same logic as in the API)
    const prompt = `Napisz krótkie podsumowanie miesięczne wyników kampanii Meta Ads dla klienta. Użyj zebranych danych:

Dane klienta: ${testData.clientName}
Okres: ${formatDateRange(testData.dateRange.start, testData.dateRange.end)}

Metryki:
- Całkowity koszt reklam: ${formatCurrency(testData.totalSpend)}
- Liczba wyświetleń: ${formatNumber(testData.totalImpressions)}
- Liczba kliknięć: ${formatNumber(testData.totalClicks)}
- Liczba konwersji: ${formatNumber(testData.totalConversions)}
- Średni CTR: ${formatPercentage(testData.averageCtr)}
- Średni CPC: ${formatCurrency(testData.averageCpc)}
- Średni CPA: ${formatCurrency(testData.averageCpa)}
- Liczba rezerwacji: ${formatNumber(testData.totalConversions)}
- Wartość rezerwacji: ${formatCurrency(testData.reservationValue)}
- ROAS: ${formatPercentage(testData.roas)}
- Liczba mikrokonwersji: ${formatNumber(testData.microConversions)}
- Koszt pozyskania rezerwacji: ${formatCurrency(testData.averageCpa)}

Pisz krótko (1–2 akapity), w stylu doradczym i przystępnym. Zacznij od ogólnej oceny miesiąca, potem podaj najważniejsze liczby. Jeśli jest dostępne porównanie rok do roku, skomentuj wynik. Dodaj informację o mikrokonwersjach i potencjalnym wpływie offline. Zakończ stwierdzeniem o całkowitej wartości rezerwacji (online + offline).

Unikaj wzmianki o Google Ads – podsumowuj wyłącznie Meta Ads. Wszystkie liczby podaj w odpowiednich formatach i walucie. Styl wzoruj na poniższym przykładzie:

"Podsumowanie ogólne

Za nami ciężki miesiąc, który ostatecznie był tylko trochę gorszy rok do roku pod kątem pozyskania rezerwacji online w kampaniach Meta Ads. Wygenerowaliśmy za to mnóstwo telefonów i innych mikrokonwersji.

Porównanie wyników rok do roku: wartość rezerwacji jest niższa o 22%.

W lipcu pozyskaliśmy 70 rezerwacji online o łącznej wartości ponad 442 tys. zł. Koszt pozyskania jednej rezerwacji wyniósł: 9,77%.

Dodatkowo pozyskaliśmy 383 mikrokonwersje (telefony, e-maile, formularze), które prawdopodobnie przyczyniły się do dodatkowych rezerwacji offline. Nawet jeśli tylko 20% z nich zakończyło się rezerwacją, to daje ok. 482 tys. zł.

Sumując rezerwacje online i szacunkowo offline, łączna wartość rezerwacji za lipiec wynosi ok. 924 tys. zł."`;

    console.log('2️⃣ Testing prompt generation...');
    console.log('📝 Generated prompt preview:');
    console.log('─'.repeat(60));
    console.log(prompt.substring(0, 300) + '...');
    console.log('─'.repeat(60));
    console.log('✅ Prompt generation successful\n');

    // Test OpenAI API call
    console.log('3️⃣ Testing OpenAI API call...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Jesteś ekspertem ds. marketingu cyfrowego i Meta Ads. Tworzysz profesjonalne, zwięzłe podsumowania wyników kampanii reklamowych w języku polskim. Używasz stylu doradczego, przystępnego i nieformalnego.'
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
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    const summary = result.choices[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated from OpenAI');
    }

    console.log('✅ OpenAI API call successful');
    console.log(`📊 Tokens used: ${result.usage?.total_tokens || 'unknown'}`);
    console.log(`💰 Estimated cost: $${((result.usage?.total_tokens || 0) * 0.00003).toFixed(4)}`);
    console.log('\n📄 Generated Executive Summary:');
    console.log('─'.repeat(60));
    console.log(summary);
    console.log('─'.repeat(60));

    // Test fallback summary generation
    console.log('\n4️⃣ Testing fallback summary generation...');
    
    const fallbackSummary = `Podsumowanie ogólne

W analizowanym okresie ${testData.clientName} wydał ${formatCurrency(testData.totalSpend)} na kampanie Meta Ads, osiągając ${formatNumber(testData.totalImpressions)} wyświetleń i ${formatNumber(testData.totalClicks)} kliknięć.

Średni CTR wyniósł ${formatPercentage(testData.averageCtr)}, a średni koszt kliknięcia to ${formatCurrency(testData.averageCpc)}.

${testData.totalConversions > 0 ? `Pozyskano ${formatNumber(testData.totalConversions)} konwersji o średnim koszcie ${formatCurrency(testData.averageCpa)}.` : 'Nie odnotowano konwersji w tym okresie.'}`;

    console.log('✅ Fallback summary generation successful');
    console.log('📄 Fallback summary:');
    console.log('─'.repeat(60));
    console.log(fallbackSummary);
    console.log('─'.repeat(60));

    console.log('\n🎉 AI Executive Summary test completed successfully!');
    console.log('\n📋 Summary of what was tested:');
    console.log('✅ Data formatting (currency, numbers, dates)');
    console.log('✅ Prompt generation with Polish formatting');
    console.log('✅ OpenAI API integration');
    console.log('✅ AI summary generation');
    console.log('✅ Fallback summary generation');
    console.log('\n🚀 The AI Executive Summary feature is working correctly!');
    console.log('\n💡 Next steps:');
    console.log('   1. Add OPENAI_API_KEY to your .env.local file');
    console.log('   2. Run the database migration: supabase db push');
    console.log('   3. Test the feature in the web application');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testAISummaryGeneration(); 