require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugCurrentData() {
  console.log('🔍 Debugging Current Data and Trend Calculation');
  console.log('==============================================\n');

  try {
    // 1. Check all reports in the database
    console.log('1. All reports in database:');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .order('date_range_start', { ascending: true });

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      return;
    }

    console.log(`Found ${reports?.length || 0} reports:`);
    reports?.forEach((report, index) => {
      console.log(`  ${index + 1}. ${report.date_range_start} to ${report.date_range_end}`);
      console.log(`     Client ID: ${report.client_id}`);
      console.log(`     Generated: ${report.generated_at}`);
      console.log(`     Campaigns: ${report.campaigns?.length || 0}`);
    });

    // 2. Check campaigns data
    console.log('\n2. Campaigns data:');
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .order('date_range_start', { ascending: true });

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      return;
    }

    console.log(`Found ${campaigns?.length || 0} campaigns:`);
    campaigns?.forEach((campaign, index) => {
      console.log(`  ${index + 1}. ${campaign.campaign_name}`);
      console.log(`     Date: ${campaign.date_range_start} to ${campaign.date_range_end}`);
      console.log(`     Spend: ${campaign.spend} zł`);
      console.log(`     Conversions: ${campaign.conversions}`);
      console.log(`     CTR: ${campaign.ctr}%`);
    });

    // 3. Calculate totals for each month
    console.log('\n3. Monthly totals calculation:');
    const monthlyTotals = {};
    
    campaigns?.forEach(campaign => {
      const monthKey = campaign.date_range_start.substring(0, 7); // YYYY-MM
      
      if (!monthlyTotals[monthKey]) {
        monthlyTotals[monthKey] = {
          spend: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0
        };
      }
      
      monthlyTotals[monthKey].spend += campaign.spend || 0;
      monthlyTotals[monthKey].impressions += campaign.impressions || 0;
      monthlyTotals[monthKey].clicks += campaign.clicks || 0;
      monthlyTotals[monthKey].conversions += campaign.conversions || 0;
    });

    // Calculate CTR for each month
    Object.keys(monthlyTotals).forEach(month => {
      const totals = monthlyTotals[month];
      totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    });

    console.log('Monthly totals:');
    Object.keys(monthlyTotals).sort().forEach(month => {
      const totals = monthlyTotals[month];
      console.log(`  ${month}:`);
      console.log(`    Spend: ${totals.spend.toFixed(2)} zł`);
      console.log(`    Conversions: ${totals.conversions}`);
      console.log(`    CTR: ${totals.ctr.toFixed(2)}%`);
    });

    // 4. Calculate trends between months
    console.log('\n4. Trend calculations:');
    const months = Object.keys(monthlyTotals).sort();
    
    for (let i = 1; i < months.length; i++) {
      const currentMonth = months[i];
      const previousMonth = months[i - 1];
      const current = monthlyTotals[currentMonth];
      const previous = monthlyTotals[previousMonth];
      
      const spendTrend = previous.spend > 0 ? ((current.spend - previous.spend) / previous.spend) * 100 : 0;
      const conversionsTrend = previous.conversions > 0 ? ((current.conversions - previous.conversions) / previous.conversions) * 100 : 0;
      const ctrTrend = previous.ctr > 0 ? ((current.ctr - previous.ctr) / previous.ctr) * 100 : 0;
      
      console.log(`\n${previousMonth} → ${currentMonth}:`);
      console.log(`  Spend: ${previous.spend.toFixed(2)} zł → ${current.spend.toFixed(2)} zł (${spendTrend >= 0 ? '+' : ''}${spendTrend.toFixed(1)}%)`);
      console.log(`  Conversions: ${previous.conversions} → ${current.conversions} (${conversionsTrend >= 0 ? '+' : ''}${conversionsTrend.toFixed(1)}%)`);
      console.log(`  CTR: ${previous.ctr.toFixed(2)}% → ${current.ctr.toFixed(2)}% (${ctrTrend >= 0 ? '+' : ''}${ctrTrend.toFixed(1)}%)`);
    }

    // 5. Check if there's a specific issue with March vs April
    console.log('\n5. March vs April 2024 specific check:');
    const march2024 = monthlyTotals['2024-03'];
    const april2024 = monthlyTotals['2024-04'];
    
    if (march2024 && april2024) {
      const spendTrend = ((april2024.spend - march2024.spend) / march2024.spend) * 100;
      console.log(`March 2024 spend: ${march2024.spend.toFixed(2)} zł`);
      console.log(`April 2024 spend: ${april2024.spend.toFixed(2)} zł`);
      console.log(`Expected trend: ${spendTrend >= 0 ? '+' : ''}${spendTrend.toFixed(1)}%`);
      console.log(`Current display shows: +8.5% (INCORRECT!)`);
    } else {
      console.log('March or April 2024 data not found');
      if (!march2024) console.log('  - March 2024 data missing');
      if (!april2024) console.log('  - April 2024 data missing');
    }

  } catch (error) {
    console.error('❌ Error debugging data:', error);
  }
}

debugCurrentData(); 