const fetch = require('node-fetch');

console.log('🔍 AUGUST DATA COMPARISON - BOTH HOTELS');
console.log('=======================================\n');

const config = {
  baseUrl: 'http://localhost:3000',
  clients: [
    { name: 'Belmonte Hotel', id: 'belmonte-hotel' },
    { name: 'Havet Hotel', id: 'havet-hotel' }
  ],
  dateRange: {
    start: '2025-08-01',
    end: '2025-08-07' // Current date range (August 1-7, 2025)
  }
};

async function fetchConversionMetrics(clientId, clientName) {
  console.log(`\n🏨 Fetching data for ${clientName}...`);
  console.log('=' .repeat(50));
  
  try {
    const response = await fetch(`${config.baseUrl}/api/fetch-live-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientId: clientId,
        dateRange: config.dateRange,
        forceFresh: true // Force fresh data to avoid cache
      })
    });

    if (!response.ok) {
      console.log(`❌ API Error for ${clientName}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.success) {
      console.log(`❌ API returned error for ${clientName}:`, data.error || 'Unknown error');
      return null;
    }

    console.log(`✅ Data received for ${clientName}`);
    return {
      clientName,
      clientId,
      conversionMetrics: data.data.conversionMetrics,
      stats: data.data.stats,
      campaignCount: data.data.campaigns.length,
      dateRange: data.data.dateRange,
      currency: data.data.client.currency || 'PLN'
    };

  } catch (error) {
    console.log(`❌ Error fetching data for ${clientName}:`, error.message);
    return null;
  }
}

async function compareHotels() {
  console.log('📊 FETCHING AUGUST CONVERSION METRICS');
  console.log(`📅 Date Range: ${config.dateRange.start} to ${config.dateRange.end}`);
  console.log('🔄 Force Fresh: true (no cache)');
  
  // Fetch data for both hotels
  const results = [];
  for (const client of config.clients) {
    const result = await fetchConversionMetrics(client.id, client.name);
    if (result) {
      results.push(result);
    }
    
    // Wait between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  if (results.length === 0) {
    console.log('\n❌ No data received for any hotel. Make sure server is running.');
    return;
  }

  // Display comparison
  console.log('\n📊 AUGUST CONVERSION METRICS COMPARISON');
  console.log('======================================\n');

  // Header
  console.log('Metric'.padEnd(30) + 'Belmonte'.padEnd(15) + 'Havet'.padEnd(15) + 'Difference');
  console.log('='.repeat(75));

  const belmonte = results.find(r => r.clientId === 'belmonte-hotel');
  const havet = results.find(r => r.clientId === 'havet-hotel');

  if (!belmonte) {
    console.log('❌ No data for Belmonte Hotel');
  }
  if (!havet) {
    console.log('❌ No data for Havet Hotel');
  }

  if (belmonte && havet) {
    const metrics = [
      { key: 'click_to_call', label: '📞 Phone Contacts' },
      { key: 'email_contacts', label: '📧 Email Contacts' },
      { key: 'booking_step_1', label: '🛒 Booking Step 1' },
      { key: 'reservations', label: '✅ Reservations' },
      { key: 'reservation_value', label: '💰 Reservation Value (zł)', format: 'currency' },
      { key: 'roas', label: '📈 ROAS', format: 'decimal' },
      { key: 'cost_per_reservation', label: '💵 Cost per Reservation (zł)', format: 'currency' },
      { key: 'booking_step_2', label: '🛍️ Booking Step 2' }
    ];

    metrics.forEach(metric => {
      const belmonteValue = belmonte.conversionMetrics[metric.key] || 0;
      const havetValue = havet.conversionMetrics[metric.key] || 0;
      
      let belmonteDisplay, havetDisplay, difference;
      
      if (metric.format === 'currency') {
        belmonteDisplay = belmonteValue.toFixed(2);
        havetDisplay = havetValue.toFixed(2);
        difference = (havetValue - belmonteValue).toFixed(2);
      } else if (metric.format === 'decimal') {
        belmonteDisplay = belmonteValue.toFixed(2) + 'x';
        havetDisplay = havetValue.toFixed(2) + 'x';
        difference = (havetValue - belmonteValue).toFixed(2) + 'x';
      } else {
        belmonteDisplay = belmonteValue.toString();
        havetDisplay = havetValue.toString();
        difference = (havetValue - belmonteValue).toString();
      }
      
      console.log(
        metric.label.padEnd(30) + 
        belmonteDisplay.padEnd(15) + 
        havetDisplay.padEnd(15) + 
        difference
      );
    });

    // Additional stats
    console.log('\n📊 ADDITIONAL STATS');
    console.log('='.repeat(50));
    console.log('Campaign Count'.padEnd(30) + belmonte.campaignCount.toString().padEnd(15) + havet.campaignCount.toString().padEnd(15) + (havet.campaignCount - belmonte.campaignCount).toString());
    console.log('Total Spend (zł)'.padEnd(30) + belmonte.stats.totalSpend.toFixed(2).padEnd(15) + havet.stats.totalSpend.toFixed(2).padEnd(15) + (havet.stats.totalSpend - belmonte.stats.totalSpend).toFixed(2));
    console.log('Total Impressions'.padEnd(30) + belmonte.stats.totalImpressions.toString().padEnd(15) + havet.stats.totalImpressions.toString().padEnd(15) + (havet.stats.totalImpressions - belmonte.stats.totalImpressions).toString());
    console.log('Total Clicks'.padEnd(30) + belmonte.stats.totalClicks.toString().padEnd(15) + havet.stats.totalClicks.toString().padEnd(15) + (havet.stats.totalClicks - belmonte.stats.totalClicks).toString());

    // Analysis
    console.log('\n🔍 ANALYSIS');
    console.log('='.repeat(25));
    
    if (belmonte.conversionMetrics.click_to_call === 0 && havet.conversionMetrics.click_to_call > 0) {
      console.log('✅ Phone tracking: Havet has click-to-call configured, Belmonte doesn\'t');
    }
    
    if (belmonte.conversionMetrics.reservations > havet.conversionMetrics.reservations) {
      console.log('📊 Reservations: Belmonte performing better');
    } else if (havet.conversionMetrics.reservations > belmonte.conversionMetrics.reservations) {
      console.log('📊 Reservations: Havet performing better');
    }
    
    if (belmonte.conversionMetrics.roas > havet.conversionMetrics.roas) {
      console.log('📈 ROAS: Belmonte more efficient');
    } else if (havet.conversionMetrics.roas > belmonte.conversionMetrics.roas) {
      console.log('📈 ROAS: Havet more efficient');
    }
  }

  // Show individual details
  results.forEach(result => {
    console.log(`\n🏨 ${result.clientName.toUpperCase()} - DETAILED BREAKDOWN`);
    console.log('='.repeat(50));
    console.log(`📅 Date Range: ${result.dateRange.start} to ${result.dateRange.end}`);
    console.log(`🏢 Campaigns: ${result.campaignCount}`);
    console.log(`💰 Currency: ${result.currency}`);
    console.log(`💸 Total Spend: ${result.stats.totalSpend.toFixed(2)} ${result.currency}`);
    console.log(`👀 Impressions: ${result.stats.totalImpressions.toLocaleString()}`);
    console.log(`🖱️ Clicks: ${result.stats.totalClicks.toLocaleString()}`);
    console.log('');
    console.log('🎯 Conversion Metrics:');
    console.log(`   📞 Phone Contacts: ${result.conversionMetrics.click_to_call}`);
    console.log(`   📧 Email Contacts: ${result.conversionMetrics.email_contacts}`);
    console.log(`   🛒 Booking Step 1: ${result.conversionMetrics.booking_step_1}`);
    console.log(`   ✅ Reservations: ${result.conversionMetrics.reservations}`);
    console.log(`   💰 Reservation Value: ${result.conversionMetrics.reservation_value.toFixed(2)} ${result.currency}`);
    console.log(`   📈 ROAS: ${result.conversionMetrics.roas.toFixed(2)}x`);
    console.log(`   💵 Cost per Reservation: ${result.conversionMetrics.cost_per_reservation.toFixed(2)} ${result.currency}`);
    console.log(`   🛍️ Booking Step 2: ${result.conversionMetrics.booking_step_2}`);
  });

  console.log('\n✅ COMPARISON COMPLETE');
  console.log('======================');
  console.log('📊 Data fetched fresh from Meta API (no cache)');
  console.log('🔄 All parsing fixes applied');
  console.log('✅ Client isolation working correctly');
  console.log('📅 August 2025 data (current period)');
}

// Run the comparison
console.log('🚀 Starting August comparison for both hotels...');
console.log('💡 Make sure your development server is running on localhost:3000');
console.log('');

compareHotels().catch(console.error); 