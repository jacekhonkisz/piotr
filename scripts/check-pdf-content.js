#!/usr/bin/env node

/**
 * Check PDF content for comparison sections
 */

const fs = require('fs');
const path = require('path');

function checkPDFContent() {
  console.log('🔍 CHECKING PDF CONTENT FOR COMPARISON SECTIONS\n');

  // Find the most recent PDF
  const pdfDir = process.cwd();
  const pdfFiles = fs.readdirSync(pdfDir)
    .filter(file => file.startsWith('test-pdf-august-2025-') && file.endsWith('.pdf'))
    .map(file => ({ name: file, time: fs.statSync(file).mtime }))
    .sort((a, b) => b.time - a.time);

  if (pdfFiles.length === 0) {
    console.log('❌ No test PDFs found');
    return;
  }

  const latestPDF = pdfFiles[0].name;
  console.log(`📄 Checking latest PDF: ${latestPDF}`);

  // Check file size
  const stats = fs.statSync(latestPDF);
  console.log(`📊 File size: ${(stats.size / 1024).toFixed(1)} KB`);

  // Try to read PDF as text (this will show readable content if any)
  try {
    const content = fs.readFileSync(latestPDF);
    
    // Convert buffer to string and look for key phrases
    const contentStr = content.toString('utf8');
    
    console.log('\n🔍 SEARCHING FOR COMPARISON SECTIONS:');
    
    // Look for Polish comparison section headers
    const monthComparison = contentStr.includes('Porównanie miesiąc do miesiąca');
    const yearComparison = contentStr.includes('Porównanie rok do roku');
    
    console.log('   Month-over-Month section:', monthComparison ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('   Year-over-Year section:', yearComparison ? '✅ FOUND' : '❌ NOT FOUND');
    
    // Look for other key content
    const hasBelmonte = contentStr.includes('Belmonte');
    const hasAugust2025 = contentStr.includes('2025-08') || contentStr.includes('sierpnia 2025');
    const hasSpendData = contentStr.includes('7790') || contentStr.includes('7,790');
    
    console.log('\n🔍 OTHER CONTENT VERIFICATION:');
    console.log('   Belmonte Hotel mentioned:', hasBelmonte ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('   August 2025 period:', hasAugust2025 ? '✅ FOUND' : '❌ NOT FOUND');
    console.log('   Spend data (7,790):', hasSpendData ? '✅ FOUND' : '❌ NOT FOUND');
    
    if (monthComparison && yearComparison) {
      console.log('\n🎉 SUCCESS! Both comparison sections are in the PDF!');
      console.log('   The fixes are working correctly.');
    } else {
      console.log('\n❌ ISSUE: Comparison sections are missing from the PDF.');
      console.log('   This suggests the template rendering is not working.');
      console.log('\n🔧 NEXT STEPS:');
      console.log('   1. Check server logs for debug messages');
      console.log('   2. Verify the HTML template is being generated correctly');
      console.log('   3. Check if Puppeteer is rendering the HTML properly');
    }
    
  } catch (error) {
    console.log('❌ Error reading PDF:', error.message);
    console.log('   PDFs are binary files, so text search may not work perfectly.');
    console.log('   Manual inspection is recommended.');
  }

  console.log('\n📋 MANUAL VERIFICATION REQUIRED:');
  console.log(`   Open the PDF file: ${latestPDF}`);
  console.log('   Look for these sections:');
  console.log('   - "Porównanie miesiąc do miesiąca"');
  console.log('   - "Porównanie rok do roku"');
  console.log('   - Percentage changes and comparison data');
}

checkPDFContent(); 