#!/usr/bin/env node

/**
 * Social Media Cache Refresh Cron Job
 * Runs every 3 hours to refresh social media data for all clients
 * Usage: node scripts/social-cache-cron.js
 */

const fetch = require('node-fetch');
const { config } = require('dotenv');

// Load environment variables
config({ path: '.env.local' });

async function refreshSocialCache() {
  const startTime = Date.now();
  
  try {
    console.log('🔄 [CRON] Starting social media cache refresh job...');
    console.log('📅 [CRON] Timestamp:', new Date().toISOString());
    
    // Determine the API URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/automated/refresh-social-media-cache`;
    
    console.log('🔗 [CRON] Calling API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'Social-Cache-Cron/1.0'
      },
      timeout: 300000 // 5 minute timeout
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    const duration = Date.now() - startTime;
    
    console.log('✅ [CRON] Social cache refresh completed successfully!');
    console.log('📊 [CRON] Summary:', {
      totalClients: result.summary?.totalClients || 0,
      successful: result.summary?.successful || 0,
      failed: result.summary?.failed || 0,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    // Log individual client results if available
    if (result.results && Array.isArray(result.results)) {
      console.log('📋 [CRON] Client results:');
      result.results.forEach(clientResult => {
        const status = clientResult.success ? '✅' : '❌';
        console.log(`   ${status} ${clientResult.clientName}: ${clientResult.success ? 'Success' : clientResult.error}`);
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('❌ [CRON] Social cache refresh failed!');
    console.error('🔍 [CRON] Error details:', {
      message: error.message,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    if (error.code) {
      console.error('🔧 [CRON] Error code:', error.code);
    }
    
    if (error.stack) {
      console.error('📍 [CRON] Stack trace:', error.stack);
    }
    
    process.exit(1);
  }
}

// Add process handlers for graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 [CRON] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 [CRON] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 [CRON] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 [CRON] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the refresh process
refreshSocialCache(); 