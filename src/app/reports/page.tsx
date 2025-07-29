'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabase';

interface Campaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpp?: number;
  frequency?: number;
  reach?: number;
  date_range_start: string;
  date_range_end: string;
}

interface MonthlyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at: string;
  campaigns: Campaign[];
}

interface Client {
  id: string;
  name: string;
  email: string;
  ad_account_id: string;
  meta_token?: string;
}

// Loading Component
const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-50 p-6">
    <div className="max-w-7xl mx-auto">
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Ładowanie...</p>
      </div>
    </div>
  </div>
);

// Main Reports Component
function ReportsPageContent() {
  const router = useRouter();
  const [reports, setReports] = useState<{ [key: string]: MonthlyReport }>({});
  const [loading, setLoading] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Get current user session
  const getCurrentUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return session?.user || null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  };

  // Generate month ID for a given date
  const generateMonthId = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  // Generate month options (last 2 years)
  const generateMonthOptions = () => {
    const months: string[] = [];
    const currentDate = new Date();
    const twoYearsAgo = new Date(currentDate.getFullYear() - 2, 0, 1);
    
    let currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    while (currentMonth >= twoYearsAgo) {
      months.push(generateMonthId(currentMonth));
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    }
    
    return months;
  };

  // Load data for a specific month
  const loadMonthData = async (monthId: string) => {
    try {
      setLoadingMonth(monthId);
      console.log(`📡 Loading data for month: ${monthId}`);
      
      // Get session for API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No access token available');
      }

      // Parse month ID to get start and end dates
      const [year, month] = monthId.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const monthStartDate = startDate.toISOString().split('T')[0];
      const monthEndDate = endDate.toISOString().split('T')[0];
      
      console.log(`📅 Fetching ${monthStartDate} to ${monthEndDate}...`);
      
      // Make API call for this specific month
      const response = await fetch('/api/fetch-live-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          dateRange: {
            start: monthStartDate,
            end: monthEndDate
          }
        })
      });

      if (!response.ok) {
        console.warn(`⚠️ API call failed for ${monthId}: ${response.status}`);
        // Add empty month if API fails
        const emptyReport: MonthlyReport = {
          id: monthId,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          generated_at: new Date().toISOString(),
          campaigns: []
        };
        setReports(prev => ({ ...prev, [monthId]: emptyReport }));
        return;
      }

      const monthData = await response.json();
      
      if (monthData.success && monthData.data?.campaigns) {
        const liveCampaigns: Campaign[] = monthData.data.campaigns.map((campaign: any) => ({
          id: `${campaign.campaign_id}-${monthId}`,
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          spend: campaign.spend || 0,
          impressions: campaign.impressions || 0,
          clicks: campaign.clicks || 0,
          conversions: campaign.conversions || 0,
          ctr: campaign.ctr || 0,
          cpc: campaign.cpc || 0,
          cpp: campaign.cpp,
          frequency: campaign.frequency,
          reach: campaign.reach,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate
        }));

        console.log(`✅ ${liveCampaigns.length} campaigns found for ${monthId}`);

        const report: MonthlyReport = {
          id: monthId,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          generated_at: new Date().toISOString(),
          campaigns: liveCampaigns
        };

        setReports(prev => ({ ...prev, [monthId]: report }));
      } else {
        console.log(`📊 No campaigns found for ${monthId}`);
        // Add empty month if no data
        const emptyReport: MonthlyReport = {
          id: monthId,
          date_range_start: monthStartDate,
          date_range_end: monthEndDate,
          generated_at: new Date().toISOString(),
          campaigns: []
        };
        setReports(prev => ({ ...prev, [monthId]: emptyReport }));
      }

    } catch (error: any) {
      console.error(`❌ Error loading data for ${monthId}:`, error);
      setError(`Failed to load data for ${monthId}: ${error.message}`);
    } finally {
      setLoadingMonth(null);
    }
  };

  // Initialize page with current month
  const initializePage = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🚀 Initializing reports page...');
      
      // Get current user
      const user = await getCurrentUser();
      if (!user) {
        console.log('No user found, redirecting to login');
        router.push('/auth/login');
        return;
      }

      console.log('✅ User found:', user.email);

      // Get client data
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('email', user.email || '')
        .single();

      if (clientError || !clientData) {
        throw new Error('Client not found in database');
      }

      console.log('✅ Client found:', clientData.name);
      setClient(clientData);

      // Generate available months
      const months = generateMonthOptions();
      setAvailableMonths(months);
      console.log(`📅 Generated ${months.length} month options`);

      // Set current month as selected
      const currentMonthId = generateMonthId(new Date());
      setSelectedMonth(currentMonthId);
      console.log(`📅 Current month: ${currentMonthId}`);

      // Load current month data
      await loadMonthData(currentMonthId);

    } catch (error: any) {
      console.error('❌ Error initializing page:', error);
      setError(error.message || 'Failed to initialize page');
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    initializePage();
  }, []);

  // Handle month selection
  const handleMonthChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedMonthId = event.target.value;
    setSelectedMonth(selectedMonthId);
    
    // Load month data if not already loaded
    if (!reports[selectedMonthId]) {
      await loadMonthData(selectedMonthId);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    if (selectedMonth) {
      await loadMonthData(selectedMonth);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Calculate totals for selected month
  const getSelectedMonthTotals = () => {
    if (!selectedMonth || !reports[selectedMonth]) return null;
    
    const selectedReport = reports[selectedMonth];
    const totals = selectedReport.campaigns.reduce((acc, campaign) => ({
      spend: acc.spend + campaign.spend,
      impressions: acc.impressions + campaign.impressions,
      clicks: acc.clicks + campaign.clicks,
      conversions: acc.conversions + campaign.conversions
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0 });

    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0
    };
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-red-600 text-xl mb-4">❌ Błąd</div>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Spróbuj ponownie
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedMonth || !reports[selectedMonth]) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-gray-600 text-xl mb-4">📊 Brak danych</div>
            <p className="text-gray-600 mb-4">Nie znaleziono danych dla wybranego miesiąca.</p>
            <button
              onClick={handleRefresh}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Odśwież
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedReport = reports[selectedMonth];
  const totals = getSelectedMonthTotals();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-blue-600">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Raporty Miesięczne</h1>
                <p className="text-gray-600">{client?.name} - Rzeczywiste dane z Meta API</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Month Selector */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Miesiąc:</label>
                <select
                  value={selectedMonth || ''}
                  onChange={handleMonthChange}
                  disabled={loadingMonth !== null}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {availableMonths.map((monthId) => {
                    const [year, month] = monthId.split('-').map(Number);
                    const date = new Date(year, month - 1, 1);
                    return (
                      <option key={monthId} value={monthId}>
                        {formatDate(date.toISOString())}
                      </option>
                    );
                  })}
                </select>
                {loadingMonth && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={loadingMonth !== null}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Odśwież</span>
              </button>

              {/* Back to Dashboard */}
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                Powrót do Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Live Data Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-blue-800 font-medium">Dane w czasie rzeczywistym z Meta API</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Primary KPIs */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Główne wskaźniki - {formatDate(selectedReport.date_range_start)}
              </h2>
              
              {totals && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {totals.spend.toFixed(2)} zł
                    </div>
                    <div className="text-sm text-gray-600">Wydatki</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {totals.impressions.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Wyświetlenia</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {totals.clicks.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Kliknięcia</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {totals.conversions.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Konwersje</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Secondary KPIs */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Wskaźniki wydajności</h3>
              
              {totals && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-600">CTR</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {totals.ctr.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">CPC</div>
                    <div className="text-xl font-semibold text-gray-900">
                      {totals.cpc.toFixed(2)} zł
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Campaigns List */}
        <div className="mt-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Kampanie - {formatDate(selectedReport.date_range_start)}
            </h3>
            
            {selectedReport.campaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kampania
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Wydatki
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Wyświetlenia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kliknięcia
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CTR
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CPC
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedReport.campaigns.map((campaign) => (
                      <tr key={campaign.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {campaign.campaign_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {campaign.spend.toFixed(2)} zł
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {campaign.impressions.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {campaign.clicks.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {campaign.ctr.toFixed(2)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {campaign.cpc.toFixed(2)} zł
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">📊</div>
                <p className="text-gray-600">Brak kampanii w tym miesiącu</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export with dynamic import to prevent SSR
const ReportsPage = dynamic(() => Promise.resolve(ReportsPageContent), {
  ssr: false,
  loading: () => <LoadingScreen />
});

export default ReportsPage; 