require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Real Meta Business Suite data (parsed from JSON)
const realMetaData = {
  "Worksheet": [
    {
      "Nazwa kampanii": "[PBM] Aktywność | Posty",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Cold | Boże Narodzenie",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Hot | Remarketing Dynamiczny",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Hot | Remarketing",
      "Wydana kwota (PLN)": 530.63,
      "Wyświetlenia": 37914,
      "Zasięg": 9711,
      "Zakupy": 1,
      "ROAS": 15.253567
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Ferie",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Advantage+ | Pakiet Romantyczny",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Advantage+ | 30% | Ogólna Kampania",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Cold | Jesień –2024",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Połączenia | Masaż Balijski",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Advantage+ | 30% | Ogólna Kampania – v2 Kampania",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Wakacje 2025",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Zasięg | Video | Wakacje 2025",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Ruch | Profil Instagramowy",
      "Wydana kwota (PLN)": 111.51,
      "Wyświetlenia": 7004,
      "Zasięg": 5157,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Aktywność | Obserwowanie Facebook",
      "Wydana kwota (PLN)": 55.28,
      "Wyświetlenia": 3554,
      "Zasięg": 2899,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Zasięg | Video | 5 powodów dla których warto przyjechać- DE – kopia",
      "Wydana kwota (PLN)": 222.11,
      "Wyświetlenia": 10118,
      "Zasięg": 6698,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Advantage+ | 30% | Ogólna Kampania – v2",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Remarketing dynamiczny - Feed od PR – Copy",
      "Wydana kwota (PLN)": 665.6,
      "Wyświetlenia": 44198,
      "Zasięg": 20377,
      "Zakupy": 2,
      "ROAS": 11.720252
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Boże Narodzenie 2025",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Sylwester 2025/26",
      "Wydana kwota (PLN)": 362.27,
      "Wyświetlenia": 30399,
      "Zasięg": 18440,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Jesień 2025",
      "Wydana kwota (PLN)": 0,
      "Wyświetlenia": 0,
      "Zasięg": 0,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Zanim ruszą ferie 2026",
      "Wydana kwota (PLN)": 283.56,
      "Wyświetlenia": 23251,
      "Zasięg": 12394,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Ferie Zimowe 2026",
      "Wydana kwota (PLN)": 570.64,
      "Wyświetlenia": 48643,
      "Zasięg": 26285,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Boże Narodzenie 2025 – v2",
      "Wydana kwota (PLN)": 424.81,
      "Wyświetlenia": 49881,
      "Zasięg": 29307,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Zanim ruszą ferie 2026 – v2",
      "Wydana kwota (PLN)": 135.65,
      "Wyświetlenia": 8620,
      "Zasięg": 5860,
      "Zakupy": null
    },
    {
      "Nazwa kampanii": "[PBM] Konwersje | Ferie Zimowe 2026 – v2",
      "Wydana kwota (PLN)": 373.8,
      "Wyświetlenia": 33167,
      "Zasięg": 20285,
      "Zakupy": null
    }
  ]
};

async function auditHavetDecemberData() {
  console.log('🔍 HAVET DECEMBER 2025 DATA AUDIT\n');
  console.log('📅 Period: 2025-12-01 to 2025-12-19');
  console.log('='.repeat(80));

  const HAVET_CLIENT_ID = '93d46876-addc-4b99-b1e1-437428dd54f1';
  const AD_ACCOUNT_ID = '659510566204299';

  // Calculate REAL totals from Meta Business Suite JSON
  const realActiveCampaigns = realMetaData.Worksheet.filter(c => c["Wydana kwota (PLN)"] > 0);
  const realTotals = {
    totalSpend: realActiveCampaigns.reduce((sum, c) => sum + (c["Wydana kwota (PLN)"] || 0), 0),
    totalImpressions: realActiveCampaigns.reduce((sum, c) => sum + (c["Wyświetlenia"] || 0), 0),
    totalReach: realActiveCampaigns.reduce((sum, c) => sum + (c["Zasięg"] || 0), 0),
    totalPurchases: realActiveCampaigns.reduce((sum, c) => sum + (c["Zakupy"] || 0), 0),
    activeCampaignsCount: realActiveCampaigns.length,
    totalCampaignsCount: realMetaData.Worksheet.length
  };

  console.log('\n📊 REAL META BUSINESS SUITE DATA (Source of Truth):\n');
  console.log(`   Total Campaigns: ${realTotals.totalCampaignsCount}`);
  console.log(`   Active Campaigns (with spend): ${realTotals.activeCampaignsCount}`);
  console.log(`   Total Spend: ${realTotals.totalSpend.toFixed(2)} PLN`);
  console.log(`   Total Impressions: ${realTotals.totalImpressions.toLocaleString()}`);
  console.log(`   Total Reach: ${realTotals.totalReach.toLocaleString()}`);
  console.log(`   Total Purchases: ${realTotals.totalPurchases}`);
  console.log(`   Avg CTR: ${realTotals.totalImpressions > 0 ? ((realTotals.totalClicks || 0) / realTotals.totalImpressions * 100).toFixed(2) : 0}%`);

  console.log('\n📋 Active Campaigns (with spend > 0):');
  realActiveCampaigns.forEach((c, i) => {
    console.log(`   ${i + 1}. ${c["Nazwa kampanii"]}`);
    console.log(`      Spend: ${c["Wydana kwota (PLN)"]} PLN | Impressions: ${c["Wyświetlenia"].toLocaleString()} | Reach: ${c["Zasięg"].toLocaleString()} | Purchases: ${c["Zakupy"] || 0}`);
  });

  try {
    // 1. Check client exists
    console.log('\n\n🔍 SYSTEM DATA CHECK:\n');
    console.log('1️⃣ Checking client in database...');
    
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', HAVET_CLIENT_ID)
      .single();

    if (clientError || !client) {
      console.log('❌ Client not found in database!');
      return;
    }

    console.log(`   ✅ Client found: ${client.name}`);
    console.log(`   Ad Account: ${client.ad_account_id}`);
    console.log(`   API Status: ${client.api_status}`);

    // 2. Check smart cache data
    console.log('\n2️⃣ Checking current_month_cache (Smart Cache)...');
    
    const { data: cacheData, error: cacheError } = await supabase
      .from('current_month_cache')
      .select('*')
      .eq('client_id', HAVET_CLIENT_ID)
      .order('last_updated', { ascending: false })
      .limit(1);

    if (cacheData && cacheData.length > 0) {
      const cache = cacheData[0];
      console.log(`   ✅ Smart cache found!`);
      console.log(`   Last Updated: ${cache.last_updated}`);
      console.log(`   Period: ${cache.period_id || 'N/A'}`);
      
      if (cache.cached_data) {
        const cachedStats = cache.cached_data.stats || {};
        const cachedConversions = cache.cached_data.conversionMetrics || {};
        const cachedCampaigns = cache.cached_data.campaigns || [];
        
        console.log(`\n   📊 SMART CACHE STATS:`);
        console.log(`      Total Spend: ${cachedStats.totalSpend?.toFixed(2) || 0} PLN`);
        console.log(`      Total Impressions: ${(cachedStats.totalImpressions || 0).toLocaleString()}`);
        console.log(`      Total Clicks: ${(cachedStats.totalClicks || 0).toLocaleString()}`);
        console.log(`      Campaigns Count: ${cachedCampaigns.length}`);
        console.log(`      Reservations: ${cachedConversions.reservations || 0}`);
        console.log(`      Reservation Value: ${cachedConversions.reservation_value?.toFixed(2) || 0} PLN`);
        
        // Compare with real data
        const spendDiff = Math.abs((cachedStats.totalSpend || 0) - realTotals.totalSpend);
        const impressionsDiff = Math.abs((cachedStats.totalImpressions || 0) - realTotals.totalImpressions);
        
        console.log(`\n   ⚖️ COMPARISON WITH REAL DATA:`);
        console.log(`      Spend Difference: ${spendDiff.toFixed(2)} PLN (${((spendDiff / realTotals.totalSpend) * 100).toFixed(1)}%)`);
        console.log(`      Impressions Difference: ${impressionsDiff.toLocaleString()} (${((impressionsDiff / realTotals.totalImpressions) * 100).toFixed(1)}%)`);
        
        if (spendDiff < 1 && impressionsDiff < 100) {
          console.log(`      ✅ Data matches!`);
        } else {
          console.log(`      ❌ DATA MISMATCH DETECTED!`);
        }
      }
    } else {
      console.log('   ⚠️ No smart cache data found');
    }

    // 3. Check campaign_summaries
    console.log('\n3️⃣ Checking campaign_summaries (Historical Data)...');
    
    const { data: summaries, error: summaryError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .eq('client_id', HAVET_CLIENT_ID)
      .eq('platform', 'meta')
      .gte('summary_date', '2025-12-01')
      .lte('summary_date', '2025-12-31')
      .order('summary_date', { ascending: false });

    if (summaries && summaries.length > 0) {
      console.log(`   ✅ Found ${summaries.length} summary record(s) for December 2025`);
      
      summaries.forEach((summary, i) => {
        console.log(`\n   Summary ${i + 1}:`);
        console.log(`      Date: ${summary.summary_date}`);
        console.log(`      Type: ${summary.summary_type}`);
        console.log(`      Total Spend: ${summary.total_spend?.toFixed(2) || 0} PLN`);
        console.log(`      Total Impressions: ${(summary.total_impressions || 0).toLocaleString()}`);
        console.log(`      Total Clicks: ${(summary.total_clicks || 0).toLocaleString()}`);
        console.log(`      Reservations: ${summary.reservations || 0}`);
        console.log(`      Reservation Value: ${summary.reservation_value?.toFixed(2) || 0} PLN`);
        
        // Compare
        const spendDiff = Math.abs((summary.total_spend || 0) - realTotals.totalSpend);
        console.log(`      ⚖️ Spend Diff from Real: ${spendDiff.toFixed(2)} PLN`);
      });
    } else {
      console.log('   ⚠️ No campaign_summaries found for December 2025');
    }

    // 4. Check daily_kpi_data
    console.log('\n4️⃣ Checking daily_kpi_data...');
    
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_kpi_data')
      .select('*')
      .eq('client_id', HAVET_CLIENT_ID)
      .eq('data_source', 'meta_api')
      .gte('date', '2025-12-01')
      .lte('date', '2025-12-19')
      .order('date', { ascending: true });

    if (dailyData && dailyData.length > 0) {
      console.log(`   ✅ Found ${dailyData.length} daily records for December 2025`);
      
      // Aggregate daily totals
      const dailyTotals = dailyData.reduce((acc, d) => ({
        totalSpend: acc.totalSpend + (d.total_spend || 0),
        totalImpressions: acc.totalImpressions + (d.total_impressions || 0),
        totalClicks: acc.totalClicks + (d.total_clicks || 0),
        reservations: acc.reservations + (d.reservations || 0),
        reservationValue: acc.reservationValue + (d.reservation_value || 0)
      }), { totalSpend: 0, totalImpressions: 0, totalClicks: 0, reservations: 0, reservationValue: 0 });

      console.log(`\n   📊 AGGREGATED DAILY TOTALS:`);
      console.log(`      Total Spend: ${dailyTotals.totalSpend.toFixed(2)} PLN`);
      console.log(`      Total Impressions: ${dailyTotals.totalImpressions.toLocaleString()}`);
      console.log(`      Total Clicks: ${dailyTotals.totalClicks.toLocaleString()}`);
      console.log(`      Reservations: ${dailyTotals.reservations}`);
      console.log(`      Reservation Value: ${dailyTotals.reservationValue.toFixed(2)} PLN`);
      
      // Compare
      const spendDiff = Math.abs(dailyTotals.totalSpend - realTotals.totalSpend);
      const impressionsDiff = Math.abs(dailyTotals.totalImpressions - realTotals.totalImpressions);
      
      console.log(`\n   ⚖️ COMPARISON WITH REAL DATA:`);
      console.log(`      Spend Difference: ${spendDiff.toFixed(2)} PLN (${realTotals.totalSpend > 0 ? ((spendDiff / realTotals.totalSpend) * 100).toFixed(1) : 0}%)`);
      console.log(`      Impressions Difference: ${impressionsDiff.toLocaleString()} (${realTotals.totalImpressions > 0 ? ((impressionsDiff / realTotals.totalImpressions) * 100).toFixed(1) : 0}%)`);
    } else {
      console.log('   ⚠️ No daily_kpi_data found for December 2025');
    }

    // 5. Test LIVE API fetch
    console.log('\n5️⃣ Testing LIVE Meta API fetch...');
    
    const accessToken = client.meta_access_token;
    const adAccountId = `act_${client.ad_account_id}`;
    
    const fields = [
      'campaign_id',
      'campaign_name',
      'impressions',
      'clicks',
      'spend',
      'ctr',
      'cpc',
      'conversions',
      'actions',
      'action_values',
      'reach'
    ].join(',');
    
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: fields,
      time_range: JSON.stringify({
        since: '2025-12-01',
        until: '2025-12-19',
      }),
      level: 'campaign',
      limit: '100',
    });
    
    const url = `https://graph.facebook.com/v18.0/${adAccountId}/insights?${params.toString()}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.log(`   ❌ API Error: ${data.error.message}`);
      } else if (data.data && data.data.length > 0) {
        console.log(`   ✅ Live API returned ${data.data.length} campaigns`);
        
        // Aggregate API totals
        const apiTotals = data.data.reduce((acc, c) => ({
          totalSpend: acc.totalSpend + parseFloat(c.spend || 0),
          totalImpressions: acc.totalImpressions + parseInt(c.impressions || 0),
          totalClicks: acc.totalClicks + parseInt(c.clicks || 0),
          totalReach: acc.totalReach + parseInt(c.reach || 0)
        }), { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalReach: 0 });

        console.log(`\n   📊 LIVE API TOTALS:`);
        console.log(`      Total Spend: ${apiTotals.totalSpend.toFixed(2)} PLN`);
        console.log(`      Total Impressions: ${apiTotals.totalImpressions.toLocaleString()}`);
        console.log(`      Total Clicks: ${apiTotals.totalClicks.toLocaleString()}`);
        console.log(`      Total Reach: ${apiTotals.totalReach.toLocaleString()}`);
        
        // Compare with real data
        const spendDiff = Math.abs(apiTotals.totalSpend - realTotals.totalSpend);
        const impressionsDiff = Math.abs(apiTotals.totalImpressions - realTotals.totalImpressions);
        
        console.log(`\n   ⚖️ COMPARISON WITH META BUSINESS SUITE (JSON):`);
        console.log(`      Spend Difference: ${spendDiff.toFixed(2)} PLN (${realTotals.totalSpend > 0 ? ((spendDiff / realTotals.totalSpend) * 100).toFixed(1) : 0}%)`);
        console.log(`      Impressions Difference: ${impressionsDiff.toLocaleString()} (${realTotals.totalImpressions > 0 ? ((impressionsDiff / realTotals.totalImpressions) * 100).toFixed(1) : 0}%)`);
        
        if (spendDiff < 1 && impressionsDiff < 100) {
          console.log(`      ✅ LIVE API DATA MATCHES META BUSINESS SUITE!`);
        } else if (spendDiff < 10) {
          console.log(`      ⚠️ MINOR DIFFERENCE (likely timing/rounding)`);
        } else {
          console.log(`      ❌ SIGNIFICANT MISMATCH - INVESTIGATE!`);
        }

        // Show individual campaigns comparison
        console.log('\n   📋 CAMPAIGN-BY-CAMPAIGN COMPARISON:');
        
        data.data.forEach((apiCampaign, i) => {
          const realCampaign = realMetaData.Worksheet.find(r => 
            r["Nazwa kampanii"] === apiCampaign.campaign_name
          );
          
          if (realCampaign && (apiCampaign.spend > 0 || realCampaign["Wydana kwota (PLN)"] > 0)) {
            const spendMatch = Math.abs(parseFloat(apiCampaign.spend || 0) - (realCampaign["Wydana kwota (PLN)"] || 0)) < 1;
            const impressionsMatch = Math.abs(parseInt(apiCampaign.impressions || 0) - (realCampaign["Wyświetlenia"] || 0)) < 100;
            
            const status = (spendMatch && impressionsMatch) ? '✅' : '❌';
            
            console.log(`\n      ${status} ${apiCampaign.campaign_name}`);
            console.log(`         API Spend: ${parseFloat(apiCampaign.spend || 0).toFixed(2)} | Real: ${realCampaign["Wydana kwota (PLN)"]} PLN`);
            console.log(`         API Impressions: ${apiCampaign.impressions} | Real: ${realCampaign["Wyświetlenia"]}`);
            
            if (!spendMatch || !impressionsMatch) {
              console.log(`         ⚠️ MISMATCH DETECTED!`);
            }
          }
        });
        
        // Check for missing campaigns
        console.log('\n   🔍 CAMPAIGNS IN REAL DATA BUT NOT IN API:');
        const apiCampaignNames = data.data.map(c => c.campaign_name);
        realActiveCampaigns.forEach(realCampaign => {
          if (!apiCampaignNames.includes(realCampaign["Nazwa kampanii"])) {
            console.log(`      ❌ Missing: ${realCampaign["Nazwa kampanii"]} (Spend: ${realCampaign["Wydana kwota (PLN)"]} PLN)`);
          }
        });

      } else {
        console.log('   ⚠️ No data returned from API');
      }
    } catch (apiError) {
      console.log(`   ❌ API fetch error: ${apiError.message}`);
    }

    // 6. Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 AUDIT SUMMARY\n');
    
    console.log('📊 REAL META BUSINESS SUITE TOTALS (Dec 1-19, 2025):');
    console.log(`   Total Spend: ${realTotals.totalSpend.toFixed(2)} PLN`);
    console.log(`   Total Impressions: ${realTotals.totalImpressions.toLocaleString()}`);
    console.log(`   Total Reach: ${realTotals.totalReach.toLocaleString()}`);
    console.log(`   Total Purchases: ${realTotals.totalPurchases}`);
    console.log(`   Active Campaigns: ${realTotals.activeCampaignsCount}/${realTotals.totalCampaignsCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the audit
auditHavetDecemberData().catch(console.error);
