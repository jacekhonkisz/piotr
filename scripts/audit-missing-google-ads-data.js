#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditMissingData() {
  console.log('🔍 AUDITING MISSING GOOGLE ADS DATA\n');
  
  try {
    // Get client
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .eq('google_ads_enabled', true)
      .limit(1);
      
    if (!clients || clients.length === 0) {
      console.log('❌ No clients found');
      return;
    }
    
    const client = clients[0];
    console.log('📊 Client:', client.name);
    
    // Check all Google Ads campaigns data
    const { data: campaigns } = await supabase
      .from('google_ads_campaigns')
      .select('*')
      .eq('client_id', client.id)
      .order('date_range_start', { ascending: false });
      
    console.log('\n📈 Google Ads campaigns in database:', campaigns?.length || 0);
    
    if (campaigns && campaigns.length > 0) {
      console.log('\n📊 Detailed campaign analysis:');
      
      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;
      let totalReservations = 0;
      let totalReservationValue = 0;
      let totalFormSubmissions = 0;
      let totalPhoneCalls = 0;
      let totalEmailClicks = 0;
      let totalPhoneClicks = 0;
      let totalBookingStep1 = 0;
      let totalBookingStep2 = 0;
      let totalBookingStep3 = 0;
      
      campaigns.forEach((campaign, i) => {
        console.log(`\n   Campaign ${i + 1}: ${campaign.campaign_name}`);
        console.log(`      Date range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
        console.log(`      Spend: ${campaign.spend} PLN`);
        console.log(`      Impressions: ${campaign.impressions?.toLocaleString() || 0}`);
        console.log(`      Clicks: ${campaign.clicks?.toLocaleString() || 0}`);
        console.log(`      CTR: ${campaign.ctr}%`);
        console.log(`      CPC: ${campaign.cpc} PLN`);
        console.log(`      Conversion metrics:`);
        console.log(`         Form submissions: ${campaign.form_submissions || 0}`);
        console.log(`         Phone calls: ${campaign.phone_calls || 0}`);
        console.log(`         Email clicks: ${campaign.email_clicks || 0}`);
        console.log(`         Phone clicks: ${campaign.phone_clicks || 0}`);
        console.log(`         Booking step 1: ${campaign.booking_step_1 || 0}`);
        console.log(`         Booking step 2: ${campaign.booking_step_2 || 0}`);
        console.log(`         Booking step 3: ${campaign.booking_step_3 || 0}`);
        console.log(`         Reservations: ${campaign.reservations || 0}`);
        console.log(`         Reservation value: ${campaign.reservation_value || 0} PLN`);
        console.log(`         ROAS: ${campaign.roas || 0}`);
        
        // Accumulate totals
        totalSpend += parseFloat(campaign.spend || 0);
        totalImpressions += parseInt(campaign.impressions || 0);
        totalClicks += parseInt(campaign.clicks || 0);
        totalReservations += parseInt(campaign.reservations || 0);
        totalReservationValue += parseFloat(campaign.reservation_value || 0);
        totalFormSubmissions += parseInt(campaign.form_submissions || 0);
        totalPhoneCalls += parseInt(campaign.phone_calls || 0);
        totalEmailClicks += parseInt(campaign.email_clicks || 0);
        totalPhoneClicks += parseInt(campaign.phone_clicks || 0);
        totalBookingStep1 += parseInt(campaign.booking_step_1 || 0);
        totalBookingStep2 += parseInt(campaign.booking_step_2 || 0);
        totalBookingStep3 += parseInt(campaign.booking_step_3 || 0);
      });
      
      console.log('\n📊 DATABASE TOTALS:');
      console.log(`   Total Spend: ${totalSpend.toFixed(2)} PLN`);
      console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`   Total Clicks: ${totalClicks.toLocaleString()}`);
      console.log(`   Total Form Submissions: ${totalFormSubmissions}`);
      console.log(`   Total Phone Calls: ${totalPhoneCalls}`);
      console.log(`   Total Email Clicks: ${totalEmailClicks}`);
      console.log(`   Total Phone Clicks: ${totalPhoneClicks}`);
      console.log(`   Total Booking Step 1: ${totalBookingStep1}`);
      console.log(`   Total Booking Step 2: ${totalBookingStep2}`);
      console.log(`   Total Booking Step 3: ${totalBookingStep3}`);
      console.log(`   Total Reservations: ${totalReservations}`);
      console.log(`   Total Reservation Value: ${totalReservationValue.toFixed(2)} PLN`);
      console.log(`   Average CPC: ${totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : 0} PLN`);
      console.log(`   Average CTR: ${totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0}%`);
      console.log(`   Cost per reservation: ${totalReservations > 0 ? (totalSpend / totalReservations).toFixed(2) : 0} PLN`);
      
      // Compare with what's showing in the report
      console.log('\n🔍 COMPARISON WITH REPORT:');
      console.log('   Report shows:');
      console.log('      Spend: 15,800.00 zł');
      console.log('      Impressions: 370,000');
      console.log('      Clicks: 7,400');
      console.log('      Reservations: 82');
      console.log('      Cost per reservation: 192.68 zł');
      console.log('      Other conversion metrics: — (dashes)');
      
      console.log('\n   Database shows:');
      console.log(`      Spend: ${totalSpend.toFixed(2)} PLN`);
      console.log(`      Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`      Clicks: ${totalClicks.toLocaleString()}`);
      console.log(`      Reservations: ${totalReservations}`);
      console.log(`      Cost per reservation: ${totalReservations > 0 ? (totalSpend / totalReservations).toFixed(2) : 0} PLN`);
      
      // Check if there's a data mismatch
      const spendMatch = Math.abs(totalSpend - 15800) < 100; // Allow some tolerance
      const impressionsMatch = Math.abs(totalImpressions - 370000) < 1000;
      const clicksMatch = Math.abs(totalClicks - 7400) < 100;
      const reservationsMatch = totalReservations === 82;
      
      console.log('\n✅ DATA MATCHING ANALYSIS:');
      console.log(`   Spend matches: ${spendMatch ? '✅' : '❌'} (DB: ${totalSpend.toFixed(2)}, Report: 15800.00)`);
      console.log(`   Impressions match: ${impressionsMatch ? '✅' : '❌'} (DB: ${totalImpressions}, Report: 370000)`);
      console.log(`   Clicks match: ${clicksMatch ? '✅' : '❌'} (DB: ${totalClicks}, Report: 7400)`);
      console.log(`   Reservations match: ${reservationsMatch ? '✅' : '❌'} (DB: ${totalReservations}, Report: 82)`);
      
      if (!spendMatch || !impressionsMatch || !clicksMatch) {
        console.log('\n⚠️ SIGNIFICANT DATA MISMATCH DETECTED!');
        console.log('   The report is showing MUCH HIGHER values than what is in the database.');
        console.log('   This suggests the report is pulling from a different data source or aggregating differently.');
        
        // Check if there might be more recent data
        console.log('\n🔍 INVESTIGATING POTENTIAL CAUSES:');
        console.log('   1. Report might be using live API data instead of database');
        console.log('   2. Report might be aggregating from multiple sources');
        console.log('   3. Database might have incomplete data');
        console.log('   4. Report might be using cached data from a different time period');
        
      } else {
        console.log('\n✅ DATA ROUGHLY MATCHES!');
        console.log('   The core metrics are similar between database and report.');
      }
      
      // Check for missing conversion data
      if (totalFormSubmissions === 0 && totalPhoneCalls === 0 && totalEmailClicks === 0) {
        console.log('\n⚠️ MISSING CONVERSION DATA DETECTED!');
        console.log('   Most conversion metrics are 0 in the database.');
        console.log('   This might explain why the report shows dashes (—) for these metrics.');
      }
    }
    
    // Check if there are any cache tables with different data
    console.log('\n🗄️ CHECKING CACHE TABLES:');
    
    const { data: monthlyCache } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .limit(1);
      
    if (monthlyCache && monthlyCache.length > 0) {
      const cacheData = monthlyCache[0].cache_data;
      console.log('   Monthly cache data found:');
      console.log(`      Campaigns: ${cacheData?.campaigns?.length || 0}`);
      console.log(`      Stats:`, cacheData?.stats || {});
      console.log(`      Conversion metrics:`, cacheData?.conversionMetrics || {});
      console.log(`      Last updated: ${monthlyCache[0].last_updated}`);
      
      // Compare cache stats with report
      if (cacheData?.stats) {
        const cacheStats = cacheData.stats;
        console.log('\n   Cache vs Report comparison:');
        console.log(`      Cache spend: ${cacheStats.totalSpend || 0}`);
        console.log(`      Cache impressions: ${cacheStats.totalImpressions || 0}`);
        console.log(`      Cache clicks: ${cacheStats.totalClicks || 0}`);
        
        const cacheSpendMatch = Math.abs((cacheStats.totalSpend || 0) - 15800) < 100;
        const cacheImpressionsMatch = Math.abs((cacheStats.totalImpressions || 0) - 370000) < 1000;
        const cacheClicksMatch = Math.abs((cacheStats.totalClicks || 0) - 7400) < 100;
        
        if (cacheSpendMatch && cacheImpressionsMatch && cacheClicksMatch) {
          console.log('   ✅ CACHE DATA MATCHES REPORT! Report is likely using cache data.');
        } else {
          console.log('   ❌ Cache data does not match report either.');
        }
      }
    } else {
      console.log('   No monthly cache data found');
    }
    
    // Check daily KPI data for conversion metrics
    console.log('\n📊 CHECKING DAILY KPI DATA FOR CONVERSION METRICS:');
    
    const { data: dailyKpi } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', client.id)
      .gte('date', '2025-08-01')
      .lte('date', '2025-08-30')
      .limit(5);
      
    if (dailyKpi && dailyKpi.length > 0) {
      console.log(`   Found ${dailyKpi.length} daily KPI records`);
      console.log('   Sample daily KPI data:');
      dailyKpi.slice(0, 2).forEach((day, i) => {
        console.log(`      Day ${i + 1} (${day.date}):`);
        console.log(`         Reservations: ${day.reservations || 0}`);
        console.log(`         Form submissions: ${day.form_submissions || 0}`);
        console.log(`         Phone calls: ${day.phone_calls || 0}`);
        console.log(`         Email clicks: ${day.email_clicks || 0}`);
      });
      
      // Calculate totals from daily KPI
      const kpiTotals = dailyKpi.reduce((acc, day) => {
        acc.reservations += day.reservations || 0;
        acc.form_submissions += day.form_submissions || 0;
        acc.phone_calls += day.phone_calls || 0;
        acc.email_clicks += day.email_clicks || 0;
        acc.phone_clicks += day.phone_clicks || 0;
        acc.booking_step_1 += day.booking_step_1 || 0;
        acc.booking_step_2 += day.booking_step_2 || 0;
        acc.booking_step_3 += day.booking_step_3 || 0;
        return acc;
      }, {
        reservations: 0,
        form_submissions: 0,
        phone_calls: 0,
        email_clicks: 0,
        phone_clicks: 0,
        booking_step_1: 0,
        booking_step_2: 0,
        booking_step_3: 0
      });
      
      console.log('\n   Daily KPI totals:');
      console.log(`      Total reservations: ${kpiTotals.reservations}`);
      console.log(`      Total form submissions: ${kpiTotals.form_submissions}`);
      console.log(`      Total phone calls: ${kpiTotals.phone_calls}`);
      console.log(`      Total email clicks: ${kpiTotals.email_clicks}`);
      
      if (kpiTotals.reservations === 82) {
        console.log('   ✅ Daily KPI reservations match report! (82)');
        console.log('   This confirms the report is using daily KPI data for conversion metrics.');
      }
      
    } else {
      console.log('   No daily KPI data found for August 2025');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

auditMissingData().catch(console.error);
