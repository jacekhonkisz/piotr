#!/usr/bin/env node

/**
 * Automated Weekly Report Generator
 * Runs every Monday to generate reports for the previous week (Monday-Sunday)
 */

require('dotenv').config();
const path = require('path');

// Import the TypeScript module using dynamic import
async function runWeeklyReportGeneration() {
  console.log('🚀 Automated Weekly Report Generation Started');
  console.log('=========================================');
  console.log('Time:', new Date().toISOString());
  console.log('');

  try {
    // Load the automated report generator
    const { generateWeeklyReportsForAllClients } = await import('../src/lib/automated-report-generator.js');
    
    // Generate reports for all weekly clients
    await generateWeeklyReportsForAllClients();
    
    console.log('');
    console.log('🎉 Weekly report generation completed successfully!');
    console.log('Time:', new Date().toISOString());
    
  } catch (error) {
    console.error('❌ Weekly report generation failed:', error);
    console.error('Time:', new Date().toISOString());
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  runWeeklyReportGeneration().catch(console.error);
}

module.exports = { runWeeklyReportGeneration }; 