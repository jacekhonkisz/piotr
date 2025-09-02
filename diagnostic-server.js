#!/usr/bin/env node

// Diagnostic script to test server startup issues
const http = require('http');
const { spawn } = require('child_process');

console.log('🔍 DIAGNOSTIC: Starting server health check...');

// Test 1: Check if port 3000 is available
const testPort = () => {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(3000, () => {
      console.log('✅ Port 3000 is available');
      server.close();
      resolve(true);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('❌ Port 3000 is already in use');
        resolve(false);
      } else {
        console.log('❌ Port test error:', err.message);
        resolve(false);
      }
    });
  });
};

// Test 2: Start Next.js with timeout
const startNextWithTimeout = () => {
  return new Promise((resolve) => {
    console.log('🚀 Starting Next.js server...');
    
    const nextProcess = spawn('npm', ['run', 'dev'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let output = '';
    let hasStarted = false;
    
    // Set timeout for startup
    const timeout = setTimeout(() => {
      if (!hasStarted) {
        console.log('⏰ TIMEOUT: Server took too long to start');
        nextProcess.kill('SIGKILL');
        resolve({ success: false, reason: 'timeout', output });
      }
    }, 30000); // 30 second timeout

    nextProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('📤 STDOUT:', text.trim());
      
      if (text.includes('Ready in') || text.includes('Local:')) {
        hasStarted = true;
        clearTimeout(timeout);
        console.log('✅ Server appears to be ready');
        
        // Test API call
        setTimeout(() => {
          testAPI().then((apiResult) => {
            nextProcess.kill('SIGTERM');
            resolve({ success: true, apiResult, output });
          });
        }, 2000);
      }
    });

    nextProcess.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      console.log('📤 STDERR:', text.trim());
    });

    nextProcess.on('error', (error) => {
      console.log('❌ Process error:', error.message);
      clearTimeout(timeout);
      resolve({ success: false, reason: 'process_error', error: error.message, output });
    });

    nextProcess.on('exit', (code, signal) => {
      console.log(`🔚 Process exited with code ${code}, signal ${signal}`);
      clearTimeout(timeout);
      if (!hasStarted) {
        resolve({ success: false, reason: 'early_exit', code, signal, output });
      }
    });
  });
};

// Test 3: API health check
const testAPI = () => {
  return new Promise((resolve) => {
    console.log('🔍 Testing API endpoint...');
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/ping',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('✅ API responded:', res.statusCode, data);
        resolve({ success: true, status: res.statusCode, data });
      });
    });

    req.on('error', (error) => {
      console.log('❌ API error:', error.message);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log('⏰ API timeout');
      req.destroy();
      resolve({ success: false, error: 'timeout' });
    });

    req.end();
  });
};

// Run diagnostics
async function runDiagnostics() {
  console.log('🔍 === SERVER DIAGNOSTIC STARTING ===');
  
  // Test port availability
  const portAvailable = await testPort();
  
  if (!portAvailable) {
    console.log('❌ Port 3000 is busy, killing existing processes...');
    spawn('pkill', ['-f', 'next-server'], { stdio: 'inherit' });
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Test server startup
  const serverResult = await startNextWithTimeout();
  
  console.log('🔍 === DIAGNOSTIC RESULTS ===');
  console.log('Server startup:', serverResult.success ? '✅ SUCCESS' : '❌ FAILED');
  
  if (!serverResult.success) {
    console.log('Failure reason:', serverResult.reason);
    console.log('Last output:', serverResult.output.slice(-500)); // Last 500 chars
  } else {
    console.log('API test:', serverResult.apiResult?.success ? '✅ SUCCESS' : '❌ FAILED');
  }
  
  process.exit(serverResult.success ? 0 : 1);
}

runDiagnostics().catch(console.error);
