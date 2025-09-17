import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    console.log('🔍 Debug: Fetching calendar data...');

    // Get all clients with their send_day values
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, reporting_frequency, send_day, api_status')
      .eq('api_status', 'valid')
      .order('name');

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`);
    }

    // Get scheduled reports
    const { data: scheduledReports, error: reportsError } = await supabase
      .from('scheduled_reports')
      .select('*')
      .order('scheduled_date');

    if (reportsError) {
      console.warn('Failed to fetch scheduled reports:', reportsError.message);
    }

    // Generate potential reports like the calendar does
    const potentialReports: any[] = [];
    const today = new Date();
    
    clients?.forEach(client => {
      if (client.reporting_frequency === 'on_demand') return;
      
      // Generate schedules for the next 3 months
      for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
        const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
        
        if (client.reporting_frequency === 'monthly') {
          // Monthly reports - send on the specified day of month
          const sendDay = client.send_day || 5;
          const sendDate = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), sendDay);
          
          // Fix timezone issue: ensure we get the correct date string
          const year = targetMonth.getFullYear();
          const month = targetMonth.getMonth();
          const sendDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(sendDay).padStart(2, '0')}`;
          
          // Only include future dates
          if (sendDate > today) {
            potentialReports.push({
              client_id: client.id,
              client_name: client.name,
              client_email: client.email,
              scheduled_date: sendDateString,
              report_type: 'monthly',
              frequency: 'monthly',
              status: 'pending',
              isActual: false,
              send_day_used: sendDay,
              original_send_day: client.send_day
            });
          }
        }
      }
    });

    // Group potential reports by date
    const reportsByDate: Record<string, any[]> = {};
    potentialReports.forEach(report => {
      const date = report.scheduled_date;
      if (!reportsByDate[date]) reportsByDate[date] = [];
      reportsByDate[date].push(report);
    });

    const result = {
      success: true,
      debug: {
        totalClients: clients?.length || 0,
        clientsWithSendDay: clients?.filter(c => c.send_day !== null).length || 0,
        clientsWithNullSendDay: clients?.filter(c => c.send_day === null).length || 0,
        monthlyClients: clients?.filter(c => c.reporting_frequency === 'monthly').length || 0,
        weeklyClients: clients?.filter(c => c.reporting_frequency === 'weekly').length || 0,
        onDemandClients: clients?.filter(c => c.reporting_frequency === 'on_demand').length || 0
      },
      clients: clients?.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        reporting_frequency: c.reporting_frequency,
        send_day: c.send_day,
        api_status: c.api_status
      })) || [],
      scheduledReports: scheduledReports || [],
      potentialReports: potentialReports,
      reportsByDate: reportsByDate,
      upcomingDates: Object.keys(reportsByDate).sort().slice(0, 10)
    };

    console.log('✅ Calendar debug data generated:', {
      clientCount: result.clients.length,
      potentialReportsCount: result.potentialReports.length,
      upcomingDatesCount: result.upcomingDates.length
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Calendar debug failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
