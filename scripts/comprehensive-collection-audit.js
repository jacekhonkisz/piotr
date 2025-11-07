/**
 * COMPREHENSIVE AUDIT: Why Collection Isn't Working
 * 
 * This script will check EVERY potential failure point
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const issues = [];
const warnings = [];
const success = [];

async function audit() {
  console.log('═'.repeat(80));
  console.log('🔍 COMPREHENSIVE COLLECTION AUDIT');
  console.log('═'.repeat(80));
  console.log('');

  // ============================================================================
  // 1. CHECK DATABASE CONNECTION
  // ============================================================================
  console.log('1️⃣  CHECKING DATABASE CONNECTION...\n');
  try {
    const { data, error } = await supabase.from('clients').select('count', { count: 'exact', head: true });
    if (error) throw error;
    success.push('Database connection: OK');
    console.log('   ✅ Database connected\n');
  } catch (error) {
    issues.push(`Database connection failed: ${error.message}`);
    console.log(`   ❌ Database connection failed: ${error.message}\n`);
  }

  // ============================================================================
  // 2. CHECK CLIENTS WITH VALID STATUS
  // ============================================================================
  console.log('2️⃣  CHECKING CLIENT STATUS...\n');
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .eq('api_status', 'valid');
    
    if (error) throw error;
    
    console.log(`   Found ${clients.length} clients with api_status='valid'`);
    
    if (clients.length === 0) {
      issues.push('NO CLIENTS with api_status=valid found');
      console.log('   ❌ NO CLIENTS FOUND!\n');
    } else {
      success.push(`${clients.length} clients with api_status='valid'`);
      console.log('   ✅ Clients found\n');
      
      // Check each client's credentials
      console.log('   Checking client credentials:\n');
      clients.forEach((client, i) => {
        const hasMeta = client.meta_access_token ? '✅' : '❌';
        const hasGoogle = client.google_ads_customer_id ? '✅' : '❌';
        console.log(`   ${i+1}. ${client.name.padEnd(35)} Meta:${hasMeta} Google:${hasGoogle}`);
        
        if (!client.meta_access_token && !client.google_ads_customer_id) {
          warnings.push(`${client.name} has NO credentials (no Meta token, no Google ID)`);
        }
      });
      console.log('');
    }
  } catch (error) {
    issues.push(`Failed to fetch clients: ${error.message}`);
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // ============================================================================
  // 3. CHECK GOOGLE ADS SYSTEM SETTINGS
  // ============================================================================
  console.log('3️⃣  CHECKING GOOGLE ADS SYSTEM SETTINGS...\n');
  try {
    const { data: settings, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', [
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ]);
    
    if (error) throw error;
    
    const requiredSettings = {
      'google_ads_client_id': false,
      'google_ads_client_secret': false,
      'google_ads_developer_token': false,
      'google_ads_manager_refresh_token': false
    };
    
    settings.forEach(s => {
      if (requiredSettings.hasOwnProperty(s.key)) {
        requiredSettings[s.key] = !!(s.value && s.value.length > 0);
      }
    });
    
    Object.entries(requiredSettings).forEach(([key, hasValue]) => {
      const status = hasValue ? '✅' : '❌';
      console.log(`   ${status} ${key}`);
      if (!hasValue) {
        issues.push(`Missing Google Ads setting: ${key}`);
      } else {
        success.push(`Google Ads setting present: ${key}`);
      }
    });
    console.log('');
  } catch (error) {
    issues.push(`Failed to check Google Ads settings: ${error.message}`);
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // ============================================================================
  // 4. CHECK ENVIRONMENT VARIABLES
  // ============================================================================
  console.log('4️⃣  CHECKING ENVIRONMENT VARIABLES...\n');
  const envVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  envVars.forEach(varName => {
    const exists = !!process.env[varName];
    const status = exists ? '✅' : '❌';
    console.log(`   ${status} ${varName}`);
    if (!exists) {
      issues.push(`Missing environment variable: ${varName}`);
    } else {
      success.push(`Environment variable present: ${varName}`);
    }
  });
  console.log('');

  // ============================================================================
  // 5. TEST API ENDPOINT ACCESSIBILITY
  // ============================================================================
  console.log('5️⃣  TESTING API ENDPOINT ACCESSIBILITY...\n');
  try {
    const response = await fetch('http://localhost:3000/api/automated/collect-weekly-summaries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(2000)
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`   ✅ Endpoint accessible`);
      console.log(`   Response: ${JSON.stringify(data)}`);
      
      if (data.responseTime === 0) {
        warnings.push('API returns immediately (responseTime: 0) - suggests no actual work being done');
        console.log(`   ⚠️  responseTime is 0 (returns immediately)\n`);
      } else {
        success.push('API endpoint working and processing');
        console.log('');
      }
    } else {
      issues.push(`API endpoint returned status: ${response.status}`);
      console.log(`   ❌ Status: ${response.status}\n`);
    }
  } catch (error) {
    issues.push(`Cannot reach API endpoint: ${error.message}`);
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // ============================================================================
  // 6. CHECK IF RECORDS ARE BEING CREATED
  // ============================================================================
  console.log('6️⃣  CHECKING RECENT RECORD CREATION...\n');
  try {
    const { data: records } = await supabase
      .from('campaign_summaries')
      .select('platform, summary_type, last_updated')
      .order('last_updated', { ascending: false })
      .limit(10);
    
    const mostRecent = new Date(records[0].last_updated);
    const minutesAgo = Math.floor((Date.now() - mostRecent.getTime()) / 60000);
    
    console.log(`   Most recent record: ${minutesAgo} minutes ago`);
    console.log(`   Latest records:`);
    records.slice(0, 5).forEach(r => {
      const time = new Date(r.last_updated);
      console.log(`     - ${r.platform}:${r.summary_type} at ${time.toLocaleString()}`);
    });
    
    if (minutesAgo > 60) {
      warnings.push(`No records created in last ${minutesAgo} minutes`);
      console.log(`   ⚠️  No recent activity\n`);
    } else {
      success.push('Recent records being created');
      console.log(`   ✅ Recent activity detected\n`);
    }
  } catch (error) {
    issues.push(`Failed to check recent records: ${error.message}`);
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // ============================================================================
  // 7. CHECK UNIQUE CONSTRAINT
  // ============================================================================
  console.log('7️⃣  CHECKING DATABASE CONSTRAINTS...\n');
  try {
    // Try to insert a duplicate to test constraint
    const testRecord = {
      client_id: 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
      summary_type: 'monthly',
      summary_date: '2099-01-01',
      platform: 'meta',
      total_spend: 0,
      total_impressions: 0,
      total_clicks: 0,
      total_conversions: 0,
      data_source: 'test'
    };
    
    // Insert test record
    const { error: insertError } = await supabase
      .from('campaign_summaries')
      .insert(testRecord);
    
    if (insertError && insertError.code === '23505') {
      success.push('Unique constraint includes platform field');
      console.log('   ✅ Unique constraint working (includes platform)\n');
    } else if (!insertError) {
      // Clean up test record
      await supabase
        .from('campaign_summaries')
        .delete()
        .eq('summary_date', '2099-01-01');
      success.push('Can insert records successfully');
      console.log('   ✅ Can insert records\n');
    } else {
      warnings.push(`Unexpected insert error: ${insertError.message}`);
      console.log(`   ⚠️  Insert error: ${insertError.message}\n`);
    }
  } catch (error) {
    warnings.push(`Constraint check failed: ${error.message}`);
    console.log(`   ⚠️  ${error.message}\n`);
  }

  // ============================================================================
  // 8. CHECK SERVER LOGS (if accessible)
  // ============================================================================
  console.log('8️⃣  CHECKING SERVER STATUS...\n');
  try {
    const response = await fetch('http://localhost:3000', {
      signal: AbortSignal.timeout(2000)
    });
    
    if (response.ok) {
      success.push('Next.js dev server is running');
      console.log('   ✅ Server is running\n');
    } else {
      warnings.push('Server responding but may have issues');
      console.log('   ⚠️  Server response not OK\n');
    }
  } catch (error) {
    issues.push(`Server not accessible: ${error.message}`);
    console.log(`   ❌ Server not accessible\n`);
  }

  // ============================================================================
  // 9. CHECK FOR RACE CONDITIONS / LOCKS
  // ============================================================================
  console.log('9️⃣  CHECKING FOR POTENTIAL LOCKS...\n');
  
  // Simulate what the collection does
  console.log('   Testing collection initialization...');
  try {
    // This tests if the BackgroundDataCollector can be imported
    const testImport = `
      (async () => {
        try {
          const module = await import('../src/lib/background-data-collector.js');
          return 'OK';
        } catch (e) {
          return e.message;
        }
      })()
    `;
    console.log('   ⚠️  Cannot directly test (ESM import limitation)\n');
    warnings.push('Cannot directly test BackgroundDataCollector import from this script');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('═'.repeat(80));
  console.log('📊 AUDIT SUMMARY');
  console.log('═'.repeat(80));
  console.log('');
  
  console.log(`✅ SUCCESSES (${success.length}):`);
  if (success.length > 0) {
    success.forEach(s => console.log(`   • ${s}`));
  } else {
    console.log('   None');
  }
  console.log('');
  
  console.log(`⚠️  WARNINGS (${warnings.length}):`);
  if (warnings.length > 0) {
    warnings.forEach(w => console.log(`   • ${w}`));
  } else {
    console.log('   None');
  }
  console.log('');
  
  console.log(`❌ CRITICAL ISSUES (${issues.length}):`);
  if (issues.length > 0) {
    issues.forEach(i => console.log(`   • ${i}`));
  } else {
    console.log('   None');
  }
  console.log('');
  
  // ============================================================================
  // DIAGNOSIS
  // ============================================================================
  console.log('═'.repeat(80));
  console.log('🔬 DIAGNOSIS');
  console.log('═'.repeat(80));
  console.log('');
  
  if (issues.length > 0) {
    console.log('❌ CRITICAL ISSUES FOUND that prevent collection:');
    issues.forEach(i => console.log(`   • ${i}`));
  } else if (warnings.length > 2) {
    console.log('⚠️  Multiple warnings suggest potential issues:');
    console.log('   • API returns immediately (no actual processing)');
    console.log('   • This indicates the collection loop never runs');
    console.log('');
    console.log('🔍 LIKELY CAUSE:');
    console.log('   • The BackgroundDataCollector.collectWeeklySummaries() method');
    console.log('   • Returns immediately without processing any clients');
    console.log('   • Possible reasons:');
    console.log('     1. Silent error being caught and ignored');
    console.log('     2. Early return condition (isRunning flag, no clients, etc)');
    console.log('     3. getAllActiveClients() returning empty array');
    console.log('     4. Loop condition not executing');
  } else {
    console.log('✅ No critical issues found');
    console.log('');
    console.log('System appears healthy but collection still not running.');
    console.log('This suggests an issue with the collection logic itself.');
  }
  
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
}

audit().catch(console.error);

