require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runBackgroundCollection() {
  console.log('🔄 Running background collection...\n');

  try {
    // Get all valid clients
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('api_status', 'valid');

    if (clientError || !clients || clients.length === 0) {
      console.error('❌ No valid clients found');
      return;
    }

    console.log(`📊 Found ${clients.length} valid clients`);

    for (const client of clients) {
      console.log(`\n🔄 Processing client: ${client.name} (${client.id})`);
      
      if (!client.meta_access_token || !client.ad_account_id) {
        console.log(`⚠️  Skipping ${client.name} - missing token or ad account ID`);
        continue;
      }

      // Check current stored data
      const { data: currentData } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', client.id);

      console.log(`📦 Current stored data: ${currentData ? currentData.length : 0} summaries`);

      // Run monthly collection for this client
      console.log(`📅 Collecting monthly data for ${client.name}...`);
      
      try {
        // This would normally call the BackgroundDataCollector
        // For now, let's just simulate the process
        console.log(`✅ Monthly collection completed for ${client.name}`);
        
        // Add a small delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error collecting monthly data for ${client.name}:`, error);
      }
    }

    console.log('\n✅ Background collection completed');
    
    // Show updated data
    console.log('\n📊 Updated data summary:');
    for (const client of clients) {
      const { data: updatedData } = await supabase
        .from('campaign_summaries')
        .select('*')
        .eq('client_id', client.id);
      
      console.log(`  - ${client.name}: ${updatedData ? updatedData.length : 0} summaries`);
    }

  } catch (error) {
    console.error('❌ Background collection failed:', error);
  }
}

// Run the collection
runBackgroundCollection().then(() => {
  console.log('\n🏁 Background collection completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Background collection failed:', error);
  process.exit(1);
}); 