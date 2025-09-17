// Script to directly run monthly data collection for all clients
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runDirectMonthlyCollection() {
  console.log('📅 Starting Direct Monthly Data Collection for All Clients\n');

  try {
    // Get all active clients
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .eq('api_status', 'valid');

    if (error) {
      console.error('❌ Error fetching clients:', error.message);
      return;
    }

    if (!clients || clients.length === 0) {
      console.log('⚠️ No active clients found');
      return;
    }

    console.log(`📊 Found ${clients.length} active clients:\n`);
    clients.forEach(client => {
      console.log(`   • ${client.name} (${client.email})`);
      console.log(`     Ad Account: ${client.ad_account_id}`);
      console.log(`     Token: ${client.meta_access_token ? 'Present' : 'Missing'}`);
      console.log('');
    });

    console.log('🚀 Starting monthly collection for each client...\n');

    // For each client, we'll manually trigger the collection process
    // This simulates what the background collection would do
    for (const client of clients) {
      console.log(`📊 Processing ${client.name}...`);
      
      try {
        // Check if client has required data
        if (!client.meta_access_token || !client.ad_account_id) {
          console.log(`   ⚠️ Skipping ${client.name} - missing token or ad account`);
          continue;
        }

        // Check current data in campaign_summaries
        const { data: existingData, error: existingError } = await supabase
          .from('campaign_summaries')
          .select('summary_date, summary_type')
          .eq('client_id', client.id)
          .eq('summary_type', 'monthly');

        if (existingError) {
          console.log(`   ❌ Error checking existing data: ${existingError.message}`);
          continue;
        }

        console.log(`   📊 Found ${existingData?.length || 0} existing monthly records`);

        // Check what months we need to collect
        const currentDate = new Date();
        const monthsToCollect = [];
        
        for (let i = 0; i < 12; i++) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const monthStart = new Date(year, month - 1, 1);
          const monthEnd = new Date(year, month, 0);
          
          monthsToCollect.push({
            year,
            month,
            startDate: monthStart.toISOString().split('T')[0],
            endDate: monthEnd.toISOString().split('T')[0]
          });
        }

        console.log(`   📅 Need to collect ${monthsToCollect.length} months of data`);

        // For now, we'll just log what needs to be done
        // The actual Meta API calls would require the MetaAPIService
        console.log(`   💡 ${client.name} needs monthly data collection for:`);
        monthsToCollect.slice(0, 5).forEach(month => {
          console.log(`      • ${month.year}-${month.month.toString().padStart(2, '0')} (${month.startDate} to ${month.endDate})`);
        });
        if (monthsToCollect.length > 5) {
          console.log(`      • ... and ${monthsToCollect.length - 5} more months`);
        }

        console.log(`   ✅ ${client.name} processed successfully\n`);

      } catch (clientError) {
        console.error(`   ❌ Error processing ${client.name}:`, clientError.message);
      }
    }

    console.log('🎉 Monthly collection analysis completed!');
    console.log('\n💡 To actually collect the data, you need to:');
    console.log('   1. Start your Next.js server: npm run dev');
    console.log('   2. Navigate to /admin/monitoring');
    console.log('   3. Click "Collect Monthly Data" button');
    console.log('   4. Or call the API endpoint directly');
    console.log('\n📊 Expected results after collection:');
    console.log('   • 3 clients × 12 months = 36 monthly records');
    console.log('   • Much faster report loading for recent data');
    console.log('   • Better user experience in the reports page');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the collection
runDirectMonthlyCollection(); 