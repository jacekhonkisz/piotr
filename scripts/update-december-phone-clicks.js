/**
 * Update December Phone Clicks
 * 
 * Manually update December 2024 phone clicks for a specific client
 * Usage: node scripts/update-december-phone-clicks.js <clientName> <phoneClicks>
 * Example: node scripts/update-december-phone-clicks.js "Havet" 21
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateDecemberPhoneClicks(clientName, phoneClicks) {
  console.log(`🔧 UPDATING DECEMBER PHONE CLICKS`);
  console.log('='.repeat(80));
  console.log(`Client: ${clientName}`);
  console.log(`New value: ${phoneClicks}`);
  console.log('='.repeat(80));
  console.log('');
  
  // Find client
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .ilike('name', `%${clientName}%`);
  
  if (clientError || !clients || clients.length === 0) {
    console.error('❌ Client not found');
    return;
  }
  
  if (clients.length > 1) {
    console.log('⚠️ Multiple clients found:');
    clients.forEach(c => console.log(`  - ${c.name}`));
    console.log('\nPlease be more specific');
    return;
  }
  
  const client = clients[0];
  console.log(`✅ Found client: ${client.name} (${client.id})`);
  
  // Get current value
  const { data: current } = await supabase
    .from('campaign_summaries')
    .select('click_to_call')
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('platform', 'meta')
    .eq('summary_date', '2024-12-01')
    .single();
  
  if (!current) {
    console.error('❌ December 2024 summary not found');
    return;
  }
  
  const oldValue = current.click_to_call || 0;
  console.log(`📊 Current value: ${oldValue}`);
  console.log(`📊 New value: ${phoneClicks}`);
  
  if (oldValue === parseInt(phoneClicks)) {
    console.log('✅ Already correct, no update needed');
    return;
  }
  
  // Update
  const { error } = await supabase
    .from('campaign_summaries')
    .update({
      click_to_call: parseInt(phoneClicks),
      last_updated: new Date().toISOString()
    })
    .eq('client_id', client.id)
    .eq('summary_type', 'monthly')
    .eq('platform', 'meta')
    .eq('summary_date', '2024-12-01');
  
  if (error) {
    console.error('❌ Update failed:', error.message);
  } else {
    console.log(`✅ Updated: ${oldValue} → ${phoneClicks} phone clicks`);
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Refresh the dashboard/reports page');
    console.log('2. December should now show', phoneClicks, 'phone clicks');
  }
}

const clientName = process.argv[2];
const phoneClicks = process.argv[3];

if (!clientName || !phoneClicks) {
  console.log('Usage: node scripts/update-december-phone-clicks.js <clientName> <phoneClicks>');
  console.log('Example: node scripts/update-december-phone-clicks.js "Havet" 21');
  process.exit(1);
}

updateDecemberPhoneClicks(clientName, phoneClicks).then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

