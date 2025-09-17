const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestComparisonData() {
  console.log('🧪 Creating test comparison data for PDF testing...\n');

  const clientId = '5703e71f-1222-4178-885c-ce72746d0713'; // jacek

  try {
    // Test data for monthly comparison (January 2025 vs December 2024)
    const decemberData = {
      client_id: clientId,
      summary_type: 'monthly',
      summary_date: '2024-12-01',
      total_spend: 2500.50,
      total_impressions: 150000,
      total_clicks: 2800,
      total_conversions: 45,
      average_ctr: 1.87,
      average_cpc: 0.89,
      campaign_data: [
        {
          campaign_name: 'Test Campaign A',
          spend: 1200.25,
          impressions: 75000,
          clicks: 1400,
          conversions: 25,
          click_to_call: 15,
          email_contacts: 30,
          booking_step_1: 20,
          reservations: 8,
          reservation_value: 3500.00,
          booking_step_2: 5
        },
        {
          campaign_name: 'Test Campaign B',
          spend: 1300.25,
          impressions: 75000,
          clicks: 1400,
          conversions: 20,
          click_to_call: 10,
          email_contacts: 25,
          booking_step_1: 15,
          reservations: 7,
          reservation_value: 2800.00,
          booking_step_2: 4
        }
      ]
    };

    // Test data for January 2025 (current month)
    const januaryData = {
      client_id: clientId,
      summary_type: 'monthly',
      summary_date: '2025-01-01',
      total_spend: 3197.86,
      total_impressions: 419727,
      total_clicks: 5134,
      total_conversions: 82,
      average_ctr: 1.22,
      average_cpc: 0.62,
      campaign_data: [
        {
          campaign_name: 'January Campaign A',
          spend: 1597.86,
          impressions: 209727,
          clicks: 2534,
          conversions: 45,
          click_to_call: 25,
          email_contacts: 1592,
          booking_step_1: 150,
          reservations: 38,
          reservation_value: 147988.00,
          booking_step_2: 20
        },
        {
          campaign_name: 'January Campaign B',
          spend: 1600.00,
          impressions: 210000,
          clicks: 2600,
          conversions: 37,
          click_to_call: 20,
          email_contacts: 50,
          booking_step_1: 100,
          reservations: 30,
          reservation_value: 80000.00,
          booking_step_2: 15
        }
      ]
    };

    // Test data for weekly comparison (Week of Jan 6-12 vs Dec 30 - Jan 5)
    const previousWeekData = {
      client_id: clientId,
      summary_type: 'weekly',
      summary_date: '2024-12-30',
      total_spend: 800.25,
      total_impressions: 45000,
      total_clicks: 650,
      total_conversions: 12,
      average_ctr: 1.44,
      average_cpc: 1.23,
      campaign_data: [
        {
          campaign_name: 'Previous Week Campaign',
          spend: 800.25,
          impressions: 45000,
          clicks: 650,
          conversions: 12,
          click_to_call: 8,
          email_contacts: 20,
          booking_step_1: 15,
          reservations: 5,
          reservation_value: 2500.00,
          booking_step_2: 3
        }
      ]
    };

    const currentWeekData = {
      client_id: clientId,
      summary_type: 'weekly',
      summary_date: '2025-01-06',
      total_spend: 950.75,
      total_impressions: 52000,
      total_clicks: 780,
      total_conversions: 15,
      average_ctr: 1.50,
      average_cpc: 1.22,
      campaign_data: [
        {
          campaign_name: 'Current Week Campaign',
          spend: 950.75,
          impressions: 52000,
          clicks: 780,
          conversions: 15,
          click_to_call: 10,
          email_contacts: 25,
          booking_step_1: 18,
          reservations: 7,
          reservation_value: 3200.00,
          booking_step_2: 4
        }
      ]
    };

    console.log('📝 Inserting test data...');

    // Insert monthly data
    console.log('   → December 2024 monthly data...');
    const { error: dec_error } = await supabase
      .from('campaign_summaries')
      .upsert(decemberData, { onConflict: 'client_id,summary_type,summary_date' });

    if (dec_error) {
      console.error('❌ Error inserting December data:', dec_error);
      return;
    }

    console.log('   → January 2025 monthly data...');
    const { error: jan_error } = await supabase
      .from('campaign_summaries')
      .upsert(januaryData, { onConflict: 'client_id,summary_type,summary_date' });

    if (jan_error) {
      console.error('❌ Error inserting January data:', jan_error);
      return;
    }

    // Insert weekly data
    console.log('   → Previous week data (Dec 30 - Jan 5)...');
    const { error: prev_week_error } = await supabase
      .from('campaign_summaries')
      .upsert(previousWeekData, { onConflict: 'client_id,summary_type,summary_date' });

    if (prev_week_error) {
      console.error('❌ Error inserting previous week data:', prev_week_error);
      return;
    }

    console.log('   → Current week data (Jan 6-12)...');
    const { error: curr_week_error } = await supabase
      .from('campaign_summaries')
      .upsert(currentWeekData, { onConflict: 'client_id,summary_type,summary_date' });

    if (curr_week_error) {
      console.error('❌ Error inserting current week data:', curr_week_error);
      return;
    }

    console.log('✅ Test comparison data created successfully!');
    console.log('\n📊 Summary of inserted data:');
    console.log('   📅 Monthly: December 2024 (2,500 zł) → January 2025 (3,198 zł)');
    console.log('   📅 Weekly: Dec 30-Jan 5 (800 zł) → Jan 6-12 (951 zł)');
    console.log('\n🎯 Expected comparisons:');
    console.log('   📈 Monthly spend: +27.9% increase');
    console.log('   📈 Weekly spend: +18.8% increase');
    console.log('   📊 All metrics should now show percentage changes');

  } catch (error) {
    console.error('💥 Error creating test data:', error);
  }
}

// Check if script is run directly
if (require.main === module) {
  createTestComparisonData();
}

module.exports = { createTestComparisonData }; 