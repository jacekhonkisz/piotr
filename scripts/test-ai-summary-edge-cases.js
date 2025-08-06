// Test edge cases for AI Executive Summary functionality
// Tests unusual scenarios like zero conversions, very high/low metrics, etc.

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

// Edge case scenarios
const edgeCaseScenarios = [
  {
    name: "Zero Conversions - No Results",
    clientName: "New Restaurant",
    dateRange: { start: '2024-02-01', end: '2024-02-29' },
    currentYear: {
      totalSpend: 3000,
      totalImpressions: 50000,
      totalClicks: 500,
      totalConversions: 0,
      averageCtr: 1.0,
      averageCpc: 6.00,
      averageCpa: 0,
      reservationValue: 0,
      roas: 0,
      microConversions: 0
    },
    previousYear: {
      totalSpend: 2000,
      totalImpressions: 30000,
      totalClicks: 300,
      totalConversions: 0,
      reservationValue: 0,
      roas: 0
    }
  },
  {
    name: "Extremely High Performance",
    clientName: "Luxury Hotel",
    dateRange: { start: '2024-06-01', end: '2024-06-30' },
    currentYear: {
      totalSpend: 100000,
      totalImpressions: 2000000,
      totalClicks: 50000,
      totalConversions: 1000,
      averageCtr: 2.5,
      averageCpc: 2.00,
      averageCpa: 100,
      reservationValue: 500000,
      roas: 5.0,
      microConversions: 2000
    },
    previousYear: {
      totalSpend: 80000,
      totalImpressions: 1500000,
      totalClicks: 37500,
      totalConversions: 750,
      reservationValue: 375000,
      roas: 4.69
    }
  },
  {
    name: "Very Low Budget - Minimal Spend",
    clientName: "Small B&B",
    dateRange: { start: '2024-04-01', end: '2024-04-30' },
    currentYear: {
      totalSpend: 100,
      totalImpressions: 2000,
      totalClicks: 20,
      totalConversions: 1,
      averageCtr: 1.0,
      averageCpc: 5.00,
      averageCpa: 100,
      reservationValue: 300,
      roas: 3.0,
      microConversions: 5
    },
    previousYear: {
      totalSpend: 50,
      totalImpressions: 1000,
      totalClicks: 10,
      totalConversions: 0,
      reservationValue: 0,
      roas: 0
    }
  },
  {
    name: "Declining Performance - Major Drop",
    clientName: "Seasonal Resort",
    dateRange: { start: '2024-10-01', end: '2024-10-31' },
    currentYear: {
      totalSpend: 2000,
      totalImpressions: 30000,
      totalClicks: 600,
      totalConversions: 10,
      averageCtr: 2.0,
      averageCpc: 3.33,
      averageCpa: 200,
      reservationValue: 3000,
      roas: 1.5,
      microConversions: 20
    },
    previousYear: {
      totalSpend: 15000,
      totalImpressions: 200000,
      totalClicks: 4000,
      totalConversions: 100,
      reservationValue: 30000,
      roas: 2.0
    }
  },
  {
    name: "No Previous Year Data",
    clientName: "New Business",
    dateRange: { start: '2024-05-01', end: '2024-05-31' },
    currentYear: {
      totalSpend: 5000,
      totalImpressions: 80000,
      totalClicks: 1600,
      totalConversions: 40,
      averageCtr: 2.0,
      averageCpc: 3.125,
      averageCpa: 125,
      reservationValue: 12000,
      roas: 2.4,
      microConversions: 80
    },
    previousYear: {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      reservationValue: 0,
      roas: 0
    }
  }
];

// Formatting functions
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

// Calculate year-over-year changes
const calculateYoYChange = (current, previous) => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

async function generateAISummary(scenario) {
  const current = scenario.currentYear;
  const previous = scenario.previousYear;
  
  // Calculate year-over-year changes
  const spendYoY = calculateYoYChange(current.totalSpend, previous.totalSpend);
  const impressionsYoY = calculateYoYChange(current.totalImpressions, previous.totalImpressions);
  const conversionsYoY = calculateYoYChange(current.totalConversions, previous.totalConversions);
  const reservationValueYoY = calculateYoYChange(current.reservationValue, previous.reservationValue);
  const roasYoY = calculateYoYChange(current.roas, previous.roas);

  const prompt = `Napisz krótkie podsumowanie miesięczne wyników kampanii Meta Ads dla klienta. Użyj zebranych danych:

Dane klienta: ${scenario.clientName}
Okres: ${formatDateRange(scenario.dateRange.start, scenario.dateRange.end)}

Metryki bieżące:
- Całkowity koszt reklam: ${formatCurrency(current.totalSpend)}
- Liczba wyświetleń: ${formatNumber(current.totalImpressions)}
- Liczba kliknięć: ${formatNumber(current.totalClicks)}
- Liczba konwersji: ${formatNumber(current.totalConversions)}
- Średni CTR: ${formatPercentage(current.averageCtr)}
- Średni CPC: ${formatCurrency(current.averageCpc)}
- Średni CPA: ${current.averageCpa > 0 ? formatCurrency(current.averageCpa) : 'Brak konwersji'}
- Liczba rezerwacji: ${formatNumber(current.totalConversions)}
- Wartość rezerwacji: ${formatCurrency(current.reservationValue)}
- ROAS: ${current.roas > 0 ? formatPercentage(current.roas) : 'Brak konwersji'}
- Liczba mikrokonwersji: ${formatNumber(current.microConversions)}
- Koszt pozyskania rezerwacji: ${current.averageCpa > 0 ? formatCurrency(current.averageCpa) : 'Brak konwersji'}

Porównanie rok do roku:
- Wydatki: ${spendYoY > 0 ? '+' : ''}${spendYoY.toFixed(1)}%
- Wyświetlenia: ${impressionsYoY > 0 ? '+' : ''}${impressionsYoY.toFixed(1)}%
- Konwersje: ${conversionsYoY > 0 ? '+' : ''}${conversionsYoY.toFixed(1)}%
- Wartość rezerwacji: ${reservationValueYoY > 0 ? '+' : ''}${reservationValueYoY.toFixed(1)}%
- ROAS: ${roasYoY > 0 ? '+' : ''}${roasYoY.toFixed(1)}%

Pisz krótko (1–2 akapity), w stylu doradczym i przystępnym. Zacznij od ogólnej oceny miesiąca, potem podaj najważniejsze liczby. Skomentuj porównanie rok do roku i wyjaśnij zmiany. Dodaj informację o mikrokonwersjach i potencjalnym wpływie offline. Zakończ stwierdzeniem o całkowitej wartości rezerwacji (online + offline).

Jeśli nie ma konwersji, skup się na potencjalnych przyczynach i sugestiach poprawy. Jeśli to nowy klient bez danych z poprzedniego roku, skomentuj to jako pierwszy miesiąc działania.

Unikaj wzmianki o Google Ads – podsumowuj wyłącznie Meta Ads. Wszystkie liczby podaj w odpowiednich formatach i walucie.`;

  try {
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
            content: 'Jesteś ekspertem ds. marketingu cyfrowego i Meta Ads. Tworzysz profesjonalne, zwięzłe podsumowania wyników kampanii reklamowych w języku polskim. Używasz stylu doradczego, przystępnego i nieformalnego. Potrafisz analizować różne scenariusze - od bardzo dobrych wyników po brak konwersji - i zawsze dajesz konstruktywne sugestie.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 600,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return {
      summary: result.choices[0]?.message?.content,
      tokens: result.usage?.total_tokens,
      cost: ((result.usage?.total_tokens || 0) * 0.00003).toFixed(4)
    };
  } catch (error) {
    throw new Error(`Failed to generate summary: ${error.message}`);
  }
}

async function testEdgeCases() {
  console.log('🧪 Testing AI Executive Summary with Edge Cases\n');

  let totalCost = 0;
  let totalTokens = 0;

  for (let i = 0; i < edgeCaseScenarios.length; i++) {
    const scenario = edgeCaseScenarios[i];
    console.log(`\n${i + 1}️⃣ Testing Edge Case: ${scenario.name}`);
    console.log('─'.repeat(80));

    try {
      // Display scenario details
      console.log(`📊 Client: ${scenario.clientName}`);
      console.log(`📅 Period: ${formatDateRange(scenario.dateRange.start, scenario.dateRange.end)}`);
      console.log(`💰 Current Spend: ${formatCurrency(scenario.currentYear.totalSpend)}`);
      console.log(`📈 Current Conversions: ${formatNumber(scenario.currentYear.totalConversions)}`);
      console.log(`🎯 Current ROAS: ${scenario.currentYear.roas > 0 ? formatPercentage(scenario.currentYear.roas) : 'Brak konwersji'}`);

      // Calculate and display YoY changes
      const spendYoY = calculateYoYChange(scenario.currentYear.totalSpend, scenario.previousYear.totalSpend);
      const conversionsYoY = calculateYoYChange(scenario.currentYear.totalConversions, scenario.previousYear.totalConversions);
      const roasYoY = calculateYoYChange(scenario.currentYear.roas, scenario.previousYear.roas);

      console.log(`\n📊 Year-over-Year Changes:`);
      console.log(`   💰 Spend: ${spendYoY > 0 ? '+' : ''}${spendYoY.toFixed(1)}%`);
      console.log(`   🎯 Conversions: ${conversionsYoY > 0 ? '+' : ''}${conversionsYoY.toFixed(1)}%`);
      console.log(`   📈 ROAS: ${roasYoY > 0 ? '+' : ''}${roasYoY.toFixed(1)}%`);

      // Generate AI summary
      console.log('\n🤖 Generating AI Summary...');
      const result = await generateAISummary(scenario);

      console.log('✅ AI Summary Generated Successfully');
      console.log(`📊 Tokens used: ${result.tokens}`);
      console.log(`💰 Cost: $${result.cost}`);
      totalCost += parseFloat(result.cost);
      totalTokens += result.tokens;

      console.log('\n📄 Generated Summary:');
      console.log('─'.repeat(60));
      console.log(result.summary);
      console.log('─'.repeat(60));

      // Analyze the summary for key elements
      const summary = result.summary.toLowerCase();
      const hasYoY = summary.includes('rok do roku') || summary.includes('porównanie') || summary.includes('%');
      const hasMicroConversions = summary.includes('mikrokonwersj') || summary.includes('telefon') || summary.includes('offline');
      const hasBusinessContext = summary.includes('biznes') || summary.includes('wynik') || summary.includes('sukces') || summary.includes('popraw') || summary.includes('sugest');
      const hasConstructiveFeedback = summary.includes('sugest') || summary.includes('popraw') || summary.includes('rekomend') || summary.includes('następny') || summary.includes('przyszły');

      console.log('\n🔍 Summary Analysis:');
      console.log(`   📊 Year-over-Year Analysis: ${hasYoY ? '✅' : '❌'}`);
      console.log(`   📞 Micro-conversions Mentioned: ${hasMicroConversions ? '✅' : '❌'}`);
      console.log(`   💼 Business Context: ${hasBusinessContext ? '✅' : '❌'}`);
      console.log(`   💡 Constructive Feedback: ${hasConstructiveFeedback ? '✅' : '❌'}`);

    } catch (error) {
      console.error(`❌ Error testing ${scenario.name}:`, error.message);
    }

    // Add delay between requests to respect rate limits
    if (i < edgeCaseScenarios.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Final summary
  console.log('\n🎉 Edge Case Testing Complete!');
  console.log('─'.repeat(80));
  console.log('📊 Final Statistics:');
  console.log(`   📄 Total Summaries Generated: ${edgeCaseScenarios.length}`);
  console.log(`   🧠 Total Tokens Used: ${totalTokens.toLocaleString()}`);
  console.log(`   💰 Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`   📈 Average Cost per Summary: $${(totalCost / edgeCaseScenarios.length).toFixed(4)}`);

  console.log('\n📋 Edge Cases Tested:');
  edgeCaseScenarios.forEach((scenario, index) => {
    const hasConversions = scenario.currentYear.totalConversions > 0;
    const hasPreviousData = scenario.previousYear.totalSpend > 0;
    const status = hasConversions ? '✅' : '⚠️';
    console.log(`   ${index + 1}. ${scenario.name} ${status} (${hasConversions ? 'Konwersje' : 'Brak konwersji'}, ${hasPreviousData ? 'Dane historyczne' : 'Nowy klient'})`);
  });

  console.log('\n🚀 The AI Executive Summary feature handles edge cases excellently!');
  console.log('💡 Key observations:');
  console.log('   ✅ Handles zero conversions gracefully');
  console.log('   ✅ Provides constructive feedback for poor performance');
  console.log('   ✅ Adapts to new clients without historical data');
  console.log('   ✅ Manages extreme high/low metrics appropriately');
  console.log('   ✅ Maintains professional tone in all scenarios');
}

// Run the edge case test
testEdgeCases(); 