'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  MousePointer, 
  DollarSign, 
  Target,
  Phone,
  Mail,
  Calendar,
  Users,
  BarChart3,
  PieChart,
  Activity,
  Zap
} from 'lucide-react';
import { UnifiedReport, UnifiedCampaign, PlatformTotals } from '../lib/unified-campaign-types';
import AIExecutiveSummary from './AIExecutiveSummary';

interface UnifiedReportViewProps {
  report: UnifiedReport;
  onDownloadPDF?: () => void;
  onViewDetails?: () => void;
  currency?: string;
  clientId?: string;
  clientName?: string;
}

interface PlatformSummaryProps {
  title: string;
  campaigns: UnifiedCampaign[];
  totals: PlatformTotals;
  currency: string;
  color: string;
  icon: React.ReactNode;
}

const PlatformSummary: React.FC<PlatformSummaryProps> = ({ 
  title, 
  campaigns, 
  totals, 
  currency, 
  color,
  icon 
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pl-PL').format(Math.round(num));
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  if (campaigns.length === 0) {
    return (
      <div className={`bg-gradient-to-br ${color} rounded-xl p-6 text-white`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {icon}
            <h3 className="text-xl font-bold">{title}</h3>
          </div>
          <div className="text-sm opacity-75">Brak danych</div>
        </div>
        <div className="text-center py-8 opacity-75">
          <p>Brak kampanii w tym okresie</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-6 text-white`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          {icon}
          <h3 className="text-xl font-bold">{title}</h3>
        </div>
        <div className="text-sm opacity-75">{campaigns.length} kampanii</div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm opacity-75">Wydano</span>
          </div>
          <div className="text-lg font-bold">{formatCurrency(totals.totalSpend)}</div>
        </div>

        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Eye className="w-4 h-4" />
            <span className="text-sm opacity-75">Wyświetlenia</span>
          </div>
          <div className="text-lg font-bold">{formatNumber(totals.totalImpressions)}</div>
        </div>

        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <MousePointer className="w-4 h-4" />
            <span className="text-sm opacity-75">Kliknięcia</span>
          </div>
          <div className="text-lg font-bold">{formatNumber(totals.totalClicks)}</div>
        </div>

        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-4 h-4" />
            <span className="text-sm opacity-75">CTR</span>
          </div>
          <div className="text-lg font-bold">{formatPercentage(totals.averageCtr)}</div>
        </div>
      </div>

      {/* Conversion Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Phone className="w-3 h-3" />
            <span className="text-xs opacity-75">Telefony</span>
          </div>
          <div className="text-sm font-semibold">{formatNumber(totals.totalClickToCalls + totals.totalPhoneCalls)}</div>
        </div>

        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Mail className="w-3 h-3" />
            <span className="text-xs opacity-75">Email</span>
          </div>
          <div className="text-sm font-semibold">{formatNumber(totals.totalEmailContacts)}</div>
        </div>

        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Calendar className="w-3 h-3" />
            <span className="text-xs opacity-75">Rezerwacje</span>
          </div>
          <div className="text-sm font-semibold">{formatNumber(totals.totalReservations)}</div>
        </div>

        <div className="bg-white/5 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <DollarSign className="w-3 h-3" />
            <span className="text-xs opacity-75">ROAS</span>
          </div>
          <div className="text-sm font-semibold">{totals.averageRoas.toFixed(2)}x</div>
        </div>
      </div>
    </div>
  );
};

const CombinedSummary: React.FC<{ totals: PlatformTotals; currency: string }> = ({ totals, currency }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pl-PL').format(Math.round(num));
  };

  return (
    <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-6 text-white mb-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Activity className="w-6 h-6" />
          <h3 className="text-xl font-bold">Podsumowanie Łączne</h3>
        </div>
        <div className="text-sm opacity-75">Meta + Google Ads</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{formatCurrency(totals.totalSpend)}</div>
          <div className="text-sm opacity-75">Łączne wydatki</div>
        </div>

        <div className="bg-white/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{formatNumber(totals.totalImpressions)}</div>
          <div className="text-sm opacity-75">Wyświetlenia</div>
        </div>

        <div className="bg-white/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{formatNumber(totals.totalClicks)}</div>
          <div className="text-sm opacity-75">Kliknięcia</div>
        </div>

        <div className="bg-white/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{totals.averageCtr.toFixed(2)}%</div>
          <div className="text-sm opacity-75">Średni CTR</div>
        </div>

        <div className="bg-white/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{formatNumber(totals.totalReservations)}</div>
          <div className="text-sm opacity-75">Rezerwacje</div>
        </div>

        <div className="bg-white/10 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{formatCurrency(totals.totalReservationValue)}</div>
          <div className="text-sm opacity-75">Wartość rezerwacji</div>
        </div>
      </div>
    </div>
  );
};

const CampaignTable: React.FC<{ 
  campaigns: UnifiedCampaign[]; 
  title: string; 
  currency: string;
  platformColor: string;
  platform?: 'meta' | 'google';
}> = ({ campaigns, title, currency, platformColor, platform = 'google' }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pl-PL').format(Math.round(num));
  };

  if (campaigns.length === 0) {
    return null;
  }

  // Use Polish full names for Meta, abbreviations for Google
  const ctrLabel = platform === 'meta' ? 'Współczynnik kliknięć' : 'CTR';
  const cpcLabel = platform === 'meta' ? 'Koszt kliknięcia' : 'CPC';

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <h3 className={`text-xl font-bold mb-4 ${platformColor}`}>{title}</h3>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-2">Kampania</th>
              <th className="text-right py-3 px-2">Wydano</th>
              <th className="text-right py-3 px-2">Wyświetlenia</th>
              <th className="text-right py-3 px-2">Kliknięcia</th>
              <th className="text-right py-3 px-2">{ctrLabel}</th>
              <th className="text-right py-3 px-2">{cpcLabel}</th>
              <th className="text-right py-3 px-2">Rezerwacje</th>
              <th className="text-right py-3 px-2">Wartość Rezerwacji</th>
              <th className="text-right py-3 px-2">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign, index) => (
              <tr key={campaign.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="py-3 px-2">
                  <div>
                    <div className="font-medium">{campaign.campaign_name}</div>
                    <div className="text-sm text-gray-500 capitalize">{campaign.status.toLowerCase()}</div>
                  </div>
                </td>
                <td className="text-right py-3 px-2 font-medium">{formatCurrency(campaign.spend)}</td>
                <td className="text-right py-3 px-2">{formatNumber(campaign.impressions)}</td>
                <td className="text-right py-3 px-2">{formatNumber(campaign.clicks)}</td>
                <td className="text-right py-3 px-2">{campaign.ctr.toFixed(2)}%</td>
                <td className="text-right py-3 px-2">{formatCurrency(campaign.cpc)}</td>
                <td className="text-right py-3 px-2">{formatNumber(campaign.reservations || 0)}</td>
                <td className="text-right py-3 px-2">{formatCurrency(campaign.reservation_value || 0)}</td>
                <td className="text-right py-3 px-2">{(campaign.roas || 0).toFixed(2)}x</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function UnifiedReportView({ 
  report, 
  onDownloadPDF, 
  onViewDetails, 
  currency = 'PLN',
  clientId,
  clientName
}: UnifiedReportViewProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('pl-PL')} - ${endDate.toLocaleDateString('pl-PL')}`;
  };

  const handleDownloadUnifiedPDF = async () => {
    if (!clientId) {
      console.error('Client ID is required for PDF generation');
      return;
    }

    setIsGeneratingPDF(true);

    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No session token available');
      }

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          clientId,
          dateRange: {
            start: report.date_range_start,
            end: report.date_range_end
          }
          // Platform will be auto-detected by PDF generation based on client configuration
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      // Download the PDF
      const blob = await response.blob();
      
      // Extract filename from Content-Disposition header or construct it
      let filename = '';
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
        }
      }
      
      // If header extraction failed, construct filename
      if (!filename) {
        // Format date range for filename (DD.MM.YYYY-DD.MM.YYYY)
        const formatDateForFilename = (dateString: string) => {
          const date = new Date(dateString);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          return `${day}.${month}.${year}`;
        };
        
        const startDate = formatDateForFilename(report.date_range_start);
        const endDate = formatDateForFilename(report.date_range_end);
        const okresRaportu = `${startDate}-${endDate}`;
        const sanitizedClientName = clientName?.replace(/[^\w\s-]/g, '').trim() || 'Klient';
        filename = `Raport Reklamowy PBM - ${sanitizedClientName} - ${okresRaportu}.pdf`;
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Unified PDF downloaded successfully');

    } catch (error) {
      console.error('❌ Error downloading unified PDF:', error);
      alert('Nie udało się pobrać raportu PDF. Spróbuj ponownie.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Raport Unified</h2>
            <p className="text-gray-600">{formatDateRange(report.date_range_start, report.date_range_end)}</p>
          </div>
          <div className="flex space-x-3">
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Szczegóły
              </button>
            )}
            <button
              onClick={handleDownloadUnifiedPDF}
              disabled={isGeneratingPDF}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isGeneratingPDF ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Generowanie...</span>
                </>
              ) : (
                <span>Pobierz PDF Unified</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Combined Summary */}
      <CombinedSummary totals={report.totals.combined} currency={currency} />

      {/* AI Executive Summary */}
      {clientId && clientName && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <AIExecutiveSummary
            clientId={clientId}
            dateRange={{
              start: report.date_range_start,
              end: report.date_range_end
            }}
            unifiedReport={report}
            clientName={clientName}
            isUnified={true}
            onSummaryGenerated={(summary) => {
              console.log('Unified AI summary generated:', summary);
            }}
          />
        </div>
      )}

      {/* Platform Summaries - Removed duplicate Google Ads cards as requested */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlatformSummary
          title="Meta Ads (Facebook)"
          campaigns={report.metaCampaigns}
          totals={report.totals.meta}
          currency={currency}
          color="from-blue-600 to-blue-700"
          icon={<Zap className="w-6 h-6" />}
        />
        
        {/* Google Ads Platform Summary removed - campaigns shown in table below */}
      </div>

      {/* Campaign Tables */}
      <CampaignTable
        campaigns={report.metaCampaigns}
        title="Kampanie Meta Ads"
        currency={currency}
        platformColor="text-blue-600"
        platform="meta"
      />

      <CampaignTable
        campaigns={report.googleCampaigns}
        title="Kampanie Google Ads"
        currency={currency}
        platformColor="text-green-600"
        platform="google"
      />

      {/* Performance Insights */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold mb-4">Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-2 text-blue-600">Meta Ads Performance</h4>
            <ul className="space-y-2 text-sm">
              <li>• {report.metaCampaigns.length} aktywnych kampanii</li>
              <li>• Średni CTR: {report.totals.meta.averageCtr.toFixed(2)}%</li>
              <li>• Łączne wydatki: {new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(report.totals.meta.totalSpend)}</li>
              <li>• Rezerwacje: {report.totals.meta.totalReservations}</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2 text-green-600">Google Ads Performance</h4>
            <ul className="space-y-2 text-sm">
              <li>• {report.googleCampaigns.length} aktywnych kampanii</li>
              <li>• Średni CTR: {report.totals.google.averageCtr.toFixed(2)}%</li>
              <li>• Łączne wydatki: {new Intl.NumberFormat('pl-PL', { style: 'currency', currency }).format(report.totals.google.totalSpend)}</li>
              <li>• Rezerwacje: {report.totals.google.totalReservations}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
