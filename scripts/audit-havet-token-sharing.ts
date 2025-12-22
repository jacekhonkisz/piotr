/**
 * 🔍 AUDIT: Which clients are using the same system user token as "havet"?
 * 
 * This script:
 * 1. Finds the "havet" client
 * 2. Gets its token (system_user_token preferred, meta_access_token as fallback)
 * 3. Finds all other clients using the same token
 * 4. Reports the results
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ClientTokenInfo {
  id: string;
  name: string;
  email: string;
  company?: string;
  ad_account_id?: string;
  system_user_token?: string;
  meta_access_token?: string;
  api_status?: string;
  created_at?: string;
  updated_at?: string;
}

async function auditHavetTokenSharing() {
  console.log('🔍 AUDIT: Clients Sharing Token with "havet"');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Find the "havet" client
    console.log('1️⃣ Searching for "havet" client...');
    const { data: havetClients, error: havetError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%havet%');

    if (havetError) {
      console.error('❌ Error searching for havet:', havetError);
      return;
    }

    if (!havetClients || havetClients.length === 0) {
      console.log('❌ No client found with name containing "havet"');
      return;
    }

    // If multiple, use the first one
    const havetClient = havetClients[0] as ClientTokenInfo;
    console.log(`✅ Found "havet" client: ${havetClient.name} (${havetClient.email})`);
    console.log(`   ID: ${havetClient.id}`);
    console.log(`   Ad Account: ${havetClient.ad_account_id || 'Not set'}`);
    console.log('');

    // Step 2: Determine which token to use
    const havetToken = havetClient.system_user_token || havetClient.meta_access_token;
    const tokenType = havetClient.system_user_token ? 'system_user_token' : 'meta_access_token';
    const tokenPreview = havetToken ? `${havetToken.substring(0, 20)}...${havetToken.substring(havetToken.length - 10)}` : 'N/A';

    if (!havetToken) {
      console.log('❌ Havet client has no token (neither system_user_token nor meta_access_token)');
      return;
    }

    console.log(`2️⃣ Havet token type: ${tokenType}`);
    console.log(`   Token preview: ${tokenPreview}`);
    console.log(`   Token length: ${havetToken.length} characters`);
    console.log('');

    // Step 3: Find all clients with the same token
    console.log('3️⃣ Searching for all clients using the same token...');
    
    // Search by system_user_token if that's what havet uses
    let clientsWithSameToken: ClientTokenInfo[] = [];
    
    if (havetClient.system_user_token) {
      const { data: systemTokenClients, error: systemError } = await supabase
        .from('clients')
        .select('*')
        .eq('system_user_token', havetToken);
      
      if (systemError) {
        console.error('❌ Error searching by system_user_token:', systemError);
      } else if (systemTokenClients) {
        clientsWithSameToken = systemTokenClients as ClientTokenInfo[];
      }
    }
    
    // Also search by meta_access_token (in case some clients use it as fallback)
    const { data: metaTokenClients, error: metaError } = await supabase
      .from('clients')
      .select('*')
      .eq('meta_access_token', havetToken);
    
    if (metaError) {
      console.error('❌ Error searching by meta_access_token:', metaError);
    } else if (metaTokenClients) {
      // Merge results, avoiding duplicates
      const existingIds = new Set(clientsWithSameToken.map(c => c.id));
      for (const client of metaTokenClients as ClientTokenInfo[]) {
        if (!existingIds.has(client.id)) {
          clientsWithSameToken.push(client);
        }
      }
    }

    // Step 4: Display results
    console.log(`✅ Found ${clientsWithSameToken.length} client(s) using the same token:`);
    console.log('');

    if (clientsWithSameToken.length === 0) {
      console.log('⚠️  No other clients found with the same token');
      console.log('   (This is normal if each client has a unique token)');
      return;
    }

    // Group by token type
    const clientsByTokenType: { [key: string]: ClientTokenInfo[] } = {
      system_user_token: [],
      meta_access_token: [],
      both: []
    };

    clientsWithSameToken.forEach(client => {
      const hasSystem = !!client.system_user_token && client.system_user_token === havetToken;
      const hasMeta = !!client.meta_access_token && client.meta_access_token === havetToken;
      
      if (hasSystem && hasMeta) {
        clientsByTokenType.both.push(client);
      } else if (hasSystem) {
        clientsByTokenType.system_user_token.push(client);
      } else if (hasMeta) {
        clientsByTokenType.meta_access_token.push(client);
      }
    });

    // Display results
    console.log('📊 RESULTS:');
    console.log('─'.repeat(80));
    console.log('');

    let index = 1;
    clientsWithSameToken.forEach((client) => {
      const isHavet = client.id === havetClient.id;
      const marker = isHavet ? '🎯' : '  ';
      const tokenTypeUsed = client.system_user_token === havetToken 
        ? 'system_user_token' 
        : client.meta_access_token === havetToken 
          ? 'meta_access_token' 
          : 'unknown';
      
      console.log(`${marker} ${index}. ${client.name}${isHavet ? ' (HAVET - Source)' : ''}`);
      console.log(`     📧 Email: ${client.email}`);
      console.log(`     🏢 Company: ${client.company || 'N/A'}`);
      console.log(`     📊 Ad Account: ${client.ad_account_id || 'Not set'}`);
      console.log(`     🔑 Token Type: ${tokenTypeUsed}`);
      console.log(`     📈 API Status: ${client.api_status || 'Unknown'}`);
      console.log(`     🆔 ID: ${client.id}`);
      console.log(`     📅 Created: ${client.created_at ? new Date(client.created_at).toLocaleDateString() : 'N/A'}`);
      console.log('');
      index++;
    });

    // Summary
    console.log('─'.repeat(80));
    console.log('📋 SUMMARY:');
    console.log(`   Total clients sharing token: ${clientsWithSameToken.length}`);
    console.log(`   Using system_user_token: ${clientsByTokenType.system_user_token.length}`);
    console.log(`   Using meta_access_token: ${clientsByTokenType.meta_access_token.length}`);
    console.log(`   Using both: ${clientsByTokenType.both.length}`);
    console.log('');

    // Security warning if multiple clients share token
    if (clientsWithSameToken.length > 1) {
      console.log('⚠️  SECURITY NOTE:');
      console.log('   Multiple clients are sharing the same authentication token.');
      console.log('   This is intentional if using a shared System User token,');
      console.log('   but ensure all clients have proper access permissions.');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the audit
auditHavetTokenSharing()
  .then(() => {
    console.log('✅ Audit completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  });

