#!/usr/bin/env node
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Re-collects ALL Meta weekly data from Dec 2024 onwards
 * using the CORRECTED meta-actions-parser.ts
 */

// Helper to get all Mondays in a date range
function getAllMondays(startDate: Date, endDate: Date): Date[] {
  const mondays: Date[] = [];
  const current = new Date(startDate);
  
  // Find first Monday
  while (current.getUTCDay() !== 1) {
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  // Collect all Mondays
  while (current <= endDate) {
    mondays.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 7);
  }
  
  return mondays;
}

async function recollectWeeklyData() {
  console.log('🔄 Starting Meta weekly data re-collection...\n');

  // Import services dynamically
  const { MetaAPIServiceOptimized } = await import('../src/lib/meta-api-optimized');
  const { enhanceCampaignsWithConversions } = await import('../src/lib/meta-actions-parser');

  // Get all Meta-enabled clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, ad_account_id, system_user_token, meta_access_token, reporting_frequency')
    .not('ad_account_id', 'is', null)
    .or('system_user_token.not.is.null,meta_access_token.not.is.null');

  if (clientsError || !clients?.length) {
    console.error('❌ Error fetching clients:', clientsError?.message);
    return;
  }

  console.log(`📊 Found ${clients.length} Meta-enabled clients\n`);

  // Generate all weeks from Dec 2024 to now
  const startDate = new Date('2024-12-01T00:00:00Z');
  const endDate = new Date();
  const allMondays = getAllMondays(startDate, endDate);

  console.log(`📅 Will re-collect ${allMondays.length} weeks\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const client of clients) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📱 Client: ${client.name}`);
    console.log(`${'='.repeat(80)}\n`);

    const accessToken = client.system_user_token || client.meta_access_token;
    if (!accessToken) {
      console.log('   ❌ No access token available\n');
      continue;
    }

    const metaService = new MetaAPIServiceOptimized(accessToken);

    for (const monday of allMondays) {
      const weekStart = new Date(monday);
      const weekEnd = new Date(monday);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      weekEnd.setUTCHours(23, 59, 59, 999);

      const weekStr = weekStart.toISOString().substring(0, 10);
      
      try {
        console.log(`   🔄 ${weekStr}...`);
        
        // Fetch fresh data from Meta API
        const rawData = await metaService.getCampaignInsights(
          client.ad_account_id,
          weekStart.toISOString().split('T')[0],
          weekEnd.toISOString().split('T')[0]
        );

        if (!rawData?.length) {
          skippedCount++;
          console.log(`      ⏭️  No campaigns`);
          continue;
        }

        // Parse using the NEW corrected parser
        const campaignsWithConversions = enhanceCampaignsWithConversions(rawData);

        // Aggregate metrics
        let totalSpend = 0;
        let totalImpressions = 0;
        let totalClicks = 0;
        let totalClickToCall = 0;
        let totalEmailContacts = 0;
        let totalBookingStep1 = 0;
        let totalBookingStep2 = 0;
        let totalBookingStep3 = 0;
        let totalReservations = 0;
        let totalReservationValue = 0;

        for (const campaign of campaignsWithConversions) {
          totalSpend += parseFloat(campaign.spend || '0');
          totalImpressions += parseInt(campaign.impressions || '0', 10);
          totalClicks += parseInt(campaign.clicks || '0', 10);
          totalClickToCall += campaign.click_to_call || 0;
          totalEmailContacts += campaign.email_contacts || 0;
          totalBookingStep1 += campaign.booking_step_1 || 0;
          totalBookingStep2 += campaign.booking_step_2 || 0;
          totalBookingStep3 += campaign.booking_step_3 || 0;
          totalReservations += campaign.reservations || 0;
          totalReservationValue += campaign.reservation_value || 0;
        }

        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const roas = totalSpend > 0 ? totalReservationValue / totalSpend : 0;
        const costPerReservation = totalReservations > 0 ? totalSpend / totalReservations : 0;

        // Upsert to campaign_summaries
        const { error: upsertError } = await supabase
          .from('campaign_summaries')
          .upsert({
            client_id: client.id,
            platform: 'meta',
            summary_type: 'weekly',
            summary_date: weekStr,
            total_spend: totalSpend,
            total_impressions: totalImpressions,
            total_clicks: totalClicks,
            total_conversions: totalReservations,
            average_ctr: ctr,
            average_cpc: cpc,
            average_cpa: costPerReservation,
            click_to_call: totalClickToCall,
            email_contacts: totalEmailContacts,
            booking_step_1: totalBookingStep1,
            booking_step_2: totalBookingStep2,
            booking_step_3: totalBookingStep3,
            reservations: totalReservations,
            reservation_value: totalReservationValue,
            roas: roas,
            cost_per_reservation: costPerReservation,
            campaign_data: campaignsWithConversions,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'client_id,platform,summary_type,summary_date'
          });

        if (upsertError) {
          throw upsertError;
        }

        successCount++;
        console.log(`      ✅ Success - Step 1: ${totalBookingStep1}, Step 2: ${totalBookingStep2}, Step 3: ${totalBookingStep3}`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
        console.error(`      ❌ Error: ${errorMessage}`);
      }
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 Weekly Re-collection Complete`);
  console.log(`${'='.repeat(80)}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`⏭️  Skipped (no data): ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\n💡 All weekly historical data updated with corrected funnel mapping:`);
  console.log(`   - Krok 1 (booking_step_1): Now uses link_click ✓`);
  console.log(`   - Krok 2 (booking_step_2): Now uses omni_view_content ✓`);
  console.log(`   - Krok 3 (booking_step_3): Now uses omni_initiated_checkout ✓`);
  console.log(`\n🔄 Refresh your browser to see updated weekly values!`);
}

recollectWeeklyData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

