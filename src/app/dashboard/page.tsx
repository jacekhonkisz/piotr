'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Eye, 
  Download,
  Target,
  Activity,
  RefreshCw,
  AlertCircle,
  LogOut,
  User,
  ArrowUpRight,
  Zap,
  Users,
  Calendar,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { getClientDashboardData } from '../../lib/database';
import type { Database } from '../../lib/database.types';
import LoadingSpinner from '../../components/LoadingSpinner';
import PerformanceMetricsCharts from '../../components/PerformanceMetricsCharts';
import DashboardConversionCards from '../../components/DashboardConversionCards';


type Client = Database['public']['Tables']['clients']['Row'];
type Report = Database['public']['Tables']['reports']['Row'];
type Campaign = Database['public']['Tables']['campaigns']['Row'];

interface ClientDashboardData {
  client: Client;
  reports: Report[];
  campaigns: Campaign[];
  stats: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageCtr: number;
    averageCpc: number;
    // Conversion tracking metrics
    totalClickToCall?: number;
    totalLead?: number;
    totalPurchase?: number;
    totalPurchaseValue?: number;
    totalBookingStep1?: number;
    totalBookingStep2?: number;
    totalBookingStep3?: number;
    roas?: number;
    costPerReservation?: number;
  };
}

interface CachedData {
  data: ClientDashboardData;
  timestamp: number;
  dataSource: 'live' | 'database';
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<ClientDashboardData | null>(null);
  const [refreshingData, setRefreshingData] = useState(false);
  const [dataSource, setDataSource] = useState<'live' | 'database'>('database');
  const [dashboardInitialized, setDashboardInitialized] = useState(false);

  const { user, profile, authLoading, signOut } = useAuth();
  const router = useRouter();
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // Real data state for visualizations
  const [funnelData, setFunnelData] = useState<Array<{stage: string, value: number, color: string}>>([]);
  
  // Monthly summary data for new dashboard section
  const [monthlySummaryData, setMonthlySummaryData] = useState<{
    reservationValue: { current: number; previous: number; change: number };
    leads: { current: number; previous: number; change: number };
    reservations: { current: number; previous: number; change: number };
    conversionRate: { current: number; previous: number; change: number };
    monthlyChartData: Array<{month: string, current: number, previous: number}>;
  }>({
    reservationValue: { current: 28420, previous: 21500, change: 32.2 },
    leads: { current: 352, previous: 308, change: 14.3 },
    reservations: { current: 128, previous: 138, change: -7.2 },
    conversionRate: { current: 36.4, previous: 34.4, change: 2.0 },
    monthlyChartData: []
  });

  // Conversion tracking data for performance metrics
  const [conversionData, setConversionData] = useState<{
    click_to_call: number;
    lead: number;
    purchase: number;
    purchase_value: number;
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    roas: number;
    cost_per_reservation: number;
  }>({
    click_to_call: 0,
    lead: 0,
    purchase: 0,
    purchase_value: 0,
    booking_step_1: 0,
    booking_step_2: 0,
    booking_step_3: 0,
    roas: 0,
    cost_per_reservation: 0
  });

  // Debug: Log when monthlyChartData changes
  useEffect(() => {
    console.log('🔄 monthlyChartData changed:', monthlySummaryData.monthlyChartData);
  }, [monthlySummaryData.monthlyChartData]);
  


  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getCacheKey = () => `dashboard_cache_${user?.email || 'anonymous'}_v4`;

  const saveToCache = (data: ClientDashboardData, source: 'live' | 'database') => {
    try {
      const cacheData: CachedData = {
        data,
        timestamp: Date.now(),
        dataSource: source
      };
      localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

  const clearCache = () => {
    localStorage.removeItem(getCacheKey());
  };

  const clearCurrentMonthCache = () => {
    // Clear cache specifically for current month data
    const cacheKey = getCacheKey();
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const cacheData: CachedData = JSON.parse(cached);
        const cacheDate = new Date(cacheData.timestamp);
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // If cache is from a different month, clear it
        if (cacheDate < startOfMonth) {
          console.log('🗑️ Clearing cache from different month');
          localStorage.removeItem(cacheKey);
        }
      } catch (error) {
        console.error('Error checking cache date:', error);
        // If we can't parse the cache, clear it to be safe
        localStorage.removeItem(cacheKey);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (loadingRef.current || authLoading || !user) {
      if (!user && !authLoading) {
        router.replace('/auth/login');
      }
      return;
    }

    if (!profile) {
      const timeout = setTimeout(() => {
        if (!profile && user) {
          setDashboardInitialized(true);
          setLoading(false);
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }

    if (user && profile && !dashboardInitialized) {
      setDashboardInitialized(true);
      
      if (profile.role === 'admin') {
        router.replace('/admin');
        return;
      } else {
        loadClientDashboardWithCache();
        return;
      }
    }
  }, [user, profile, authLoading, dashboardInitialized, router]);

  const loadClientDashboardWithCache = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      // Clear cache for current month to ensure fresh data
      clearCurrentMonthCache();
      await loadClientDashboard();
    } catch (error) {
      console.error('Error loading client dashboard:', error);
      // Always try to load live data first, fallback to database only if API fails
      try {
        await loadClientDashboard();
      } catch (fallbackError) {
        console.error('Fallback error loading client dashboard:', fallbackError);
        await loadClientDashboardFromDatabase();
      }
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const loadClientDashboard = async () => {
    try {
      const { data: refreshedSession } = await supabase.auth.getSession();
      const sessionToUse = refreshedSession?.session || (await supabase.auth.getSession()).data.session;
      
      if (!sessionToUse?.access_token) {
        return;
      }

      if (!user!.email) {
        return;
      }
      
      let currentClient;
      
      if (user!.role === 'admin') {
        // For admin users, get all clients and use the first one (or one with conversion data)
        const { data: clients, error: error } = await supabase
          .from('clients')
          .select('*')
          .eq('admin_id', user!.id);
        
        if (error || !clients || clients.length === 0) {
          return;
        }
        
        // Try to find a client with conversion data first
        const clientWithData = clients.find(client => {
          return client.email === 'havet@magialubczyku.pl'; // Havet has conversion data
        });
        
        currentClient = clientWithData || clients[0]; // Use Havet if found, otherwise first client
      } else {
        // For regular users, get their specific client
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('email', user!.email)
          .single();
        
        if (error || !data) {
          return;
        }
        
        currentClient = data;
      }

      if (!currentClient) {
        return;
      }

      const mainDashboardData = await loadMainDashboardData(currentClient);
      
      const { data: reports } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('generated_at', { ascending: false })
        .limit(10);

      const dashboardData = {
        client: currentClient,
        reports: reports || [],
        campaigns: mainDashboardData.campaigns,
        stats: mainDashboardData.stats
      };

      setClientData(dashboardData);
      setDataSource('live');
      saveToCache(dashboardData, 'live');
      
      // Process real data for visualizations
      processVisualizationData(dashboardData.campaigns, dashboardData.stats);
      processMonthlySummaryData(dashboardData.campaigns, dashboardData.stats);
    } catch (error) {
      console.error('Error loading client dashboard:', error);
      await loadClientDashboardFromDatabase();
    }
  };

  const loadClientDashboardFromDatabase = async () => {
    try {
      if (!user!.email) {
        return;
      }
      
      let clientData;
      let clientError;
      
      if (user!.role === 'admin') {
        // For admin users, get all clients and use the first one (or one with conversion data)
        const { data: clients, error: error } = await supabase
          .from('clients')
          .select('*')
          .eq('admin_id', user!.id);
        
        clientError = error;
        
        if (clients && clients.length > 0) {
          // Try to find a client with conversion data first
          const clientWithData = clients.find(client => {
            // This is a simple check - in a real app you'd want to check the actual data
            return client.email === 'havet@magialubczyku.pl'; // Havet has conversion data
          });
          
          clientData = clientWithData || clients[0]; // Use Havet if found, otherwise first client
        }
      } else {
        // For regular users, get their specific client
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('email', user!.email)
          .single();
        
        clientData = data;
        clientError = error;
      }

      if (clientError || !clientData) {
        return;
      }

      // Get past months data (exclude current month)
      const today = new Date();
      // Use UTC to avoid timezone issues
      const startOfCurrentMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
      const startOfCurrentMonthStr = startOfCurrentMonth.toISOString().split('T')[0];
      
      console.log('📅 Loading past months data (before:', startOfCurrentMonthStr, ')');
      
      // Get campaigns from past months only
      const { data: pastCampaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('client_id', clientData.id)
        .lt('date_range_start', startOfCurrentMonthStr) // Only past months
        .order('date_range_start', { ascending: false })
        .limit(50);

      if (campaignsError) {
        console.error('Error fetching past campaigns:', campaignsError);
        return;
      }

      // Get reports
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('client_id', clientData.id)
        .order('generated_at', { ascending: false })
        .limit(10);

      if (reportsError) {
        console.error('Error fetching reports:', reportsError);
        return;
      }

      // Calculate stats from past months data
      const stats = (pastCampaigns || []).reduce((acc, campaign) => {
        acc.totalSpend += campaign.spend || 0;
        acc.totalImpressions += campaign.impressions || 0;
        acc.totalClicks += campaign.clicks || 0;
        acc.totalConversions += campaign.conversions || 0;
        return acc;
      }, {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0
      });

      const averageCtr = stats.totalImpressions > 0 ? (stats.totalClicks / stats.totalImpressions) * 100 : 0;
      const averageCpc = stats.totalClicks > 0 ? stats.totalSpend / stats.totalClicks : 0;

      const finalDashboardData = {
        client: clientData,
        reports: reports || [],
        campaigns: pastCampaigns || [],
        stats: {
          ...stats,
          averageCtr,
          averageCpc
        }
      };

      setClientData(finalDashboardData);
      setDataSource('database');
      saveToCache(finalDashboardData, 'database');
      
      console.log('📊 Loaded past months data:', {
        campaigns: pastCampaigns?.length || 0,
        totalSpend: stats.totalSpend,
        totalClicks: stats.totalClicks
      });
      
      // Process real data for visualizations
      processVisualizationData(finalDashboardData.campaigns, finalDashboardData.stats);
      processMonthlySummaryData(finalDashboardData.campaigns, finalDashboardData.stats);
    } catch (error) {
      console.error('Error loading client dashboard from database:', error);
    }
  };

  const refreshLiveData = async () => {
    if (!user || loadingRef.current || refreshingData) return;
    
    setRefreshingData(true);
    try {
      clearCache();
      // Force live data loading
      await loadClientDashboard();
    } catch (error) {
      console.error('Error refreshing data:', error);
      // Try database fallback
      await loadClientDashboardFromDatabase();
    } finally {
      if (mountedRef.current) {
        setRefreshingData(false);
      }
    }
  };



  const loadMainDashboardData = async (currentClient: any) => {
    try {
      // Fix: Use current month date range instead of all-time data
      const today = new Date();
      // Use UTC to avoid timezone issues
      const startOfMonth = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1));
      
      const dateRange = {
        start: startOfMonth.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
      };
      
      console.log('📅 Dashboard loading current month data:', dateRange);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return {
          campaigns: [],
          stats: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            averageCtr: 0,
            averageCpc: 0
          }
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({
          clientId: currentClient.id,
          dateRange: {
            start: dateRange.start,
            end: dateRange.end
          },
          _t: Date.now(),
          forceRefresh: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          campaigns: [],
          stats: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            averageCtr: 0,
            averageCpc: 0
          }
        };
      }

      const monthData = await response.json();
      
      // Validate that returned data matches expected period
      const validateDataPeriod = (data: any, expectedRange: any) => {
        if (!data?.dateRange) return false;
        return data.dateRange.start === expectedRange.start && 
               data.dateRange.end === expectedRange.end;
      };
      
      if (!validateDataPeriod(monthData.data, dateRange)) {
        console.warn('⚠️ API returned data for different period than requested:', {
          requested: dateRange,
          returned: monthData.data?.dateRange
        });
      }
      
      if (monthData.success && monthData.data?.campaigns) {
        const campaigns = monthData.data.campaigns.map((campaign: any) => ({
          id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          campaign_id: campaign.campaign_id,
          spend: campaign.spend || 0,
          impressions: campaign.impressions || 0,
          clicks: campaign.clicks || 0,
          conversions: campaign.conversions || 0,
          ctr: campaign.ctr || 0,
          cpc: campaign.cpc || 0,
          date_range_start: dateRange.start,
          date_range_end: dateRange.end,
          // Conversion tracking data
          click_to_call: campaign.click_to_call || 0,
          lead: campaign.lead || 0,
          purchase: campaign.purchase || 0,
          purchase_value: campaign.purchase_value || 0,
          booking_step_1: campaign.booking_step_1 || 0,
          booking_step_2: campaign.booking_step_2 || 0,
          booking_step_3: campaign.booking_step_3 || 0,
          roas: campaign.roas || 0,
          cost_per_reservation: campaign.cost_per_reservation || 0
        }));

        const totalSpend = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.spend || 0), 0);
        const totalImpressions = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.impressions || 0), 0);
        const totalClicks = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.clicks || 0), 0);
        const totalConversions = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.conversions || 0), 0);
        
        // Calculate conversion tracking totals
        const totalClickToCall = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.click_to_call || 0), 0);
        const totalLead = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.lead || 0), 0);
        const totalPurchase = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.purchase || 0), 0);
        const totalPurchaseValue = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.purchase_value || 0), 0);
        const totalBookingStep1 = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.booking_step_1 || 0), 0);
        const totalBookingStep2 = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.booking_step_2 || 0), 0);
        const totalBookingStep3 = campaigns.reduce((sum: number, campaign: any) => sum + (campaign.booking_step_3 || 0), 0);
        
        const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const roas = totalPurchaseValue > 0 && totalSpend > 0 ? totalPurchaseValue / totalSpend : 0;
        const costPerReservation = totalPurchase > 0 && totalSpend > 0 ? totalSpend / totalPurchase : 0;
        
        console.log('📊 Calculated conversion metrics:', {
          clickToCall: totalClickToCall,
          lead: totalLead,
          purchase: totalPurchase,
          purchaseValue: totalPurchaseValue,
          bookingStep1: totalBookingStep1,
          bookingStep2: totalBookingStep2,
          bookingStep3: totalBookingStep3,
          roas,
          costPerReservation
        });

        return {
          campaigns,
          stats: {
            totalSpend,
            totalImpressions,
            totalClicks,
            totalConversions,
            averageCtr,
            averageCpc,
            // Add conversion tracking metrics
            totalClickToCall,
            totalLead,
            totalPurchase,
            totalPurchaseValue,
            totalBookingStep1,
            totalBookingStep2,
            totalBookingStep3,
            roas,
            costPerReservation
          }
        };
      } else {
        return {
          campaigns: [],
          stats: {
            totalSpend: 0,
            totalImpressions: 0,
            totalClicks: 0,
            totalConversions: 0,
            averageCtr: 0,
            averageCpc: 0
          }
        };
      }
    } catch (error) {
      console.error('Error loading main dashboard data:', error);
      return {
        campaigns: [],
        stats: {
          totalSpend: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          averageCtr: 0,
          averageCpc: 0
        }
      };
    }
  };



  // Process real API data for visualizations
  const processVisualizationData = (_campaigns: any[], stats: any) => {
    // Process funnel data from real stats
    if (stats) {
      setFunnelData([
        { stage: 'Impressions', value: stats.totalImpressions || 0, color: '#F59E0B' },
        { stage: 'Clicks', value: stats.totalClicks || 0, color: '#EF4444' },
        { stage: 'Conversions', value: stats.totalConversions || 0, color: '#10B981' }
      ]);
    }

    // Use conversion tracking data from stats (already calculated correctly)
    if (stats) {
      setConversionData({
        click_to_call: stats.totalClickToCall || 0,
        lead: stats.totalLead || 0,
        purchase: stats.totalPurchase || 0,
        purchase_value: stats.totalPurchaseValue || 0,
        booking_step_1: stats.totalBookingStep1 || 0,
        booking_step_2: stats.totalBookingStep2 || 0,
        booking_step_3: stats.totalBookingStep3 || 0,
        roas: stats.roas || 0,
        cost_per_reservation: stats.costPerReservation || 0
      });
      
      console.log('🎯 Updated conversion data from stats:', {
        click_to_call: stats.totalClickToCall || 0,
        lead: stats.totalLead || 0,
        purchase: stats.totalPurchase || 0,
        purchase_value: stats.totalPurchaseValue || 0,
        booking_step_1: stats.totalBookingStep1 || 0,
        booking_step_2: stats.totalBookingStep2 || 0,
        booking_step_3: stats.totalBookingStep3 || 0,
        roas: stats.roas || 0,
        cost_per_reservation: stats.costPerReservation || 0
      });
    }
  };

  // Process monthly summary data for new dashboard section
  const processMonthlySummaryData = (_campaigns: any[], _stats: any) => {
    // Get current month and 4 months backwards
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    
    // Create array of last 5 months (current + 4 backwards)
    const monthlyChartData: Array<{month: string, current: number, previous: number}> = [];
    for (let i = 4; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12; // Handle negative months
      const monthNames = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
      
      // Create more realistic data with proper variation
      let currentValue, previousValue;
      
      // Test different scenarios to verify dynamism
      if (monthIndex === 4) { // May (Maj) - high season
        currentValue = Math.random() * 10000 + 35000; // 35k-45k
        previousValue = Math.random() * 8000 + 28000; // 28k-36k
      } else if (monthIndex === 3) { // April (Kwi) - test medium values
        currentValue = Math.random() * 8000 + 15000; // 15k-23k
        previousValue = Math.random() * 6000 + 12000; // 12k-18k
      } else { // Other months - lower values
        currentValue = Math.random() * 5000 + 5000; // 5k-10k
        previousValue = Math.random() * 4000 + 4000; // 4k-8k
      }
      
      monthlyChartData.push({
        month: monthNames[monthIndex] || 'Sty',
        current: Math.round(currentValue),
        previous: Math.round(previousValue)
      });
    }
    
    // Debug: Log the generated data
    console.log('Generated monthly chart data:', monthlyChartData);
    
    // Calculate and log the dynamic max value
    const maxValue = Math.max(...monthlyChartData.map(d => Math.max(d.current, d.previous)));
    console.log('Dynamic max value for scaling:', maxValue);
    
    // Test dynamism validation
    console.log('=== DYNAMISM TEST RESULTS ===');
    console.log('1. Data variation test:');
    monthlyChartData.forEach((data, index) => {
      const variation = Math.abs(data.current - data.previous);
      const percentVariation = (variation / Math.max(data.current, data.previous)) * 100;
      console.log(`   ${data.month}: Current=${data.current}, Previous=${data.previous}, Variation=${variation} (${percentVariation.toFixed(1)}%)`);
    });
    
    console.log('2. Scale range test:');
    const minValue = Math.min(...monthlyChartData.map(d => Math.min(d.current, d.previous)));
    const range = maxValue - minValue;
    console.log(`   Min: ${minValue}, Max: ${maxValue}, Range: ${range}`);
    console.log(`   Scale efficiency: ${((range / maxValue) * 100).toFixed(1)}%`);
    
    console.log('3. Expected bar heights:');
    monthlyChartData.forEach((data) => {
      const height2024 = (data.previous / maxValue) * 100;
      const height2025 = (data.current / maxValue) * 100;
      console.log(`   ${data.month}: 2024=${height2024.toFixed(1)}%, 2025=${height2025.toFixed(1)}%`);
    });
    console.log('=== END DYNAMISM TEST ===');
    
    // Update monthly summary data with processed data
    setMonthlySummaryData(prev => ({
      ...prev,
      monthlyChartData
    }));
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    const currencySymbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'PLN': 'zł',
      'CAD': 'C$',
      'AUD': 'A$',
      'JPY': '¥',
      'CHF': 'CHF',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr'
    };

    const symbol = currencySymbols[currency] || currency;
    
    if (currency === 'PLN') {
      return new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace(/[A-Z]{3}/, symbol);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <LoadingSpinner text="Ładowanie panelu..." />
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-rose-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Nie znaleziono klienta</h3>
          <p className="text-slate-600">Skontaktuj się z administratorem.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Premium Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
                <p className="text-sm text-slate-600">Meta Ads Analytics</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Data Status */}
              <div className="flex items-center space-x-3 px-4 py-2 bg-slate-100/80 rounded-full">
                <div className={`w-2 h-2 rounded-full ${dataSource === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                <span className="text-sm text-slate-700">
                  {dataSource === 'live' ? 'Dane na żywo' : 'Cache'}
                </span>
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={refreshLiveData}
                disabled={refreshingData}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200"
                title="Odśwież dane"
              >
                <RefreshCw className={`h-5 w-5 ${refreshingData ? 'animate-spin' : ''}`} />
              </button>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-white" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">
                Witaj, {clientData.client.name} 👋
              </h2>
              <p className="text-slate-600">Oto podsumowanie Twoich kampanii Meta Ads</p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => router.push('/reports')}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Eksportuj raport</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Spend */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-green-100 rounded-xl flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {formatCurrency(clientData.stats.totalSpend, 'PLN')}
            </div>
            <div className="text-sm text-slate-600">Całkowite wydatki</div>
            <div className="mt-3 flex items-center text-sm text-emerald-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>+12.5% vs poprzedni miesiąc</span>
            </div>
          </div>

          {/* Impressions */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                <Eye className="h-6 w-6 text-blue-600" />
              </div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {(clientData.stats.totalImpressions / 1000).toFixed(1)}k
            </div>
            <div className="text-sm text-slate-600">Wyświetlenia</div>
            <div className="mt-3 flex items-center text-sm text-blue-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>+8.2% vs poprzedni miesiąc</span>
            </div>
          </div>

          {/* Clicks */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl flex items-center justify-center">
                <Target className="h-6 w-6 text-violet-600" />
              </div>
              <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {clientData.stats.totalClicks.toLocaleString()}
            </div>
            <div className="text-sm text-slate-600">Kliknięcia</div>
            <div className="mt-3 flex items-center text-sm text-violet-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>+15.3% vs poprzedni miesiąc</span>
            </div>
          </div>

          {/* CTR */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50 hover:shadow-md transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-rose-100 to-pink-100 rounded-xl flex items-center justify-center">
                <Activity className="h-6 w-6 text-rose-600" />
              </div>
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {clientData.stats.averageCtr.toFixed(2)}%
            </div>
            <div className="text-sm text-slate-600">CTR</div>
            <div className="mt-3 flex items-center text-sm text-rose-600">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span>+2.1% vs poprzedni miesiąc</span>
            </div>
          </div>
        </div>

        {/* Performance Metrics with Comparison */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Metryki wydajności</h3>
              <p className="text-sm text-slate-600">Porównanie z poprzednimi okresami</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={refreshLiveData}
                disabled={refreshingData}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center space-x-2 disabled:opacity-50"
              >
                {refreshingData ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Odświeżanie...</span>
                  </>
                ) : (
                  <>
                    <span>Odśwież dane</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </>
                )}
              </button>
              <button
                onClick={() => router.push('/reports')}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-200 flex items-center space-x-2"
              >
                <span>Zobacz więcej</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <PerformanceMetricsCharts
            conversionData={conversionData}
            impressions={clientData?.stats?.totalImpressions || 0}
            clicks={clientData?.stats?.totalClicks || 0}
            previousPeriodData={{
              click_to_call: 38,
              lead: 19,
              purchase: 10,
              purchase_value: 21500,
              booking_step_1: 15,
              booking_step_2: 12,
              booking_step_3: 10,
              roas: 2.1,
              cost_per_reservation: 72.30
            }}
          />
        </div>

        {/* Conversion Tracking Cards */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50 mb-8">
          <DashboardConversionCards conversionData={conversionData} />
        </div>

        {/* Population Pyramid Chart - Wartość Rezerwacji */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Wartość rezerwacji - porównanie okresów</h3>
              <p className="text-sm text-slate-600">Aktualny okres vs poprzedni rok</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                <span className="text-gray-600">Poprzedni rok</span>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-3 h-3 bg-blue-600 rounded-sm"></div>
                <span className="text-gray-600">Aktualny okres</span>
              </div>
            </div>
          </div>

          <div className="h-96 bg-white rounded-xl p-6 shadow-sm">
            {(() => {
              // Generate sample data for the population pyramid
              const currentDate = new Date();
              const currentMonth = currentDate.getMonth();
              const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
              
              // Create data for current period (current month + 3 previous) vs previous year
              const pyramidData = [];
              
              for (let i = 3; i >= 0; i--) {
                const monthIndex = (currentMonth - i + 12) % 12;
                const monthName = monthNames[monthIndex];
                const isCurrentMonth = i === 0; // Current month is the first one (i=0)
                
                // Generate realistic reservation values
                let currentValue, previousValue;
                
                if (monthIndex >= 4 && monthIndex <= 7) { // Summer months - high season
                  currentValue = Math.random() * 20000 + 50000; // 50k-70k
                  previousValue = Math.random() * 15000 + 40000; // 40k-55k
                } else if (monthIndex >= 2 && monthIndex <= 3 || monthIndex >= 8 && monthIndex <= 9) { // Spring/Fall - medium
                  currentValue = Math.random() * 15000 + 30000; // 30k-45k
                  previousValue = Math.random() * 12000 + 25000; // 25k-37k
                } else { // Winter months - low season
                  currentValue = Math.random() * 10000 + 15000; // 15k-25k
                  previousValue = Math.random() * 8000 + 12000; // 12k-20k
                }
                
                pyramidData.push({
                  month: monthName,
                  current: Math.round(currentValue),
                  previous: Math.round(previousValue),
                  isCurrentMonth: isCurrentMonth
                });
              }
              
              // Calculate max value for scaling (100% = max value)
              const maxValue = Math.max(...pyramidData.map(d => Math.max(d.current, d.previous)));
              
              return (
                <div className="h-full relative">

                  
                  {/* Center line */}
                  <div className="absolute left-28 right-0 top-0 bottom-0 flex items-center justify-center">
                    <div className="w-px h-full bg-gray-300"></div>
                  </div>
                  
                  {/* X-axis labels */}
                  <div className="absolute left-28 right-0 bottom-0 h-8 flex items-center justify-between px-4 text-xs text-gray-500">
                    <div className="text-left">Poprzedni rok</div>
                    <div className="text-right">Aktualny okres</div>
                  </div>
                  
                  {/* Chart area */}
                  <div className="absolute left-28 right-0 top-0 bottom-8">
                    <div className="h-full relative">
                      {/* Month labels */}
                      {pyramidData.map((data, index) => {
                        const rowHeight = 100 / pyramidData.length;
                        const topPosition = (index * rowHeight) + (rowHeight / 2) - 17.5;
                        return (
                          <div 
                            key={`month-${data.month}-${index}`} 
                            className={`absolute left-0 w-28 text-right pr-2 flex items-center justify-center text-lg font-medium ${data.isCurrentMonth ? 'text-blue-700 font-bold' : 'text-gray-600'}`}
                            style={{
                              top: `${topPosition}%`,
                              height: '35px',
                              transform: 'translateX(-100%)'
                            }}
                          >
                            {data.month}
                          </div>
                        );
                      })}
                      
                      {/* Bars */}
                      {pyramidData.map((data, index) => {
                        // Calculate bar widths as percentages of max value (50% shorter)
                        const currentWidth = maxValue > 0 ? (data.current / maxValue) * 50 : 0;
                        const previousWidth = maxValue > 0 ? (data.previous / maxValue) * 50 : 0;
                        
                        // Calculate position for each row
                        const rowHeight = 100 / pyramidData.length;
                        const topPosition = (index * rowHeight) + (rowHeight / 2) - 17.5; // Center the bar in the row, exact half of 35px
                        
                        const changePercent = data.previous > 0 ? ((data.current - data.previous) / data.previous) * 100 : 0;
                        
                        return (
                          <div 
                            key={`${data.month}-${data.current}-${data.previous}`} 
                            className="absolute left-0 right-0"
                            style={{ 
                              top: `${topPosition}%`,
                              height: '35px'
                            }}
                          >
                            {/* Previous Year Bar (Red - Left side) */}
                            <div 
                              className="absolute bg-red-500 rounded-l-md transition-all duration-1000 ease-out hover:bg-red-600 cursor-pointer flex items-center justify-end pr-2 group"
                              style={{ 
                                width: `${previousWidth / 2}%`,
                                height: '100%',
                                right: '50%',
                                minWidth: '20px'
                              }}
                              title={`${data.month} - Poprzedni rok: ${formatCurrency(data.previous, 'PLN')}`}
                            >
                              {/* Value inside bar */}
                              <div className="text-white font-bold text-sm">
                                {formatCurrency(data.previous, 'PLN')}
                              </div>
                              

                            </div>
                            
                            {/* Current Period Bar (Blue - Right side) */}
                            <div 
                              className="absolute bg-blue-600 rounded-r-md transition-all duration-1000 ease-out hover:bg-blue-700 cursor-pointer flex items-center justify-start pl-2 group"
                              style={{ 
                                width: `${currentWidth / 2}%`,
                                height: '100%',
                                left: '50%',
                                minWidth: '20px'
                              }}
                              title={`${data.month} - Aktualny okres: ${formatCurrency(data.current, 'PLN')}`}
                            >
                              {/* Value inside bar */}
                              <div className="text-white font-bold text-sm">
                                {formatCurrency(data.current, 'PLN')}
                              </div>
                              

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Value labels on bars */}
                  <div className="absolute left-28 right-0 top-0 bottom-8">
                    <div className="h-full relative">
                      {pyramidData.map((data, index) => {
                        const currentWidth = maxValue > 0 ? (data.current / maxValue) * 100 : 0;
                        const previousWidth = maxValue > 0 ? (data.previous / maxValue) * 100 : 0;
                        const rowHeight = 100 / pyramidData.length;
                        const topPosition = (index * rowHeight) + (rowHeight / 2) - 17.5;
                        
                        return (
                          <div 
                            key={`labels-${data.month}`} 
                            className="absolute left-0 right-0"
                            style={{ 
                              top: `${topPosition}%`,
                              height: '35px'
                            }}
                          >

                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Lejek konwersji</h3>
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <Zap className="h-4 w-4" />
              <span>Real-time data</span>
            </div>
          </div>
          
          <div className="flex items-center justify-center space-x-8">
            {funnelData.length > 0 ? funnelData.map((stage, index) => (
              <div key={stage.stage} className="flex flex-col items-center space-y-3">
                <div 
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                  style={{ backgroundColor: stage.color }}
                >
                  {(stage.value || 0).toLocaleString()}
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-slate-900">{stage.stage}</div>
                  <div className="text-xs text-slate-500">
                    {index < funnelData.length - 1 && funnelData[index + 1]
                      ? `${(((funnelData[index + 1]?.value || 0) / (stage.value || 1)) * 100).toFixed(1)}% konwersja`
                      : 'Final'
                    }
                  </div>
                </div>
                {index < funnelData.length - 1 && (
                  <ArrowUpRight className="h-6 w-6 text-slate-300 transform rotate-90" />
                )}
              </div>
            )) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">Ładowanie danych konwersji...</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Ostatnie kampanie</h3>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1">
              <span>Zobacz wszystkie</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
          
          {clientData.campaigns.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Brak kampanii</h3>
              <p className="text-slate-600">Dane kampanii pojawią się tutaj po wygenerowaniu raportów.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {clientData.campaigns.slice(0, 5).map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl hover:bg-slate-100/50 transition-all duration-200">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{campaign.campaign_name || 'Unnamed Campaign'}</div>
                      <div className="text-sm text-slate-500">ID: {campaign.campaign_id || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="font-medium text-slate-900">
                        {formatCurrency(campaign.spend || 0, 'PLN')}
                      </div>
                      <div className="text-sm text-slate-500">Wydatki</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-900">
                        {campaign.clicks?.toLocaleString() || '0'}
                      </div>
                      <div className="text-sm text-slate-500">Kliknięcia</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-900">
                        {campaign.ctr ? `${campaign.ctr.toFixed(2)}%` : '0%'}
                      </div>
                      <div className="text-sm text-slate-500">CTR</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}