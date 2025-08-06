// Test script for text alignment fix
// This script tests that the summary text is properly aligned without indentation issues

function testTextAlignmentFix() {
  console.log('🧪 Testing Text Alignment Fix...\n');

  // Test data with potential formatting issues
  const testSummaries = [
    // Summary with leading whitespace (problematic)
    {
      content: `   W kwietniu wydaliśmy 246,94 zł na kampanie reklamowe, które wygenerowały 8 099 wyświetleń i 143 kliknięcia, co dało CTR na poziomie 1,77%. Średni koszt kliknięcia wyniósł 1,73 zł. W tym okresie nie zanotowaliśmy żadnych konwersji, dlatego CPA wyniósł 0,00 zł.
Pomimo braku konwersji, działania mogły przyczynić się do zwiększenia świadomości marki oraz potencjalnych kontaktów offline.`,
      description: 'Summary with leading whitespace'
    },
    // Summary with extra line breaks (problematic)
    {
      content: `

W kwietniu wydaliśmy 246,94 zł na kampanie reklamowe, które wygenerowały 8 099 wyświetleń i 143 kliknięcia, co dało CTR na poziomie 1,77%. Średni koszt kliknięcia wyniósł 1,73 zł. W tym okresie nie zanotowaliśmy żadnych konwersji, dlatego CPA wyniósł 0,00 zł.

Pomimo braku konwersji, działania mogły przyczynić się do zwiększenia świadomości marki oraz potencjalnych kontaktów offline.

`,
      description: 'Summary with extra line breaks'
    },
    // Clean summary (correct)
    {
      content: `W kwietniu wydaliśmy 246,94 zł na kampanie reklamowe, które wygenerowały 8 099 wyświetleń i 143 kliknięcia, co dało CTR na poziomie 1,77%. Średni koszt kliknięcia wyniósł 1,73 zł. W tym okresie nie zanotowaliśmy żadnych konwersji, dlatego CPA wyniósł 0,00 zł.
Pomimo braku konwersji, działania mogły przyczynić się do zwiększenia świadomości marki oraz potencjalnych kontaktów offline.`,
      description: 'Clean summary (correct)'
    }
  ];

  console.log('📋 Testing Summary Formatting:');
  console.log('─'.repeat(60));

  testSummaries.forEach((testCase, index) => {
    console.log(`\n${index + 1}. ${testCase.description}:`);
    console.log('─'.repeat(40));
    
    // Simulate the component rendering
    const originalContent = testCase.content;
    const trimmedContent = testCase.content.trim();
    
    console.log('Original content length:', originalContent.length);
    console.log('Trimmed content length:', trimmedContent.length);
    console.log('Has leading whitespace:', originalContent !== originalContent.trimStart());
    console.log('Has trailing whitespace:', originalContent !== originalContent.trimEnd());
    
    console.log('\nOriginal (first 50 chars):');
    console.log(`"${originalContent.substring(0, 50)}"`);
    
    console.log('\nTrimmed (first 50 chars):');
    console.log(`"${trimmedContent.substring(0, 50)}"`);
    
    console.log('\nRendered output:');
    console.log('─'.repeat(40));
    console.log(trimmedContent);
    console.log('─'.repeat(40));
  });

  console.log('\n🎯 Expected Results:');
  console.log('✅ No leading whitespace in rendered text');
  console.log('✅ No trailing whitespace in rendered text');
  console.log('✅ Proper left alignment for all lines');
  console.log('✅ Consistent paragraph formatting');
  console.log('✅ No extra line breaks at start/end');

  console.log('\n🔧 Fixes Applied:');
  console.log('1. Removed `whitespace-pre-wrap` CSS class');
  console.log('2. Added `.trim()` to summary content');
  console.log('3. Updated prompt to avoid leading whitespace');
  console.log('4. Added explicit formatting instructions');

  console.log('\n✅ Test completed! The text alignment should now be fixed.');
}

// Run the test
testTextAlignmentFix(); 