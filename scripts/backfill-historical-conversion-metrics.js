const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfillHistoricalConversionMetrics() {
  console.log('🔄 Starting backfill of historical conversion metrics...');
  
  try {
    // Get all campaign summaries that have zero or null conversion metrics
    const { data: summaries, error: fetchError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa')
      .or('reservation_value.is.null,reservation_value.eq.0')
      .order('summary_date', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching summaries:', fetchError);
      return;
    }

    console.log(`📊 Found ${summaries.length} summaries to backfill`);

    for (const summary of summaries) {
      console.log(`\n🔍 Processing summary: ${summary.summary_date} (${summary.summary_type})`);
      
      let totalReservations = 0;
      let totalReservationValue = 0;
      let totalBookingStep1 = 0;
      let totalBookingStep2 = 0;
      let totalBookingStep3 = 0;

      // Extract conversion metrics from campaign_data JSONB
      if (summary.campaign_data && Array.isArray(summary.campaign_data)) {
        for (const campaign of summary.campaign_data) {
          totalReservations += parseInt(campaign.reservations || 0);
          totalReservationValue += parseFloat(campaign.reservation_value || 0);
          totalBookingStep1 += parseInt(campaign.booking_step_1 || 0);
          totalBookingStep2 += parseInt(campaign.booking_step_2 || 0);
          totalBookingStep3 += parseInt(campaign.booking_step_3 || 0);
        }
      }

      console.log(`   📈 Calculated metrics:`, {
        reservations: totalReservations,
        reservationValue: totalReservationValue,
        bookingStep1: totalBookingStep1,
        bookingStep2: totalBookingStep2,
        bookingStep3: totalBookingStep3
      });

      // Update the summary with calculated metrics
      const { error: updateError } = await supabase
        .from('campaign_summaries')
        .update({
          reservations: totalReservations,
          reservation_value: totalReservationValue,
          booking_step_1: totalBookingStep1,
          booking_step_2: totalBookingStep2,
          booking_step_3: totalBookingStep3,
          last_updated: new Date().toISOString()
        })
        .eq('id', summary.id);

      if (updateError) {
        console.error(`❌ Error updating summary ${summary.id}:`, updateError);
      } else {
        console.log(`✅ Updated summary ${summary.id}`);
      }
    }

    console.log('\n🎉 Backfill completed successfully!');
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
  }
}

// Run the backfill
backfillHistoricalConversionMetrics();
