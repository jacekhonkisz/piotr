// Standalone test server to isolate the issue
const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  if (req.url === '/test') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: Date.now(),
      message: 'Standalone server working'
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(3001, () => {
  console.log('🚀 Test server running on http://localhost:3001');
  console.log('Test with: curl http://localhost:3001/test');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test server...');
  server.close(() => {
    console.log('✅ Test server stopped');
    process.exit(0);
  });
});
