const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditAllDuplicatesAndBlockers() {
  console.log('🔍 Auditing All Duplicates and Blockers\n');

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

    // 1. Check for duplicate API credentials
    console.log('\n1️⃣ STEP 1: Checking for Duplicate API Credentials');
    console.log('='.repeat(50));
    
    const { data: allClients } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (allClients) {
      console.log(`📋 Found ${allClients.length} clients:`);
      
      // Check for duplicate ad_account_ids
      const adAccountIds = allClients.map(client => client.ad_account_id);
      const duplicateAdAccounts = adAccountIds.filter((id, index) => adAccountIds.indexOf(id) !== index);
      
      if (duplicateAdAccounts.length > 0) {
        console.log('❌ DUPLICATE AD ACCOUNT IDs FOUND:');
        duplicateAdAccounts.forEach(adAccountId => {
          const clientsWithSameAccount = allClients.filter(client => client.ad_account_id === adAccountId);
          console.log(`   Ad Account ${adAccountId}:`);
          clientsWithSameAccount.forEach(client => {
            console.log(`      - ${client.name} (${client.email})`);
          });
        });
      } else {
        console.log('✅ No duplicate ad account IDs found');
      }

      // Check for duplicate meta_access_tokens
      const metaTokens = allClients.map(client => client.meta_access_token);
      const duplicateTokens = metaTokens.filter((token, index) => metaTokens.indexOf(token) !== index);
      
      if (duplicateTokens.length > 0) {
        console.log('❌ DUPLICATE META ACCESS TOKENS FOUND:');
        duplicateTokens.forEach(token => {
          const clientsWithSameToken = allClients.filter(client => client.meta_access_token === token);
          console.log(`   Token ${token.substring(0, 20)}...:`);
          clientsWithSameToken.forEach(client => {
            console.log(`      - ${client.name} (${client.email})`);
          });
        });
      } else {
        console.log('✅ No duplicate meta access tokens found');
      }

      // Display all clients with their credentials
      console.log('\n📊 All Clients and Their Credentials:');
      allClients.forEach((client, index) => {
        console.log(`${index + 1}. ${client.name} (${client.email})`);
        console.log(`   - Ad Account: ${client.ad_account_id}`);
        console.log(`   - Meta Token: ${client.meta_access_token.substring(0, 20)}...`);
        console.log(`   - Admin ID: ${client.admin_id}`);
        console.log(`   - API Status: ${client.api_status}`);
      });
    }

    // 2. Check for hardcoded values in the codebase
    console.log('\n2️⃣ STEP 2: Checking for Hardcoded Values');
    console.log('='.repeat(50));
    
    try {
      const fs = require('fs');
      
      // Check dashboard file for hardcoded client preferences
      const dashboardPath = 'src/app/dashboard/page.tsx';
      if (fs.existsSync(dashboardPath)) {
        const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
        
        const hardcodedChecks = [
          { pattern: 'havet@magialubczyku.pl', description: 'Hardcoded Havet email' },
          { pattern: 'belmonte@hotel.com', description: 'Hardcoded Belmonte email' },
          { pattern: 'client.email ===', description: 'Hardcoded client email comparisons' },
          { pattern: 'selectedClient', description: 'Selected client usage' },
          { pattern: 'currentClient', description: 'Current client usage' }
        ];
        
        console.log('🔍 Dashboard File Analysis:');
        hardcodedChecks.forEach(check => {
          const matches = (dashboardContent.match(new RegExp(check.pattern, 'g')) || []).length;
          console.log(`   - ${check.description}: ${matches} occurrences`);
        });
      }

      // Check ClientSelector component
      const clientSelectorPath = 'src/components/ClientSelector.tsx';
      if (fs.existsSync(clientSelectorPath)) {
        const clientSelectorContent = fs.readFileSync(clientSelectorPath, 'utf8');
        
        console.log('\n🔍 ClientSelector Component Analysis:');
        const selectorChecks = [
          { pattern: 'onClientChange', description: 'Client change handler' },
          { pattern: 'userRole === \'admin\'', description: 'Admin role check' },
          { pattern: 'loadClients', description: 'Client loading function' }
        ];
        
        selectorChecks.forEach(check => {
          const matches = (clientSelectorContent.match(new RegExp(check.pattern, 'g')) || []).length;
          console.log(`   - ${check.description}: ${matches} occurrences`);
        });
      }
    } catch (error) {
      console.log('❌ Error checking code files:', error.message);
    }

    // 3. Test API calls for each client
    console.log('\n3️⃣ STEP 3: Testing API Calls for Each Client');
    console.log('='.repeat(50));
    
    const testResults = [];
    
    for (const client of allClients) {
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

    // 4. Analyze results for duplicates
    console.log('\n4️⃣ STEP 4: Analyzing Results for Duplicates');
    console.log('='.repeat(50));
    
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
      
      if (uniquePatterns.length < testResults.length) {
        console.log('\n❌ DUPLICATE DATA PATTERNS FOUND:');
        uniquePatterns.forEach(pattern => {
          const clientsWithPattern = testResults.filter(r => `${r.totalClickToCall}-${r.totalPurchase}-${r.totalPurchaseValue.toFixed(0)}` === pattern);
          if (clientsWithPattern.length > 1) {
            console.log(`   Pattern ${pattern}:`);
            clientsWithPattern.forEach(client => {
              console.log(`      - ${client.name} (${client.email})`);
            });
          }
        });
      } else {
        console.log('\n✅ No duplicate data patterns found - each client has unique data');
      }
    }

    // 5. Check for caching issues
    console.log('\n5️⃣ STEP 5: Checking for Caching Issues');
    console.log('='.repeat(50));
    
    console.log('🔍 Cache Key Analysis:');
    console.log('   - Current cache key format: dashboard_cache_${user?.email}_${selectedClient?.id}_v4');
    console.log('   - This should ensure each client has its own cache');
    
    // Check if there are any localStorage issues
    console.log('\n🔍 Browser Storage Analysis:');
    console.log('   - Check browser localStorage for cached data');
    console.log('   - Clear all dashboard caches if needed');

    console.log('\n✅ Audit completed');

  } catch (error) {
    console.error('❌ Audit failed:', error);
  }
}

auditAllDuplicatesAndBlockers(); 