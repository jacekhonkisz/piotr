/**
 * Audit all clients by 4 categories:
 * 1. Meta Weekly
 * 2. Meta Monthly
 * 3. Google Weekly
 * 4. Google Monthly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function audit4Categories() {
  console.log('\n📊 AUDIT: 4 CATEGORIES PER CLIENT\n');
  console.log('═'.repeat(100) + '\n');

  try {
    // Get all clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, google_ads_customer_id')
      .order('name');

    // Get all records
    const { data: records } = await supabase
      .from('campaign_summaries')
      .select('client_id, platform, summary_type');

    console.log('CLIENT DATA BY 4 CATEGORIES:\n');
    console.log('Client Name'.padEnd(35) + ' | Meta W | Meta M | Google W | Google M | Total | Status');
    console.log('─'.repeat(100));

    let totalMetaWeekly = 0;
    let totalMetaMonthly = 0;
    let totalGoogleWeekly = 0;
    let totalGoogleMonthly = 0;

    for (const client of clients) {
      const clientRecords = records.filter(r => r.client_id === client.id);
      
      const metaWeekly = clientRecords.filter(r => r.platform === 'meta' && r.summary_type === 'weekly').length;
      const metaMonthly = clientRecords.filter(r => r.platform === 'meta' && r.summary_type === 'monthly').length;
      const googleWeekly = clientRecords.filter(r => r.platform === 'google' && r.summary_type === 'weekly').length;
      const googleMonthly = clientRecords.filter(r => r.platform === 'google' && r.summary_type === 'monthly').length;
      const total = clientRecords.length;

      totalMetaWeekly += metaWeekly;
      totalMetaMonthly += metaMonthly;
      totalGoogleWeekly += googleWeekly;
      totalGoogleMonthly += googleMonthly;

      // Status indicators
      const hasGoogle = client.google_ads_customer_id ? true : false;
      const metaWStatus = metaWeekly >= 53 ? '✅' : '⚠️';
      const metaMStatus = metaMonthly >= 12 ? '✅' : '⚠️';
      const googleWStatus = !hasGoogle ? '➖' : (googleWeekly >= 53 ? '✅' : '⚠️');
      const googleMStatus = !hasGoogle ? '➖' : (googleMonthly >= 12 ? '✅' : '⚠️');

      const name = client.name.padEnd(35);
      const mw = String(metaWeekly).padStart(4);
      const mm = String(metaMonthly).padStart(4);
      const gw = hasGoogle ? String(googleWeekly).padStart(6) : '  N/A';
      const gm = hasGoogle ? String(googleMonthly).padStart(6) : '  N/A';
      const tot = String(total).padStart(4);

      console.log(`${name} | ${mw} ${metaWStatus} | ${mm} ${metaMStatus} | ${gw} ${googleWStatus} | ${gm} ${googleMStatus} | ${tot} | ${hasGoogle ? 'Meta+Google' : 'Meta only'}`);
    }

    console.log('─'.repeat(100));
    console.log('TOTALS:'.padEnd(35) + ` | ${String(totalMetaWeekly).padStart(4)}   | ${String(totalMetaMonthly).padStart(4)}   | ${String(totalGoogleWeekly).padStart(6)}   | ${String(totalGoogleMonthly).padStart(6)}   | ${String(records.length).padStart(4)}`);

    console.log('\n' + '═'.repeat(100) + '\n');

    // Summary
    console.log('📋 SUMMARY BY CATEGORY:\n');
    console.log(`   Meta Weekly:     ${totalMetaWeekly} records`);
    console.log(`   Meta Monthly:    ${totalMetaMonthly} records`);
    console.log(`   Google Weekly:   ${totalGoogleWeekly} records`);
    console.log(`   Google Monthly:  ${totalGoogleMonthly} records`);
    console.log(`   ─────────────────────────────`);
    console.log(`   TOTAL:           ${records.length} records`);

    console.log('\n' + '─'.repeat(100) + '\n');

    // Coverage analysis
    console.log('🎯 COVERAGE ANALYSIS:\n');

    const clientsWithGoogle = clients.filter(c => c.google_ads_customer_id).length;
    const clientsWithoutGoogle = clients.length - clientsWithGoogle;

    console.log(`   Total Clients: ${clients.length}`);
    console.log(`   Clients with Google Ads: ${clientsWithGoogle}`);
    console.log(`   Clients without Google Ads: ${clientsWithoutGoogle}\n`);

    // Check which clients need more data
    console.log('⚠️  CLIENTS NEEDING MORE DATA:\n');

    let needsDataCount = 0;
    for (const client of clients) {
      const clientRecords = records.filter(r => r.client_id === client.id);
      
      const metaWeekly = clientRecords.filter(r => r.platform === 'meta' && r.summary_type === 'weekly').length;
      const metaMonthly = clientRecords.filter(r => r.platform === 'meta' && r.summary_type === 'monthly').length;
      const googleWeekly = clientRecords.filter(r => r.platform === 'google' && r.summary_type === 'weekly').length;
      const googleMonthly = clientRecords.filter(r => r.platform === 'google' && r.summary_type === 'monthly').length;

      const hasGoogle = client.google_ads_customer_id ? true : false;

      const issues = [];
      if (metaWeekly < 53) issues.push(`Meta Weekly: ${metaWeekly}/53`);
      if (metaMonthly < 12) issues.push(`Meta Monthly: ${metaMonthly}/12`);
      if (hasGoogle && googleWeekly < 53) issues.push(`Google Weekly: ${googleWeekly}/53`);
      if (hasGoogle && googleMonthly < 12) issues.push(`Google Monthly: ${googleMonthly}/12`);

      if (issues.length > 0) {
        needsDataCount++;
        console.log(`   ${needsDataCount}. ${client.name}`);
        issues.forEach(issue => console.log(`      - ${issue}`));
      }
    }

    if (needsDataCount === 0) {
      console.log('   ✅ All clients have complete coverage!\n');
    } else {
      console.log(`\n   📊 ${needsDataCount} client(s) need more data collection`);
      console.log('   🔄 Automated job on Monday 2 AM will collect missing data\n');
    }

    console.log('═'.repeat(100) + '\n');

    // Target vs Actual
    console.log('🎯 TARGET vs ACTUAL:\n');
    console.log(`   Target per client (with Google Ads):`);
    console.log(`   - Meta Weekly:     53 weeks`);
    console.log(`   - Meta Monthly:    12 months`);
    console.log(`   - Google Weekly:   53 weeks`);
    console.log(`   - Google Monthly:  12 months`);
    console.log(`   - TOTAL:           130 records\n`);

    console.log(`   Target per client (Meta only):`);
    console.log(`   - Meta Weekly:     53 weeks`);
    console.log(`   - Meta Monthly:    12 months`);
    console.log(`   - TOTAL:           65 records\n`);

    const expectedTotal = (clientsWithGoogle * 130) + (clientsWithoutGoogle * 65);
    const actualTotal = records.length;
    const coveragePct = ((actualTotal / expectedTotal) * 100).toFixed(1);

    console.log(`   Expected Total: ${expectedTotal} records`);
    console.log(`   Actual Total:   ${actualTotal} records`);
    console.log(`   Coverage:       ${coveragePct}%\n`);

    console.log('═'.repeat(100) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

audit4Categories().catch(console.error);

