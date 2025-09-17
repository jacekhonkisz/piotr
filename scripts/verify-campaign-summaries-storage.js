// Script to verify the campaign_summaries table and check data storage status
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyCampaignSummariesStorage() {
  console.log('🔍 Verifying Campaign Summaries Storage for Smart Caching System\n');

  try {
    // Step 1: Check if the table exists
    console.log('1️⃣ Checking if campaign_summaries table exists...');
    
    const { data: tableData, error: tableError } = await supabase
      .from('campaign_summaries')
      .select('id')
      .limit(1);
    
    if (tableError) {
      if (tableError.code === '42P01') {
        console.error('❌ Table does not exist:', tableError.message);
        console.log('💡 Run migration: supabase/migrations/013_add_campaign_summaries.sql');
        return;
      } else {
        console.error('❌ Error checking table:', tableError.message);
        return;
      }
    }
    
    console.log('✅ campaign_summaries table exists!');

    // Step 2: Check table structure
    console.log('\n2️⃣ Checking table structure...');
    
    const { data: structureData, error: structureError } = await supabase
      .from('campaign_summaries')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.error('❌ Error checking structure:', structureError.message);
      return;
    }
    
    if (structureData && structureData.length > 0) {
      const columns = Object.keys(structureData[0]);
      console.log('✅ Table structure verified');
      console.log('   Columns found:', columns.join(', '));
    }

    // Step 3: Check current data count
    console.log('\n3️⃣ Checking current data count...');
    
    const { count: totalCount, error: countError } = await supabase
      .from('campaign_summaries')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting records:', countError.message);
    } else {
      console.log(`📊 Total records in table: ${totalCount}`);
    }

    // Step 4: Check data distribution by type
    console.log('\n4️⃣ Checking data distribution by type...');
    
    const { data: typeDistribution, error: typeError } = await supabase
      .from('campaign_summaries')
      .select('summary_type, summary_date, client_id')
      .order('summary_date', { ascending: false });
    
    if (typeError) {
      console.error('❌ Error checking type distribution:', typeError.message);
    } else if (typeDistribution && typeDistribution.length > 0) {
      const monthlyCount = typeDistribution.filter(r => r.summary_type === 'monthly').length;
      const weeklyCount = typeDistribution.filter(r => r.summary_type === 'weekly').length;
      
      console.log(`📅 Monthly summaries: ${monthlyCount}`);
      console.log(`📅 Weekly summaries: ${weeklyCount}`);
      
      // Show recent data
      console.log('\n📋 Recent data samples:');
      typeDistribution.slice(0, 10).forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.summary_type} - ${record.summary_date} (Client: ${record.client_id.substring(0, 8)}...)`);
      });
    } else {
      console.log('⚠️ No data found in table');
    }

    // Step 5: Check data freshness
    console.log('\n5️⃣ Checking data freshness...');
    
    if (typeDistribution && typeDistribution.length > 0) {
      const now = new Date();
      const oldestDate = new Date(Math.min(...typeDistribution.map(r => new Date(r.summary_date))));
      const newestDate = new Date(Math.max(...typeDistribution.map(r => new Date(r.summary_date))));
      
      const daysOld = Math.floor((now - oldestDate) / (1000 * 60 * 60 * 24));
      const daysNew = Math.floor((now - newestDate) / (1000 * 60 * 60 * 24));
      
      console.log(`📅 Oldest data: ${oldestDate.toISOString().split('T')[0]} (${daysOld} days ago)`);
      console.log(`📅 Newest data: ${newestDate.toISOString().split('T')[0]} (${daysNew} days ago)`);
      
      // Check if we have last 12 months
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      const recentDataCount = typeDistribution.filter(r => new Date(r.summary_date) >= twelveMonthsAgo).length;
      console.log(`📊 Data within last 12 months: ${recentDataCount} records`);
      
      if (recentDataCount === 0) {
        console.log('⚠️ No data found for last 12 months - background collection needed!');
      } else if (recentDataCount < 24) { // Less than 2 years of monthly data
        console.log('⚠️ Incomplete data for last 12 months - background collection needed!');
      } else {
        console.log('✅ Sufficient data found for last 12 months');
      }
    }

    // Step 6: Check client coverage
    console.log('\n6️⃣ Checking client coverage...');
    
    const { data: clientCoverage, error: clientError } = await supabase
      .from('campaign_summaries')
      .select('client_id')
      .order('client_id');
    
    if (clientError) {
      console.error('❌ Error checking client coverage:', clientError.message);
    } else if (clientCoverage && clientCoverage.length > 0) {
      const uniqueClients = [...new Set(clientCoverage.map(r => r.client_id))];
      console.log(`👥 Clients with stored data: ${uniqueClients.length}`);
      
      // Get client names
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, email')
        .in('id', uniqueClients);
      
      if (!clientsError && clients) {
        console.log('📋 Clients with data:');
        clients.forEach(client => {
          const clientDataCount = clientCoverage.filter(r => r.client_id === client.id).length;
          console.log(`   • ${client.name} (${client.email}): ${clientDataCount} records`);
        });
      }
    }

    // Step 7: Check data quality
    console.log('\n7️⃣ Checking data quality...');
    
    if (typeDistribution && typeDistribution.length > 0) {
      const sampleRecord = typeDistribution[0];
      
      const { data: fullRecord, error: fullError } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('id', sampleRecord.id || sampleRecord.client_id)
        .single();
      
      if (!fullError && fullRecord) {
        console.log('✅ Data quality check:');
        console.log(`   • Total spend: ${fullRecord.total_spend || 'N/A'}`);
        console.log(`   • Total impressions: ${fullRecord.total_impressions || 'N/A'}`);
        console.log(`   • Total clicks: ${fullRecord.total_clicks || 'N/A'}`);
        console.log(`   • Total conversions: ${fullRecord.total_conversions || 'N/A'}`);
        console.log(`   • Campaign data: ${fullRecord.campaign_data ? 'Present' : 'Missing'}`);
        console.log(`   • Meta tables: ${fullRecord.meta_tables ? 'Present' : 'Missing'}`);
      }
    }

    // Step 8: Check if background collection is needed
    console.log('\n8️⃣ Background Collection Status...');
    
    const currentDate = new Date();
    const twelveMonthsAgo = new Date(currentDate);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    if (typeDistribution && typeDistribution.length > 0) {
      const recentData = typeDistribution.filter(r => new Date(r.summary_date) >= twelveMonthsAgo);
      const monthlyData = recentData.filter(r => r.summary_type === 'monthly');
      const weeklyData = recentData.filter(r => r.summary_type === 'weekly');
      
      console.log('📊 Data completeness analysis:');
      console.log(`   • Last 12 months: ${recentData.length} total records`);
      console.log(`   • Monthly summaries: ${monthlyData.length}/12 expected`);
      console.log(`   • Weekly summaries: ${weeklyData.length}/52 expected`);
      
      if (monthlyData.length < 12 || weeklyData.length < 52) {
        console.log('⚠️ Background collection needed to populate missing data');
        console.log('💡 Run: POST /api/background/collect-monthly');
        console.log('💡 Run: POST /api/background/collect-weekly');
      } else {
        console.log('✅ Sufficient data found - background collection not needed');
      }
    } else {
      console.log('⚠️ No data found - background collection required');
      console.log('💡 Run: POST /api/background/collect-monthly');
      console.log('💡 Run: POST /api/background/collect-weekly');
    }

    // Final summary
    console.log('\n🎉 Campaign Summaries Storage Verification Complete!');
    console.log('─'.repeat(80));
    console.log('📋 Summary:');
    console.log(`   ✅ Table exists: Yes`);
    console.log(`   📊 Total records: ${totalCount || 0}`);
    console.log(`   📅 Data coverage: ${typeDistribution ? typeDistribution.length : 0} records`);
    
    if (typeDistribution && typeDistribution.length > 0) {
      const recentData = typeDistribution.filter(r => new Date(r.summary_date) >= twelveMonthsAgo);
      console.log(`   🎯 Last 12 months: ${recentData.length} records`);
      console.log(`   📈 Monthly data: ${recentData.filter(r => r.summary_type === 'monthly').length}/12`);
      console.log(`   📈 Weekly data: ${recentData.filter(r => r.summary_type === 'weekly').length}/52`);
    }
    
    console.log('\n💡 Next Steps:');
    if (totalCount === 0 || (typeDistribution && typeDistribution.length < 24)) {
      console.log('   1. Run background collection to populate data');
      console.log('   2. Monitor collection progress');
      console.log('   3. Verify data completeness after collection');
    } else {
      console.log('   1. Data appears to be properly stored');
      console.log('   2. Monitor data freshness');
      console.log('   3. Check performance improvements in reports');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

// Run the verification
verifyCampaignSummariesStorage(); 