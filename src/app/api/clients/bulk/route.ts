import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MetaAPIService } from '../../../../lib/meta-api-optimized';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Extract the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token and get user
    const { data: { user }, error: userAuthError } = await supabase.auth.getUser(token);
    if (userAuthError || !user) {
      console.error('Token verification failed:', userAuthError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { action, clientIds, frequency } = await request.json();

    if (!action || !clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
    }

    const results = {
      success: [] as string[],
      failed: [] as { clientId: string; error: string }[]
    };

    switch (action) {
      case 'delete':
        await handleBulkDelete(clientIds, results);
        break;
      
      case 'send_reports':
        await handleBulkSendReports(clientIds, results);
        break;
      
      case 'regenerate_credentials':
        await handleBulkRegenerateCredentials(clientIds, results);
        break;
      
      case 'change_frequency':
        if (!frequency) {
          return NextResponse.json({ error: 'Frequency is required' }, { status: 400 });
        }
        await handleBulkChangeFrequency(clientIds, frequency, results);
        break;
      
      case 'generate_reports':
        await handleBulkGenerateReports(clientIds, results);
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      message: `Bulk ${action} completed`,
      results
    });

  } catch (error) {
    console.error('Bulk operation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleBulkDelete(clientIds: string[], results: any) {
  for (const clientId of clientIds) {
    try {
      // Get client to find associated user
      const { data: client } = await supabase
        .from('clients')
        .select('id, email')
        .eq('id', clientId)
        .single();

      if (!client) {
        results.failed.push({ clientId, error: 'Client not found' });
        continue;
      }

      // Delete the client record
      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (clientError) {
        results.failed.push({ clientId, error: clientError.message });
        continue;
      }

      // Try to delete the associated user account
      try {
        const { data: user } = await supabase.auth.admin.listUsers();
        const userToDelete = user.users.find(u => u.email === client.email);
        
        if (userToDelete) {
          await supabase.auth.admin.deleteUser(userToDelete.id);
        }
      } catch (userError) {
        console.warn(`Failed to delete user for client ${clientId}:`, userError);
        // Don't fail the operation if user deletion fails
      }

      results.success.push(clientId);
    } catch (error) {
      results.failed.push({ 
        clientId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

async function handleBulkSendReports(clientIds: string[], results: any) {
  for (const clientId of clientIds) {
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (!client) {
        results.failed.push({ clientId, error: 'Client not found' });
        continue;
      }

      // Send report email
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          clientId: clientId,
          includePdf: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        results.failed.push({ clientId, error: errorData.error || 'Failed to send report' });
        continue;
      }

      results.success.push(clientId);
    } catch (error) {
      results.failed.push({ 
        clientId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

async function handleBulkRegenerateCredentials(clientIds: string[], results: any) {
  for (const clientId of clientIds) {
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (!client) {
        results.failed.push({ clientId, error: 'Client not found' });
        continue;
      }

      // Generate new password
      const newPassword = generateSecurePassword();
      const newUsername = client.email;

      // Update user password
      const { data: user } = await supabase.auth.admin.listUsers();
      const userToUpdate = user.users.find(u => u.email === client.email);
      
      if (userToUpdate) {
        await supabase.auth.admin.updateUserById(userToUpdate.id, {
          password: newPassword
        });
      }

      // Update client record
      const { error: clientError } = await supabase
        .from('clients')
        .update({
          generated_password: newPassword,
          generated_username: newUsername,
          credentials_generated_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (clientError) {
        results.failed.push({ clientId, error: clientError.message });
        continue;
      }

      results.success.push(clientId);
    } catch (error) {
      results.failed.push({ 
        clientId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

async function handleBulkChangeFrequency(clientIds: string[], frequency: string, results: any) {
  const { error } = await supabase
    .from('clients')
    .update({ reporting_frequency: frequency })
    .in('id', clientIds);

  if (error) {
    results.failed.push({ clientIds, error: error.message });
  } else {
    results.success.push(...clientIds);
  }
}

async function handleBulkGenerateReports(clientIds: string[], results: any) {
  for (const clientId of clientIds) {
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (!client) {
        results.failed.push({ clientId, error: 'Client not found' });
        continue;
      }

      // Generate report
      const metaService = new MetaAPIService(client.meta_access_token);
      const endDate = new Date().toISOString().split('T')[0] || '';
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
      
      if (!client.ad_account_id) {
        results.failed.push({ clientId, error: 'Client has no ad account ID' });
        continue;
      }
      
      const adAccountId = client.ad_account_id.replace('act_', '');
      
      await metaService.generateClientReport(
        adAccountId,
        startDate,
        endDate
      );

      // Store report in database
      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          client_id: clientId,
          date_range_start: startDate,
          date_range_end: endDate,
          generated_at: new Date().toISOString(),
          generation_time_ms: 0,
          email_sent: false
        });

      if (reportError) {
        results.failed.push({ clientId, error: reportError.message });
        continue;
      }

      // Update client's last report date
      await supabase
        .from('clients')
        .update({ last_report_date: new Date().toISOString() })
        .eq('id', clientId);

      results.success.push(clientId);
    } catch (error) {
      results.failed.push({ 
        clientId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
} 