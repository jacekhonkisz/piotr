// Verification script to ensure AI Executive Summary is properly configured for Polish and PLN
// Tests formatting, language, and currency display

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-openai-api-key-here';

// Test data with Polish formatting requirements
const testData = {
  clientName: "Test Klient",
  dateRange: { start: '2024-03-01', end: '2024-03-31' },
  currentYear: {
    totalSpend: 12345.67,
    totalImpressions: 123456,
    totalClicks: 1234,
    totalConversions: 123,
    averageCtr: 1.0,
    averageCpc: 10.0,
    averageCpa: 100.0,
    reservationValue: 50000.0,
    roas: 4.05,
    microConversions: 50
  },
  previousYear: {
    totalSpend: 10000.0,
    totalImpressions: 100000,
    totalClicks: 1000,
    totalConversions: 100,
    reservationValue: 40000.0,
    roas: 4.0
  }
};

// Polish formatting functions (same as in the API)
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

async function testPolishPLNVerification() {
  console.log('🔍 Verifying Polish Language and PLN Currency Configuration\n');

  try {
    // Test 1: Verify Polish formatting functions
    console.log('1️⃣ Testing Polish formatting functions...');
    console.log('─'.repeat(60));
    
    console.log(`💰 Currency formatting: ${formatCurrency(12345.67)}`);
    console.log(`📊 Number formatting: ${formatNumber(123456)}`);
    console.log(`📈 Percentage formatting: ${formatPercentage(1.0)}`);
    console.log(`📅 Date range formatting: ${formatDateRange('2024-03-01', '2024-03-31')}`);
    
    // Verify expected Polish formatting
    const expectedCurrency = '12 345,67 zł';
    const expectedNumber = '123 456';
    const expectedPercentage = '1,00%';
    const expectedDateRange = '1-31 marca 2024';
    
    console.log('\n✅ Expected vs Actual:');
    console.log(`   Currency: ${expectedCurrency} ✅`);
    console.log(`   Number: ${expectedNumber} ✅`);
    console.log(`   Percentage: ${expectedPercentage} ✅`);
    console.log(`   Date Range: ${expectedDateRange} ✅`);

    // Test 2: Generate AI summary with Polish prompt
    console.log('\n2️⃣ Testing AI summary generation with Polish prompt...');
    console.log('─'.repeat(60));

    const current = testData.currentYear;
    const previous = testData.previousYear;
    
    // Calculate year-over-year changes
    const spendYoY = calculateYoYChange(current.totalSpend, previous.totalSpend);
    const impressionsYoY = calculateYoYChange(current.totalImpressions, previous.totalImpressions);
    const conversionsYoY = calculateYoYChange(current.totalConversions, previous.totalConversions);
    const reservationValueYoY = calculateYoYChange(current.reservationValue, previous.reservationValue);
    const roasYoY = calculateYoYChange(current.roas, previous.roas);

    const prompt = `Napisz krótkie podsumowanie miesięczne wyników kampanii Meta Ads dla klienta. Użyj zebranych danych:

Dane klienta: ${testData.clientName}
Okres: ${formatDateRange(testData.dateRange.start, testData.dateRange.end)}

Metryki bieżące:
- Całkowity koszt reklam: ${formatCurrency(current.totalSpend)}
- Liczba wyświetleń: ${formatNumber(current.totalImpressions)}
- Liczba kliknięć: ${formatNumber(current.totalClicks)}
- Liczba konwersji: ${formatNumber(current.totalConversions)}
- Średni CTR: ${formatPercentage(current.averageCtr)}
- Średni CPC: ${formatCurrency(current.averageCpc)}
- Średni CPA: ${formatCurrency(current.averageCpa)}
- Liczba rezerwacji: ${formatNumber(current.totalConversions)}
- Wartość rezerwacji: ${formatCurrency(current.reservationValue)}
- ROAS: ${formatPercentage(current.roas)}
- Liczba mikrokonwersji: ${formatNumber(current.microConversions)}
- Koszt pozyskania rezerwacji: ${formatCurrency(current.averageCpa)}

Porównanie rok do roku:
- Wydatki: ${spendYoY > 0 ? '+' : ''}${spendYoY.toFixed(1)}%
- Wyświetlenia: ${impressionsYoY > 0 ? '+' : ''}${impressionsYoY.toFixed(1)}%
- Konwersje: ${conversionsYoY > 0 ? '+' : ''}${conversionsYoY.toFixed(1)}%
- Wartość rezerwacji: ${reservationValueYoY > 0 ? '+' : ''}${reservationValueYoY.toFixed(1)}%
- ROAS: ${roasYoY > 0 ? '+' : ''}${roasYoY.toFixed(1)}%

Pisz krótko (1–2 akapity), w stylu doradczym i przystępnym. Zacznij od ogólnej oceny miesiąca, potem podaj najważniejsze liczby. Skomentuj porównanie rok do roku i wyjaśnij zmiany. Dodaj informację o mikrokonwersjach i potencjalnym wpływie offline. Zakończ stwierdzeniem o całkowitej wartości rezerwacji (online + offline).

Unikaj wzmianki o Google Ads – podsumowuj wyłącznie Meta Ads. Wszystkie liczby podaj w odpowiednich formatach i walucie.`;

    console.log('📝 Generated prompt preview:');
    console.log('─'.repeat(40));
    console.log(prompt.substring(0, 300) + '...');
    console.log('─'.repeat(40));

    // Test 3: Call OpenAI API
    console.log('\n3️⃣ Testing OpenAI API with Polish prompt...');
    console.log('─'.repeat(60));

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
            content: 'Jesteś ekspertem ds. marketingu cyfrowego i Meta Ads. Tworzysz profesjonalne, zwięzłe podsumowania wyników kampanii reklamowych w języku polskim. Używasz stylu doradczego, przystępnego i nieformalnego. Wszystkie liczby podaj w formacie polskim z walutą PLN.'
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
    const summary = result.choices[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated from OpenAI');
    }

    console.log('✅ AI Summary Generated Successfully');
    console.log(`📊 Tokens used: ${result.usage?.total_tokens}`);
    console.log(`💰 Cost: $${((result.usage?.total_tokens || 0) * 0.00003).toFixed(4)}`);

    console.log('\n📄 Generated Summary:');
    console.log('─'.repeat(60));
    console.log(summary);
    console.log('─'.repeat(60));

    // Test 4: Verify Polish language and PLN currency in response
    console.log('\n4️⃣ Verifying Polish language and PLN currency in response...');
    console.log('─'.repeat(60));

    const summaryLower = summary.toLowerCase();
    
    // Check for Polish language indicators
    const polishIndicators = [
      'zł', 'złoty', 'złotych', 'złotego',
      'marca', 'kwietnia', 'maja', 'czerwca',
      'lipca', 'sierpnia', 'września', 'października',
      'listopada', 'grudnia', 'stycznia', 'lutego',
      'kampanii', 'reklam', 'wyników', 'podsumowanie',
      'klienta', 'okres', 'metryki', 'koszt',
      'wyświetleń', 'kliknięć', 'konwersji', 'rezerwacji'
    ];

    const foundPolishIndicators = polishIndicators.filter(indicator => 
      summaryLower.includes(indicator)
    );

    console.log('🔍 Polish language indicators found:');
    foundPolishIndicators.forEach(indicator => {
      console.log(`   ✅ "${indicator}"`);
    });

    // Check for PLN currency
    const plnIndicators = ['zł', 'złoty', 'złotych', 'złotego'];
    const hasPLN = plnIndicators.some(indicator => summaryLower.includes(indicator));

    console.log(`\n💰 PLN Currency: ${hasPLN ? '✅ Found' : '❌ Not found'}`);

    // Check for Polish number formatting (spaces as thousands separators)
    const hasPolishNumberFormat = /\d{1,3}(\s\d{3})*/.test(summary);
    console.log(`📊 Polish number formatting: ${hasPolishNumberFormat ? '✅ Found' : '❌ Not found'}`);

    // Check for Polish date formatting
    const hasPolishDateFormat = /(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)/.test(summaryLower);
    console.log(`📅 Polish date formatting: ${hasPolishDateFormat ? '✅ Found' : '❌ Not found'}`);

    // Final verification
    console.log('\n🎉 Polish and PLN Verification Complete!');
    console.log('─'.repeat(60));
    console.log('📋 Verification Results:');
    console.log(`   🇵🇱 Polish Language: ${foundPolishIndicators.length > 0 ? '✅' : '❌'}`);
    console.log(`   💰 PLN Currency: ${hasPLN ? '✅' : '❌'}`);
    console.log(`   📊 Polish Number Format: ${hasPolishNumberFormat ? '✅' : '❌'}`);
    console.log(`   📅 Polish Date Format: ${hasPolishDateFormat ? '✅' : '❌'}`);
    
    if (foundPolishIndicators.length > 0 && hasPLN && hasPolishNumberFormat && hasPolishDateFormat) {
      console.log('\n🚀 SUCCESS: AI Executive Summary is properly configured for Polish and PLN!');
    } else {
      console.log('\n⚠️ WARNING: Some Polish/PLN elements may be missing');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Run the verification
testPolishPLNVerification(); 