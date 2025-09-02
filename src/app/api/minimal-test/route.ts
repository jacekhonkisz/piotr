import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'working',
    timestamp: Date.now()
  });
}
