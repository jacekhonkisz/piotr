#!/usr/bin/env node

require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyFinalStatus() {
  console.log('🔍 VERIFYING FINAL CLIENT STATUS\n');
  
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('name, email, ad_account_id, api_status, meta_access_token, notes')
      .order('name');
    
    if (error) {
      console.error('❌ Error fetching clients:', error);
      return;
    }
    
    console.log('📊 ALL CLIENTS IN DATABASE:');
    console.log('='.repeat(80));
    
    const fromSpreadsheet = [
      'Arche Nałęczów', 'Arche Dwór Uphagena Gdańsk', 'Hotel Artis Loft',
      'Blue & Green Baltic Kołobrzeg', 'Blue & Green Mazury', 'Cesarskie Ogrody',
      'Hotel Diva SPA Kołobrzeg', 'Hotel Lambert Ustronie Morskie', 'Apartamenty Lambert',
      'Hotel Tobaco Łódź', 'Hotel Zalewski Mrzeżyno', 'Młyn Klekotki',
      'Sandra SPA Karpacz', 'Nickel Resort Grzybowo'
    ];
    
    let spreadsheetClients = 0;
    let otherClients = 0;
    
    clients.forEach((client, i) => {
      const isFromSpreadsheet = fromSpreadsheet.includes(client.name);
      if (isFromSpreadsheet) spreadsheetClients++;
      else otherClients++;
      
      console.log(`${i+1}. ${client.name} ${isFromSpreadsheet ? '📋' : '🔧'}`);
      console.log(`   📧 ${client.email}`);
      console.log(`   🏢 Ad Account: ${client.ad_account_id}`);
      console.log(`   ✅ Status: ${client.api_status}`);
      console.log(`   🔑 Has Token: ${client.meta_access_token ? 'Yes' : 'No'}`);
      if (client.notes && client.notes.includes('shared')) {
        console.log(`   🔗 Uses shared token`);
      }
      console.log('');
    });
    
    console.log('='.repeat(80));
    console.log('📈 FINAL SUMMARY:');
    console.log(`   📋 Clients from spreadsheet: ${spreadsheetClients} / 14`);
    console.log(`   🔧 Other existing clients: ${otherClients}`);
    console.log(`   📊 Total clients in database: ${clients.length}`);
    console.log(`   ✅ Clients with tokens: ${clients.filter(c => c.meta_access_token).length}`);
    console.log(`   ❌ Clients without tokens: ${clients.filter(c => !c.meta_access_token).length}`);
    
    // Check which spreadsheet clients are missing
    const addedNames = clients.map(c => c.name);
    const missingFromSpreadsheet = fromSpreadsheet.filter(name => !addedNames.includes(name));
    
    if (missingFromSpreadsheet.length > 0) {
      console.log(`\n⚠️  Missing from spreadsheet: ${missingFromSpreadsheet.length}`);
      missingFromSpreadsheet.forEach(name => {
        console.log(`   • ${name} - Still needs Meta Ads token`);
      });
    }
    
    console.log('\n🎉 Database verification completed!');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

verifyFinalStatus();
