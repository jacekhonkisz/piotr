#!/usr/bin/env node

/**
 * Test the FIXED parser with real Belmonte campaign data
 */

// Sample data from actual Belmonte campaign
const sampleCampaign = {
  "campaign_name": "[PBM] HOT | Remarketing | www i SM",
  "spend": "1127.56",
  "actions": [
    { "action_type": "omni_search", "value": "400" },
    { "action_type": "offsite_conversion.fb_pixel_search", "value": "400" },
    { "action_type": "search", "value": "400" },
    { "action_type": "view_content", "value": "123" },
    { "action_type": "omni_view_content", "value": "123" },
    { "action_type": "offsite_conversion.fb_pixel_view_content", "value": "123" },
    { "action_type": "initiate_checkout", "value": "28" },
    { "action_type": "omni_initiated_checkout", "value": "28" },
    { "action_type": "offsite_conversion.fb_pixel_initiate_checkout", "value": "28" },
    { "action_type": "purchase", "value": "6" },
    { "action_type": "omni_purchase", "value": "6" },
    { "action_type": "offsite_conversion.fb_pixel_purchase", "value": "6" }
  ],
  "action_values": [
    { "action_type": "purchase", "value": "18262" },
    { "action_type": "omni_purchase", "value": "18262" }
  ]
};

// Import the fixed parser from built version
const { parseMetaActions } = require('../.next/server/chunks/[root of the server]__f1d3f6._.js').then
  ? require('../src/lib/meta-actions-parser.ts')  
  : require('../src/lib/meta-actions-parser.ts');

console.log('🧪 TESTING FIXED PARSER WITH REAL BELMONTE DATA');
console.log('═══════════════════════════════════════════════════\n');

console.log('📊 Input Campaign:', sampleCampaign.campaign_name);
console.log('💰 Spend:', sampleCampaign.spend, 'PLN\n');

console.log('📋 Actions Array:');
sampleCampaign.actions.forEach(action => {
  console.log(`  - ${action.action_type}: ${action.value}`);
});

console.log('\n💵 Action Values Array:');
sampleCampaign.action_values.forEach(actionValue => {
  console.log(`  - ${actionValue.action_type}: ${actionValue.value}`);
});

console.log('\n🔄 PARSING WITH FIXED PARSER...\n');

const parsed = parseMetaActions(
  sampleCampaign.actions,
  sampleCampaign.action_values,
  sampleCampaign.campaign_name
);

console.log('═══════════════════════════════════════════════════');
console.log('✅ PARSED RESULTS');
console.log('═══════════════════════════════════════════════════\n');

console.log('Booking Engine Funnel:');
console.log(`  Step 1 (Search):           ${parsed.booking_step_1}`);
console.log(`  Step 2 (View Content):     ${parsed.booking_step_2}`);
console.log(`  Step 3 (Initiate Checkout): ${parsed.booking_step_3}`);
console.log(`  Reservations (Purchase):    ${parsed.reservations}`);
console.log(`  Reservation Value:          ${parsed.reservation_value} PLN`);

console.log('\nOther Conversions:');
console.log(`  Click to Call:              ${parsed.click_to_call}`);
console.log(`  Email Contacts:             ${parsed.email_contacts}`);

console.log('\n═══════════════════════════════════════════════════');
console.log('🔍 VERIFICATION');
console.log('═══════════════════════════════════════════════════\n');

// Expected values based on real data
const expected = {
  booking_step_1: 400,  // From omni_search (all search types should be counted once)
  booking_step_2: 123,  // From view_content (all view_content types should be counted once)
  booking_step_3: 28,   // From initiate_checkout (all initiate_checkout types should be counted once)
  reservations: 6,      // From purchase (all purchase types should be counted once)
  reservation_value: 18262
};

console.log('Expected Values:');
console.log(`  Step 1: ${expected.booking_step_1}`);
console.log(`  Step 2: ${expected.booking_step_2}`);
console.log(`  Step 3: ${expected.booking_step_3}`);
console.log(`  Reservations: ${expected.reservations}`);
console.log(`  Value: ${expected.reservation_value}`);

console.log('\nActual Values:');
console.log(`  Step 1: ${parsed.booking_step_1}`);
console.log(`  Step 2: ${parsed.booking_step_2}`);
console.log(`  Step 3: ${parsed.booking_step_3}`);
console.log(`  Reservations: ${parsed.reservations}`);
console.log(`  Value: ${parsed.reservation_value}`);

console.log('\nComparison:');
const checks = {
  step1: parsed.booking_step_1 >= expected.booking_step_1,
  step2: parsed.booking_step_2 >= expected.booking_step_2,
  step3: parsed.booking_step_3 >= expected.booking_step_3,
  reservations: parsed.reservations >= expected.reservations,
  value: parsed.reservation_value >= expected.reservation_value
};

console.log(`  Step 1: ${checks.step1 ? '✅' : '❌'} ${checks.step1 ? 'CORRECT' : 'WRONG'}`);
console.log(`  Step 2: ${checks.step2 ? '✅' : '❌'} ${checks.step2 ? 'CORRECT' : 'WRONG'}`);
console.log(`  Step 3: ${checks.step3 ? '✅' : '❌'} ${checks.step3 ? 'CORRECT' : 'WRONG'}`);
console.log(`  Reservations: ${checks.reservations ? '✅' : '❌'} ${checks.reservations ? 'CORRECT' : 'WRONG'}`);
console.log(`  Value: ${checks.value ? '✅' : '❌'} ${checks.value ? 'CORRECT' : 'WRONG'}`);

const allCorrect = Object.values(checks).every(v => v);

console.log('\n═══════════════════════════════════════════════════');
if (allCorrect) {
  console.log('🎉 ALL CHECKS PASSED! Parser is working correctly!');
} else {
  console.log('❌ SOME CHECKS FAILED! Parser needs adjustment!');
}
console.log('═══════════════════════════════════════════════════\n');

// Funnel validation
console.log('🔍 FUNNEL VALIDATION:');
const isValidFunnel = 
  parsed.booking_step_1 >= parsed.booking_step_2 &&
  parsed.booking_step_2 >= parsed.booking_step_3 &&
  parsed.booking_step_3 >= parsed.reservations;

if (isValidFunnel) {
  console.log('✅ Funnel progression is VALID (Step 1 >= Step 2 >= Step 3 >= Reservations)');
} else {
  console.log('⚠️  Funnel has inversions:');
  if (parsed.booking_step_2 > parsed.booking_step_1) {
    console.log('   - Step 2 > Step 1');
  }
  if (parsed.booking_step_3 > parsed.booking_step_2) {
    console.log('   - Step 3 > Step 2');
  }
  if (parsed.reservations > parsed.booking_step_3) {
    console.log('   - Reservations > Step 3');
  }
}

console.log('');

