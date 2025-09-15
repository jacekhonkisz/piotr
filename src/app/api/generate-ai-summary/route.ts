import { NextRequest, NextResponse } from 'next/server';
import { generateAISummary } from '../../../lib/ai-summary-generator';

export async function POST(request: NextRequest) {
  try {
    const { summaryData, clientId } = await request.json();

    if (!summaryData) {
      return NextResponse.json({ error: 'Summary data is required' }, { status: 400 });
    }

    console.log('🤖 Generating AI summary for client:', clientId);
    console.log('📊 Summary data keys:', Object.keys(summaryData));

    // Generate AI summary using the same function as PDF
    const aiSummary = await generateAISummary(summaryData, clientId);

    if (!aiSummary) {
      return NextResponse.json({ 
        error: 'Failed to generate AI summary',
        summary: null 
      }, { status: 500 });
    }

    console.log('✅ AI summary generated successfully');
    console.log('📝 Summary length:', aiSummary.length, 'characters');

    return NextResponse.json({ 
      success: true,
      summary: aiSummary,
      length: aiSummary.length
    });

  } catch (error: any) {
    console.error('❌ AI summary generation error:', error);
    
    return NextResponse.json({ 
      error: error.message || 'Failed to generate AI summary',
      summary: null 
    }, { status: 500 });
  }
}
