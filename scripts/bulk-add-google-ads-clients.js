#!/usr/bin/env node

/**
 * Bulk Add Google Ads Customer IDs to Multiple Clients
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Add your client Google Ads Customer IDs here
const CLIENT_GOOGLE_ADS_MAPPING = [
  { email: 'belmonte@hotel.com', customer_id: '789-260-9395' },
  // Add more clients here:
  // { email: 'client2@example.com', customer_id: 'XXX-XXX-XXXX' },
  // { email: 'client3@example.com', customer_id: 'XXX-XXX-XXXX' },
  // etc...
];

async function bulkAddGoogleAdsClients() {
  console.log('🎯 Bulk Adding Google Ads Customer IDs to Clients');
  console.log('==================================================\n');
  
  try {
    // Get all clients
    const { data: allClients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, google_ads_customer_id, google_ads_enabled');
    
    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError.message);
      return;
    }
    
    console.log(`📋 Found ${allClients.length} total clients in database`);
    console.log(`📝 Processing ${CLIENT_GOOGLE_ADS_MAPPING.length} clients with Google Ads Customer IDs\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const mapping of CLIENT_GOOGLE_ADS_MAPPING) {
      try {
        console.log(`🔍 Processing: ${mapping.email}`);
        
        // Find client by email
        const client = allClients.find(c => c.email === mapping.email);
        
        if (!client) {
          console.log(`   ⚠️  Client not found: ${mapping.email}`);
          errorCount++;
          continue;
        }
        
        // Check if already has Google Ads Customer ID
        if (client.google_ads_customer_id) {
          console.log(`   ⚠️  Already has Customer ID: ${client.google_ads_customer_id}`);
          skipCount++;
          continue;
        }
        
        // Update client with Google Ads data
        const { data: updatedClient, error: updateError } = await supabase
          .from('clients')
          .update({
            google_ads_customer_id: mapping.customer_id,
            google_ads_enabled: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', client.id)
          .select('name, email, google_ads_customer_id, google_ads_enabled')
          .single();
        
        if (updateError) {
          console.log(`   ❌ Error updating: ${updateError.message}`);
          errorCount++;
          continue;
        }
        
        console.log(`   ✅ Updated successfully!`);
        console.log(`      Customer ID: ${updatedClient.google_ads_customer_id}`);
        console.log(`      Enabled: ${updatedClient.google_ads_enabled}`);
        successCount++;
        
      } catch (error) {
        console.log(`   ❌ Error processing ${mapping.email}: ${error.message}`);
        errorCount++;
      }
      
      console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log('📊 Bulk Update Summary');
    console.log('======================');
    console.log(`✅ Successfully updated: ${successCount}`);
    console.log(`⚠️  Skipped (already configured): ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Total processed: ${CLIENT_GOOGLE_ADS_MAPPING.length}`);
    
    if (successCount > 0) {
      console.log('\n🎉 Bulk update completed successfully!');
      console.log('\n🚀 Next steps:');
      console.log('1. Set up OAuth credentials (Client ID + Client Secret) in admin settings');
      console.log('2. Generate ONE refresh token for your manager account');
      console.log('3. Store the refresh token in admin settings or use it for API calls');
      console.log('4. Test data fetching from Google Ads API');
    }
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

async function showCurrentStatus() {
  console.log('📋 Current Google Ads Status for All Clients');
  console.log('=============================================\n');
  
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('name, email, google_ads_customer_id, google_ads_enabled')
      .order('name');
    
    if (error) {
      console.error('❌ Error fetching clients:', error.message);
      return;
    }
    
    let configuredCount = 0;
    let enabledCount = 0;
    
    clients.forEach(client => {
      const hasCustomerId = !!client.google_ads_customer_id;
      const isEnabled = !!client.google_ads_enabled;
      
      if (hasCustomerId) configuredCount++;
      if (isEnabled) enabledCount++;
      
      console.log(`${hasCustomerId ? '✅' : '❌'} ${client.name} (${client.email})`);
      if (hasCustomerId) {
        console.log(`   Customer ID: ${client.google_ads_customer_id}`);
        console.log(`   Enabled: ${isEnabled ? '✅ Yes' : '❌ No'}`);
      } else {
        console.log(`   No Google Ads Customer ID configured`);
      }
      console.log('');
    });
    
    console.log('📊 Summary');
    console.log('===========');
    console.log(`Total clients: ${clients.length}`);
    console.log(`Google Ads configured: ${configuredCount}`);
    console.log(`Google Ads enabled: ${enabledCount}`);
    console.log(`Remaining to configure: ${clients.length - configuredCount}`);
    
  } catch (error) {
    console.error('❌ Error showing status:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    await showCurrentStatus();
  } else if (args.includes('--help')) {
    console.log('📖 Bulk Google Ads Client Setup');
    console.log('================================');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/bulk-add-google-ads-clients.js           # Add Customer IDs to clients');
    console.log('  node scripts/bulk-add-google-ads-clients.js --status  # Show current status');
    console.log('  node scripts/bulk-add-google-ads-clients.js --help    # Show this help');
    console.log('');
    console.log('Setup:');
    console.log('1. Edit CLIENT_GOOGLE_ADS_MAPPING in this file');
    console.log('2. Add email and customer_id for each client');
    console.log('3. Run the script to bulk update');
  } else {
    await bulkAddGoogleAdsClients();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  bulkAddGoogleAdsClients,
  showCurrentStatus,
  CLIENT_GOOGLE_ADS_MAPPING
}; 