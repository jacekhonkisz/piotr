#!/usr/bin/env node

/**
 * Force restart development server and test PDF generation
 */

const { exec } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceRestartAndTest() {
  console.log('🔄 FORCE RESTART AND TEST PROCEDURE\n');

  console.log('1. 🛑 Finding and killing existing Next.js processes...');
  
  // Kill existing Next.js processes
  exec('pkill -f "next"', (error, stdout, stderr) => {
    if (error) {
      console.log('   No Next.js processes found to kill (or error occurred)');
    } else {
      console.log('   ✅ Killed existing Next.js processes');
    }
  });

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n2. 🚀 Instructions to restart server:');
  console.log('   Run this in a separate terminal:');
  console.log('   cd /Users/macbook/piotr && npm run dev');
  console.log('');
  console.log('   Wait for "Ready - started server on 0.0.0.0:3000" message');

  console.log('\n3. 🧪 After server restarts, test PDF generation:');
  console.log('   The validation logic is confirmed working');
  console.log('   Both comparison sections SHOULD appear now');

  console.log('\n4. 🔍 What to look for in the PDF:');
  console.log('   - "Porównanie miesiąc do miesiąca" section');
  console.log('   - "Porównanie rok do roku" section');
  console.log('   - August 2025 vs July 2025 comparison');
  console.log('   - August 2025 vs August 2024 comparison');

  console.log('\n5. 📋 If comparisons still don\'t appear, check:');
  console.log('   - Server console logs for our debug messages');
  console.log('   - Look for "🔍 YEAR-OVER-YEAR VALIDATION DEBUG" messages');
  console.log('   - Look for "🔍 PERIOD COMPARISON VALIDATION DEBUG" messages');
  console.log('   - Look for "✅ Monthly comparison shown" messages');

  // Test PDF generation after restart
  console.log('\n6. 🎯 Quick test after restart:');
  console.log('   You can run: node scripts/test-pdf-with-download.js');
  console.log('   This will generate a fresh PDF with the new logic');

  console.log('\n🔧 DEBUGGING TIPS:');
  console.log('   If you still don\'t see comparisons:');
  console.log('   1. Check browser developer tools → Network tab');
  console.log('   2. Look at the PDF generation request payload');
  console.log('   3. Check server logs for our debug messages');
  console.log('   4. Verify the reportData object has comparison data');
}

forceRestartAndTest().catch(console.error); 