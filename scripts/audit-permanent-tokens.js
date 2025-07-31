const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function auditPermanentTokens() {
  console.log('🔍 Permanent Token Audit Report\n');
  console.log('This audit will check the permanence status of all client tokens.\n');

  // Check environment variables
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    console.log('❌ Missing Meta App credentials in .env.local file');
    console.log('💡 Please add these environment variables:');
    console.log('   META_APP_ID=your_meta_app_id');
    console.log('   META_APP_SECRET=your_meta_app_secret');
    return;
  }

  console.log('✅ Meta App credentials found');
  console.log(`   App ID: ${appId.substring(0, 10)}...`);
  console.log(`   App Secret: ${appSecret.substring(0, 10)}...\n`);

  // Get all clients
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*');

  if (clientsError) {
    console.error('❌ Error fetching clients:', clientsError);
    return;
  }

  if (!clients || clients.length === 0) {
    console.log('ℹ️ No clients found in database.');
    return;
  }

  console.log(`📋 Found ${clients.length} client(s) to audit:\n`);

  let permanentTokens = 0;
  let longLivedTokens = 0;
  let shortLivedTokens = 0;
  let invalidTokens = 0;
  let missingTokens = 0;
  let needsSystemUser = 0;

  const clientAuditResults = [];

  for (const client of clients) {
    console.log(`🔍 Auditing: ${client.name} (${client.email})`);
    console.log(`   Ad Account ID: ${client.ad_account_id}`);
    
    const auditResult = {
      client: client,
      tokenStatus: 'unknown',
      permanence: 'unknown',
      recommendations: [],
      issues: []
    };

    if (!client.meta_access_token) {
      console.log(`   ❌ Token Status: Missing`);
      auditResult.tokenStatus = 'missing';
      auditResult.permanence = 'none';
      auditResult.recommendations.push('Generate a System User token for permanent access');
      missingTokens++;
    } else {
      // Test current token
      try {
        const testResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${client.meta_access_token}`);
        const testData = await testResponse.json();
        
        if (testData.error) {
          console.log(`   ❌ Token Status: ${testData.error.message}`);
          auditResult.tokenStatus = 'invalid';
          auditResult.permanence = 'none';
          auditResult.issues.push(testData.error.message);
          auditResult.recommendations.push('Generate a new System User token');
          invalidTokens++;
        } else {
          // Token is valid, now check if it's permanent
          const debugResponse = await fetch(`https://graph.facebook.com/v18.0/debug_token?input_token=${client.meta_access_token}&access_token=${client.meta_access_token}`);
          const debugData = await debugResponse.json();
          
          if (debugData.error) {
            console.log(`   ⚠️ Token Status: Valid but cannot debug (may be System User token)`);
            auditResult.tokenStatus = 'valid';
            auditResult.permanence = 'likely_permanent';
            auditResult.recommendations.push('Token appears to be permanent (System User token)');
            permanentTokens++;
          } else {
            const tokenInfo = debugData.data;
            const expiresAt = tokenInfo.expires_at;
            
            if (expiresAt === 0) {
              console.log(`   ✅ Token Status: Valid and PERMANENT (System User token)`);
              auditResult.tokenStatus = 'valid';
              auditResult.permanence = 'permanent';
              auditResult.recommendations.push('Token is permanent - no action needed');
              permanentTokens++;
            } else if (expiresAt > 0) {
              const daysUntilExpiry = Math.ceil((expiresAt * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
              
              if (daysUntilExpiry > 30) {
                console.log(`   ⚠️ Token Status: Valid, expires in ${daysUntilExpiry} days (Long-lived token)`);
                auditResult.tokenStatus = 'valid';
                auditResult.permanence = 'long_lived';
                auditResult.issues.push(`Token expires in ${daysUntilExpiry} days`);
                auditResult.recommendations.push('Convert to System User token for permanent access');
                longLivedTokens++;
              } else if (daysUntilExpiry > 0) {
                console.log(`   ⚠️ Token Status: Valid, expires in ${daysUntilExpiry} days (Short-lived token)`);
                auditResult.tokenStatus = 'valid';
                auditResult.permanence = 'short_lived';
                auditResult.issues.push(`Token expires in ${daysUntilExpiry} days`);
                auditResult.recommendations.push('URGENT: Convert to System User token immediately');
                shortLivedTokens++;
              } else {
                console.log(`   ❌ Token Status: Expired`);
                auditResult.tokenStatus = 'expired';
                auditResult.permanence = 'none';
                auditResult.issues.push('Token has expired');
                auditResult.recommendations.push('Generate new System User token');
                invalidTokens++;
              }
            } else {
              console.log(`   ✅ Token Status: Valid and PERMANENT`);
              auditResult.tokenStatus = 'valid';
              auditResult.permanence = 'permanent';
              auditResult.recommendations.push('Token is permanent - no action needed');
              permanentTokens++;
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ Token Status: Error testing token`);
        auditResult.tokenStatus = 'error';
        auditResult.permanence = 'unknown';
        auditResult.issues.push('Error testing token');
        auditResult.recommendations.push('Check token validity and regenerate if needed');
        invalidTokens++;
      }
    }
    
    // Check if client needs System User setup
    if (auditResult.permanence !== 'permanent' && auditResult.tokenStatus !== 'missing') {
      needsSystemUser++;
    }
    
    clientAuditResults.push(auditResult);
    console.log('');
  }

  // Print summary
  console.log('📊 PERMANENT TOKEN AUDIT SUMMARY:\n');
  console.log(`   ✅ Permanent Tokens (System Users): ${permanentTokens}`);
  console.log(`   ⚠️ Long-lived Tokens (60 days): ${longLivedTokens}`);
  console.log(`   ⚠️ Short-lived Tokens (<30 days): ${shortLivedTokens}`);
  console.log(`   ❌ Invalid/Expired Tokens: ${invalidTokens}`);
  console.log(`   ❌ Missing Tokens: ${missingTokens}`);
  console.log(`   📈 Total Clients: ${clients.length}`);
  console.log(`   🔧 Need System User Setup: ${needsSystemUser}\n`);

  // Print recommendations
  console.log('🎯 RECOMMENDATIONS:\n');
  
  if (permanentTokens === clients.length) {
    console.log('✅ EXCELLENT! All clients have permanent tokens.');
    console.log('   No action needed - your setup is production-ready!');
  } else {
    console.log('⚠️ ACTION REQUIRED: Some clients need permanent token setup.\n');
    
    if (needsSystemUser > 0) {
      console.log(`1️⃣ Set up System Users for ${needsSystemUser} client(s):`);
      console.log('   - System User tokens NEVER expire');
      console.log('   - Most reliable for production applications');
      console.log('   - Requires Business Manager access from each client');
      console.log('');
    }
    
    if (invalidTokens > 0 || missingTokens > 0) {
      console.log(`2️⃣ Fix ${invalidTokens + missingTokens} invalid/missing token(s):`);
      console.log('   - Generate new System User tokens');
      console.log('   - Update client records with new tokens');
      console.log('');
    }
    
    if (longLivedTokens > 0) {
      console.log(`3️⃣ Convert ${longLivedTokens} long-lived token(s) to permanent:`);
      console.log('   - Long-lived tokens expire in 60 days');
      console.log('   - Convert to System User tokens for permanence');
      console.log('');
    }
  }

  // Print detailed client recommendations
  console.log('📋 DETAILED CLIENT RECOMMENDATIONS:\n');
  
  clientAuditResults.forEach((result, index) => {
    if (result.permanence !== 'permanent' && result.tokenStatus !== 'valid') {
      console.log(`${index + 1}. ${result.client.name} (${result.client.email}):`);
      console.log(`   Status: ${result.tokenStatus}`);
      console.log(`   Permanence: ${result.permanence}`);
      
      if (result.issues.length > 0) {
        console.log(`   Issues: ${result.issues.join(', ')}`);
      }
      
      console.log(`   Recommendations:`);
      result.recommendations.forEach(rec => {
        console.log(`     - ${rec}`);
      });
      console.log('');
    }
  });

  // Print setup instructions
  if (needsSystemUser > 0) {
    console.log('🛠️ SYSTEM USER SETUP INSTRUCTIONS:\n');
    console.log('For each client that needs a System User:');
    console.log('');
    console.log('1️⃣ Get Business Manager Access:');
    console.log('   - Ask client to add you as admin to their Business Manager');
    console.log('   - You need admin permissions to create System Users');
    console.log('');
    console.log('2️⃣ Create System User:');
    console.log('   - Go to Business Manager → Settings → Business Settings');
    console.log('   - Users → System Users → Add → System User');
    console.log('   - Name: "API Access User - [Client Name]"');
    console.log('   - Role: Admin');
    console.log('');
    console.log('3️⃣ Assign Ad Account:');
    console.log('   - Select the System User');
    console.log('   - Assigned Assets → Ad Accounts → Assign');
    console.log('   - Select their ad account(s) with Admin role');
    console.log('');
    console.log('4️⃣ Generate Permanent Token:');
    console.log('   - In System User settings → Access Tokens');
    console.log('   - Generate New Token with permissions:');
    console.log('     * ads_read');
    console.log('     * ads_management');
    console.log('     * business_management');
    console.log('     * read_insights');
    console.log('');
    console.log('5️⃣ Update Client Record:');
    console.log('   - Use your admin panel to update the client');
    console.log('   - Replace the token with the System User token');
    console.log('   - Validate the connection');
    console.log('');
  }

  console.log('📞 Need Help?');
  console.log('   - Check PERMANENT_MULTI_CLIENT_SETUP.md for detailed instructions');
  console.log('   - Use the admin panel to update client tokens');
  console.log('   - Run this audit again after making changes');
}

auditPermanentTokens(); 