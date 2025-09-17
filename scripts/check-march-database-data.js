const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMarchDatabaseData() {
  console.log('🔍 Checking March 2024 database data...\n');

  try {
    // Get jacek's client ID
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .eq('email', 'jac.honkisz@gmail.com');

    if (!clients || clients.length === 0) {
      console.error('❌ No client found for jacek');
      return;
    }

    const jacek = clients[0];
    console.log('👤 Jacek client:', { id: jacek.id, name: jacek.name });

    // Check campaigns with overlapping date ranges for March 2024
    const marchStart = '2024-03-01';
    const marchEnd = '2024-03-31';
    
    console.log(`📅 Checking campaigns for date range: ${marchStart} to ${marchEnd}`);
    
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', jacek.id)
      .or(`date_range_start.lte.${marchEnd},date_range_end.gte.${marchStart}`);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`📊 Found ${campaigns.length} campaigns in database`);
    
    if (campaigns.length > 0) {
      // Calculate totals
      const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
      const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
      const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
      const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
      
      console.log('\n📈 Database Totals:');
      console.log(`   Total Spend: ${totalSpend.toFixed(2)} zł`);
      console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
      console.log(`   Total Clicks: ${totalClicks.toLocaleString()}`);
      console.log(`   Total Conversions: ${totalConversions}`);
      
      // Show first few campaigns
      console.log('\n📋 Sample campaigns:');
      campaigns.slice(0, 5).forEach((campaign, index) => {
        console.log(`   ${index + 1}. ${campaign.campaign_name}`);
        console.log(`      Spend: ${campaign.spend || 0} zł`);
        console.log(`      Impressions: ${campaign.impressions || 0}`);
        console.log(`      Clicks: ${campaign.clicks || 0}`);
        console.log(`      Date range: ${campaign.date_range_start} to ${campaign.date_range_end}`);
      });
      
      if (campaigns.length > 5) {
        console.log(`   ... and ${campaigns.length - 5} more campaigns`);
      }
    }

    // Compare with what the reports page shows
    console.log('\n🔍 Comparison with Reports Page:');
    console.log('   Reports Page shows: 7,225.75 zł spend, 237,863 impressions, 4,224 clicks');
    console.log(`   Database shows: ${totalSpend.toFixed(2)} zł spend, ${totalImpressions.toLocaleString()} impressions, ${totalClicks.toLocaleString()} clicks`);
    
    if (Math.abs(totalSpend - 7225.75) < 0.01) {
      console.log('✅ Database totals match reports page!');
    } else {
      console.log('⚠️ Database totals do NOT match reports page!');
      console.log('   This explains why PDF generation shows different data.');
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkMarchDatabaseData(); 