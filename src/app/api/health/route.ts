// Ultra-simple health check endpoint
export async function GET() {
  return Response.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    node_version: process.version
  });
}