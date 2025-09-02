// Debug endpoint with console logging to trace execution
console.log('🔍 DEBUG: Loading debug route file');

export async function GET() {
  console.log('🔍 DEBUG: GET handler called');
  
  try {
    console.log('🔍 DEBUG: Creating response');
    const response = new Response(JSON.stringify({
      status: 'debug-ok',
      timestamp: Date.now(),
      message: 'Debug endpoint reached'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔍 DEBUG: Response created, returning');
    return response;
  } catch (error) {
    console.error('🔍 DEBUG: Error in handler:', error);
    return new Response('Error', { status: 500 });
  }
}

console.log('🔍 DEBUG: Debug route file loaded completely');
