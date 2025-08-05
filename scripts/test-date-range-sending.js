// Test script to verify date range sending
console.log('🔍 Testing Date Range Sending...\n');

// Simulate the exact flow from the modal
const simulateModalFlow = () => {
  console.log('📅 Simulating modal flow...');
  
  // Step 1: Modal opens and resets
  console.log('1️⃣ Modal opens and resets state');
  
  // Step 2: Generate month options (current month is August 2025)
  const today = new Date();
  const months = [];
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    
    months.push({
      id: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${monthNames[month]} ${year}`,
      startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
    });
  }
  
  console.log('2️⃣ Generated month options:', months.slice(0, 3).map(m => `${m.id}: ${m.startDate} to ${m.endDate}`));
  
  // Step 3: Set current month as default
  const currentMonthId = months[0]?.id || '';
  console.log('3️⃣ Set default selected month:', currentMonthId);
  
  // Step 4: Simulate getDateRange function
  const selectedRange = 'monthly';
  const selectedMonth = currentMonthId;
  
  const getDateRange = () => {
    console.log('4️⃣ getDateRange called with:', { selectedRange, selectedMonth, monthOptions: months.length });
    
    if (selectedRange === 'quarterly') {
      const today = new Date();
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
      const quarterEnd = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
      const result = {
        start: `${quarterStart.getFullYear()}-${String(quarterStart.getMonth() + 1).padStart(2, '0')}-01`,
        end: `${quarterEnd.getFullYear()}-${String(quarterEnd.getMonth() + 1).padStart(2, '0')}-${String(quarterEnd.getDate()).padStart(2, '0')}`
      };
      console.log('📅 Quarterly date range:', result);
      return result;
    } else if (selectedRange === 'monthly' && selectedMonth) {
      const selectedOption = months.find(option => option.id === selectedMonth);
      if (selectedOption) {
        console.log('📅 Monthly date range from selected option:', selectedOption);
        return {
          start: selectedOption.startDate,
          end: selectedOption.endDate
        };
      }
    } else if (selectedRange === 'custom') {
      console.log('📅 Custom date range');
      return { start: '2025-08-01', end: '2025-08-31' };
    }
    
    // Fallback to current month
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const result = {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`
    };
    console.log('📅 Fallback date range:', result);
    return result;
  };
  
  const dateRange = getDateRange();
  console.log('5️⃣ Final date range to be sent:', dateRange);
  
  return dateRange;
};

const result = simulateModalFlow();
console.log('\n✅ Expected date range:', result);
console.log('❓ But server logs showed: { start: "2024-01-17", end: "2025-08-31" }');
console.log('🔍 This suggests the modal is NOT sending the correct date range!'); 