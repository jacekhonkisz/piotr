#!/usr/bin/env tsx

/**
 * COMPREHENSIVE METRICS AUDIT FOR BELMONTE
 * 
 * Compares database vs live Google Ads API for ALL months
 * Checks for metric consistency and accuracy
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MonthMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  conversionRate: number;
}

function calculateMetrics(spend: number, impressions: number, clicks: number, conversions: number): MonthMetrics {
  return {
    spend,
    impressions,
    clicks,
    conversions,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0
  };
}

async function auditMonth(
  client: any,
  googleAdsService: any,
  year: number,
  month: number,
  monthName: string
) {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📅 ${monthName} (${startDate} to ${endDate})`);
  console.log('='.repeat(70));

  try {
    // Get from database
    const { data: dbData } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', client.id)
      .eq('summary_type', 'monthly')
      .eq('platform', 'google')
      .eq('summary_date', startDate)
      .maybeSingle();

    if (!dbData) {
      console.log('❌ No data in database');
      return { monthName, hasIssue: true, issue: 'Missing from database' };
    }

    const dbMetrics = calculateMetrics(
      parseFloat(dbData.total_spend),
      dbData.total_impressions,
      dbData.total_clicks,
      dbData.total_conversions
    );

    console.log('\n📊 DATABASE METRICS:');
    console.log(`   Spend:       ${dbMetrics.spend.toFixed(2)} PLN`);
    console.log(`   Impressions: ${dbMetrics.impressions.toLocaleString()}`);
    console.log(`   Clicks:      ${dbMetrics.clicks.toLocaleString()}`);
    console.log(`   Conversions: ${dbMetrics.conversions.toLocaleString()}`);
    console.log(`   CTR:         ${dbMetrics.ctr.toFixed(2)}%`);
    console.log(`   CPC:         ${dbMetrics.cpc.toFixed(2)} PLN`);
    console.log(`   Conv Rate:   ${dbMetrics.conversionRate.toFixed(2)}%`);

    // Get from API
    console.log('\n🔄 Fetching from Google Ads API...');
    const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

    const apiTotals = campaigns.reduce((acc: any, campaign: any) => ({
      spend: acc.spend + (campaign.spend || 0),
      impressions: acc.impressions + (campaign.impressions || 0),
      clicks: acc.clicks + (campaign.clicks || 0),
      conversions: acc.conversions + (campaign.conversions || 0),
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

    const apiMetrics = calculateMetrics(
      apiTotals.spend,
      apiTotals.impressions,
      apiTotals.clicks,
      apiTotals.conversions
    );

    console.log('\n📊 GOOGLE ADS API METRICS:');
    console.log(`   Spend:       ${apiMetrics.spend.toFixed(2)} PLN`);
    console.log(`   Impressions: ${apiMetrics.impressions.toLocaleString()}`);
    console.log(`   Clicks:      ${apiMetrics.clicks.toLocaleString()}`);
    console.log(`   Conversions: ${apiMetrics.conversions.toFixed(0)}`);
    console.log(`   CTR:         ${apiMetrics.ctr.toFixed(2)}%`);
    console.log(`   CPC:         ${apiMetrics.cpc.toFixed(2)} PLN`);
    console.log(`   Conv Rate:   ${apiMetrics.conversionRate.toFixed(2)}%`);

    // Calculate differences
    const spendDiff = Math.abs(dbMetrics.spend - apiMetrics.spend);
    const spendDiffPct = dbMetrics.spend > 0 ? (spendDiff / dbMetrics.spend) * 100 : 0;
    const impressionsDiff = Math.abs(dbMetrics.impressions - apiMetrics.impressions);
    const impressionsDiffPct = dbMetrics.impressions > 0 ? (impressionsDiff / dbMetrics.impressions) * 100 : 0;
    const clicksDiff = Math.abs(dbMetrics.clicks - apiMetrics.clicks);
    const clicksDiffPct = dbMetrics.clicks > 0 ? (clicksDiff / dbMetrics.clicks) * 100 : 0;
    const conversionsDiff = Math.abs(dbMetrics.conversions - apiMetrics.conversions);
    const conversionsDiffPct = dbMetrics.conversions > 0 ? (conversionsDiff / dbMetrics.conversions) * 100 : 0;

    console.log('\n📉 DIFFERENCES:');
    console.log(`   Spend:       ${spendDiff.toFixed(2)} PLN (${spendDiffPct.toFixed(2)}%)`);
    console.log(`   Impressions: ${impressionsDiff.toLocaleString()} (${impressionsDiffPct.toFixed(2)}%)`);
    console.log(`   Clicks:      ${clicksDiff.toLocaleString()} (${clicksDiffPct.toFixed(2)}%)`);
    console.log(`   Conversions: ${conversionsDiff.toFixed(0)} (${conversionsDiffPct.toFixed(2)}%)`);

    // Check for issues
    const issues = [];
    
    if (spendDiffPct > 5) issues.push(`Spend differs by ${spendDiffPct.toFixed(1)}%`);
    if (impressionsDiffPct > 5) issues.push(`Impressions differ by ${impressionsDiffPct.toFixed(1)}%`);
    if (clicksDiffPct > 5) issues.push(`Clicks differ by ${clicksDiffPct.toFixed(1)}%`);
    if (conversionsDiffPct > 10) issues.push(`Conversions differ by ${conversionsDiffPct.toFixed(1)}%`);
    
    // Check for suspicious conversion rates
    if (dbMetrics.conversionRate > 80) {
      issues.push(`🚨 SUSPICIOUS: Conv rate ${dbMetrics.conversionRate.toFixed(1)}% (too high!)`);
    }
    if (apiMetrics.conversionRate > 80) {
      issues.push(`🚨 SUSPICIOUS: API conv rate ${apiMetrics.conversionRate.toFixed(1)}% (too high!)`);
    }
    
    // Check for conversion > clicks (impossible)
    if (dbMetrics.conversions > dbMetrics.clicks) {
      issues.push(`🚨 IMPOSSIBLE: More conversions than clicks in DB (${dbMetrics.conversions} conv > ${dbMetrics.clicks} clicks)`);
    }
    if (apiMetrics.conversions > apiMetrics.clicks) {
      issues.push(`⚠️  API reports more conversions than clicks (view-through or attribution issue)`);
    }

    if (issues.length > 0) {
      console.log('\n🚨 ISSUES DETECTED:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      return {
        monthName,
        hasIssue: true,
        issues,
        dbMetrics,
        apiMetrics,
        needsRecollection: spendDiffPct > 5 || impressionsDiffPct > 5 || clicksDiffPct > 5
      };
    } else {
      console.log('\n✅ DATA LOOKS GOOD');
      return {
        monthName,
        hasIssue: false,
        dbMetrics,
        apiMetrics
      };
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    return { monthName, hasIssue: true, issue: 'Error during audit', error };
  }
}

async function comprehensiveAudit() {
  console.log('🔍 COMPREHENSIVE METRICS AUDIT FOR BELMONTE');
  console.log('═'.repeat(70));
  console.log('\nChecking accuracy of ALL metrics across ALL months\n');

  try {
    // Get client
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .single();

    if (!client) {
      console.error('❌ Client not found');
      process.exit(1);
    }

    console.log(`✅ Client: ${client.name}`);
    console.log(`   Client ID: ${client.id}`);

    // Get credentials
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token'
      ]);

    const creds: Record<string, string> = {};
    settings?.forEach(s => {
      creds[s.key] = s.value;
    });

    const googleAdsService = new GoogleAdsAPIService({
      refreshToken: creds.google_ads_manager_refresh_token!,
      clientId: creds.google_ads_client_id!,
      clientSecret: creds.google_ads_client_secret!,
      developmentToken: creds.google_ads_developer_token!,
      customerId: client.google_ads_customer_id,
    });

    // Months with actual spend (skip zero months)
    const monthsToAudit = [
      { year: 2025, month: 11, name: 'November 2025' },
      { year: 2025, month: 10, name: 'October 2025' },
      { year: 2025, month: 9, name: 'September 2025' },
      { year: 2025, month: 8, name: 'August 2025' },
      { year: 2025, month: 6, name: 'June 2025' },
      { year: 2025, month: 5, name: 'May 2025' },
      { year: 2025, month: 4, name: 'April 2025' },
    ];

    const results = [];

    for (const monthData of monthsToAudit) {
      const result = await auditMonth(
        client,
        googleAdsService,
        monthData.year,
        monthData.month,
        monthData.name
      );
      
      results.push(result);

      // Delay between API calls
      if (monthsToAudit.indexOf(monthData) < monthsToAudit.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary
    console.log('\n\n');
    console.log('═'.repeat(70));
    console.log('📊 AUDIT SUMMARY');
    console.log('═'.repeat(70));

    const withIssues = results.filter(r => r.hasIssue);
    const needsRecollection = results.filter(r => r.needsRecollection);

    console.log(`\n✅ Months audited: ${results.length}`);
    console.log(`🚨 Months with issues: ${withIssues.length}`);
    console.log(`🔄 Months needing recollection: ${needsRecollection.length}`);

    if (withIssues.length > 0) {
      console.log('\n🚨 MONTHS WITH ISSUES:');
      console.log('─'.repeat(70));
      withIssues.forEach(r => {
        console.log(`\n${r.monthName}:`);
        if (r.issues) {
          r.issues.forEach((issue: string) => console.log(`   - ${issue}`));
        } else if (r.issue) {
          console.log(`   - ${r.issue}`);
        }
      });
    }

    if (needsRecollection.length > 0) {
      console.log('\n\n🔄 RECOMMENDED ACTIONS:');
      console.log('─'.repeat(70));
      needsRecollection.forEach(r => {
        const yearMonth = r.monthName.split(' ');
        const monthNames: Record<string, number> = {
          'January': 1, 'February': 2, 'March': 3, 'April': 4,
          'May': 5, 'June': 6, 'July': 7, 'August': 8,
          'September': 9, 'October': 10, 'November': 11, 'December': 12
        };
        const month = monthNames[yearMonth[0]];
        const year = parseInt(yearMonth[1]);
        console.log(`npx tsx scripts/collect-month-belmonte.ts ${year} ${month}  # Re-collect ${r.monthName}`);
      });
    }

    console.log('\n' + '═'.repeat(70));

    if (withIssues.length === 0) {
      console.log('✅ ALL METRICS ARE ACCURATE AND CONSISTENT!');
    } else {
      console.log('⚠️  DATA INCONSISTENCIES FOUND - REVIEW ABOVE');
    }

    console.log('═'.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error during audit:', error);
    process.exit(1);
  }
}

comprehensiveAudit();


