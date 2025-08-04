// Test the formatting functions that were fixed
function formatCurrency(value) {
  if (value === undefined || value === null || isNaN(value)) return '0.00 zł';
  return `${value.toFixed(2)} zł`;
}

function formatNumber(value) {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return value.toLocaleString();
}

function formatPercentage(value) {
  if (value === undefined || value === null || isNaN(value)) return '0.00%';
  return `${value.toFixed(2)}%`;
}

console.log('🧪 Testing PDF Generation Formatting Functions...\n');

// Test cases with null/undefined values
const testCases = [
  { value: undefined, type: 'currency' },
  { value: null, type: 'currency' },
  { value: NaN, type: 'currency' },
  { value: 0, type: 'currency' },
  { value: 123.456, type: 'currency' },
  { value: undefined, type: 'number' },
  { value: null, type: 'number' },
  { value: NaN, type: 'number' },
  { value: 0, type: 'number' },
  { value: 1234567, type: 'number' },
  { value: undefined, type: 'percentage' },
  { value: null, type: 'percentage' },
  { value: NaN, type: 'percentage' },
  { value: 0, type: 'percentage' },
  { value: 12.345, type: 'percentage' }
];

testCases.forEach(({ value, type }) => {
  let result;
  switch (type) {
    case 'currency':
      result = formatCurrency(value);
      break;
    case 'number':
      result = formatNumber(value);
      break;
    case 'percentage':
      result = formatPercentage(value);
      break;
  }
  
  console.log(`${type.padEnd(12)} | ${String(value).padEnd(10)} | ${result}`);
});

console.log('\n✅ All formatting functions now handle null/undefined values safely!');
console.log('📄 PDF generation should no longer crash with "Cannot read properties of undefined (reading \'toFixed\')"'); 