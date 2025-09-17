 const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPercentageComparisons() {
  console.log('🧪 Testing Percentage Comparisons in PDF...\n');

  const clientId = '5703e71f-1222-4178-885c-ce72746d0713';

  try {
    // Step 1: Ensure we have clear December 2024 data
    console.log('📝 Step 1: Setting up December 2024 data...');
    const decemberData = {
      client_id: clientId,
      summary_type: 'monthly',
      summary_date: '2024-12-01',
      total_spend: 1000.00,  // Simple round numbers for easy calculation
      total_impressions: 100000,
      total_clicks: 1000,
      total_conversions: 10,
      average_ctr: 1.00,
      average_cpc: 1.00,
      campaign_data: []
    };

    const { error: dec_error } = await supabase
      .from('campaign_summaries')
      .upsert(decemberData, { onConflict: 'client_id,summary_type,summary_date' });

    if (dec_error) {
      console.error('❌ Error inserting December data:', dec_error);
      return;
    }

    // Step 2: Ensure we have clear January 2025 data
    console.log('📝 Step 2: Setting up January 2025 data...');
    const januaryData = {
      client_id: clientId,
      summary_type: 'monthly',
      summary_date: '2025-01-01',
      total_spend: 1500.00,  // 50% increase for clear percentage
      total_impressions: 150000,  // 50% increase
      total_clicks: 1200,  // 20% increase
      total_conversions: 15,  // 50% increase
      average_ctr: 0.80,  // 20% decrease
      average_cpc: 1.25,  // 25% increase
      campaign_data: []
    };

    const { error: jan_error } = await supabase
      .from('campaign_summaries')
      .upsert(januaryData, { onConflict: 'client_id,summary_type,summary_date' });

    if (jan_error) {
      console.error('❌ Error inserting January data:', jan_error);
      return;
    }

    // Step 3: Clear campaigns table and add simple test campaign
    console.log('📝 Step 3: Adding simple campaign data for January...');
    
    await supabase
      .from('campaigns')
      .delete()
      .eq('client_id', clientId)
      .gte('date_range_start', '2025-01-01');

    const campaignData = {
      client_id: clientId,
      campaign_id: 'test_jan_2025_simple',
      campaign_name: 'Test January Campaign',
      status: 'ACTIVE',
      spend: 1500.00,
      impressions: 150000,
      clicks: 1200,
      conversions: 15,
      ctr: 0.80,
      cpc: 1.25,
      date_range_start: '2025-01-01',
      date_range_end: '2025-01-31'
    };

    const { error: camp_error } = await supabase
      .from('campaigns')
      .insert([campaignData]);

    if (camp_error) {
      console.error('❌ Error inserting campaign data:', camp_error);
      return;
    }

    console.log('✅ Test data prepared!');
    console.log('\n📊 Expected comparisons:');
    console.log('   📈 Spend: 1500 vs 1000 = +50%');
    console.log('   📈 Impressions: 150000 vs 100000 = +50%');
    console.log('   📈 Clicks: 1200 vs 1000 = +20%');
    console.log('   📉 CTR: 0.80 vs 1.00 = -20%');
    console.log('   📈 CPC: 1.25 vs 1.00 = +25%');

    // Step 4: Generate PDF
    console.log('\n📄 Step 4: Generating test PDF...');
    
    const response = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-token-for-pdf-generation'
      },
      body: JSON.stringify({
        clientId: clientId,
        dateRange: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      })
    });

    if (response.ok) {
      const fs = require('fs');
      const path = require('path');
      const pdfBuffer = await response.arrayBuffer();
      const pdfPath = path.join(__dirname, '..', 'test-percentage-comparison-pdf.pdf');
      fs.writeFileSync(pdfPath, Buffer.from(pdfBuffer));
      console.log('✅ Test PDF generated: test-percentage-comparison-pdf.pdf');
      console.log(`📊 File size: ${pdfBuffer.byteLength} bytes`);
      
      console.log('\n🔍 **VERIFICATION STEPS**:');
      console.log('1. Open test-percentage-comparison-pdf.pdf');
      console.log('2. Check "Wydajność kampanii" section should show:');
      console.log('   - Wydatki łączne: 1500,00 zł ↗ +50.0% vs poprzedni miesiąc');
      console.log('   - Wyświetlenia: 150000 ↗ +50.0% vs poprzedni miesiąc');
      console.log('   - Kliknięcia: 1200 ↗ +20.0% vs poprzedni miesiąc');
      console.log('3. Check "Porównanie miesiąc do miesiąca" table exists');
      console.log('4. All percentage changes should have arrows (↗ ↘)');
      
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('❌ PDF generation failed:', errorData);
    }

  } catch (error) {
    console.error('💥 Error in test:', error);
  }
}

// Check if script is run directly
if (require.main === module) {
  testPercentageComparisons();
}

module.exports = { testPercentageComparisons }; 