/**
 * Audit ALL clients and their data coverage
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditAllClients() {
  console.log('\n🔍 AUDITING ALL CLIENTS DATA COVERAGE\n');
  console.log('═'.repeat(80) + '\n');

  try {
    // 1️⃣ Get all clients
    console.log('1️⃣ ALL CLIENTS:\n');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, meta_access_token, google_ads_customer_id, created_at')
      .order('name');

    if (clientsError) throw clientsError;

    console.log(`   Total Clients: ${clients.length}\n`);
    clients.forEach((c, i) => {
      const metaStatus = c.meta_access_token ? '✅ Meta' : '❌ Meta';
      const googleStatus = c.google_ads_customer_id ? '✅ Google' : '❌ Google';
      console.log(`   ${i + 1}. ${c.name}`);
      console.log(`      ${metaStatus} | ${googleStatus} | Created: ${c.created_at.split('T')[0]}`);
    });

    console.log('\n' + '─'.repeat(80) + '\n');

    // 2️⃣ Get record counts per client
    console.log('2️⃣ RECORDS PER CLIENT:\n');

    for (const client of clients) {
      const { data: records } = await supabase
        .from('campaign_summaries')
        .select('platform, summary_type')
        .eq('client_id', client.id);

      if (!records || records.length === 0) {
        console.log(`   ❌ ${client.name}: NO DATA`);
        continue;
      }

      const meta = records.filter(r => r.platform === 'meta').length;
      const google = records.filter(r => r.platform === 'google').length;
      const weekly = records.filter(r => r.summary_type === 'weekly').length;
      const monthly = records.filter(r => r.summary_type === 'monthly').length;

      console.log(`   ✅ ${client.name}: ${records.length} total records`);
      console.log(`      Platform: Meta=${meta}, Google=${google}`);
      console.log(`      Period: Weekly=${weekly}, Monthly=${monthly}`);
    }

    console.log('\n' + '─'.repeat(80) + '\n');

    // 3️⃣ Overall database summary
    console.log('3️⃣ DATABASE SUMMARY:\n');

    const { data: allRecords } = await supabase
      .from('campaign_summaries')
      .select('client_id, platform, summary_type, data_source, total_spend');

    const clientsWithData = new Set(allRecords.map(r => r.client_id)).size;
    const metaRecords = allRecords.filter(r => r.platform === 'meta').length;
    const googleRecords = allRecords.filter(r => r.platform === 'google').length;
    const weeklyRecords = allRecords.filter(r => r.summary_type === 'weekly').length;
    const monthlyRecords = allRecords.filter(r => r.summary_type === 'monthly').length;
    const totalSpend = allRecords.reduce((sum, r) => sum + (r.total_spend || 0), 0);

    console.log(`   Total Clients: ${clients.length}`);
    console.log(`   Clients with Data: ${clientsWithData}`);
    console.log(`   Clients without Data: ${clients.length - clientsWithData}`);
    console.log(`\n   Total Records: ${allRecords.length}`);
    console.log(`   Meta Records: ${metaRecords}`);
    console.log(`   Google Records: ${googleRecords}`);
    console.log(`   Weekly Records: ${weeklyRecords}`);
    console.log(`   Monthly Records: ${monthlyRecords}`);
    console.log(`\n   Total Spend: $${totalSpend.toFixed(2)}`);

    console.log('\n' + '─'.repeat(80) + '\n');

    // 4️⃣ Data source validation
    console.log('4️⃣ DATA SOURCE VALIDATION:\n');

    const correctSources = allRecords.filter(r => {
      if (r.platform === 'meta') {
        return ['meta_api', 'smart_cache_archive'].includes(r.data_source);
      } else if (r.platform === 'google') {
        return ['google_ads_api', 'google_ads_smart_cache_archive'].includes(r.data_source);
      }
      return false;
    }).length;

    const incorrectSources = allRecords.length - correctSources;

    console.log(`   ✅ Correct sources: ${correctSources} (${((correctSources / allRecords.length) * 100).toFixed(1)}%)`);
    console.log(`   ⚠️  Incorrect sources: ${incorrectSources} (${((incorrectSources / allRecords.length) * 100).toFixed(1)}%)`);

    if (incorrectSources > 0) {
      console.log('\n   Incorrect data sources found:');
      const incorrectBySource = {};
      allRecords.forEach(r => {
        const isCorrect = (
          (r.platform === 'meta' && ['meta_api', 'smart_cache_archive'].includes(r.data_source)) ||
          (r.platform === 'google' && ['google_ads_api', 'google_ads_smart_cache_archive'].includes(r.data_source))
        );
        if (!isCorrect) {
          const key = `${r.platform}:${r.data_source}`;
          incorrectBySource[key] = (incorrectBySource[key] || 0) + 1;
        }
      });
      Object.entries(incorrectBySource).forEach(([key, count]) => {
        console.log(`   ⚠️  ${key}: ${count} records`);
      });
    }

    console.log('\n' + '─'.repeat(80) + '\n');

    // 5️⃣ Coverage analysis
    console.log('5️⃣ COVERAGE ANALYSIS:\n');

    for (const client of clients) {
      const { data: records } = await supabase
        .from('campaign_summaries')
        .select('platform, summary_type, summary_date')
        .eq('client_id', client.id)
        .order('summary_date');

      if (!records || records.length === 0) continue;

      const metaWeekly = records.filter(r => r.platform === 'meta' && r.summary_type === 'weekly');
      const googleWeekly = records.filter(r => r.platform === 'google' && r.summary_type === 'weekly');
      const metaMonthly = records.filter(r => r.platform === 'meta' && r.summary_type === 'monthly');
      const googleMonthly = records.filter(r => r.platform === 'google' && r.summary_type === 'monthly');

      console.log(`   ${client.name}:`);
      
      if (metaWeekly.length > 0) {
        console.log(`      Meta Weekly: ${metaWeekly.length} weeks (${metaWeekly[0].summary_date} to ${metaWeekly[metaWeekly.length - 1].summary_date})`);
      }
      if (googleWeekly.length > 0) {
        console.log(`      Google Weekly: ${googleWeekly.length} weeks (${googleWeekly[0].summary_date} to ${googleWeekly[googleWeekly.length - 1].summary_date})`);
      }
      if (metaMonthly.length > 0) {
        console.log(`      Meta Monthly: ${metaMonthly.length} months (${metaMonthly[0].summary_date} to ${metaMonthly[metaMonthly.length - 1].summary_date})`);
      }
      if (googleMonthly.length > 0) {
        console.log(`      Google Monthly: ${googleMonthly.length} months (${googleMonthly[0].summary_date} to ${googleMonthly[googleMonthly.length - 1].summary_date})`);
      }
    }

    console.log('\n' + '═'.repeat(80) + '\n');

    // 6️⃣ Recommendations
    console.log('6️⃣ RECOMMENDATIONS:\n');

    const clientsWithoutData = clients.filter(c => {
      const hasRecords = allRecords.some(r => r.client_id === c.id);
      return !hasRecords;
    });

    if (clientsWithoutData.length > 0) {
      console.log(`   ⚠️  ${clientsWithoutData.length} client(s) have no data:`);
      clientsWithoutData.forEach(c => {
        console.log(`      - ${c.name}`);
        console.log(`        Action: Check if API credentials are valid`);
        console.log(`        Action: Trigger manual collection: node scripts/test-google-weekly-collection.js`);
      });
    }

    if (incorrectSources > 0) {
      console.log(`\n   ⚠️  ${incorrectSources} record(s) have incorrect data sources`);
      console.log(`      Action: Run FIX_LEGACY_DATA_SOURCES_SAFE.sql for each affected client`);
    }

    const clientsNeedingGoogleWeekly = clients.filter(c => {
      if (!c.google_ads_customer_id) return false;
      const googleWeeklyCount = allRecords.filter(r => 
        r.client_id === c.id && r.platform === 'google' && r.summary_type === 'weekly'
      ).length;
      return googleWeeklyCount < 50; // Should have ~53 weeks
    });

    if (clientsNeedingGoogleWeekly.length > 0) {
      console.log(`\n   📊 ${clientsNeedingGoogleWeekly.length} client(s) need more Google weekly data:`);
      clientsNeedingGoogleWeekly.forEach(c => {
        const count = allRecords.filter(r => 
          r.client_id === c.id && r.platform === 'google' && r.summary_type === 'weekly'
        ).length;
        console.log(`      - ${c.name}: ${count} weeks (target: 53)`);
      });
      console.log(`      Action: Automated weekly job will collect on Monday 2 AM`);
      console.log(`      Action: Or trigger manually via /api/automated/collect-weekly-summaries`);
    }

    if (clientsWithoutData.length === 0 && incorrectSources === 0 && clientsNeedingGoogleWeekly.length === 0) {
      console.log(`   ✅ All clients have proper data coverage!`);
      console.log(`   ✅ All data sources are correct!`);
      console.log(`   ✅ System is working perfectly!`);
    }

    console.log('\n' + '═'.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

auditAllClients().catch(console.error);

