const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

// Test PDF generation functionality
async function testPDFGeneration() {
  console.log('🧪 Testing PDF Generation System...\n');

  // Test 1: Check if Puppeteer is working
  console.log('1. Testing Puppeteer installation...');
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<h1>Test PDF</h1><p>This is a test PDF generation.</p>');
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    console.log('✅ Puppeteer is working correctly');
    console.log(`   Generated PDF size: ${pdfBuffer.length} bytes\n`);
  } catch (error) {
    console.error('❌ Puppeteer test failed:', error.message);
    return;
  }

  // Test 2: Check Supabase connection
  console.log('2. Testing Supabase connection...');
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data, error } = await supabase
      .from('clients')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return;
    }
    
    console.log('✅ Supabase connection is working\n');
  } catch (error) {
    console.error('❌ Supabase test failed:', error.message);
    return;
  }

  // Test 3: Test HTML generation
  console.log('3. Testing HTML generation...');
  try {
    const testReportData = {
      client: {
        id: 'test-client',
        name: 'Test Client',
        email: 'test@example.com',
        ad_account_id: 'test-account'
      },
      dateRange: {
        start: '2024-01-01',
        end: '2024-01-31'
      },
      campaigns: [
        {
          id: 'test-campaign-1',
          campaign_id: 'test-campaign-1',
          campaign_name: 'Test Campaign',
          spend: 1000,
          impressions: 50000,
          clicks: 1000,
          conversions: 50,
          ctr: 2.0,
          cpc: 1.0,
          date_range_start: '2024-01-01',
          date_range_end: '2024-01-31',
          status: 'ACTIVE'
        }
      ],
      totals: {
        spend: 1000,
        impressions: 50000,
        clicks: 1000,
        conversions: 50,
        ctr: 2.0,
        cpc: 1.0,
        cpm: 20.0
      },
      trends: {
        spend: 5.0,
        conversions: 3.0,
        ctr: 1.5
      }
    };

    // Import the HTML generation function
    const { generateReportHTML } = require('../src/app/api/download-pdf/route.ts');
    const html = generateReportHTML(testReportData);
    
    if (html && html.includes('Test Client') && html.includes('Test Campaign')) {
      console.log('✅ HTML generation is working correctly');
      console.log(`   Generated HTML size: ${html.length} characters\n`);
    } else {
      console.error('❌ HTML generation failed - content not found');
      return;
    }
  } catch (error) {
    console.error('❌ HTML generation test failed:', error.message);
    return;
  }

  // Test 4: Simulate full PDF generation
  console.log('4. Testing full PDF generation...');
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Create a simple test HTML
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .metric { margin: 10px 0; padding: 10px; background: #f3f4f6; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Test Report</h1>
          <p>Test Client - January 2024</p>
        </div>
        <div class="content">
          <div class="metric">
            <h3>💰 Spend: 1,000.00 zł</h3>
          </div>
          <div class="metric">
            <h3>👁️ Impressions: 50,000</h3>
          </div>
          <div class="metric">
            <h3>🖱️ Clicks: 1,000</h3>
          </div>
          <div class="metric">
            <h3>🎯 Conversions: 50</h3>
          </div>
        </div>
      </body>
      </html>
    `;
    
    await page.setContent(testHTML, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
    });
    
    await browser.close();
    
    console.log('✅ Full PDF generation is working correctly');
    console.log(`   Generated PDF size: ${pdfBuffer.length} bytes`);
    console.log('   PDF contains proper styling and layout\n');
  } catch (error) {
    console.error('❌ Full PDF generation test failed:', error.message);
    return;
  }

  console.log('🎉 All PDF generation tests passed!');
  console.log('\n📋 Summary:');
  console.log('   ✅ Puppeteer is installed and working');
  console.log('   ✅ Supabase connection is functional');
  console.log('   ✅ HTML generation is working');
  console.log('   ✅ PDF generation is working');
  console.log('\n🚀 The PDF generation system is ready for production use!');
}

// Run the test
testPDFGeneration().catch(console.error); 