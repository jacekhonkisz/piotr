#!/usr/bin/env node

/**
 * Automated Monthly Report Generator
 * Runs on the 1st day of each month to generate reports for the previous month
 */

require('dotenv').config();
const path = require('path');

// Import the TypeScript module using dynamic import
async function runMonthlyReportGeneration() {
  console.log('🚀 Automated Monthly Report Generation Started');
  console.log('==========================================');
  console.log('Time:', new Date().toISOString());
  console.log('');

  try {
    // Load the automated report generator
    const { generateMonthlyReportsForAllClients } = await import('../src/lib/automated-report-generator.js');
    
    // Generate reports for all monthly clients
    await generateMonthlyReportsForAllClients();
    
    console.log('');
    console.log('🎉 Monthly report generation completed successfully!');
    console.log('Time:', new Date().toISOString());
    
  } catch (error) {
    console.error('❌ Monthly report generation failed:', error);
    console.error('Time:', new Date().toISOString());
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  runMonthlyReportGeneration().catch(console.error);
}

module.exports = { runMonthlyReportGeneration }; 