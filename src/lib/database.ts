import { supabase } from './supabase';
import type { Database } from './database.types';

type Client = Database['public']['Tables']['clients']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

/**
 * Batch multiple database queries for better performance
 */
export async function batchQueries<T extends Record<string, any>>(
  queries: Array<() => Promise<any>>
): Promise<T[]> {
  try {
    const results = await Promise.all(queries.map(query => query()));
    return results;
  } catch (error) {
    console.error('Error in batch queries:', error);
    throw error;
  }
}

/**
 * Get client dashboard data in a single optimized query
 */
export async function getClientDashboardData(clientId: string) {
  try {
    // Use separate queries to ensure proper typing
    const [clientResult, reportsResult, campaignsResult] = await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single(),
      
      supabase
        .from('reports')
        .select('*')
        .eq('client_id', clientId)
        .order('generated_at', { ascending: false })
        .limit(10),
      
      supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', clientId)
        .order('date_range_start', { ascending: false })
        .limit(50)
    ]);

    if (clientResult.error) throw clientResult.error;
    if (reportsResult.error) throw reportsResult.error;
    if (campaignsResult.error) throw campaignsResult.error;

    return {
      client: clientResult.data,
      reports: reportsResult.data || [],
      campaigns: campaignsResult.data || []
    };
  } catch (error) {
    console.error('Error fetching client dashboard data:', error);
    throw error;
  }
}

/**
 * Get admin dashboard stats in optimized queries
 */
export async function getAdminDashboardStats(adminId: string) {
  try {
    console.log('Getting admin dashboard stats for adminId:', adminId);
    
    // First get all clients for this admin
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, api_status')
      .eq('admin_id', adminId);

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw clientsError;
    }

    console.log('Found clients:', clients?.length || 0);
    const clientIds = clients?.map(client => client.id) || [];
    
    if (clientIds.length === 0) {
      console.log('No clients found, returning empty stats');
      return {
        totalClients: 0,
        totalReports: 0,
        activeClients: 0,
        totalSpend: 0
      };
    }

    console.log('Client IDs:', clientIds);

    // Get reports and campaigns for all clients of this admin
    const [reportsResult, campaignsResult] = await Promise.all([
      supabase
        .from('reports')
        .select('id', { count: 'exact' })
        .in('client_id', clientIds),
      
      supabase
        .from('campaigns')
        .select('spend')
        .in('client_id', clientIds)
        .not('spend', 'is', null)
    ]);

    if (reportsResult.error) {
      console.error('Error fetching reports:', reportsResult.error);
      throw reportsResult.error;
    }

    if (campaignsResult.error) {
      console.error('Error fetching campaigns:', campaignsResult.error);
      throw campaignsResult.error;
    }

    const totalSpend = campaignsResult.data?.reduce((sum, campaign) => sum + (campaign.spend || 0), 0) || 0;
    const activeClients = clients?.filter(client => client.api_status === 'valid').length || 0;

    const stats = {
      totalClients: clients?.length || 0,
      totalReports: reportsResult.count || 0,
      activeClients,
      totalSpend
    };

    console.log('Admin dashboard stats:', stats);
    return stats;
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    throw error;
  }
}

/**
 * Get reports with campaigns in optimized query
 */
export async function getReportsWithCampaigns(clientId: string, limit: number = 20) {
  try {
    // Get reports first
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*')
      .eq('client_id', clientId)
      .order('generated_at', { ascending: false })
      .limit(limit);

    if (reportsError) throw reportsError;

    if (!reports || reports.length === 0) {
      return [];
    }

    // Get all campaigns for this client (simplified approach)
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientId)
      .order('date_range_start', { ascending: false });

    if (campaignsError) throw campaignsError;

    // Group campaigns by date range
    const campaignsByDateRange = new Map<string, Campaign[]>();
    campaigns?.forEach(campaign => {
      const key = `${campaign.date_range_start}_${campaign.date_range_end}`;
      if (!campaignsByDateRange.has(key)) {
        campaignsByDateRange.set(key, []);
      }
      campaignsByDateRange.get(key)!.push(campaign);
    });

    // Match campaigns to reports
    return reports.map(report => {
      const key = `${report.date_range_start}_${report.date_range_end}`;
      return {
        ...report,
        campaigns: campaignsByDateRange.get(key) || []
      };
    });
  } catch (error) {
    console.error('Error fetching reports with campaigns:', error);
    throw error;
  }
}

/**
 * Cache for database queries
 */
const queryCache = new Map<string, { data: any; timestamp: number }>();
const QUERY_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export function getCachedQuery<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < QUERY_CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

export function setCachedQuery<T>(key: string, data: T): void {
  queryCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

export function clearQueryCache(pattern?: string): void {
  if (pattern) {
    for (const key of queryCache.keys()) {
      if (key.includes(pattern)) {
        queryCache.delete(key);
      }
    }
  } else {
    queryCache.clear();
  }
} 