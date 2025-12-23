#!/usr/bin/env node
/**
 * BACKFILL META HISTORICAL FUNNEL DATA
 * 
 * This script re-fetches historical Meta Ads data to correctly populate
 * the booking funnel steps (omni_search, omni_view_content, omni_initiated_checkout).
 * 
 * The issue: Historical data collected before parser fixes has:
 * - booking_step_2: 0 (should have omni_view_content values)
 * - booking_step_3: 0 (should have omni_initiated_checkout values)
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../src/lib/meta-api-optimized';
import { parseMetaActions, aggregateConversionMetrics, enhanceCampaignsWithConversions } from '../src/lib/meta-actions-parser';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface BackfillResult {
  period: string;
  before: {
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    reservations: number;
  };
  after: {
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    reservations: number;
  };
  success: boolean;
  error?: string;
}

async function getMonthsToBackfill(): Promise<Array<{ startDate: string; endDate: string; label: string }>> {
  // Backfill from October 2024 to August 2025 (where data is broken)
  const months: Array<{ startDate: string; endDate: string; label: string }> = [];
  
  // Start from October 2024
  const startMonth = new Date(2024, 9, 1); // October 2024
  const endMonth = new Date(2025, 7, 31); // August 2025
  
  let current = new Date(startMonth);
  
  while (current <= endMonth) {
    const year = current.getFullYear();
    const month = current.getMonth();
    
    // Get last day of month
    const lastDay = new Date(year, month + 1, 0).getDate();
    
    months.push({
      startDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      endDate: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      label: `${year}-${String(month + 1).padStart(2, '0')}`
    });
    
    // Move to next month
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

async function backfillMonthForClient(
  client: any,
  month: { startDate: string; endDate: string; label: string },
  dryRun: boolean
): Promise<BackfillResult> {
  
  const result: BackfillResult = {
    period: month.label,
    before: { booking_step_1: 0, booking_step_2: 0, booking_step_3: 0, reservations: 0 },
    after: { booking_step_1: 0, booking_step_2: 0, booking_step_3: 0, reservations: 0 },
    success: false
  };
  
  try {
    // Get current values from database
    const { data: currentSummary } = await supabase
      .from('campaign_summaries')
      .select('booking_step_1, booking_step_2, booking_step_3, reservations, campaign_data')
      .eq('client_id', client.id)
      .eq('summary_date', month.startDate)
      .eq('platform', 'meta')
      .eq('summary_type', 'monthly')
      .single();
      
    if (currentSummary) {
      result.before = {
        booking_step_1: currentSummary.booking_step_1 || 0,
        booking_step_2: currentSummary.booking_step_2 || 0,
        booking_step_3: currentSummary.booking_step_3 || 0,
        reservations: currentSummary.reservations || 0
      };
    }
    
    // Check if this month needs fixing (step2 or step3 is 0 but step1 has data)
    if (result.before.booking_step_1 > 0 && 
        (result.before.booking_step_2 === 0 || result.before.booking_step_3 === 0)) {
      
      console.log(`\n📊 ${month.label}: Needs fixing (step1: ${result.before.booking_step_1}, step2: ${result.before.booking_step_2}, step3: ${result.before.booking_step_3})`);
      
      // Get Meta access token
      const accessToken = client.meta_access_token || client.system_user_token;
      
      if (!accessToken) {
        result.error = 'No Meta access token available';
        return result;
      }
      
      // Initialize Meta API service
      const metaService = new MetaAPIService(accessToken);
      
      // Fetch data from Meta API
      console.log(`   📡 Fetching from Meta API: ${month.startDate} to ${month.endDate}`);
      
      const apiResult = await metaService.getMonthlyReport(
        client.ad_account_id,
        month.startDate,
        month.endDate
      );
      
      if (!apiResult || apiResult.length === 0) {
        result.error = 'No data from Meta API';
        return result;
      }
      
      console.log(`   ✅ Received ${apiResult.length} campaigns from Meta API`);
      
      // Parse actions using the correct parser
      const enhancedCampaigns = enhanceCampaignsWithConversions(apiResult);
      
      // Aggregate metrics
      const aggregated = aggregateConversionMetrics(enhancedCampaigns);
      
      result.after = {
        booking_step_1: aggregated.booking_step_1,
        booking_step_2: aggregated.booking_step_2,
        booking_step_3: aggregated.booking_step_3,
        reservations: aggregated.reservations
      };
      
      console.log(`   📊 New values: step1=${result.after.booking_step_1}, step2=${result.after.booking_step_2}, step3=${result.after.booking_step_3}, reservations=${result.after.reservations}`);
      
      // Calculate totals
      let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalConversions = 0;
      
      enhancedCampaigns.forEach((campaign: any) => {
        totalSpend += parseFloat(campaign.spend || 0);
        totalImpressions += parseInt(campaign.impressions || 0);
        totalClicks += parseInt(campaign.clicks || 0);
        totalConversions += parseInt(campaign.conversions || 0);
      });
      
      if (!dryRun) {
        // Update the database
        const { error: updateError } = await supabase
          .from('campaign_summaries')
          .upsert({
            client_id: client.id,
            summary_date: month.startDate,
            summary_type: 'monthly',
            platform: 'meta',
            total_spend: totalSpend,
            total_impressions: totalImpressions,
            total_clicks: totalClicks,
            total_conversions: totalConversions,
            average_ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
            average_cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
            booking_step_1: aggregated.booking_step_1,
            booking_step_2: aggregated.booking_step_2,
            booking_step_3: aggregated.booking_step_3,
            reservations: aggregated.reservations,
            reservation_value: aggregated.reservation_value,
            click_to_call: aggregated.click_to_call,
            email_contacts: aggregated.email_contacts,
            campaign_data: enhancedCampaigns.map((c: any) => ({
              campaign_id: c.campaign_id || c.id,
              campaign_name: c.campaign_name || c.name,
              spend: parseFloat(c.spend || 0),
              impressions: parseInt(c.impressions || 0),
              clicks: parseInt(c.clicks || 0),
              conversions: parseInt(c.conversions || 0),
              ctr: parseFloat(c.ctr || 0),
              cpc: parseFloat(c.cpc || 0),
              booking_step_1: c.booking_step_1 || 0,
              booking_step_2: c.booking_step_2 || 0,
              booking_step_3: c.booking_step_3 || 0,
              reservations: c.reservations || 0,
              reservation_value: c.reservation_value || 0,
              click_to_call: c.click_to_call || 0,
              email_contacts: c.email_contacts || 0,
              roas: c.roas || 0,
              cost_per_reservation: c.cost_per_reservation || 0,
              date_start: month.startDate,
              date_stop: month.endDate
            })),
            data_source: 'meta_api_backfill',
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'client_id,summary_type,summary_date,platform'
          });
          
        if (updateError) {
          result.error = `Database update failed: ${updateError.message}`;
          return result;
        }
        
        console.log(`   ✅ Database updated successfully`);
      } else {
        console.log(`   🔍 DRY RUN: Would update database`);
      }
      
      result.success = true;
      
    } else {
      console.log(`\n✅ ${month.label}: Already correct (step2: ${result.before.booking_step_2}, step3: ${result.before.booking_step_3})`);
      result.success = true;
    }
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`\n❌ ${month.label}: ${result.error}`);
  }
  
  return result;
}

async function main() {
  console.log('\n🔧 META HISTORICAL FUNNEL BACKFILL\n');
  console.log('='.repeat(60));
  
  const dryRun = process.argv.includes('--dry-run');
  const clientFilter = process.argv.find(arg => arg.startsWith('--client='))?.split('=')[1];
  
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '⚡ LIVE (will update database)'}`);
  
  // Get clients
  let clientQuery = supabase
    .from('clients')
    .select('id, name, ad_account_id, meta_access_token, system_user_token');
    
  if (clientFilter) {
    clientQuery = clientQuery.ilike('name', `%${clientFilter}%`);
  }
  
  const { data: clients, error: clientError } = await clientQuery;
  
  if (clientError || !clients) {
    console.error('Failed to get clients:', clientError?.message);
    return;
  }
  
  console.log(`\nFound ${clients.length} client(s) to process`);
  
  const months = await getMonthsToBackfill();
  console.log(`Months to check: ${months.map(m => m.label).join(', ')}`);
  
  const allResults: BackfillResult[] = [];
  
  for (const client of clients) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 Processing: ${client.name}`);
    console.log('='.repeat(60));
    
    for (const month of months) {
      const result = await backfillMonthForClient(client, month, dryRun);
      allResults.push(result);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  const fixed = allResults.filter(r => r.success && r.before.booking_step_2 === 0 && r.after.booking_step_2 > 0);
  const alreadyCorrect = allResults.filter(r => r.success && r.before.booking_step_2 > 0);
  const failed = allResults.filter(r => !r.success);
  
  console.log(`\n✅ Fixed: ${fixed.length}`);
  console.log(`✅ Already correct: ${alreadyCorrect.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  
  if (fixed.length > 0) {
    console.log('\n📊 Fixed periods:');
    fixed.forEach(r => {
      console.log(`   ${r.period}: step2 ${r.before.booking_step_2} → ${r.after.booking_step_2}, step3 ${r.before.booking_step_3} → ${r.after.booking_step_3}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed periods:');
    failed.forEach(r => {
      console.log(`   ${r.period}: ${r.error}`);
    });
  }
}

main().catch(console.error);

