require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCurrentSession() {
  try {
    console.log('🔍 Debugging current session and clients...\n');
    
    // Get all clients to see their current status
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    
    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }
    
    console.log('📋 All clients in database:');
    clients.forEach((client, index) => {
      console.log(`\n${index + 1}. ${client.name} (${client.email})`);
      console.log(`   - ID: ${client.id}`);
      console.log(`   - Ad Account ID: ${client.ad_account_id}`);
      console.log(`   - Has Token: ${!!client.meta_access_token}`);
      console.log(`   - Token Length: ${client.meta_access_token?.length || 0}`);
      console.log(`   - Last Report Date: ${client.last_report_date || 'Never'}`);
      console.log(`   - Created: ${client.created_at}`);
      console.log(`   - Updated: ${client.updated_at}`);
    });
    
    // Test each client's token permissions
    console.log('\n🔍 Testing each client\'s token permissions...');
    
    for (const client of clients) {
      if (!client.meta_access_token) {
        console.log(`\n❌ ${client.name}: No token available`);
        continue;
      }
      
      console.log(`\n🔍 Testing ${client.name} (${client.email})...`);
      
      try {
        // Test basic token validity
        const tokenInfoResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${client.meta_access_token}`);
        const tokenInfo = await tokenInfoResponse.json();
        
        if (tokenInfo.error) {
          console.log(`   ❌ Token invalid: ${tokenInfo.error.message}`);
          continue;
        }
        
        console.log(`   ✅ Token valid for: ${tokenInfo.name}`);
        
        // Test ad accounts access
        const adAccountsResponse = await fetch(`https://graph.facebook.com/v18.0/me/adaccounts?access_token=${client.meta_access_token}&fields=id,name,account_id,account_status`);
        const adAccounts = await adAccountsResponse.json();
        
        if (adAccounts.error) {
          console.log(`   ❌ Ad accounts error: ${adAccounts.error.message}`);
          continue;
        }
        
        console.log(`   ✅ Ad accounts accessible: ${adAccounts.data?.length || 0} accounts`);
        
        // Test specific ad account access
        if (client.ad_account_id) {
          const adAccountId = client.ad_account_id.startsWith('act_') ? client.ad_account_id : `act_${client.ad_account_id}`;
          const accountResponse = await fetch(`https://graph.facebook.com/v18.0/${adAccountId}?access_token=${client.meta_access_token}&fields=id,name,account_id,account_status`);
          const account = await accountResponse.json();
          
          if (account.error) {
            console.log(`   ❌ Specific account error: ${account.error.message}`);
            console.log(`   💡 Account ID: ${client.ad_account_id} is not accessible`);
          } else {
            console.log(`   ✅ Specific account accessible: ${account.name}`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ Error testing ${client.name}: ${error.message}`);
      }
    }
    
    // Check recent reports to see which ones failed
    console.log('\n📊 Recent reports in database:');
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(10);
    
    if (reportsError) {
      console.error('❌ Error fetching reports:', reportsError);
    } else {
      reports.forEach((report, index) => {
        console.log(`\n${index + 1}. Report ID: ${report.id}`);
        console.log(`   - Client ID: ${report.client_id}`);
        console.log(`   - Date Range: ${report.date_range_start} to ${report.date_range_end}`);
        console.log(`   - Generated: ${report.generated_at}`);
        console.log(`   - Generation Time: ${report.generation_time_ms}ms`);
        console.log(`   - Email Sent: ${report.email_sent}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Error debugging session:', error);
  }
}

// Run the debug
debugCurrentSession(); 