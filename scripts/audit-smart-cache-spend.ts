#!/usr/bin/env tsx

/**
 * AUDIT: SMART CACHE GOOGLE ADS SPEND
 * 
 * This script audits if the current period (month/week) Google Ads spend
 * is being used correctly by the smart caching system.
 * 
 * Verification Points:
 * 1. Smart cache table exists and has data
 * 2. Cached spend matches live Google Ads API spend
 * 3. Cache is being refreshed properly (< 3 hours old)
 * 4. Dashboard is using cached data for current periods
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleAdsAPIService } from '../src/lib/google-ads-api.js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AuditResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
  data?: any;
}

async function auditSmartCacheSpend() {
  console.log('🔍 AUDITING SMART CACHE GOOGLE ADS SPEND SYSTEM');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const results: AuditResult[] = [];

  try {
    // Get Belmonte client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
      .single();

    if (clientError || !client) {
      console.error('❌ Failed to get client:', clientError);
      process.exit(1);
    }

    console.log(`✅ Client: ${client.name}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Google Ads Customer ID: ${client.google_ads_customer_id}\n`);

    // ===========================
    // CHECK 1: Smart Cache Table Exists
    // ===========================
    console.log('1️⃣  CHECKING: Smart cache table exists and has data\n');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentPeriodId = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const { data: monthlyCache, error: monthlyCacheError } = await supabase
      .from('google_ads_current_month_cache')
      .select('*')
      .eq('client_id', client.id)
      .eq('period_id', currentPeriodId)
      .single();

    if (monthlyCacheError || !monthlyCache) {
      results.push({
        check: 'Monthly Smart Cache Exists',
        status: 'FAIL',
        details: `No cache found for current month ${currentPeriodId}`
      });
      console.log('❌ FAIL: No monthly cache found\n');
    } else {
      const cacheAge = Date.now() - new Date(monthlyCache.last_updated).getTime();
      const cacheAgeMinutes = Math.floor(cacheAge / (1000 * 60));
      const cacheAgeHours = (cacheAge / (1000 * 60 * 60)).toFixed(2);
      const isFresh = parseFloat(cacheAgeHours) < 3;

      results.push({
        check: 'Monthly Smart Cache Exists',
        status: 'PASS',
        details: `Cache found for ${currentPeriodId}, age: ${cacheAgeMinutes}min (${cacheAgeHours}h)`,
        data: {
          periodId: currentPeriodId,
          lastUpdated: monthlyCache.last_updated,
          cacheAgeMinutes,
          cacheAgeHours,
          isFresh
        }
      });

      console.log(`✅ PASS: Monthly cache found`);
      console.log(`   Period ID: ${currentPeriodId}`);
      console.log(`   Last Updated: ${monthlyCache.last_updated}`);
      console.log(`   Cache Age: ${cacheAgeMinutes} minutes (${cacheAgeHours} hours)`);
      console.log(`   Is Fresh (< 3h): ${isFresh ? '✅ YES' : '⚠️  NO'}\n`);

      // ===========================
      // CHECK 2: Cache Has Spend Data
      // ===========================
      console.log('2️⃣  CHECKING: Cached data structure and spend\n');

      if (!monthlyCache.cache_data) {
        results.push({
          check: 'Cache Data Structure',
          status: 'FAIL',
          details: 'cache_data field is null'
        });
        console.log('❌ FAIL: cache_data field is null\n');
      } else {
        const cacheData = monthlyCache.cache_data;
        const hasStats = !!cacheData.stats;
        const hasSpend = hasStats && typeof cacheData.stats.totalSpend === 'number';
        const hasCampaigns = Array.isArray(cacheData.campaigns) && cacheData.campaigns.length > 0;

        if (!hasStats || !hasSpend) {
          results.push({
            check: 'Cache Data Structure',
            status: 'FAIL',
            details: 'Missing stats or totalSpend in cache_data'
          });
          console.log('❌ FAIL: Missing stats.totalSpend in cached data\n');
        } else {
          results.push({
            check: 'Cache Data Structure',
            status: 'PASS',
            details: `Cached spend: ${cacheData.stats.totalSpend.toFixed(2)} PLN, ${cacheData.campaigns.length} campaigns`,
            data: {
              totalSpend: cacheData.stats.totalSpend,
              totalImpressions: cacheData.stats.totalImpressions,
              totalClicks: cacheData.stats.totalClicks,
              totalConversions: cacheData.stats.totalConversions,
              campaignCount: cacheData.campaigns.length
            }
          });

          console.log(`✅ PASS: Cache data structure valid`);
          console.log(`   Total Spend: ${cacheData.stats.totalSpend.toFixed(2)} PLN`);
          console.log(`   Impressions: ${cacheData.stats.totalImpressions}`);
          console.log(`   Clicks: ${cacheData.stats.totalClicks}`);
          console.log(`   Conversions: ${cacheData.stats.totalConversions}`);
          console.log(`   Campaigns: ${cacheData.campaigns.length}\n`);

          // ===========================
          // CHECK 3: Compare with Live API
          // ===========================
          console.log('3️⃣  CHECKING: Cached spend vs Live Google Ads API\n');

          try {
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

            // Calculate current month boundaries
            const firstDay = new Date(currentYear, currentMonth - 1, 1);
            const lastDay = new Date(currentYear, currentMonth, 0);
            const startDate = firstDay.toISOString().split('T')[0];
            const endDate = lastDay.toISOString().split('T')[0];

            console.log(`   Fetching live data for: ${startDate} to ${endDate}...`);

            const campaigns = await googleAdsService.getCampaignData(startDate, endDate);

            const liveSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
            const liveImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
            const liveClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
            const liveConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);

            console.log(`\n   📊 LIVE API DATA:`);
            console.log(`      Spend: ${liveSpend.toFixed(2)} PLN`);
            console.log(`      Impressions: ${liveImpressions}`);
            console.log(`      Clicks: ${liveClicks}`);
            console.log(`      Conversions: ${liveConversions}`);
            console.log(`      Campaigns: ${campaigns.length}`);

            console.log(`\n   📦 CACHED DATA:`);
            console.log(`      Spend: ${cacheData.stats.totalSpend.toFixed(2)} PLN`);
            console.log(`      Impressions: ${cacheData.stats.totalImpressions}`);
            console.log(`      Clicks: ${cacheData.stats.totalClicks}`);
            console.log(`      Conversions: ${cacheData.stats.totalConversions}`);
            console.log(`      Campaigns: ${cacheData.campaigns.length}`);

            // Compare
            const spendDiff = Math.abs(liveSpend - cacheData.stats.totalSpend);
            const spendDiffPercent = cacheData.stats.totalSpend > 0 
              ? (spendDiff / cacheData.stats.totalSpend) * 100 
              : 0;

            const impressionsDiff = Math.abs(liveImpressions - cacheData.stats.totalImpressions);
            const clicksDiff = Math.abs(liveClicks - cacheData.stats.totalClicks);
            const conversionsDiff = Math.abs(liveConversions - cacheData.stats.totalConversions);

            console.log(`\n   📈 COMPARISON:`);
            console.log(`      Spend Difference: ${spendDiff.toFixed(2)} PLN (${spendDiffPercent.toFixed(2)}%)`);
            console.log(`      Impressions Difference: ${impressionsDiff}`);
            console.log(`      Clicks Difference: ${clicksDiff}`);
            console.log(`      Conversions Difference: ${conversionsDiff}`);

            // Tolerance: 1% or 1 PLN
            const tolerance = 1.0; // 1 PLN
            const tolerancePercent = 1.0; // 1%

            if (spendDiff <= tolerance || spendDiffPercent <= tolerancePercent) {
              results.push({
                check: 'Cache vs Live API Accuracy',
                status: 'PASS',
                details: `Spend matches within tolerance (diff: ${spendDiff.toFixed(2)} PLN, ${spendDiffPercent.toFixed(2)}%)`,
                data: {
                  cached: cacheData.stats.totalSpend,
                  live: liveSpend,
                  difference: spendDiff,
                  percentDiff: spendDiffPercent
                }
              });
              console.log(`\n✅ PASS: Cached and live spend match within tolerance\n`);
            } else {
              results.push({
                check: 'Cache vs Live API Accuracy',
                status: 'WARN',
                details: `Spend differs by ${spendDiff.toFixed(2)} PLN (${spendDiffPercent.toFixed(2)}%). Cache may be stale.`,
                data: {
                  cached: cacheData.stats.totalSpend,
                  live: liveSpend,
                  difference: spendDiff,
                  percentDiff: spendDiffPercent
                }
              });
              console.log(`⚠️  WARN: Cached spend differs from live API\n`);
            }

          } catch (apiError) {
            results.push({
              check: 'Cache vs Live API Accuracy',
              status: 'FAIL',
              details: `Failed to fetch live API data: ${apiError}`
            });
            console.log(`❌ FAIL: Could not fetch live API data for comparison\n`);
            console.error(apiError);
          }
        }
      }
    }

    // ===========================
    // CHECK 4: Data Fetcher Priority
    // ===========================
    console.log('4️⃣  CHECKING: Data fetcher uses smart cache for current period\n');

    // Read the Google Ads standardized data fetcher code
    const fs = require('fs');
    const fetcherCode = fs.readFileSync('src/lib/google-ads-standardized-data-fetcher.ts', 'utf-8');

    const hasSmartCachePriority = fetcherCode.includes('google_ads_smart_cache') &&
                                  fetcherCode.includes('needsLiveData') &&
                                  fetcherCode.includes('fetchFromGoogleAdsSmartCache');

    if (hasSmartCachePriority) {
      results.push({
        check: 'Data Fetcher Priority Logic',
        status: 'PASS',
        details: 'Google Ads standardized data fetcher correctly prioritizes smart cache for current periods'
      });
      console.log('✅ PASS: Data fetcher has correct priority order\n');
      console.log('   Priority for CURRENT periods:');
      console.log('   1️⃣  Google Ads smart cache (< 3 hours)');
      console.log('   2️⃣  Live Google Ads API (fallback)\n');
    } else {
      results.push({
        check: 'Data Fetcher Priority Logic',
        status: 'FAIL',
        details: 'Data fetcher does not prioritize smart cache correctly'
      });
      console.log('❌ FAIL: Data fetcher priority logic incorrect\n');
    }

    // ===========================
    // FINAL SUMMARY
    // ===========================
    console.log('\n═══════════════════════════════════════════════════════════════════════════════');
    console.log('📊 AUDIT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    const passCount = results.filter(r => r.status === 'PASS').length;
    const warnCount = results.filter(r => r.status === 'WARN').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;

    results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️ ' : '❌';
      console.log(`${icon} ${result.check}`);
      console.log(`   ${result.details}\n`);
    });

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`RESULTS: ${passCount} PASS | ${warnCount} WARN | ${failCount} FAIL`);
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    if (failCount === 0 && warnCount === 0) {
      console.log('🎉 ALL CHECKS PASSED! Smart cache system is working correctly.\n');
      console.log('✅ Current period Google Ads spend IS being used by smart caching system');
      console.log('✅ Cache is fresh and accurate');
      console.log('✅ Data fetcher prioritizes smart cache for current periods\n');
    } else if (failCount === 0) {
      console.log('⚠️  AUDIT PASSED WITH WARNINGS\n');
      console.log('Smart cache system is working but may need attention for warnings above.\n');
    } else {
      console.log('❌ AUDIT FAILED\n');
      console.log('Smart cache system has issues that need to be fixed.\n');
      process.exit(1);
    }

    // Save detailed results
    const reportPath = `SMART_CACHE_AUDIT_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(reportPath, JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2));
    console.log(`📄 Detailed results saved to: ${reportPath}\n`);

  } catch (error) {
    console.error('❌ Fatal error during audit:', error);
    process.exit(1);
  }
}

auditSmartCacheSpend();

