// Script to run monthly data collection for all clients
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMonthlyCollection() {
  console.log('📅 Starting Monthly Data Collection for All Clients\n');

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
    });

    console.log('\n🚀 Starting monthly collection...');
    console.log('⚠️ This will take several minutes to complete...\n');

    // Call the monthly collection API
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/background/collect-monthly`;
    
    console.log(`🌐 Calling API: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Monthly collection started successfully!');
      console.log('📊 Response:', result);
      
      console.log('\n⏳ Collection is running in the background...');
      console.log('💡 You can monitor progress in the admin panel or check the database later.');
      console.log('💡 Run the verification script again to check data completeness.');
      
    } else {
      console.error('❌ Failed to start monthly collection');
      console.error('Status:', response.status);
      const errorText = await response.text();
      console.error('Error:', errorText);
      
      console.log('\n💡 Alternative: You can manually trigger collection via:');
      console.log('   1. Admin panel: /admin/monitoring');
      console.log('   2. API endpoint: POST /api/background/collect-monthly');
      console.log('   3. Or run the BackgroundDataCollector directly');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    console.log('\n💡 Alternative: You can manually trigger collection via:');
    console.log('   1. Admin panel: /admin/monitoring');
    console.log('   2. API endpoint: POST /api/background/collect-monthly');
    console.log('   3. Or run the BackgroundDataCollector directly');
  }
}

// Run the collection
runMonthlyCollection(); 