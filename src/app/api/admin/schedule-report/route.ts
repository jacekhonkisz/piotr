import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { clientId, scheduledDate, reportType, recurring } = await request.json();

    if (!clientId || !scheduledDate || !reportType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get client information
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, admin_id, reporting_frequency, send_day, api_status')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    if (client.api_status !== 'valid') {
      return NextResponse.json(
        { error: 'Client has invalid API status' },
        { status: 400 }
      );
    }

    // Parse the scheduled date
    const scheduleDate = new Date(scheduledDate);
    
    // Calculate report period based on report type
    let reportPeriodStart: string;
    let reportPeriodEnd: string;

    if (reportType === 'monthly') {
      // Previous month
      const prevMonth = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth() - 1, 1);
      const lastDayOfMonth = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), 0);
      reportPeriodStart = prevMonth.toISOString().split('T')[0]!;
      reportPeriodEnd = lastDayOfMonth.toISOString().split('T')[0]!;
    } else if (reportType === 'weekly') {
      // Previous week (Monday to Sunday)
      const todayWeekday = scheduleDate.getDay();
      const daysBackToMonday = todayWeekday === 0 ? 6 : todayWeekday - 1;
      const lastMonday = new Date(scheduleDate);
      lastMonday.setDate(scheduleDate.getDate() - daysBackToMonday - 7);
      
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      
      reportPeriodStart = lastMonday.toISOString().split('T')[0]!;
      reportPeriodEnd = lastSunday.toISOString().split('T')[0]!;
    } else {
      // Custom: use last 30 days
      const endDate = new Date(scheduleDate);
      endDate.setDate(endDate.getDate() - 1); // End yesterday
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30);
      
      reportPeriodStart = startDate.toISOString().split('T')[0]!;
      reportPeriodEnd = endDate.toISOString().split('T')[0]!;
    }

    // Check if a schedule already exists for this period
    const { data: existingSchedule, error: checkError } = await supabase
      .from('email_scheduler_logs')
      .select('id')
      .eq('client_id', clientId)
      .eq('report_period_start', reportPeriodStart)
      .eq('report_period_end', reportPeriodEnd)
      .eq('operation_type', 'scheduled')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing schedule:', checkError);
      return NextResponse.json(
        { error: 'Error checking existing schedules' },
        { status: 500 }
      );
    }

    if (existingSchedule) {
      return NextResponse.json(
        { error: 'A schedule already exists for this period' },
        { status: 409 }
      );
    }

    // Create the scheduled entry
    const { data: scheduledEntry, error: insertError } = await supabase
      .from('email_scheduler_logs')
      .insert({
        client_id: clientId,
        admin_id: client.admin_id,
        operation_type: 'scheduled',
        frequency: reportType,
        send_day: scheduleDate.getDate(),
        report_period_start: reportPeriodStart,
        report_period_end: reportPeriodEnd,
        email_sent: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating schedule:', insertError);
      return NextResponse.json(
        { error: 'Failed to create schedule' },
        { status: 500 }
      );
    }

    // If recurring, update client's default settings
    if (recurring) {
      const { error: updateError } = await supabase
        .from('clients')
        .update({
          reporting_frequency: reportType,
          send_day: scheduleDate.getDate(),
          next_report_scheduled_at: scheduleDate.toISOString()
        })
        .eq('id', clientId);

      if (updateError) {
        console.error('Error updating client recurring settings:', updateError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule created successfully',
      data: {
        id: scheduledEntry.id,
        clientName: client.name,
        scheduledDate: scheduledDate,
        reportPeriod: {
          start: reportPeriodStart,
          end: reportPeriodEnd
        },
        recurring
      }
    });

  } catch (error) {
    console.error('Error in schedule-report API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const clientId = searchParams.get('clientId');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('email_scheduler_logs')
      .select(`
        id,
        client_id,
        operation_type,
        frequency,
        send_day,
        report_period_start,
        report_period_end,
        email_sent,
        email_sent_at,
        error_message,
        created_at,
        clients!inner(
          name,
          email,
          company
        )
      `)
      .order('report_period_start', { ascending: false });

    if (startDate) {
      query = query.gte('report_period_start', startDate);
    }

    if (endDate) {
      query = query.lte('report_period_end', endDate);
    }

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching schedules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: 500 }
      );
    }

    const schedules = data?.map(item => ({
      id: item.id,
      client_id: item.client_id,
      client_name: (item.clients as any)?.name || 'Nieznany klient',
      client_email: (item.clients as any)?.email || '',
      client_company: (item.clients as any)?.company || '',
      operation_type: item.operation_type,
      frequency: item.frequency,
      send_day: item.send_day,
      report_period_start: item.report_period_start,
      report_period_end: item.report_period_end,
      email_sent: item.email_sent,
      email_sent_at: item.email_sent_at,
      error_message: item.error_message,
      created_at: item.created_at,
      status: item.email_sent ? 'sent' : (item.error_message ? 'failed' : 'pending')
    })) || [];

    return NextResponse.json({
      success: true,
      data: schedules
    });

  } catch (error) {
    console.error('Error in GET schedule-report API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('id');
    const { scheduledDate, reportType } = await request.json();

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if schedule exists and is not already sent
    const { data: schedule, error: fetchError } = await supabase
      .from('email_scheduler_logs')
      .select('id, email_sent, client_id')
      .eq('id', scheduleId)
      .single();

    if (fetchError || !schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    if (schedule.email_sent) {
      return NextResponse.json(
        { error: 'Cannot update a schedule that has already been sent' },
        { status: 400 }
      );
    }

    // Calculate new report period if date changed
    let updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (scheduledDate) {
      const scheduleDate = new Date(scheduledDate);
      updateData.send_day = scheduleDate.getDate();

      // Recalculate report period based on new date and report type
      if (reportType) {
        updateData.frequency = reportType;
        
        if (reportType === 'monthly') {
          const prevMonth = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth() - 1, 1);
          const lastDayOfMonth = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), 0);
          updateData.report_period_start = prevMonth.toISOString().split('T')[0]!;
          updateData.report_period_end = lastDayOfMonth.toISOString().split('T')[0]!;
        } else if (reportType === 'weekly') {
          const todayWeekday = scheduleDate.getDay();
          const daysBackToMonday = todayWeekday === 0 ? 6 : todayWeekday - 1;
          const lastMonday = new Date(scheduleDate);
          lastMonday.setDate(scheduleDate.getDate() - daysBackToMonday - 7);
          
          const lastSunday = new Date(lastMonday);
          lastSunday.setDate(lastMonday.getDate() + 6);
          
          updateData.report_period_start = lastMonday.toISOString().split('T')[0]!;
          updateData.report_period_end = lastSunday.toISOString().split('T')[0]!;
        }
      }
    }

    // Update the schedule
    const { error: updateError } = await supabase
      .from('email_scheduler_logs')
      .update(updateData)
      .eq('id', scheduleId);

    if (updateError) {
      console.error('Error updating schedule:', updateError);
      return NextResponse.json(
        { error: 'Failed to update schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule updated successfully'
    });

  } catch (error) {
    console.error('Error in PUT schedule-report API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('id');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if schedule exists and is not already sent
    const { data: schedule, error: fetchError } = await supabase
      .from('email_scheduler_logs')
      .select('id, email_sent, client_id')
      .eq('id', scheduleId)
      .single();

    if (fetchError || !schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    if (schedule.email_sent) {
      return NextResponse.json(
        { error: 'Cannot delete a schedule that has already been sent' },
        { status: 400 }
      );
    }

    // Delete the schedule
    const { error: deleteError } = await supabase
      .from('email_scheduler_logs')
      .delete()
      .eq('id', scheduleId);

    if (deleteError) {
      console.error('Error deleting schedule:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    console.error('Error in DELETE schedule-report API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 