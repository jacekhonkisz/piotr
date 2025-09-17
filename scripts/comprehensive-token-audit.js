#!/usr/bin/env node

/**
 * Comprehensive Token Audit
 * 
 * This script checks all Google Ads tokens and credentials
 * to see what's actually configured in the system
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function comprehensiveTokenAudit() {
  console.log('🔍 COMPREHENSIVE TOKEN AUDIT\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Check system-level Google Ads settings
    console.log('🔧 SYSTEM-LEVEL GOOGLE ADS SETTINGS');
    console.log('='.repeat(60));
    
    const { data: systemSettings } = await supabase
      .from('system_settings')
      .select('key, value, description, updated_at')
      .in('key', [
        'google_ads_enabled',
        'google_ads_client_id',
        'google_ads_client_secret',
        'google_ads_developer_token',
        'google_ads_manager_refresh_token',
        'google_ads_manager_customer_id'
      ]);
    
    console.log('System Settings:');
    systemSettings?.forEach(setting => {
      const value = setting.key.includes('secret') || setting.key.includes('token') 
        ? (setting.value ? '***CONFIGURED***' : 'NOT SET')
        : setting.value;
      console.log(`   ${setting.key}: ${value}`);
      console.log(`   Description: ${setting.description}`);
      console.log(`   Updated: ${setting.updated_at}`);
      console.log('');
    });
    
    // 2. Check all client Google Ads credentials
    console.log('👥 CLIENT GOOGLE ADS CREDENTIALS');
    console.log('='.repeat(60));
    
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, google_ads_customer_id, google_ads_refresh_token, google_ads_access_token, google_ads_token_expires_at, google_ads_enabled, api_status')
      .eq('api_status', 'valid')
      .order('name');
    
    console.log(`Total Active Clients: ${clients?.length || 0}`);
    console.log('');
    
    let clientsWithGoogleAds = 0;
    let clientsWithRefreshToken = 0;
    let clientsWithAccessToken = 0;
    let clientsWithValidTokens = 0;
    
    clients?.forEach((client, index) => {
      const hasGoogleAds = !!client.google_ads_customer_id;
      const hasRefreshToken = !!client.google_ads_refresh_token;
      const hasAccessToken = !!client.google_ads_access_token;
      const hasValidTokens = hasRefreshToken && hasAccessToken;
      
      if (hasGoogleAds) clientsWithGoogleAds++;
      if (hasRefreshToken) clientsWithRefreshToken++;
      if (hasAccessToken) clientsWithAccessToken++;
      if (hasValidTokens) clientsWithValidTokens++;
      
      console.log(`${index + 1}. ${client.name}`);
      console.log(`   📧 ${client.email}`);
      console.log(`   🔧 Google Ads Customer ID: ${client.google_ads_customer_id || 'NOT SET'}`);
      console.log(`   🔑 Refresh Token: ${hasRefreshToken ? '***CONFIGURED***' : 'NOT SET'}`);
      console.log(`   🔑 Access Token: ${hasAccessToken ? '***CONFIGURED***' : 'NOT SET'}`);
      console.log(`   ⏰ Token Expires: ${client.google_ads_token_expires_at || 'NOT SET'}`);
      console.log(`   ✅ Enabled: ${client.google_ads_enabled ? 'YES' : 'NO'}`);
      console.log(`   🎯 Status: ${hasValidTokens ? 'FULLY CONFIGURED' : hasGoogleAds ? 'PARTIAL' : 'NOT CONFIGURED'}`);
      console.log('');
    });
    
    // 3. Summary statistics
    console.log('📊 TOKEN CONFIGURATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Clients: ${clients?.length || 0}`);
    console.log(`Clients with Google Ads Customer ID: ${clientsWithGoogleAds}`);
    console.log(`Clients with Refresh Token: ${clientsWithRefreshToken}`);
    console.log(`Clients with Access Token: ${clientsWithAccessToken}`);
    console.log(`Clients with Valid Tokens: ${clientsWithValidTokens}`);
    console.log('');
    
    // 4. Check for expired tokens
    console.log('⏰ TOKEN EXPIRATION ANALYSIS');
    console.log('='.repeat(60));
    
    const now = new Date();
    let expiredTokens = 0;
    let expiringSoon = 0;
    
    clients?.forEach(client => {
      if (client.google_ads_token_expires_at) {
        const expiresAt = new Date(client.google_ads_token_expires_at);
        const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
        
        if (expiresAt <= now) {
          expiredTokens++;
          console.log(`❌ ${client.name}: Token expired ${Math.abs(hoursUntilExpiry).toFixed(1)} hours ago`);
        } else if (hoursUntilExpiry <= 24) {
          expiringSoon++;
          console.log(`⚠️  ${client.name}: Token expires in ${hoursUntilExpiry.toFixed(1)} hours`);
        }
      }
    });
    
    if (expiredTokens === 0 && expiringSoon === 0) {
      console.log('✅ No expired or expiring tokens found');
    }
    
    console.log(`\nExpired Tokens: ${expiredTokens}`);
    console.log(`Expiring Soon (24h): ${expiringSoon}`);
    
    // 5. Check for any other Google Ads related settings
    console.log('\n🔍 ADDITIONAL GOOGLE ADS SETTINGS');
    console.log('='.repeat(60));
    
    const { data: allGoogleSettings } = await supabase
      .from('system_settings')
      .select('key, value, description')
      .ilike('key', '%google%');
    
    console.log('All Google-related settings:');
    allGoogleSettings?.forEach(setting => {
      const value = setting.key.includes('secret') || setting.key.includes('token') 
        ? (setting.value ? '***CONFIGURED***' : 'NOT SET')
        : setting.value;
      console.log(`   ${setting.key}: ${value}`);
    });
    
    // 6. Check for any Google Ads related tables
    console.log('\n🗄️ GOOGLE ADS RELATED TABLES');
    console.log('='.repeat(60));
    
    const { data: googleAdsTables } = await supabase
      .from('google_ads_campaigns')
      .select('client_id, campaign_id, campaign_name, status')
      .limit(5);
    
    if (googleAdsTables && googleAdsTables.length > 0) {
      console.log(`Google Ads Campaigns Table: ${googleAdsTables.length} records found`);
      console.log('Sample records:');
      googleAdsTables.forEach((record, i) => {
        console.log(`   ${i + 1}. Client: ${record.client_id}, Campaign: ${record.campaign_name}`);
      });
    } else {
      console.log('Google Ads Campaigns Table: No records found');
    }
    
    // 7. Final diagnosis
    console.log('\n🎯 FINAL DIAGNOSIS');
    console.log('='.repeat(60));
    
    if (clientsWithValidTokens === 0) {
      console.log('❌ CRITICAL ISSUE: No clients have valid Google Ads tokens configured');
      console.log('   - This explains why live data collection fails');
      console.log('   - Need to set up OAuth flow for all clients');
    } else if (clientsWithValidTokens < clientsWithGoogleAds) {
      console.log('⚠️  PARTIAL ISSUE: Some clients missing valid tokens');
      console.log(`   - ${clientsWithValidTokens}/${clientsWithGoogleAds} clients have valid tokens`);
      console.log('   - Need to configure tokens for remaining clients');
    } else {
      console.log('✅ TOKENS CONFIGURED: All clients have valid tokens');
      console.log('   - If data collection still fails, check API permissions');
      console.log('   - Verify campaigns are active and have data');
    }
    
    console.log('\n✅ COMPREHENSIVE TOKEN AUDIT COMPLETE');
    
  } catch (error) {
    console.error('❌ Token audit failed:', error);
  }
}

// Run the comprehensive audit
comprehensiveTokenAudit();
