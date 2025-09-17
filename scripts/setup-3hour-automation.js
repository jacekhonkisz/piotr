#!/usr/bin/env node

/**
 * 3-Hour Cache Refresh Automation Setup
 * 
 * This script sets up automated cache refresh every 3 hours.
 * It can be run in two modes:
 * 1. Cron mode: Sets up system cron job
 * 2. Node mode: Runs continuous Node.js scheduler
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
// For local development, use localhost. For production, use your domain
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-domain.com' 
  : 'http://localhost:3000';
const AUTOMATION_URL = BASE_URL + '/api/automated/refresh-3hour-cache';
const AUTOMATION_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_DIR = process.cwd();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test the automation endpoint
async function testAutomationEndpoint() {
  try {
    logInfo('Testing 3-hour automation endpoint...');
    
    const response = await fetch(AUTOMATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTOMATION_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      logSuccess('Automation endpoint is working!');
      logInfo(`Response: ${JSON.stringify(data.summary || data.message, null, 2)}`);
      return true;
    } else {
      logError(`Automation endpoint failed: HTTP ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Failed to test automation endpoint: ${error.message}`);
    return false;
  }
}

// Create Node.js scheduler script
function createNodeScheduler() {
  const schedulerScript = `#!/usr/bin/env node

/**
 * 3-Hour Cache Refresh Scheduler
 * Runs automatically every 3 hours
 */

const cron = require('node-cron');
require('dotenv').config({ path: '.env.local' });

 // For local development, use localhost. For production, use your domain
 const BASE_URL = process.env.NODE_ENV === 'production' 
   ? 'https://your-domain.com' 
   : 'http://localhost:3000';
 const AUTOMATION_URL = BASE_URL + '/api/automated/refresh-3hour-cache';
const AUTOMATION_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🚀 Starting 3-hour cache refresh scheduler...');
console.log(\`📅 Next refresh: \${new Date(Date.now() + 3 * 60 * 60 * 1000).toLocaleString()}\`);

// Run every 3 hours: 0 */3 * * *
const cronExpression = '0 */3 * * *';

cron.schedule(cronExpression, async () => {
  const timestamp = new Date().toISOString();
  console.log(\`\\n🔄 [\${timestamp}] Starting scheduled 3-hour cache refresh...\`);
  
  try {
    const response = await fetch(AUTOMATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${AUTOMATION_KEY}\`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(\`✅ [\${timestamp}] Cache refresh completed successfully\`);
      console.log(\`📊 Summary: \${JSON.stringify(data.summary, null, 2)}\`);
    } else {
      console.error(\`❌ [\${timestamp}] Cache refresh failed: HTTP \${response.status}\`);
    }
  } catch (error) {
    console.error(\`❌ [\${timestamp}] Cache refresh error: \${error.message}\`);
  }
}, {
  scheduled: true,
  timezone: "Europe/Warsaw"
});

// Run initial refresh on startup (optional)
console.log('🔄 Running initial cache refresh...');
setTimeout(async () => {
  try {
    const response = await fetch(AUTOMATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${AUTOMATION_KEY}\`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Initial cache refresh completed');
      console.log(\`📊 Summary: \${JSON.stringify(data.summary, null, 2)}\`);
    } else {
      console.error(\`❌ Initial cache refresh failed: HTTP \${response.status}\`);
    }
  } catch (error) {
    console.error(\`❌ Initial cache refresh error: \${error.message}\`);
  }
}, 5000); // Wait 5 seconds after startup

console.log('⏰ Scheduler is running. Press Ctrl+C to stop.');
`;

  const schedulerPath = path.join(PROJECT_DIR, 'scripts', '3hour-scheduler.js');
  
  try {
    fs.writeFileSync(schedulerPath, schedulerScript);
    fs.chmodSync(schedulerPath, 0o755); // Make executable
    logSuccess(`Node.js scheduler created: ${schedulerPath}`);
    return schedulerPath;
  } catch (error) {
    logError(`Failed to create Node.js scheduler: ${error.message}`);
    return null;
  }
}

// Create system cron job
function createSystemCron() {
  const cronCommand = `curl -X POST "${AUTOMATION_URL}" -H "Content-Type: application/json" -H "Authorization: Bearer ${AUTOMATION_KEY}"`;
  const cronEntry = `0 */3 * * * ${cronCommand} >> /var/log/3hour-refresh.log 2>&1`;
  
  logInfo('System cron entry (add manually to crontab):');
  log(`${cronEntry}`, 'yellow');
  
  logInfo('To add this to your crontab:');
  log('1. Run: crontab -e', 'blue');
  log('2. Add the line above', 'blue');
  log('3. Save and exit', 'blue');
  
  return cronEntry;
}

// Create PM2 ecosystem file for production
function createPM2Config() {
  const pm2Config = {
    apps: [{
      name: "3hour-cache-refresh",
      script: "./scripts/3hour-scheduler.js",
      cwd: PROJECT_DIR,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production"
      },
      log_file: "./logs/3hour-refresh.log",
      out_file: "./logs/3hour-refresh-out.log",
      error_file: "./logs/3hour-refresh-error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }]
  };
  
  const pm2Path = path.join(PROJECT_DIR, 'ecosystem.3hour.config.js');
  
  try {
    fs.writeFileSync(pm2Path, `module.exports = ${JSON.stringify(pm2Config, null, 2)};`);
    logSuccess(`PM2 config created: ${pm2Path}`);
    logInfo('To start with PM2: pm2 start ecosystem.3hour.config.js');
    return pm2Path;
  } catch (error) {
    logError(`Failed to create PM2 config: ${error.message}`);
    return null;
  }
}

// Create logs directory
function createLogsDirectory() {
  const logsDir = path.join(PROJECT_DIR, 'logs');
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      logSuccess(`Logs directory created: ${logsDir}`);
    }
  } catch (error) {
    logWarning(`Could not create logs directory: ${error.message}`);
  }
}

// Main setup function
async function setup() {
  log('🚀 3-Hour Cache Refresh Automation Setup', 'bold');
  log('==========================================', 'blue');
  
  // Check environment
  if (!AUTOMATION_URL || !AUTOMATION_KEY) {
    logError('Missing environment variables. Please check .env.local file.');
    logError('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  
  logInfo(`Automation URL: ${AUTOMATION_URL}`);
  
  // Test endpoint
  const endpointWorking = await testAutomationEndpoint();
  if (!endpointWorking) {
    logError('Automation endpoint is not working. Please fix the endpoint first.');
    process.exit(1);
  }
  
  // Create logs directory
  createLogsDirectory();
  
  // Install node-cron if not present
  try {
    require('node-cron');
  } catch (error) {
    logInfo('Installing node-cron package...');
    const { execSync } = require('child_process');
    execSync('npm install node-cron', { stdio: 'inherit' });
    logSuccess('node-cron installed');
  }
  
  // Create scheduler script
  const schedulerPath = createNodeScheduler();
  
  // Create PM2 config
  createPM2Config();
  
  // Show cron option
  log('\\n📋 Setup Options:', 'bold');
  log('=================', 'blue');
  
  log('\\n1. Node.js Scheduler (Recommended for development):', 'green');
  log(`   node ${schedulerPath}`, 'yellow');
  
  log('\\n2. PM2 (Recommended for production):', 'green');
  log('   pm2 start ecosystem.3hour.config.js', 'yellow');
  
  log('\\n3. System Cron (Manual setup required):', 'green');
  createSystemCron();
  
  log('\\n✅ Setup completed successfully!', 'green');
  log('\\n🔍 Monitor logs:', 'blue');
  log('   tail -f logs/3hour-refresh.log', 'yellow');
}

// Run setup
if (require.main === module) {
  setup().catch(error => {
    logError(`Setup failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { setup, testAutomationEndpoint }; 