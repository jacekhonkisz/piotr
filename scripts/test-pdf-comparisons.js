#!/usr/bin/env node

/**
 * Test PDF generation with comparison data to debug why comparisons aren't showing
 * Run with: node scripts/test-pdf-comparisons.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPDFComparisons() {
  console.log('🧪 TESTING PDF GENERATION WITH COMPARISON DATA\n');

  try {
    // Get the first client with data (Belmonte Hotel from audit)
    const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
    const dateRange = {
      start: '2025-08-01',
      end: '2025-08-31'
    };

    console.log('📋 Test Parameters:');
    console.log('   Client ID:', clientId);
    console.log('   Date Range:', `${dateRange.start} to ${dateRange.end}`);
    console.log('   Expected: Month-over-Month comparison should be available\n');

    // Make request to PDF generation API
    const response = await fetch('http://localhost:3000/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer dummy-token-for-testing'
      },
      body: JSON.stringify({
        clientId,
        dateRange
      })
    });

    console.log('📄 PDF Generation Response:');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('   Error Response:', errorText);
      return;
    }

    console.log('   ✅ PDF generated successfully!');
    console.log('   📝 Check server logs for comparison debug information');

  } catch (error) {
    console.error('❌ Error testing PDF generation:', error.message);
  }
}

// Alternative: Test the specific comparison data fetching
async function testComparisonDataFetching() {
  console.log('\n🔍 TESTING COMPARISON DATA FETCHING DIRECTLY\n');

  const clientId = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'; // Belmonte Hotel
  const currentDateRange = { start: '2025-08-01', end: '2025-08-31' };

  // Calculate previous month range (same logic as PDF generation)
  const dateParts = currentDateRange.start.split('-').map(Number);
  const year = dateParts[0];
  const month = dateParts[1];
  
  let previousYear = year;
  let previousMonth = month - 1;
  
  if (previousMonth === 0) {
    previousMonth = 12;
    previousYear = year - 1;
  }
  
  const previousDateRange = {
    start: `${previousYear}-${previousMonth.toString().padStart(2, '0')}-01`,
    end: `${previousYear}-${previousMonth.toString().padStart(2, '0')}-31`
  };

  console.log('📅 Date Calculation:');
  console.log('   Current Month:', currentDateRange.start);
  console.log('   Previous Month:', previousDateRange.start);

  // Check if previous month data exists in campaign_summaries
  const { data: storedSummary, error } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'monthly')
    .eq('summary_date', previousDateRange.start)
    .single();

  console.log('\n📊 Previous Month Data Query:');
  console.log('   Query for date:', previousDateRange.start);
  console.log('   Data found:', !!storedSummary);
  console.log('   Error:', error?.message || 'none');

  if (storedSummary) {
    console.log('   📈 Previous Month Data:');
    console.log('      Spend:', (storedSummary.total_spend || 0).toFixed(2) + ' zł');
    console.log('      Impressions:', (storedSummary.total_impressions || 0).toLocaleString());
    console.log('      Clicks:', (storedSummary.total_clicks || 0).toLocaleString());
    console.log('      Conversions:', storedSummary.total_conversions || 0);
    
    // Check campaign data for conversion metrics
    const campaignData = storedSummary.campaign_data || [];
    console.log('      Campaign Data:', campaignData.length + ' campaigns');
    
    if (campaignData.length > 0) {
      const conversions = campaignData.reduce((acc, campaign) => ({
        reservations: acc.reservations + (campaign.reservations || 0),
        reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
        email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
      }), { reservations: 0, reservation_value: 0, email_contacts: 0 });
      
      console.log('      Calculated Conversions:');
      console.log('         Reservations:', conversions.reservations);
      console.log('         Reservation Value:', conversions.reservation_value.toFixed(2) + ' zł');
      console.log('         Email Contacts:', conversions.email_contacts);
    }
  }

  // Also check current month data
  const { data: currentSummary, error: currentError } = await supabase
    .from('campaign_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('summary_type', 'monthly')
    .eq('summary_date', currentDateRange.start)
    .single();

  console.log('\n📊 Current Month Data Query:');
  console.log('   Query for date:', currentDateRange.start);
  console.log('   Data found:', !!currentSummary);
  console.log('   Error:', currentError?.message || 'none');

  if (currentSummary && storedSummary) {
    console.log('\n🎯 COMPARISON ANALYSIS:');
    console.log('   Both current and previous month data available');
    console.log('   Month-over-Month comparison SHOULD be possible');
    
    const currentSpend = currentSummary.total_spend || 0;
    const previousSpend = storedSummary.total_spend || 0;
    const spendChange = previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0;
    
    console.log('   Sample comparison:');
    console.log(`      Spend: ${currentSpend.toFixed(2)} zł vs ${previousSpend.toFixed(2)} zł (${spendChange > 0 ? '+' : ''}${spendChange.toFixed(1)}%)`);
  }
}

// Run both tests
testComparisonDataFetching().then(() => {
  console.log('\n' + '='.repeat(60));
  return testPDFComparisons();
}).catch(error => {
  console.error('Fatal error:', error);
}); 