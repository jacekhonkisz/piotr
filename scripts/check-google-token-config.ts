#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGoogleTokenConfig() {
  console.log('🔍 CHECKING GOOGLE ADS TOKEN CONFIGURATION\n');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // 1. Check system_settings for Google Ads credentials
  console.log('1️⃣  SYSTEM SETTINGS (Manager-level credentials):\n');
  
  const { data: settings, error: settingsError } = await supabase
    .from('system_settings')
    .select('key, value, created_at, updated_at')
    .like('key', '%google_ads%')
    .order('key');

  if (settingsError) {
    console.error('❌ Error fetching settings:', settingsError);
  } else if (settings) {
    settings.forEach(setting => {
      const isSensitive = setting.key.includes('token') || 
                          setting.key.includes('secret') || 
                          setting.key.includes('password');
      
      const displayValue = isSensitive && setting.value 
        ? `${setting.value.substring(0, 20)}...${setting.value.substring(setting.value.length - 10)} (${setting.value.length} chars)`
        : setting.value;

      console.log(`   ${setting.key}:`);
      console.log(`      Value: ${displayValue}`);
      console.log(`      Updated: ${new Date(setting.updated_at).toLocaleString()}`);
      
      // Validate token format
      if (setting.key.includes('refresh_token') && setting.value) {
        const hasInvalidChars = /[\n\r\t]/.test(setting.value);
        const startsWithSpace = setting.value.startsWith(' ');
        const endsWithSpace = setting.value.endsWith(' ');
        
        if (hasInvalidChars || startsWithSpace || endsWithSpace) {
          console.log(`      ⚠️  WARNING: Token has formatting issues!`);
          if (hasInvalidChars) console.log(`         - Contains newlines/tabs`);
          if (startsWithSpace) console.log(`         - Starts with space`);
          if (endsWithSpace) console.log(`         - Ends with space`);
        } else {
          console.log(`      ✅ Token format looks clean`);
        }
      }
      
      console.log('');
    });
  }

  // 2. Check Belmonte client settings
  console.log('\n2️⃣  CLIENT SETTINGS (Belmonte Hotel):\n');
  
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name, google_ads_enabled, google_ads_customer_id, google_ads_refresh_token, updated_at')
    .or('name.ilike.%belmonte%,email.ilike.%belmonte%')
    .single();

  if (clientError) {
    console.error('❌ Error fetching client:', clientError);
  } else if (client) {
    console.log(`   Client: ${client.name}`);
    console.log(`   ID: ${client.id}`);
    console.log(`   Google Ads Enabled: ${client.google_ads_enabled}`);
    console.log(`   Customer ID: ${client.google_ads_customer_id}`);
    
    if (client.google_ads_refresh_token) {
      const token = client.google_ads_refresh_token;
      const displayToken = `${token.substring(0, 20)}...${token.substring(token.length - 10)} (${token.length} chars)`;
      console.log(`   Client Refresh Token: ${displayToken}`);
      console.log(`   Updated: ${new Date(client.updated_at).toLocaleString()}`);
      
      // Validate token format
      const hasInvalidChars = /[\n\r\t]/.test(token);
      const startsWithSpace = token.startsWith(' ');
      const endsWithSpace = token.endsWith(' ');
      
      if (hasInvalidChars || startsWithSpace || endsWithSpace) {
        console.log(`   ⚠️  WARNING: Token has formatting issues!`);
        if (hasInvalidChars) console.log(`      - Contains newlines/tabs`);
        if (startsWithSpace) console.log(`      - Starts with space`);
        if (endsWithSpace) console.log(`      - Ends with space`);
      } else {
        console.log(`   ✅ Token format looks clean`);
      }
    } else {
      console.log(`   Client Refresh Token: ❌ NOT SET (uses manager token)`);
    }
  }

  // 3. Token Priority Logic
  console.log('\n3️⃣  TOKEN PRIORITY LOGIC:\n');
  
  const managerToken = settings?.find(s => s.key === 'google_ads_manager_refresh_token');
  const clientToken = client?.google_ads_refresh_token;
  
  if (managerToken?.value) {
    console.log(`   ✅ Manager token exists: ${managerToken.value.length} chars`);
    console.log(`      Last updated: ${new Date(managerToken.updated_at).toLocaleString()}`);
  } else {
    console.log(`   ❌ Manager token: NOT SET`);
  }
  
  if (clientToken) {
    console.log(`   ✅ Client token exists: ${clientToken.length} chars`);
  } else {
    console.log(`   ❌ Client token: NOT SET`);
  }
  
  console.log('\n   📋 Priority (as per code):');
  console.log(`      1. Manager token (google_ads_manager_refresh_token) ${managerToken?.value ? '✅' : '❌'}`);
  console.log(`      2. Client token (clients.google_ads_refresh_token) ${clientToken ? '✅' : '❌'}`);
  
  const tokenUsed = managerToken?.value ? 'MANAGER TOKEN' : clientToken ? 'CLIENT TOKEN' : 'NONE';
  console.log(`\n   🎯 Token being used: ${tokenUsed}`);

  // 4. Check recent cache updates
  console.log('\n4️⃣  RECENT CACHE ACTIVITY:\n');
  
  const { data: cacheData } = await supabase
    .from('google_ads_current_month_cache')
    .select('period_id, last_updated')
    .eq('client_id', client?.id)
    .order('last_updated', { ascending: false })
    .limit(5);

  if (cacheData && cacheData.length > 0) {
    console.log(`   Recent cache updates for ${client?.name}:`);
    cacheData.forEach(cache => {
      const age = Date.now() - new Date(cache.last_updated).getTime();
      const ageHours = (age / (1000 * 60 * 60)).toFixed(1);
      console.log(`      ${cache.period_id}: ${new Date(cache.last_updated).toLocaleString()} (${ageHours}h ago)`);
    });
  } else {
    console.log(`   ❌ No cache data found`);
  }

  // 5. Test token by trying to decode it (basic validation)
  console.log('\n5️⃣  TOKEN VALIDATION:\n');
  
  const tokenToValidate = managerToken?.value || clientToken;
  
  if (tokenToValidate) {
    console.log(`   Token length: ${tokenToValidate.length} characters`);
    console.log(`   Starts with: ${tokenToValidate.substring(0, 10)}...`);
    console.log(`   Ends with: ...${tokenToValidate.substring(tokenToValidate.length - 10)}`);
    
    // Check for common issues
    const issues = [];
    
    if (tokenToValidate.length < 50) {
      issues.push('Token seems too short (expected 100+ chars)');
    }
    
    if (tokenToValidate.includes(' ') && tokenToValidate.trim().length !== tokenToValidate.length) {
      issues.push('Token has leading/trailing spaces');
    }
    
    if (/[\n\r]/.test(tokenToValidate)) {
      issues.push('Token contains newline characters');
    }
    
    if (!tokenToValidate.match(/^[A-Za-z0-9._\-\/]+$/)) {
      issues.push('Token contains unexpected characters');
    }
    
    if (issues.length > 0) {
      console.log('\n   ⚠️  ISSUES FOUND:');
      issues.forEach(issue => console.log(`      - ${issue}`));
    } else {
      console.log('\n   ✅ Token format appears valid');
    }
    
    // Check if it's an old token format
    const tokenAge = managerToken ? 
      Date.now() - new Date(managerToken.updated_at).getTime() :
      Date.now() - new Date(client!.updated_at).getTime();
    
    const tokenAgeDays = Math.floor(tokenAge / (1000 * 60 * 60 * 24));
    
    console.log(`\n   📅 Token age: ${tokenAgeDays} days`);
    
    if (tokenAgeDays < 7) {
      console.log(`      ✅ Token was updated within the last week (${tokenAgeDays} days ago)`);
    } else if (tokenAgeDays < 30) {
      console.log(`      ⚠️  Token is ${tokenAgeDays} days old`);
    } else {
      console.log(`      ⚠️  Token is quite old (${tokenAgeDays} days)`);
    }
    
  } else {
    console.log('   ❌ No token found to validate');
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  if (tokenToValidate) {
    console.log('✅ Refresh token is configured');
    
    const tokenAge = managerToken ? 
      Date.now() - new Date(managerToken.updated_at).getTime() :
      Date.now() - new Date(client!.updated_at).getTime();
    const tokenAgeDays = Math.floor(tokenAge / (1000 * 60 * 60 * 24));
    
    if (tokenAgeDays < 7) {
      console.log('✅ Token was updated recently (< 7 days)');
      console.log('\n⚠️  BUT getting invalid_grant error!');
      console.log('\n🔍 POSSIBLE CAUSES:');
      console.log('   1. Token was copied with extra spaces/newlines');
      console.log('   2. Token is for wrong OAuth client (dev vs prod)');
      console.log('   3. Token was revoked in Google Console');
      console.log('   4. OAuth consent screen needs re-approval');
      console.log('   5. Scopes changed and token needs regeneration');
    } else {
      console.log('⚠️  Token might be old - consider refreshing');
    }
  } else {
    console.log('❌ No refresh token configured');
  }

  console.log('\n');
}

checkGoogleTokenConfig();







