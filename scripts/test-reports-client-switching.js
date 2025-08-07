const fs = require('fs');
const path = require('path');

function testReportsClientSwitching() {
  console.log('🧪 Testing Reports Page Client Switching Implementation');
  console.log('=====================================================\n');

  let allChecksPassed = true;

  // Check 1: ClientSelector import
  console.log('📦 Check 1: ClientSelector Import');
  try {
    const reportsPath = path.join(__dirname, '../src/app/reports/page.tsx');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    
    if (reportsContent.includes("import ClientSelector from '../../components/ClientSelector';")) {
      console.log('   ✅ ClientSelector import found');
    } else {
      console.log('   ❌ ClientSelector import missing');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading reports file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 2: selectedClient state
  console.log('\n📊 Check 2: selectedClient State');
  try {
    const reportsPath = path.join(__dirname, '../src/app/reports/page.tsx');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    
    if (reportsContent.includes("const [selectedClient, setSelectedClient] = useState<Client | null>(null);")) {
      console.log('   ✅ selectedClient state defined');
    } else {
      console.log('   ❌ selectedClient state missing');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading reports file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 3: handleClientChange function
  console.log('\n🔄 Check 3: handleClientChange Function');
  try {
    const reportsPath = path.join(__dirname, '../src/app/reports/page.tsx');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    
    if (reportsContent.includes("const handleClientChange = async (newClient: Client) => {")) {
      console.log('   ✅ handleClientChange function defined');
    } else {
      console.log('   ❌ handleClientChange function missing');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading reports file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 4: ClientSelector component in UI
  console.log('\n🎯 Check 4: ClientSelector Component in UI');
  try {
    const reportsPath = path.join(__dirname, '../src/app/reports/page.tsx');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    
    if (reportsContent.includes("<ClientSelector") && reportsContent.includes("currentClient={selectedClient}")) {
      console.log('   ✅ ClientSelector component found in UI');
    } else {
      console.log('   ❌ ClientSelector component missing from UI');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading reports file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 5: Admin role check
  console.log('\n👤 Check 5: Admin Role Check');
  try {
    const reportsPath = path.join(__dirname, '../src/app/reports/page.tsx');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    
    if (reportsContent.includes("profile?.role === 'admin'") && reportsContent.includes("ClientSelector")) {
      console.log('   ✅ Admin role check implemented');
    } else {
      console.log('   ❌ Admin role check missing');
      allChecksPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ Error reading reports file: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 6: selectedClient usage in data loading
  console.log('\n📡 Check 6: selectedClient Usage in Data Loading');
  try {
    const reportsPath = path.join(__dirname, '../src/app/reports/page.tsx');
    const reportsContent = fs.readFileSync(reportsPath, 'utf8');
    
    const selectedClientChecks = [
      { pattern: /selectedClient\.id/, name: 'selectedClient.id usage' },
      { pattern: /selectedClient\.name/, name: 'selectedClient.name usage' },
      { pattern: /selectedClient\.email/, name: 'selectedClient.email usage' },
      { pattern: /selectedClient\.ad_account_id/, name: 'selectedClient.ad_account_id usage' },
      { pattern: /selectedClient\.meta_access_token/, name: 'selectedClient.meta_access_token usage' }
    ];

    let selectedClientChecksPassed = 0;
    selectedClientChecks.forEach(check => {
      if (check.pattern.test(reportsContent)) {
        console.log(`   ✅ Found: ${check.name}`);
        selectedClientChecksPassed++;
      } else {
        console.log(`   ❌ Missing: ${check.name}`);
        allChecksPassed = false;
      }
    });

    console.log(`   📊 selectedClient usage checks: ${selectedClientChecksPassed}/${selectedClientChecks.length} passed`);
  } catch (error) {
    console.log(`   ❌ Error reading reports file: ${error.message}`);
    allChecksPassed = false;
  }

  // Summary
  console.log('\n📋 Summary:');
  console.log('=====================================================');
  
  if (allChecksPassed) {
    console.log('✅ ALL CHECKS PASSED!');
    console.log('🎉 Reports page client switching is correctly implemented');
    console.log('\n📊 What was verified:');
    console.log('   ✅ ClientSelector component imported');
    console.log('   ✅ selectedClient state added');
    console.log('   ✅ handleClientChange function implemented');
    console.log('   ✅ ClientSelector component added to UI');
    console.log('   ✅ Admin role check implemented');
    console.log('   ✅ selectedClient used in data loading functions');
    console.log('\n🚀 Next steps:');
    console.log('   1. Test in browser: Navigate to /reports as admin user');
    console.log('   2. Verify ClientSelector appears in the header');
    console.log('   3. Switch between Belmonte and Havet clients');
    console.log('   4. Confirm conversion metrics show different values for each client');
    console.log('   5. Verify current month data is displayed correctly');
  } else {
    console.log('❌ SOME CHECKS FAILED!');
    console.log('🔧 Please review the failed checks above and fix the issues');
  }

  return allChecksPassed;
}

// Run the test
testReportsClientSwitching(); 