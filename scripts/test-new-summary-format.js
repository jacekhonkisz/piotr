// Test script for new summary format
// This script tests the updated prompt that should generate concise, factual summaries

function testNewSummaryFormat() {
  console.log('🧪 Testing New Summary Format...\n');

  // Test data (same as in the image)
  const testData = {
    totalSpend: 246.94,
    totalImpressions: 8099,
    totalClicks: 143,
    totalConversions: 0,
    averageCtr: 1.77,
    averageCpc: 1.73,
    averageCpa: 0,
    dateRange: {
      start: '2024-04-01',
      end: '2024-04-30'
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

  // New updated prompt
  const prompt = `Napisz miesięczne podsumowanie wyników kampanii Meta Ads w języku polskim.

Pisz z perspektywy zespołu ("zrobiliśmy", "wydaliśmy", "zaobserwowaliśmy").

Nie używaj nazwy klienta, firmy ani nazw platformy w tekście podsumowania.

Nie wymyślaj danych ani zdarzeń – opieraj się tylko na dostarczonych liczbach.

Jeśli są dane historyczne (poprzedni miesiąc, rok, 3-miesięczna zmiana), porównaj je rzeczowo (np. "W porównaniu do marca, liczba kliknięć wzrosła o 10%").

Skup się na najważniejszych wskaźnikach: wydatki, wyświetlenia, kliknięcia, CTR, CPC, konwersje, CPA, zmiany miesiąc do miesiąca.

Jeśli nie ma konwersji – zaznacz to krótko i rzeczowo, ewentualnie odnieś się do potencjalnych efektów pośrednich (np. wzrost świadomości marki).

Nie dodawaj żadnych zwrotów grzecznościowych, podziękowań, ani formułek typu "cieszymy się", "dziękujemy" itp.

Nie dopisuj planów na przyszłość, jeśli nie wynikają bezpośrednio z danych (np. "skupimy się na..." tylko jeśli wynika to z analizy spadków/wzrostów).

Tekst ma być spójny, zwięzły, bez zbędnych akapitów czy pustych linii. Nie rozpoczynaj tekstu pustą linią, nie kończ pustą linią.

Dane do analizy:
Okres: ${formatDateRange(testData.dateRange.start, testData.dateRange.end)}
Całkowity koszt reklam: ${formatCurrency(testData.totalSpend)}
Liczba wyświetleń: ${formatNumber(testData.totalImpressions)}
Liczba kliknięć: ${formatNumber(testData.totalClicks)}
CTR: ${formatPercentage(testData.averageCtr)}
CPC: ${formatCurrency(testData.averageCpc)}
Liczba konwersji: ${formatNumber(testData.totalConversions)}
CPA: ${formatCurrency(testData.averageCpa)}

Przykład stylu:

W kwietniu wydaliśmy 246,94 zł na kampanie reklamowe, które wygenerowały 8 099 wyświetleń i 143 kliknięcia, co dało CTR na poziomie 1,77%. Średni koszt kliknięcia wyniósł 1,73 zł. W tym okresie nie zanotowaliśmy żadnych konwersji, dlatego CPA wyniósł 0,00 zł. W porównaniu do poprzedniego miesiąca liczba kliknięć spadła o 8%.
Pomimo braku konwersji, działania mogły przyczynić się do zwiększenia świadomości marki oraz potencjalnych kontaktów offline.

Jeśli nie ma danych porównawczych, pomiń zdania porównujące. Zakończ podsumowanie, gdy przekażesz najważniejsze fakty.`;

  console.log('📋 Test Data:');
  console.log('─'.repeat(40));
  console.log(`Period: ${formatDateRange(testData.dateRange.start, testData.dateRange.end)}`);
  console.log(`Total Spend: ${formatCurrency(testData.totalSpend)}`);
  console.log(`Impressions: ${formatNumber(testData.totalImpressions)}`);
  console.log(`Clicks: ${formatNumber(testData.totalClicks)}`);
  console.log(`CTR: ${formatPercentage(testData.averageCtr)}`);
  console.log(`CPC: ${formatCurrency(testData.averageCpc)}`);
  console.log(`Conversions: ${formatNumber(testData.totalConversions)}`);
  console.log(`CPA: ${formatCurrency(testData.averageCpa)}`);

  console.log('\n📝 New Prompt:');
  console.log('─'.repeat(60));
  console.log(prompt);
  console.log('─'.repeat(60));

  console.log('\n🎯 Expected Improvements:');
  console.log('✅ No unnecessary phrases like "dziękujemy za zaufanie"');
  console.log('✅ No forced future predictions');
  console.log('✅ Proper paragraph alignment (no extra line breaks)');
  console.log('✅ Concise, factual tone');
  console.log('✅ Team perspective ("zrobiliśmy", "wydaliśmy")');
  console.log('✅ No empty lines at start/end');
  console.log('✅ Focus on data and facts only');

  console.log('\n📄 Expected Output Format:');
  console.log('─'.repeat(60));
  console.log('W kwietniu wydaliśmy 246,94 zł na kampanie reklamowe, które wygenerowały 8 099 wyświetleń i 143 kliknięcia, co dało CTR na poziomie 1,77%. Średni koszt kliknięcia wyniósł 1,73 zł. W tym okresie nie zanotowaliśmy żadnych konwersji, dlatego CPA wyniósł 0,00 zł.');
  console.log('Pomimo braku konwersji, działania mogły przyczynić się do zwiększenia świadomości marki oraz potencjalnych kontaktów offline.');
  console.log('─'.repeat(60));

  console.log('\n✅ Test completed! The new prompt should generate:');
  console.log('- Concise, factual summaries');
  console.log('- Proper formatting without extra line breaks');
  console.log('- No unnecessary phrases or forced predictions');
  console.log('- Team perspective writing style');
}

// Run the test
testNewSummaryFormat(); 