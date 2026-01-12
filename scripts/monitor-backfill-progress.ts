/**
 * Monitor Historical CTR/CPC Backfill Progress
 * 
 * This script checks the progress of the backfill operation
 * by querying the database to see how many summaries have been updated.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function monitorProgress() {
  console.log('📊 MONITORING: Historical CTR/CPC Backfill Progress\n');
  console.log('='.repeat(70));

  try {
    // 1. Overall Summary
    console.log('\n1️⃣ OVERALL PROGRESS SUMMARY');
    console.log('-'.repeat(70));

    const { data: overallStats, error: overallError } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: false })
      .eq('platform', 'meta');

    if (overallError) {
      console.error('❌ Error fetching overall stats:', overallError);
      return;
    }

    // Get detailed stats
    const { data: allSummaries } = await supabase
    .from('campaign_summaries')
      .select('average_ctr, average_cpc, last_updated, total_spend, total_impressions')
      .eq('platform', 'meta');

    if (!allSummaries) {
      console.log('⚠️  No summaries found');
      return;
    }

    const total = allSummaries.length;
    const updatedLastHour = allSummaries.filter(s => {
      const updated = new Date(s.last_updated);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return updated > oneHourAgo;
    }).length;

    const updatedLast24h = allSummaries.filter(s => {
      const updated = new Date(s.last_updated);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return updated > oneDayAgo;
    }).length;

    const hasCtr = allSummaries.filter(s => (s.average_ctr || 0) > 0).length;
    const hasCpc = allSummaries.filter(s => (s.average_cpc || 0) > 0).length;
    const hasBoth = allSummaries.filter(s => (s.average_ctr || 0) > 0 && (s.average_cpc || 0) > 0).length;

    const needsUpdate = allSummaries.filter(s => 
      ((s.average_ctr || 0) === 0 || (s.average_cpc || 0) === 0) &&
      ((s.total_spend || 0) > 0 || (s.total_impressions || 0) > 0)
    ).length;

    const avgCtr = allSummaries
      .filter(s => (s.average_ctr || 0) > 0)
      .reduce((sum, s) => sum + (s.average_ctr || 0), 0) / hasCtr || 0;

    const avgCpc = allSummaries
      .filter(s => (s.average_cpc || 0) > 0)
      .reduce((sum, s) => sum + (s.average_cpc || 0), 0) / hasCpc || 0;

    console.log(`Total Meta Summaries: ${total}`);
    console.log(`Updated Last Hour: ${updatedLastHour}`);
    console.log(`Updated Last 24 Hours: ${updatedLast24h}`);
    console.log(`Has CTR Value (> 0): ${hasCtr} (${((hasCtr / total) * 100).toFixed(1)}%)`);
    console.log(`Has CPC Value (> 0): ${hasCpc} (${((hasCpc / total) * 100).toFixed(1)}%)`);
    console.log(`Has Both CTR & CPC: ${hasBoth} (${((hasBoth / total) * 100).toFixed(1)}%)`);
    console.log(`Needs Update: ${needsUpdate} (${((needsUpdate / total) * 100).toFixed(1)}%)`);
    console.log(`Average CTR: ${avgCtr.toFixed(2)}%`);
    console.log(`Average CPC: ${avgCpc.toFixed(2)} zł`);

    // 2. Per-Client Breakdown
    console.log('\n2️⃣ PER-CLIENT BREAKDOWN');
    console.log('-'.repeat(70));

    const { data: clientStats, error: clientError } = await supabase
    .from('campaign_summaries')
    .select(`
        client_id,
        average_ctr,
        average_cpc,
        last_updated,
        total_spend,
        total_impressions,
      summary_date,
      summary_type,
        clients!inner(id, name)
      `)
      .eq('platform', 'meta');

    if (clientError) {
      console.error('❌ Error fetching client stats:', clientError);
      return;
    }

    if (!clientStats) {
      console.log('⚠️  No client stats found');
      return;
    }

    // Group by client
    const clientMap = new Map<string, any[]>();
    clientStats.forEach((stat: any) => {
      const clientId = stat.client_id;
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, []);
      }
      clientMap.get(clientId)!.push(stat);
    });

    for (const [clientId, summaries] of clientMap.entries()) {
      const clientName = summaries[0].clients?.name || 'Unknown';
      const total = summaries.length;
      const updatedRecent = summaries.filter((s: any) => {
        const updated = new Date(s.last_updated);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return updated > oneHourAgo;
      }).length;

      const hasBoth = summaries.filter((s: any) => 
        (s.average_ctr || 0) > 0 && (s.average_cpc || 0) > 0
      ).length;

      const needsUpdate = summaries.filter((s: any) => 
        ((s.average_ctr || 0) === 0 || (s.average_cpc || 0) === 0) &&
        ((s.total_spend || 0) > 0 || (s.total_impressions || 0) > 0)
      ).length;

      const avgCtr = summaries
        .filter((s: any) => (s.average_ctr || 0) > 0)
        .reduce((sum: number, s: any) => sum + (s.average_ctr || 0), 0) / 
        summaries.filter((s: any) => (s.average_ctr || 0) > 0).length || 0;

      const avgCpc = summaries
        .filter((s: any) => (s.average_cpc || 0) > 0)
        .reduce((sum: number, s: any) => sum + (s.average_cpc || 0), 0) / 
        summaries.filter((s: any) => (s.average_cpc || 0) > 0).length || 0;

      const earliest = summaries.reduce((min: any, s: any) => 
        !min || s.summary_date < min ? s.summary_date : min, null
      );
      const latest = summaries.reduce((max: any, s: any) => 
        !max || s.summary_date > max ? s.summary_date : max, null
      );

      console.log(`\n📊 ${clientName}`);
      console.log(`   Total Summaries: ${total}`);
      console.log(`   Updated Recently: ${updatedRecent}`);
      console.log(`   Has Both CTR & CPC: ${hasBoth} / ${total} (${((hasBoth / total) * 100).toFixed(1)}%)`);
      console.log(`   Needs Update: ${needsUpdate} / ${total} (${((needsUpdate / total) * 100).toFixed(1)}%)`);
      console.log(`   Average CTR: ${avgCtr > 0 ? avgCtr.toFixed(2) + '%' : 'N/A'}`);
      console.log(`   Average CPC: ${avgCpc > 0 ? avgCpc.toFixed(2) + ' zł' : 'N/A'}`);
      console.log(`   Date Range: ${earliest} to ${latest}`);
    }

    // 3. Recent Updates
    console.log('\n3️⃣ RECENT UPDATES (Last Hour)');
    console.log('-'.repeat(70));

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentUpdates, error: recentError } = await supabase
      .from('campaign_summaries')
      .select(`
        summary_type,
        summary_date,
        average_ctr,
        average_cpc,
        last_updated,
        clients!inner(name)
      `)
      .eq('platform', 'meta')
      .gt('last_updated', oneHourAgo)
      .order('last_updated', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('❌ Error fetching recent updates:', recentError);
    } else if (recentUpdates && recentUpdates.length > 0) {
      recentUpdates.forEach((update: any) => {
        console.log(`   ${update.clients?.name || 'Unknown'} - ${update.summary_type} ${update.summary_date}`);
        console.log(`      CTR: ${(update.average_ctr || 0).toFixed(2)}%, CPC: ${(update.average_cpc || 0).toFixed(2)} zł`);
        console.log(`      Updated: ${new Date(update.last_updated).toLocaleString('pl-PL')}`);
      });
    } else {
      console.log('   No updates in the last hour');
    }

    // 4. Still Needing Update
    console.log('\n4️⃣ STILL NEEDING UPDATE');
    console.log('-'.repeat(70));

    const { data: summariesNeedingUpdate, error: needsError } = await supabase
      .from('campaign_summaries')
      .select(`
        summary_type,
        summary_date,
        average_ctr,
        average_cpc,
        total_spend,
        total_impressions,
        clients!inner(name)
      `)
      .eq('platform', 'meta')
      .or('average_ctr.eq.0,average_cpc.eq.0')
      .gt('total_spend', 0)
      .order('summary_date', { ascending: false })
      .limit(10);

    if (needsError) {
      console.error('❌ Error fetching summaries needing update:', needsError);
    } else if (summariesNeedingUpdate && summariesNeedingUpdate.length > 0) {
      console.log(`   Found ${summariesNeedingUpdate.length} summaries still needing update:`);
      summariesNeedingUpdate.forEach((summary: any) => {
        console.log(`   ${summary.clients?.name || 'Unknown'} - ${summary.summary_type} ${summary.summary_date}`);
        console.log(`      CTR: ${(summary.average_ctr || 0).toFixed(2)}%, CPC: ${(summary.average_cpc || 0).toFixed(2)} zł`);
        console.log(`      Spend: ${(summary.total_spend || 0).toFixed(2)} zł, Impressions: ${summary.total_impressions || 0}`);
      });
    } else {
      console.log('   ✅ All summaries with data have CTR/CPC values!');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Monitoring complete');

  } catch (error: any) {
    console.error('\n❌ Error monitoring progress:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the monitoring
monitorProgress()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
