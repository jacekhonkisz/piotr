// Test script to verify modal date range
console.log('🔍 Testing Modal Date Range...\n');

// Simulate the modal's date range logic
const selectedRange = 'monthly';
const selectedMonth = '2024-08'; // Current month
const monthOptions = [
  {
    id: '2024-08',
    label: 'Sierpień 2024',
    startDate: '2024-08-01',
    endDate: '2024-08-31'
  },
  {
    id: '2024-07',
    label: 'Lipiec 2024',
    startDate: '2024-07-01',
    endDate: '2024-07-31'
  }
];

const getDateRange = () => {
  console.log('📅 getDateRange called with:', { selectedRange, selectedMonth, monthOptions: monthOptions.length });
  
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
    const selectedOption = monthOptions.find(option => option.id === selectedMonth);
    if (selectedOption) {
      console.log('📅 Monthly date range from selected option:', selectedOption);
      return {
        start: selectedOption.startDate,
        end: selectedOption.endDate
      };
    }
  } else if (selectedRange === 'custom') {
    console.log('📅 Custom date range');
    return { start: '2024-01-01', end: '2024-12-31' };
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
console.log('📅 Final date range:', dateRange); 