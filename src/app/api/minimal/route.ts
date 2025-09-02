// Ultra-minimal endpoint with zero imports to test request processing
export async function GET() {
  return Response.json({ 
    status: 'minimal-ok',
    timestamp: Date.now(),
    message: 'Ultra minimal endpoint working'
  });
}
