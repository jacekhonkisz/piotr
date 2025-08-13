const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditPDFComparisonData() {
  console.log('🔍 COMPREHENSIVE DATABASE AUDIT FOR PDF COMPARISONS\n');
  
  try {
    // 1. Check all campaign_summaries data
    console.log('1️⃣ CAMPAIGN SUMMARIES OVERVIEW');
    const { data: allSummaries, error: summariesError } = await supabase
      .from('campaign_summaries')
      .select('client_id, summary_date, summary_type, total_spend, total_impressions, total_clicks, total_conversions, campaign_data')
      .order('summary_date', { ascending: false });
    
    if (summariesError) {
      console.error('❌ Error fetching summaries:', summariesError);
      return;
    }
    
    console.log(`📊 Total summaries found: ${allSummaries.length}`);
    
    // Group by client and summary type
    const groupedData = {};
    allSummaries.forEach(summary => {
      const key = `${summary.client_id}-${summary.summary_type}`;
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(summary);
    });
    
    console.log('\n📋 Data breakdown by client and type:');
    Object.keys(groupedData).forEach(key => {
      const [clientId, summaryType] = key.split('-');
      const summaries = groupedData[key];
      console.log(`   ${clientId.substring(0, 8)}... (${summaryType}): ${summaries.length} entries`);
    });
    
    // 2. Get client names
    console.log('\n2️⃣ CLIENT MAPPING');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email');
    
    if (!clientsError && clients) {
      clients.forEach(client => {
        const clientSummaries = allSummaries.filter(s => s.client_id === client.id);
        console.log(`   ${client.name} (${client.email}): ${clientSummaries.length} summaries`);
      });
    }
    
    // 3. Focus on monthly data for PDF comparisons
    console.log('\n3️⃣ MONTHLY DATA ANALYSIS (Required for PDF comparisons)');
    const monthlySummaries = allSummaries.filter(s => s.summary_type === 'monthly');
    console.log(`📅 Monthly summaries found: ${monthlySummaries.length}`);
    
    // Group monthly by client
    const monthlyByClient = {};
    monthlySummaries.forEach(summary => {
      if (!monthlyByClient[summary.client_id]) {
        monthlyByClient[summary.client_id] = [];
      }
      monthlyByClient[summary.client_id].push(summary);
    });
    
    console.log('\n📊 Monthly data per client:');
    Object.keys(monthlyByClient).forEach(clientId => {
      const client = clients?.find(c => c.id === clientId);
      const clientName = client ? client.name : clientId.substring(0, 8);
      const summaries = monthlyByClient[clientId];
      
      console.log(`\n   👤 ${clientName}:`);
      summaries.sort((a, b) => new Date(a.summary_date) - new Date(b.summary_date));
      
      summaries.forEach(summary => {
        const date = new Date(summary.summary_date);
        const monthName = date.toLocaleDateString('pl-PL', { year: 'numeric', month: 'long' });
        console.log(`      📅 ${monthName}: ${summary.total_spend?.toFixed(2) || 0} zł, ${summary.total_impressions || 0} impressions, ${summary.total_clicks || 0} clicks`);
      });
    });
    
    // 4. Check current month and previous month specifically
    console.log('\n4️⃣ CURRENT VS PREVIOUS MONTH CHECK');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Current month start
    const currentMonthStart = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
    
    // Previous month start
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const previousMonthStart = new Date(previousYear, previousMonth, 1).toISOString().split('T')[0];
    
    console.log(`📅 Current month start: ${currentMonthStart}`);
    console.log(`📅 Previous month start: ${previousMonthStart}`);
    
    Object.keys(monthlyByClient).forEach(clientId => {
      const client = clients?.find(c => c.id === clientId);
      const clientName = client ? client.name : clientId.substring(0, 8);
      const summaries = monthlyByClient[clientId];
      
      const currentMonthData = summaries.find(s => s.summary_date === currentMonthStart);
      const previousMonthData = summaries.find(s => s.summary_date === previousMonthStart);
      
      console.log(`\n   👤 ${clientName}:`);
      console.log(`      Current month (${currentMonthStart}): ${currentMonthData ? '✅ EXISTS' : '❌ MISSING'}`);
      console.log(`      Previous month (${previousMonthStart}): ${previousMonthData ? '✅ EXISTS' : '❌ MISSING'}`);
      
      if (currentMonthData && previousMonthData) {
        console.log(`      🎯 PDF COMPARISONS SHOULD WORK!`);
        
        // Calculate sample comparison
        const spendChange = previousMonthData.total_spend > 0 
          ? ((currentMonthData.total_spend - previousMonthData.total_spend) / previousMonthData.total_spend) * 100
          : 0;
        const impressionsChange = previousMonthData.total_impressions > 0
          ? ((currentMonthData.total_impressions - previousMonthData.total_impressions) / previousMonthData.total_impressions) * 100
          : 0;
          
        console.log(`         Spend: ${currentMonthData.total_spend?.toFixed(2)} zł vs ${previousMonthData.total_spend?.toFixed(2)} zł (${spendChange > 0 ? '+' : ''}${spendChange.toFixed(1)}%)`);
        console.log(`         Impressions: ${currentMonthData.total_impressions} vs ${previousMonthData.total_impressions} (${impressionsChange > 0 ? '+' : ''}${impressionsChange.toFixed(1)}%)`);
      } else {
        console.log(`      ⚠️ PDF comparisons will NOT work - missing data`);
      }
    });
    
    // 5. Check for specific date ranges that might be used in PDF
    console.log('\n5️⃣ CHECKING COMMON DATE RANGES');
    
    // Check July 2025 and June 2025 (common test dates)
    const july2025 = '2025-07-01';
    const june2025 = '2025-06-01';
    const august2025 = '2025-08-01';
    
    console.log('\nChecking specific months:');
    [june2025, july2025, august2025].forEach(dateStr => {
      const monthData = monthlySummaries.filter(s => s.summary_date === dateStr);
      console.log(`   ${dateStr}: ${monthData.length} summaries`);
      monthData.forEach(summary => {
        const client = clients?.find(c => c.id === summary.client_id);
        const clientName = client ? client.name : summary.client_id.substring(0, 8);
        console.log(`      ${clientName}: ${summary.total_spend?.toFixed(2) || 0} zł`);
      });
    });
    
    // 6. Check campaign_data field for conversion metrics
    console.log('\n6️⃣ CONVERSION METRICS CHECK');
    const summariesWithCampaigns = monthlySummaries.filter(s => s.campaign_data && s.campaign_data.length > 0);
    console.log(`📊 Monthly summaries with campaign data: ${summariesWithCampaigns.length}/${monthlySummaries.length}`);
    
    if (summariesWithCampaigns.length > 0) {
      const sampleSummary = summariesWithCampaigns[0];
      const sampleCampaign = sampleSummary.campaign_data[0];
      console.log('   Sample campaign fields:', Object.keys(sampleCampaign));
      
      // Check for conversion fields
      const conversionFields = ['click_to_call', 'email_contacts', 'booking_step_1', 'reservations', 'reservation_value', 'booking_step_2'];
      const availableConversionFields = conversionFields.filter(field => sampleCampaign.hasOwnProperty(field));
      console.log(`   Available conversion fields: ${availableConversionFields.join(', ')}`);
    }
    
    // 7. Test PDF generation with debug logs
    console.log('\n7️⃣ TESTING PDF GENERATION WITH DEBUG');
    
    if (clients && clients.length > 0) {
      const testClient = clients[0];
      console.log(`Testing PDF with client: ${testClient.name}`);
      
      // Try generating PDF for current month
      console.log('Making PDF generation request...');
      
      try {
        const response = await fetch('http://localhost:3000/api/generate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer debug-token'
          },
          body: JSON.stringify({
            clientId: testClient.id,
            dateRange: {
              start: currentMonthStart,
              end: new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]
            }
          })
        });
        
        console.log(`PDF Generation Status: ${response.status}`);
        
        if (response.ok) {
          console.log('✅ PDF generation successful!');
        } else {
          const errorText = await response.text();
          console.log('❌ PDF generation failed:', errorText);
        }
      } catch (error) {
        console.log('❌ PDF generation error:', error.message);
      }
    }
    
    console.log('\n✅ COMPREHENSIVE AUDIT COMPLETE');
    
  } catch (error) {
    console.error('💥 Audit Error:', error);
  }
}

auditPDFComparisonData(); 