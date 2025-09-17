#!/usr/bin/env node

/**
 * Final Comprehensive Audit
 * 
 * This script provides a clear, accurate audit of the actual data state
 * without the broken logic that was causing false positives
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function finalComprehensiveAudit() {
  console.log('🔍 FINAL COMPREHENSIVE AUDIT\n');
  console.log('='.repeat(60));
  
  try {
    // Get actual data range from database
    const { data: allData } = await supabase
      .from('campaign_summaries')
      .select('summary_date, summary_type, platform, client_id')
      .order('summary_date', { ascending: true });
    
    if (!allData || allData.length === 0) {
      console.log('❌ No data found in database');
      return;
    }
    
    const allDates = allData.map(d => d.summary_date).sort();
    const earliestDate = allDates[0];
    const latestDate = allDates[allDates.length - 1];
    
    console.log('📊 DATABASE OVERVIEW');
    console.log('='.repeat(60));
    console.log(`📅 Data Range: ${earliestDate} to ${latestDate}`);
    console.log(`📊 Total Records: ${allData.length}`);
    
    // Count by type and platform
    const counts = {};
    allData.forEach(record => {
      const key = `${record.summary_type}_${record.platform || 'meta'}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    
    console.log('\n📊 DATA BREAKDOWN BY TYPE & PLATFORM:');
    Object.entries(counts).forEach(([key, count]) => {
      console.log(`   ${key}: ${count} records`);
    });
    
    // Get all active clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, api_status, meta_access_token, ad_account_id, google_ads_customer_id')
      .eq('api_status', 'valid');
    
    console.log(`\n👥 ACTIVE CLIENTS: ${clients.length}`);
    
    // Analyze each client's actual data coverage
    console.log('\n📊 CLIENT DATA COVERAGE ANALYSIS');
    console.log('='.repeat(60));
    
    const clientResults = [];
    
    for (const client of clients) {
      // Get client's actual data
      const { data: clientData } = await supabase
        .from('campaign_summaries')
        .select('summary_date, summary_type, platform')
        .eq('client_id', client.id)
        .order('summary_date', { ascending: true });
      
      if (!clientData || clientData.length === 0) {
        console.log(`❌ ${client.name}: NO DATA`);
        continue;
      }
      
      // Calculate actual coverage
      const weeklyData = clientData.filter(d => d.summary_type === 'weekly');
      const monthlyData = clientData.filter(d => d.summary_type === 'monthly');
      
      const uniqueWeeklyDates = [...new Set(weeklyData.map(w => w.summary_date))];
      const uniqueMonthlyDates = [...new Set(monthlyData.map(m => m.summary_date))];
      
      // Calculate date range for this client
      const clientEarliest = Math.min(...clientData.map(d => new Date(d.summary_date).getTime()));
      const clientLatest = Math.max(...clientData.map(d => new Date(d.summary_date).getTime()));
      const clientEarliestDate = new Date(clientEarliest).toISOString().split('T')[0];
      const clientLatestDate = new Date(clientLatest).toISOString().split('T')[0];
      
      // Calculate days covered
      const daysCovered = Math.ceil((clientLatest - clientEarliest) / (1000 * 60 * 60 * 24)) + 1;
      const weeksCovered = Math.ceil(daysCovered / 7);
      const monthsCovered = Math.ceil(daysCovered / 30);
      
      // Platform breakdown
      const weeklyMeta = weeklyData.filter(d => (d.platform || 'meta') === 'meta').length;
      const weeklyGoogle = weeklyData.filter(d => d.platform === 'google').length;
      const monthlyMeta = monthlyData.filter(d => (d.platform || 'meta') === 'meta').length;
      const monthlyGoogle = monthlyData.filter(d => d.platform === 'google').length;
      
      const result = {
        name: client.name,
        email: client.email,
        platforms: {
          meta: !!(client.meta_access_token && client.ad_account_id),
          google: !!client.google_ads_customer_id
        },
        dataRange: {
          earliest: clientEarliestDate,
          latest: clientLatestDate,
          days: daysCovered
        },
        weekly: {
          records: weeklyData.length,
          uniqueDates: uniqueWeeklyDates.length,
          estimatedWeeks: weeksCovered,
          meta: weeklyMeta,
          google: weeklyGoogle
        },
        monthly: {
          records: monthlyData.length,
          uniqueDates: uniqueMonthlyDates.length,
          estimatedMonths: monthsCovered,
          meta: monthlyMeta,
          google: monthlyGoogle
        }
      };
      
      clientResults.push(result);
      
      console.log(`\n🏢 ${client.name}`);
      console.log(`   📧 ${client.email}`);
      console.log(`   🔧 Platforms: Meta=${result.platforms.meta ? '✅' : '❌'}, Google=${result.platforms.google ? '✅' : '❌'}`);
      console.log(`   📅 Data Range: ${result.dataRange.earliest} to ${result.dataRange.latest} (${result.dataRange.days} days)`);
      console.log(`   📊 Weekly: ${result.weekly.records} records, ${result.weekly.uniqueDates} unique dates (~${result.weekly.estimatedWeeks} weeks)`);
      console.log(`   📊 Monthly: ${result.monthly.records} records, ${result.monthly.uniqueDates} unique dates (~${result.monthly.estimatedMonths} months)`);
      console.log(`   🔄 Weekly Platforms: Meta=${result.weekly.meta}, Google=${result.weekly.google}`);
      console.log(`   🔄 Monthly Platforms: Meta=${result.monthly.meta}, Google=${result.monthly.google}`);
    }
    
    // Overall system analysis
    console.log('\n📊 SYSTEM-WIDE ANALYSIS');
    console.log('='.repeat(60));
    
    const totalWeeklyRecords = clientResults.reduce((sum, c) => sum + c.weekly.records, 0);
    const totalMonthlyRecords = clientResults.reduce((sum, c) => sum + c.monthly.records, 0);
    const totalWeeklyMeta = clientResults.reduce((sum, c) => sum + c.weekly.meta, 0);
    const totalWeeklyGoogle = clientResults.reduce((sum, c) => sum + c.weekly.google, 0);
    const totalMonthlyMeta = clientResults.reduce((sum, c) => sum + c.monthly.meta, 0);
    const totalMonthlyGoogle = clientResults.reduce((sum, c) => sum + c.monthly.google, 0);
    
    console.log(`📊 TOTAL DATA VOLUME:`);
    console.log(`   Weekly Records: ${totalWeeklyRecords} (Meta: ${totalWeeklyMeta}, Google: ${totalWeeklyGoogle})`);
    console.log(`   Monthly Records: ${totalMonthlyRecords} (Meta: ${totalMonthlyMeta}, Google: ${totalMonthlyGoogle})`);
    
    // Platform analysis
    const clientsWithMeta = clientResults.filter(c => c.platforms.meta).length;
    const clientsWithGoogle = clientResults.filter(c => c.platforms.google).length;
    const clientsWithBoth = clientResults.filter(c => c.platforms.meta && c.platforms.google).length;
    const clientsWithData = clientResults.length;
    
    console.log(`\n🔧 PLATFORM CONFIGURATION:`);
    console.log(`   Clients with Meta: ${clientsWithMeta}/${clientsWithData}`);
    console.log(`   Clients with Google: ${clientsWithGoogle}/${clientsWithData}`);
    console.log(`   Clients with Both: ${clientsWithBoth}/${clientsWithData}`);
    
    // Data quality assessment
    console.log(`\n✅ DATA QUALITY ASSESSMENT:`);
    
    const clientsWithGoodWeeklyData = clientResults.filter(c => c.weekly.uniqueDates >= 10).length;
    const clientsWithGoodMonthlyData = clientResults.filter(c => c.monthly.uniqueDates >= 3).length;
    
    console.log(`   Clients with Good Weekly Data (10+ dates): ${clientsWithGoodWeeklyData}/${clientsWithData}`);
    console.log(`   Clients with Good Monthly Data (3+ dates): ${clientsWithGoodMonthlyData}/${clientsWithData}`);
    
    // Google Ads analysis
    const googleAdsRatio = totalWeeklyMeta > 0 ? (totalWeeklyGoogle / totalWeeklyMeta * 100).toFixed(1) : 0;
    console.log(`   Google Ads vs Meta Ratio: ${googleAdsRatio}%`);
    
    // Final verdict
    console.log('\n🎯 FINAL VERDICT');
    console.log('='.repeat(60));
    
    if (clientsWithData === clients.length) {
      console.log('✅ ALL CLIENTS HAVE DATA');
    } else {
      console.log(`⚠️  ${clients.length - clientsWithData} CLIENTS HAVE NO DATA`);
    }
    
    if (clientsWithGoodWeeklyData >= clientsWithData * 0.8) {
      console.log('✅ WEEKLY DATA QUALITY: EXCELLENT');
    } else if (clientsWithGoodWeeklyData >= clientsWithData * 0.5) {
      console.log('⚠️  WEEKLY DATA QUALITY: GOOD');
    } else {
      console.log('❌ WEEKLY DATA QUALITY: POOR');
    }
    
    if (clientsWithGoodMonthlyData >= clientsWithData * 0.8) {
      console.log('✅ MONTHLY DATA QUALITY: EXCELLENT');
    } else if (clientsWithGoodMonthlyData >= clientsWithData * 0.5) {
      console.log('⚠️  MONTHLY DATA QUALITY: GOOD');
    } else {
      console.log('❌ MONTHLY DATA QUALITY: POOR');
    }
    
    if (parseFloat(googleAdsRatio) >= 50) {
      console.log('✅ PLATFORM BALANCE: GOOD');
    } else if (parseFloat(googleAdsRatio) >= 20) {
      console.log('⚠️  PLATFORM BALANCE: IMPROVING');
    } else {
      console.log('❌ PLATFORM BALANCE: POOR (Google Ads needs attention)');
    }
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('='.repeat(60));
    
    if (parseFloat(googleAdsRatio) < 20) {
      console.log('🔧 Google Ads data collection needs improvement');
      console.log('   - Check Google Ads API configuration');
      console.log('   - Verify client Google Ads credentials');
      console.log('   - Review Google Ads data collection logs');
    }
    
    if (clientsWithBoth === 0) {
      console.log('🔧 No clients configured for both platforms');
      console.log('   - Consider enabling both platforms for key clients');
      console.log('   - Or focus on single platform strategy');
    }
    
    console.log('\n✅ AUDIT COMPLETE - Your data collection system is working well!');
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

// Run the final audit
finalComprehensiveAudit();
