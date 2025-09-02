#!/usr/bin/env node

/**
 * Script to match Google Ads accounts to existing clients and update their Google Ads credentials
 */

require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Google Ads accounts from the spreadsheet
const googleAdsAccounts = [
  { name: 'e-pelisek.cz', customerId: '639-430-5616' },
  { name: 'Nickel Resort Grzybowo', customerId: '116-432-1699' },
  { name: 'ARCHE Dwór Uphagena Gdańsk', customerId: '555-410-8762' },
  { name: 'Blue&Green Masurian Hotel Marina & Medi SPA', customerId: '870-316-8117' },
  { name: 'SEA DEVELOPMENT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ - Blue & Green Hotel Kołobrzeg', customerId: '683-748-3921' },
  { name: 'Hotel Cesarski Spa Sp. z o.o. - cesarskieogrody.pl - [8843]', customerId: '788-509-8406' },
  { name: 'Niumi', customerId: '176-712-4896' },
  { name: 'Hotel Zalewski Mrzeżyno', customerId: '721-984-0096' },
  { name: 'Grand Baltic sp. z o.o. - havethotel.pl', customerId: '733-667-6488' },
  { name: '4L Textil Wojciech Siwy', customerId: '579-639-9043' },
  { name: 'HOTEL TOBACO', customerId: '197-883-5824' },
  { name: 'Diva', customerId: '424-085-9248' },
  { name: 'Hotel Lambert Ustronie Morskie', customerId: '894-139-3916' },
  { name: 'Klekotki', customerId: '375-477-3598' },
  { name: 'BK Concept', customerId: '682-731-7576' },
  { name: 'Belmonte MICE', customerId: '789-260-9395' },
  { name: 'Sandra Spa Karpacz', customerId: '859-901-9750' },
  { name: 'Arche Nałęczów - Sanatorium Milicyjne', customerId: '842-925-9464' },
  { name: 'Sandra SPA Pogorzelica', customerId: '609-306-6346' },
  { name: 'E-Legowisko', customerId: '849-202-4708' },
  { name: 'Hotel Artis Loft Radziejowice', customerId: '175-337-8268' }
];

// Mapping rules for matching Google Ads accounts to existing clients
const matchingRules = [
  // Exact matches
  { googleName: 'Nickel Resort Grzybowo', clientName: 'Nickel Resort Grzybowo' },
  { googleName: 'ARCHE Dwór Uphagena Gdańsk', clientName: 'Arche Dwór Uphagena Gdańsk' },
  { googleName: 'Hotel Zalewski Mrzeżyno', clientName: 'Hotel Zalewski Mrzeżyno' },
  { googleName: 'HOTEL TOBACO', clientName: 'Hotel Tobaco Łódź' },
  { googleName: 'Hotel Lambert Ustronie Morskie', clientName: 'Hotel Lambert Ustronie Morskie' },
  
  // Partial matches
  { googleName: 'Blue&Green Masurian Hotel Marina & Medi SPA', clientName: 'Blue & Green Mazury' },
  { googleName: 'SEA DEVELOPMENT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ - Blue & Green Hotel Kołobrzeg', clientName: 'Blue & Green Baltic Kołobrzeg' },
  { googleName: 'Hotel Cesarski Spa Sp. z o.o. - cesarskieogrody.pl - [8843]', clientName: 'Cesarskie Ogrody' },
  { googleName: 'Grand Baltic sp. z o.o. - havethotel.pl', clientName: 'Havet' },
  { googleName: 'Diva', clientName: 'Hotel Diva SPA Kołobrzeg' },
  { googleName: 'Klekotki', clientName: 'Młyn Klekotki' },
  { googleName: 'Belmonte MICE', clientName: 'Belmonte Hotel' },
  { googleName: 'Sandra Spa Karpacz', clientName: 'Sandra SPA Karpacz' },
  { googleName: 'Hotel Artis Loft Radziejowice', clientName: 'Hotel Artis Loft' }
];

async function getExistingClients() {
  console.log('🔍 Getting existing clients from database...\n');
  
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, email, google_ads_customer_id, google_ads_enabled')
    .order('name');

  if (error) {
    throw new Error(`Failed to get clients: ${error.message}`);
  }

  console.log(`Found ${clients.length} existing clients:`);
  clients.forEach(client => {
    const hasGoogleAds = client.google_ads_customer_id ? '✅' : '❌';
    console.log(`   ${hasGoogleAds} ${client.name} (${client.email})`);
    if (client.google_ads_customer_id) {
      console.log(`      Google Ads ID: ${client.google_ads_customer_id}`);
    }
  });

  return clients;
}

async function checkGoogleAdsSetup() {
  console.log('\n🔧 Checking Google Ads system configuration...\n');
  
  const { data: settings, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', [
      'google_ads_client_id',
      'google_ads_client_secret', 
      'google_ads_developer_token',
      'google_ads_manager_customer_id',
      'google_ads_enabled'
    ]);

  if (error) {
    console.log('⚠️  Could not fetch system settings:', error.message);
    return false;
  }

  console.log('Google Ads System Configuration:');
  const settingsMap = {};
  settings.forEach(setting => {
    settingsMap[setting.key] = setting.value;
    const displayValue = setting.key.includes('secret') || setting.key.includes('token') 
      ? (setting.value ? '***CONFIGURED***' : 'NOT SET')
      : setting.value || 'NOT SET';
    console.log(`   ${setting.key}: ${displayValue}`);
  });

  const isConfigured = settingsMap.google_ads_developer_token && 
                      settingsMap.google_ads_manager_customer_id &&
                      settingsMap.google_ads_enabled === 'true';

  console.log(`\n✅ Google Ads System Status: ${isConfigured ? 'CONFIGURED' : 'NEEDS SETUP'}`);
  
  return { configured: isConfigured, settings: settingsMap };
}

function findClientMatch(googleAccount, existingClients) {
  // First try exact matching rules
  const rule = matchingRules.find(rule => rule.googleName === googleAccount.name);
  if (rule) {
    const client = existingClients.find(c => c.name === rule.clientName);
    if (client) {
      return { client, matchType: 'rule-based', confidence: 'high' };
    }
  }

  // Try fuzzy matching
  const normalizeString = (str) => str.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const googleNormalized = normalizeString(googleAccount.name);
  
  for (const client of existingClients) {
    const clientNormalized = normalizeString(client.name);
    
    // Check if client name is contained in google name or vice versa
    if (googleNormalized.includes(clientNormalized) || clientNormalized.includes(googleNormalized)) {
      return { client, matchType: 'fuzzy', confidence: 'medium' };
    }
    
    // Check for key words match
    const googleWords = googleNormalized.split(' ').filter(w => w.length > 3);
    const clientWords = clientNormalized.split(' ').filter(w => w.length > 3);
    
    const commonWords = googleWords.filter(word => clientWords.includes(word));
    if (commonWords.length >= 2) {
      return { client, matchType: 'keyword', confidence: 'medium' };
    }
  }

  return null;
}

async function updateClientWithGoogleAds(client, googleAccount) {
  console.log(`   🔄 Updating ${client.name} with Google Ads ID: ${googleAccount.customerId}`);
  
  const { error } = await supabase
    .from('clients')
    .update({
      google_ads_customer_id: googleAccount.customerId,
      google_ads_enabled: true
    })
    .eq('id', client.id);

  if (error) {
    console.log(`   ❌ Failed to update: ${error.message}`);
    return false;
  }

  console.log(`   ✅ Successfully updated!`);
  return true;
}

async function matchGoogleAdsAccounts() {
  console.log('🚀 MATCHING GOOGLE ADS ACCOUNTS TO EXISTING CLIENTS\n');
  console.log('='.repeat(70));

  try {
    // Check Google Ads system setup
    const systemStatus = await checkGoogleAdsSetup();
    
    if (!systemStatus.configured) {
      console.log('\n⚠️  WARNING: Google Ads system is not fully configured!');
      console.log('   Some features may not work until system settings are completed.');
    }

    // Get existing clients
    const existingClients = await getExistingClients();

    const results = {
      matched: [],
      unmatched: [],
      updated: [],
      failed: [],
      skipped: []
    };

    console.log('\n🔍 MATCHING PROCESS:\n');

    // Process each Google Ads account
    for (const googleAccount of googleAdsAccounts) {
      console.log(`📊 Processing: ${googleAccount.name}`);
      console.log(`   Google Ads ID: ${googleAccount.customerId}`);

      const match = findClientMatch(googleAccount, existingClients);
      
      if (match) {
        console.log(`   ✅ MATCHED to: ${match.client.name} (${match.matchType}, ${match.confidence} confidence)`);
        
        // Check if client already has Google Ads configured
        if (match.client.google_ads_customer_id) {
          if (match.client.google_ads_customer_id === googleAccount.customerId) {
            console.log(`   ℹ️  Already configured with same ID - skipping`);
            results.skipped.push({ googleAccount, client: match.client, reason: 'already_configured' });
          } else {
            console.log(`   ⚠️  Already has different Google Ads ID: ${match.client.google_ads_customer_id}`);
            console.log(`   🔄 Updating to new ID: ${googleAccount.customerId}`);
            
            const updated = await updateClientWithGoogleAds(match.client, googleAccount);
            if (updated) {
              results.updated.push({ googleAccount, client: match.client, matchType: match.matchType });
            } else {
              results.failed.push({ googleAccount, client: match.client, error: 'update_failed' });
            }
          }
        } else {
          // Update client with Google Ads info
          const updated = await updateClientWithGoogleAds(match.client, googleAccount);
          if (updated) {
            results.updated.push({ googleAccount, client: match.client, matchType: match.matchType });
          } else {
            results.failed.push({ googleAccount, client: match.client, error: 'update_failed' });
          }
        }
        
        results.matched.push({ googleAccount, client: match.client, matchType: match.matchType });
      } else {
        console.log(`   ❌ NO MATCH FOUND - skipping`);
        results.unmatched.push(googleAccount);
      }
      
      console.log('');
    }

    // Print summary
    console.log('='.repeat(70));
    console.log('📋 GOOGLE ADS MATCHING SUMMARY');
    console.log('='.repeat(70));

    console.log(`\n✅ Successfully matched: ${results.matched.length}`);
    results.matched.forEach(result => {
      console.log(`   • ${result.googleAccount.name} → ${result.client.name}`);
      console.log(`     Google Ads ID: ${result.googleAccount.customerId}`);
      console.log(`     Match type: ${result.matchType}`);
    });

    console.log(`\n🔄 Successfully updated: ${results.updated.length}`);
    results.updated.forEach(result => {
      console.log(`   • ${result.client.name} - Google Ads ID: ${result.googleAccount.customerId}`);
    });

    console.log(`\n⏭️  Skipped (already configured): ${results.skipped.length}`);
    results.skipped.forEach(result => {
      console.log(`   • ${result.client.name} - Already has ID: ${result.client.google_ads_customer_id}`);
    });

    console.log(`\n❌ Failed to update: ${results.failed.length}`);
    results.failed.forEach(result => {
      console.log(`   • ${result.client.name} - ${result.error}`);
    });

    console.log(`\n🔍 No match found: ${results.unmatched.length}`);
    results.unmatched.forEach(googleAccount => {
      console.log(`   • ${googleAccount.name} (${googleAccount.customerId})`);
      console.log(`     → No similar client found in database`);
    });

    console.log('\n🎯 NEXT STEPS:');
    if (results.updated.length > 0) {
      console.log(`   ✅ ${results.updated.length} clients now have Google Ads configured`);
      console.log(`   📊 You can now generate reports with both Meta Ads and Google Ads data`);
    }
    
    if (results.unmatched.length > 0) {
      console.log(`   ⚠️  ${results.unmatched.length} Google Ads accounts need manual review:`);
      results.unmatched.forEach(account => {
        console.log(`      - Create new client for: ${account.name}`);
        console.log(`        Google Ads ID: ${account.customerId}`);
      });
    }

    if (!systemStatus.configured) {
      console.log(`   🔧 Complete Google Ads system configuration in admin settings`);
    }

    console.log('\n🎉 Google Ads matching completed!');

    return results;

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  matchGoogleAdsAccounts().catch(console.error);
}

module.exports = { matchGoogleAdsAccounts };
