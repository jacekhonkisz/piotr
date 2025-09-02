export async function GET() {
  return Response.json({ message: 'Simple endpoint working', timestamp: Date.now() });
}
