#!/usr/bin/env node

/**
 * Test PDF generation and save to file for manual verification
 * This will generate a PDF with our fixed comparison logic
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPDFWithDownload() {
  console.log('🧪 TESTING PDF GENERATION WITH DOWNLOAD VERIFICATION\n');

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const dateRange = {
    start: '2025-08-01',
    end: '2025-08-31'
  };

  try {
    // Get client data
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    console.log('📊 Test Parameters:');
    console.log('   Client:', client.name);
    console.log('   Period: August 2025');
    console.log('   Expected Month-over-Month: August 2025 vs July 2025');
    console.log('   Expected Year-over-Year: August 2025 vs August 2024');

    // Create request body (simulating frontend)
    const requestBody = {
      clientId,
      dateRange,
      // Note: Not passing campaigns/totals to trigger database lookup path
    };

    console.log('\n📝 Making PDF generation request...');

    // Make request to PDF API
    const response = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-token-for-testing'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PDF generation failed: ${response.status} - ${errorText}`);
    }

    // Get PDF blob and save to file
    const pdfBuffer = await response.arrayBuffer();
    const filename = `test-pdf-august-2025-${Date.now()}.pdf`;
    const filepath = path.join(process.cwd(), filename);
    
    fs.writeFileSync(filepath, Buffer.from(pdfBuffer));

    console.log('\n✅ PDF Generated Successfully!');
    console.log('   File saved as:', filename);
    console.log('   File size:', (pdfBuffer.byteLength / 1024).toFixed(1), 'KB');

    console.log('\n🔍 MANUAL VERIFICATION NEEDED:');
    console.log('   1. Open the PDF file:', filename);
    console.log('   2. Look for these sections:');
    console.log('      - "Porównanie miesiąc do miesiąca" (Month-over-Month)');
    console.log('      - "Porównanie rok do roku" (Year-over-Year)');
    console.log('   3. Verify the data matches:');
    console.log('      - August 2025: ~7,790 zł');
    console.log('      - July 2025: ~26,915 zł (-71% change)');
    console.log('      - August 2024: ~22,982 zł (-66% change)');

    console.log('\n📋 Expected Results:');
    console.log('   ✅ Month-over-Month section should show August vs July');
    console.log('   ✅ Year-over-Year section should show 2025 vs 2024');
    console.log('   ✅ Percentage changes should be calculated and colored');
    console.log('   ✅ Both sections should have proper formatting');

    // Also test with direct data path
    console.log('\n🔄 Testing Direct Data Path...');
    
    const directRequestBody = {
      clientId,
      dateRange,
      campaigns: [], // Empty campaigns array
      totals: { spend: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0, cpm: 0 },
      client
    };

    const directResponse = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-token-for-testing'
      },
      body: JSON.stringify(directRequestBody)
    });

    if (directResponse.ok) {
      const directPdfBuffer = await directResponse.arrayBuffer();
      const directFilename = `test-pdf-direct-august-2025-${Date.now()}.pdf`;
      const directFilepath = path.join(process.cwd(), directFilename);
      
      fs.writeFileSync(directFilepath, Buffer.from(directPdfBuffer));

      console.log('   ✅ Direct data path PDF also generated:', directFilename);
      console.log('   📋 Compare both PDFs to ensure they show the same comparison data');
    } else {
      console.log('   ❌ Direct data path failed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Also run our database verification
async function verifyExpectedData() {
  console.log('\n📊 VERIFYING EXPECTED DATA IN DATABASE:\n');

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

  // Check August 2025 data
  const { data: aug2025 } = await supabase
    .from('campaign_summaries')
    .select('total_spend, total_conversions')
    .eq('client_id', clientId)
    .eq('summary_date', '2025-08-01')
    .single();

  // Check July 2025 data  
  const { data: jul2025 } = await supabase
    .from('campaign_summaries')
    .select('total_spend, total_conversions')
    .eq('client_id', clientId)
    .eq('summary_date', '2025-07-01')
    .single();

  // Check August 2024 data
  const { data: aug2024 } = await supabase
    .from('campaign_summaries')
    .select('total_spend, total_conversions')
    .eq('client_id', clientId)
    .eq('summary_date', '2024-08-01')
    .single();

  console.log('📅 Data Verification:');
  console.log('   August 2025:', aug2025 ? `${aug2025.total_spend} zł` : 'Missing');
  console.log('   July 2025:', jul2025 ? `${jul2025.total_spend} zł` : 'Missing');
  console.log('   August 2024:', aug2024 ? `${aug2024.total_spend} zł` : 'Missing');

  if (aug2025 && jul2025) {
    const monthChange = jul2025.total_spend > 0 ? 
      ((aug2025.total_spend - jul2025.total_spend) / jul2025.total_spend) * 100 : 0;
    console.log('   Month-over-Month Change:', `${monthChange > 0 ? '+' : ''}${monthChange.toFixed(1)}%`);
  }

  if (aug2025 && aug2024) {
    const yearChange = aug2024.total_spend > 0 ? 
      ((aug2025.total_spend - aug2024.total_spend) / aug2024.total_spend) * 100 : 0;
    console.log('   Year-over-Year Change:', `${yearChange > 0 ? '+' : ''}${yearChange.toFixed(1)}%`);
  }
}

// Run tests
verifyExpectedData()
  .then(() => testPDFWithDownload())
  .catch(console.error); 