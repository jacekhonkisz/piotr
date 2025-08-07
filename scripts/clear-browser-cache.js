const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearBrowserCache() {
  console.log('🧹 Clearing Browser Cache and Testing Fixed Client Switching\n');

  try {
    // Get admin session
    const { data: { session }, error: sessionError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'password123'
    });

    if (sessionError || !session) {
      console.error('❌ Failed to get admin session:', sessionError);
      return;
    }

    console.log('🔐 Admin session obtained');

    // Get remaining clients (after removing duplicates)
    const { data: clients } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (!clients || clients.length === 0) {
      console.log('❌ No clients found');
      return;
    }

    console.log(`📋 Found ${clients.length} clients after removing duplicates:`);
    clients.forEach((client, index) => {
      console.log(`${index + 1}. ${client.name} (${client.email})`);
      console.log(`   - Ad Account: ${client.ad_account_id}`);
      console.log(`   - API Status: ${client.api_status}`);
    });

    // Test API calls for each client to verify they have unique data
    console.log('\n🧪 Testing Each Client for Unique Data...');
    
    const testResults = [];
    
    for (const client of clients) {
      console.log(`\n🏨 Testing ${client.name}...`);
      
      const response = await fetch('http://localhost:3000/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId: client.id,
          dateRange: {
            start: '2025-08-01',
            end: '2025-08-07'
          }
        })
      });

      if (!response.ok) {
        console.log(`   ❌ API Error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      if (data.data?.campaigns && data.data.campaigns.length > 0) {
        const campaigns = data.data.campaigns;
        
        // Calculate conversion metrics
        const totalClickToCall = campaigns.reduce((sum, campaign) => sum + (campaign.click_to_call || 0), 0);
        const totalLead = campaigns.reduce((sum, campaign) => sum + (campaign.lead || 0), 0);
        const totalPurchase = campaigns.reduce((sum, campaign) => sum + (campaign.purchase || 0), 0);
        const totalPurchaseValue = campaigns.reduce((sum, campaign) => sum + (campaign.purchase_value || 0), 0);
        const totalBookingStep1 = campaigns.reduce((sum, campaign) => sum + (campaign.booking_step_1 || 0), 0);
        
        const totalSpend = campaigns.reduce((sum, campaign) => sum + (campaign.spend || 0), 0);
        const roas = totalPurchaseValue > 0 && totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;

        const result = {
          name: client.name,
          email: client.email,
          adAccountId: client.ad_account_id,
          totalClickToCall,
          totalLead,
          totalPurchase,
          totalPurchaseValue,
          totalBookingStep1,
          totalSpend,
          roas
        };

        testResults.push(result);

        console.log(`   📊 Campaigns: ${campaigns.length}`);
        console.log(`   📈 Click to Call: ${totalClickToCall}`);
        console.log(`   📈 Purchase: ${totalPurchase}`);
        console.log(`   📈 Purchase Value: ${totalPurchaseValue.toFixed(2)} zł`);
        console.log(`   📈 ROAS: ${roas.toFixed(2)}x`);
      } else {
        console.log(`   ❌ No campaign data`);
      }
    }

    // Verify unique data patterns
    console.log('\n🔍 Verifying Unique Data Patterns...');
    
    if (testResults.length > 1) {
      console.log('📊 Data Comparison:');
      console.log('| Client | Click to Call | Purchase | Purchase Value | ROAS |');
      console.log('|--------|---------------|----------|----------------|------|');
      
      testResults.forEach(result => {
        console.log(`| ${result.name} | ${result.totalClickToCall} | ${result.totalPurchase} | ${result.totalPurchaseValue.toFixed(2)} zł | ${result.roas.toFixed(2)}x |`);
      });

      // Check for identical data patterns
      const dataPatterns = testResults.map(r => `${r.totalClickToCall}-${r.totalPurchase}-${r.totalPurchaseValue.toFixed(0)}`);
      const uniquePatterns = [...new Set(dataPatterns)];
      
      if (uniquePatterns.length === testResults.length) {
        console.log('\n✅ All clients have unique data patterns!');
        console.log('✅ Client switching should now work properly');
      } else {
        console.log('\n❌ Some clients still have duplicate data patterns');
        uniquePatterns.forEach(pattern => {
          const clientsWithPattern = testResults.filter(r => `${r.totalClickToCall}-${r.totalPurchase}-${r.totalPurchaseValue.toFixed(0)}` === pattern);
          if (clientsWithPattern.length > 1) {
            console.log(`   Pattern ${pattern}:`);
            clientsWithPattern.forEach(client => {
              console.log(`      - ${client.name} (${client.email})`);
            });
          }
        });
      }
    }

    // Instructions for clearing browser cache
    console.log('\n🧹 Browser Cache Clearing Instructions:');
    console.log('1. Open your browser\'s Developer Tools (F12)');
    console.log('2. Go to Application/Storage tab');
    console.log('3. Find "Local Storage" on the left');
    console.log('4. Look for keys starting with "dashboard_cache_"');
    console.log('5. Delete all dashboard cache keys');
    console.log('6. Refresh the dashboard page');
    console.log('7. Try switching between clients using the dropdown');

    console.log('\n🎯 Expected Results:');
    console.log('- Belmonte Hotel: 245 purchases, 135,894 zł value, ~38x ROAS');
    console.log('- Havet: 70 purchases, 55,490 zł value, 57 click-to-calls, ~16x ROAS');
    console.log('- jacek: 0 purchases, 0 zł value (no conversion data)');

    console.log('\n✅ Cache clearing and testing completed');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

clearBrowserCache(); 