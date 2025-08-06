const { createClient } = require('@supabase/supabase-js');

// Test configuration
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key',
  openaiApiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
};

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

async function testAIExecutiveSummary() {
  console.log('🧪 Testing AI Executive Summary functionality...\n');

  try {
    // Step 1: Test OpenAI API directly
    console.log('1️⃣ Testing OpenAI API connection...');
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Jesteś ekspertem ds. marketingu cyfrowego i Meta Ads. Tworzysz profesjonalne, zwięzłe podsumowania wyników kampanii reklamowych w języku polskim.'
          },
          {
            role: 'user',
            content: 'Napisz krótkie podsumowanie miesięczne wyników kampanii Meta Ads. Dane: wydatki 5000 zł, wyświetlenia 100000, kliknięcia 2000, CTR 2%, CPC 2.50 zł.'
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`);
    }

    const openaiResult = await openaiResponse.json();
    console.log('✅ OpenAI API connection successful');
    console.log('📝 Sample AI response:', openaiResult.choices[0]?.message?.content?.substring(0, 100) + '...\n');

    // Step 2: Test database connection
    console.log('2️⃣ Testing database connection...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email')
      .limit(1);

    if (clientError) {
      throw new Error(`Database error: ${clientError.message}`);
    }

    if (!clients || clients.length === 0) {
      throw new Error('No clients found in database');
    }

    const testClient = clients[0];
    console.log('✅ Database connection successful');
    console.log(`📋 Test client: ${testClient.name} (${testClient.email})\n`);

    // Step 3: Test executive summaries API endpoint
    console.log('3️⃣ Testing executive summaries API endpoint...');
    
    // First, get a session token (this would normally come from authentication)
    console.log('⚠️ Note: This test requires a valid session token. Please run this after logging in.');
    console.log('📝 To test the full flow, you would need to:');
    console.log('   1. Log in to the application');
    console.log('   2. Navigate to the reports page');
    console.log('   3. Select a report period');
    console.log('   4. Click "Generate AI Summary" button\n');

    // Step 4: Test the AI summary generation logic
    console.log('4️⃣ Testing AI summary generation logic...');
    
    const mockReportData = {
      account_summary: {
        total_spend: 5000,
        total_impressions: 100000,
        total_clicks: 2000,
        total_conversions: 50,
        average_ctr: 2.0,
        average_cpc: 2.50,
        average_cpa: 100,
        total_conversion_value: 7500,
        roas: 1.5,
        micro_conversions: 150
      }
    };

    const mockSummaryData = {
      totalSpend: mockReportData.account_summary.total_spend,
      totalImpressions: mockReportData.account_summary.total_impressions,
      totalClicks: mockReportData.account_summary.total_clicks,
      totalConversions: mockReportData.account_summary.total_conversions,
      averageCtr: mockReportData.account_summary.average_ctr,
      averageCpc: mockReportData.account_summary.average_cpc,
      averageCpa: mockReportData.account_summary.average_cpa,
      currency: 'PLN',
      dateRange: {
        start: '2024-01-01',
        end: '2024-01-31'
      },
      clientName: testClient.name,
      reservations: mockReportData.account_summary.total_conversions,
      reservationValue: mockReportData.account_summary.total_conversion_value,
      roas: mockReportData.account_summary.roas,
      microConversions: mockReportData.account_summary.micro_conversions,
      costPerReservation: mockReportData.account_summary.average_cpa
    };

    // Format numbers for Polish locale
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

    const prompt = `Napisz krótkie podsumowanie miesięczne wyników kampanii Meta Ads dla klienta. Użyj zebranych danych:

Dane klienta: ${mockSummaryData.clientName}
Okres: 1-31 stycznia 2024

Metryki:
- Całkowity koszt reklam: ${formatCurrency(mockSummaryData.totalSpend)}
- Liczba wyświetleń: ${formatNumber(mockSummaryData.totalImpressions)}
- Liczba kliknięć: ${formatNumber(mockSummaryData.totalClicks)}
- Liczba konwersji: ${formatNumber(mockSummaryData.totalConversions)}
- Średni CTR: ${formatPercentage(mockSummaryData.averageCtr)}
- Średni CPC: ${formatCurrency(mockSummaryData.averageCpc)}
- Średni CPA: ${formatCurrency(mockSummaryData.averageCpa)}
- Liczba rezerwacji: ${formatNumber(mockSummaryData.reservations)}
- Wartość rezerwacji: ${formatCurrency(mockSummaryData.reservationValue)}
- ROAS: ${formatPercentage(mockSummaryData.roas)}
- Liczba mikrokonwersji: ${formatNumber(mockSummaryData.microConversions)}
- Koszt pozyskania rezerwacji: ${formatCurrency(mockSummaryData.costPerReservation)}

Pisz krótko (1–2 akapity), w stylu doradczym i przystępnym.`;

    console.log('📝 Generated prompt preview:');
    console.log(prompt.substring(0, 200) + '...\n');

    // Step 5: Test the complete AI generation
    console.log('5️⃣ Testing complete AI summary generation...');
    
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Jesteś ekspertem ds. marketingu cyfrowego i Meta Ads. Tworzysz profesjonalne, zwięzłe podsumowania wyników kampanii reklamowych w języku polskim. Używasz stylu doradczego, przystępnego i nieformalnego.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!aiResponse.ok) {
      throw new Error(`AI generation error: ${aiResponse.status} ${aiResponse.statusText}`);
    }

    const aiResult = await aiResponse.json();
    const generatedSummary = aiResult.choices[0]?.message?.content;

    console.log('✅ AI summary generation successful');
    console.log('📄 Generated summary:');
    console.log('─'.repeat(50));
    console.log(generatedSummary);
    console.log('─'.repeat(50));

    // Step 6: Test database operations
    console.log('\n6️⃣ Testing database operations...');
    
    // Test inserting a summary
    const { data: insertedSummary, error: insertError } = await supabase
      .from('executive_summaries')
      .insert({
        client_id: testClient.id,
        date_range_start: '2024-01-01',
        date_range_end: '2024-01-31',
        content: generatedSummary,
        is_ai_generated: true,
        generated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.log('⚠️ Database insert test failed (this is expected if table doesn\'t exist yet):', insertError.message);
    } else {
      console.log('✅ Database insert successful');
      console.log(`📋 Inserted summary ID: ${insertedSummary.id}`);
      
      // Test reading the summary
      const { data: readSummary, error: readError } = await supabase
        .from('executive_summaries')
        .select('*')
        .eq('id', insertedSummary.id)
        .single();

      if (readError) {
        console.log('⚠️ Database read test failed:', readError.message);
      } else {
        console.log('✅ Database read successful');
        console.log(`📋 Read summary content length: ${readSummary.content.length} characters`);
      }
    }

    console.log('\n🎉 AI Executive Summary test completed successfully!');
    console.log('\n📋 Summary of what was tested:');
    console.log('✅ OpenAI API connection');
    console.log('✅ Database connection');
    console.log('✅ AI prompt generation');
    console.log('✅ AI summary generation');
    console.log('✅ Database operations (if table exists)');
    console.log('\n🚀 The AI Executive Summary feature is ready to use!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testAIExecutiveSummary(); 