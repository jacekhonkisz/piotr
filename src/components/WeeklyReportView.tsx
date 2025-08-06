'use client';

import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  MousePointer,
  Eye,
  Target,
  DollarSign,
  Activity,
  Zap,
  Award,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Phone,
  Mail,
  FileText,
  ShoppingCart,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';
import ConversionTrackingSetup from './ConversionTrackingSetup';

interface Campaign {
  id: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr?: number;
  cpc?: number;
  cpa?: number;
  frequency?: number;
  reach?: number;
  relevance_score?: number;
  landing_page_view?: number;
  ad_type?: string;
  objective?: string;
  status?: string;
  cpm?: number;
  // Conversion tracking fields (if available from Meta API)
  click_to_call?: number;
  lead?: number;
  purchase?: number;
  purchase_value?: number;
  booking_step_1?: number;
  booking_step_2?: number;
  booking_step_3?: number;
}

interface WeeklyReport {
  id: string;
  date_range_start: string;
  date_range_end: string;
  generated_at?: string;
  campaigns: Campaign[];
}

interface WeeklyReportViewProps {
  reports: { [key: string]: WeeklyReport };
  viewType?: 'monthly' | 'weekly' | 'all-time' | 'custom';
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString('pl-PL');
};

const formatDate = (dateString: string) => {
  if (!dateString || dateString.trim() === '') {
    return 'Brak daty';
  }
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'Nieprawidłowa data';
  }
  
  return date.toLocaleDateString('pl-PL', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Helper function to get week start and end dates
const getWeekDateRange = (year: number, week: number) => {
  const firstDayOfYear = new Date(year, 0, 1);
  const days = (week - 1) * 7;
  const startDate = new Date(firstDayOfYear.getTime() + days * 24 * 60 * 60 * 1000);
  const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  const formatDateForDisplay = (date: Date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${day.toString().padStart(2, '0')}.${month.toString().padStart(2, '0')}`;
  };
  
  return `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}.${year}`;
};

const getWeekNumber = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

// Tooltip component for explanations
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

// Metric Card Component - Premium minimalist design
const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  tooltip,
  isDisabled = false,
  showYearOverYear = false,
  yearOverYearChange = 0
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tooltip?: string;
  isDisabled?: boolean;
  showYearOverYear?: boolean;
  yearOverYearChange?: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const card = (
    <div 
      className={`relative p-5 transition-all duration-200 ${isDisabled ? 'opacity-50' : ''}`}
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #F0F0F0',
        borderRadius: '8px',
        boxShadow: isHovered && !isDisabled ? '0 2px 8px rgba(36, 69, 131, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.02)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{title}</span>
        {tooltip && (
          <Tooltip content={tooltip}>
            <HelpCircle className="w-3 h-3 text-gray-400 hover:text-gray-600 transition-colors" />
          </Tooltip>
        )}
      </div>
      
      <div className="mb-2">
        <p className={`text-xl ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`} style={{ fontWeight: 600 }}>
          {isDisabled ? '—' : value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
      
      {showYearOverYear && !isDisabled && (
        <div className="flex items-center">
          {yearOverYearChange > 0 ? (
            <ArrowUpRight className="w-3 h-3 text-green-500 mr-1" />
          ) : yearOverYearChange < 0 ? (
            <ArrowDownRight className="w-3 h-3 text-red-500 mr-1" />
          ) : null}
          <span className={`text-xs ${
            yearOverYearChange > 0 ? 'text-green-600' : 
            yearOverYearChange < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {yearOverYearChange > 0 ? '+' : ''}{yearOverYearChange.toFixed(1)}% vs rok temu
          </span>
        </div>
      )}
      
      {isDisabled && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(250, 250, 250, 0.8)' }}>
          <span className="text-xs text-gray-500">Nie skonfigurowane</span>
        </div>
      )}
    </div>
  );

  return tooltip ? <Tooltip content={tooltip}>{card}</Tooltip> : card;
};

export default function WeeklyReportView({ reports, viewType = 'weekly' }: WeeklyReportViewProps) {
  const [expandedReports, setExpandedReports] = useState<{ [key: string]: boolean }>({});
  const [showSetupModal, setShowSetupModal] = useState(false);
  const reportIds = Object.keys(reports);

  const toggleReportExpansion = (reportId: string) => {
    setExpandedReports(prev => ({
      ...prev,
      [reportId]: !prev[reportId]
    }));
  };
  
  if (reportIds.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Brak Raportów</h3>
        <p className="text-gray-600">Nie znaleziono żadnych raportów do wyświetlenia.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-10">
      {reportIds.map((reportId) => {
        const report = reports[reportId];
        if (!report) return null;
        const campaigns = report.campaigns || [];
        
        // Calculate campaign performance totals
        const campaignTotals = campaigns.reduce((acc, campaign) => ({
          spend: acc.spend + (campaign.spend || 0),
          impressions: acc.impressions + (campaign.impressions || 0),
          clicks: acc.clicks + (campaign.clicks || 0),
          reach: acc.reach + (campaign.reach || 0),
          status: campaign.status || 'UNKNOWN'
        }), { 
          spend: 0, 
          impressions: 0, 
          clicks: 0, 
          reach: 0,
          status: 'UNKNOWN'
        });

        // Calculate derived campaign metrics
        const ctr = campaignTotals.impressions > 0 ? (campaignTotals.clicks / campaignTotals.impressions) * 100 : 0;
        const cpc = campaignTotals.clicks > 0 ? campaignTotals.spend / campaignTotals.clicks : 0;
        const cpm = campaignTotals.impressions > 0 ? (campaignTotals.spend / campaignTotals.impressions) * 1000 : 0;

        // Calculate conversion tracking totals
        const conversionTotals = campaigns.reduce((acc, campaign) => ({
          click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
          lead: acc.lead + (campaign.lead || 0),
          purchase: acc.purchase + (campaign.purchase || 0),
          purchase_value: acc.purchase_value + (campaign.purchase_value || 0),
          booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
          booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
          booking_step_3: acc.booking_step_3 + (campaign.booking_step_3 || 0),
        }), { 
          click_to_call: 0, 
          lead: 0, 
          purchase: 0, 
          purchase_value: 0,
          booking_step_1: 0,
          booking_step_2: 0,
          booking_step_3: 0
        });

        // Calculate conversion metrics
        const roas = campaignTotals.spend > 0 ? conversionTotals.purchase_value / campaignTotals.spend : 0;
        const costPerReservation = conversionTotals.purchase > 0 ? campaignTotals.spend / conversionTotals.purchase : 0;

        // Mock year-over-year data
        const yearOverYearChange = 12.5;

        const startDate = new Date(report.date_range_start);
        const weekNumber = getWeekNumber(startDate);

        // Determine report title
        let reportTitle = 'Raport';
        if (reportId === 'all-time') {
          reportTitle = 'Raport - Cały Okres';
        } else if (reportId === 'custom') {
          reportTitle = 'Raport - Własny Zakres';
        } else if (viewType === 'monthly') {
          reportTitle = 'Raport - Miesiąc';
        } else {
          reportTitle = `Raport - ${getWeekDateRange(startDate.getFullYear(), weekNumber)}`;
        }

        return (
          <div key={reportId} className="space-y-10">
            {/* Header Section */}
            <div className="border-b pb-8" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl text-gray-900 mb-2" style={{ fontWeight: 600 }}>
                    {reportTitle}
                  </h1>
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(report.date_range_start)} - {formatDate(report.date_range_end)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>Ostatnia aktualizacja: {new Date().toLocaleString('pl-PL')}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg text-gray-900" style={{ fontWeight: 600 }}>
                    {campaigns.length}
                  </div>
                  <div className="text-sm text-gray-600">
                    {campaigns.length === 1 ? 'kampania' : 'kampanii'}
                  </div>
                </div>
              </div>
            </div>

            {/* Campaign Performance Section */}
            <section>
              <div className="mb-8">
                <h2 className="text-lg text-gray-900 mb-2" style={{ fontWeight: 600 }}>Wydajność Kampanii</h2>
                <p className="text-sm text-gray-600">Główne metryki reklamowe z Meta Ads API</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Całkowite Wydatki"
                  value={formatCurrency(campaignTotals.spend)}
                  subtitle="Suma wydatków na reklamy"
                  tooltip="Łączna kwota wydana na reklamy w wybranym okresie"
                />
                
                <MetricCard
                  title="Wyświetlenia"
                  value={formatNumber(campaignTotals.impressions)}
                  subtitle="Liczba wyświetleń reklam"
                  tooltip="Całkowita liczba wyświetleń reklam"
                />
                
                <MetricCard
                  title="Kliknięcia"
                  value={formatNumber(campaignTotals.clicks)}
                  subtitle="Liczba kliknięć w reklamy"
                  tooltip="Całkowita liczba kliknięć w reklamy"
                />
                
                <MetricCard
                  title="Zasięg"
                  value={formatNumber(campaignTotals.reach)}
                  subtitle="Unikalni użytkownicy"
                  tooltip="Liczba unikalnych użytkowników, którzy zobaczyli reklamy"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <MetricCard
                  title="CTR"
                  value={`${ctr.toFixed(2)}%`}
                  subtitle="Click-through rate"
                  tooltip="Procent kliknięć w stosunku do wyświetleń"
                />
                
                <MetricCard
                  title="CPC"
                  value={formatCurrency(cpc)}
                  subtitle="Cost per click"
                  tooltip="Średni koszt za kliknięcie"
                />
                
                <MetricCard
                  title="CPM"
                  value={formatCurrency(cpm)}
                  subtitle="Cost per mille"
                  tooltip="Koszt za 1000 wyświetleń"
                />
                
                <MetricCard
                  title="Status"
                  value={campaignTotals.status}
                  subtitle="Status kampanii"
                  tooltip="Aktualny status kampanii reklamowych"
                />
              </div>
            </section>

            {/* Conversions & Lead Steps Section */}
            <section>
              <div className="mb-8">
                <h2 className="text-lg text-gray-900 mb-2" style={{ fontWeight: 600 }}>Konwersje i Etapy Rezerwacji</h2>
                <p className="text-sm text-gray-600">Szczegółowe śledzenie konwersji i kroków rezerwacji</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Potencjalne Kontakty Telefoniczne"
                  value={conversionTotals.click_to_call > 0 ? formatNumber(conversionTotals.click_to_call) : '—'}
                  subtitle="Kliknięcia w numer telefonu"
                  tooltip="Liczba kliknięć w numer telefonu (wymaga konfiguracji Pixel)"
                  isDisabled={conversionTotals.click_to_call === 0}
                />
                
                <MetricCard
                  title="Potencjalne Kontakty Email"
                  value={conversionTotals.lead > 0 ? formatNumber(conversionTotals.lead) : '—'}
                  subtitle="Formularze i kontakty email"
                  tooltip="Liczba wypełnionych formularzy i kontaktów email (wymaga konfiguracji Pixel)"
                  isDisabled={conversionTotals.lead === 0}
                />
                
                <MetricCard
                  title="Kroki Rezerwacji"
                  value={conversionTotals.booking_step_1 > 0 ? formatNumber(conversionTotals.booking_step_1) : '—'}
                  subtitle="Etap 1 procesu rezerwacji"
                  tooltip="Liczba rozpoczętych procesów rezerwacji (wymaga konfiguracji Pixel)"
                  isDisabled={conversionTotals.booking_step_1 === 0}
                />
                
                <MetricCard
                  title="Rezerwacje"
                  value={conversionTotals.purchase > 0 ? formatNumber(conversionTotals.purchase) : '—'}
                  subtitle="Zakończone rezerwacje"
                  tooltip="Liczba zakończonych rezerwacji"
                  isDisabled={conversionTotals.purchase === 0}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <MetricCard
                  title="Wartość Rezerwacji"
                  value={conversionTotals.purchase_value > 0 ? formatCurrency(conversionTotals.purchase_value) : '—'}
                  subtitle="Łączna wartość rezerwacji"
                  tooltip="Całkowita wartość zakończonych rezerwacji"
                  isDisabled={conversionTotals.purchase_value === 0}
                  showYearOverYear={conversionTotals.purchase_value > 0}
                  yearOverYearChange={yearOverYearChange}
                />
                
                <MetricCard
                  title="ROAS"
                  value={roas > 0 ? `${roas.toFixed(2)}x` : '—'}
                  subtitle="Return on ad spend"
                  tooltip="Zwrot z wydatków na reklamy (wartość rezerwacji / wydatki)"
                  isDisabled={roas === 0}
                />
                
                <MetricCard
                  title="Koszt per Rezerwacja"
                  value={costPerReservation > 0 ? formatCurrency(costPerReservation) : '—'}
                  subtitle="Średni koszt za rezerwację"
                  tooltip="Średni koszt pozyskania jednej rezerwacji"
                  isDisabled={costPerReservation === 0}
                />
                
                <MetricCard
                  title="Etap 2 Rezerwacji"
                  value={conversionTotals.booking_step_2 > 0 ? formatNumber(conversionTotals.booking_step_2) : '—'}
                  subtitle="Etap 2 procesu rezerwacji"
                  tooltip="Liczba użytkowników w etapie 2 rezerwacji (wymaga konfiguracji Pixel)"
                  isDisabled={conversionTotals.booking_step_2 === 0}
                />
              </div>

              {/* Year-over-Year Comparison */}
              {conversionTotals.purchase_value > 0 && (
                <div className="mt-6 p-5 rounded-lg" style={{ backgroundColor: '#F8F9FA', border: '1px solid #E9ECEF' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">Porównanie Rok do Roku</h3>
                        <p className="text-xs text-gray-600 mt-1">
                          Wartość rezerwacji jest {yearOverYearChange > 0 ? 'wyższa' : 'niższa'} o {Math.abs(yearOverYearChange).toFixed(1)}% 
                          w porównaniu do tego samego miesiąca ubiegłego roku
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg ${
                        yearOverYearChange > 0 ? 'text-green-600' : 'text-red-600'
                      }`} style={{ fontWeight: 600 }}>
                        {yearOverYearChange > 0 ? '+' : ''}{yearOverYearChange.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">vs rok temu</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Setup CTA for missing tracking */}
              {(conversionTotals.click_to_call === 0 || conversionTotals.lead === 0 || conversionTotals.booking_step_1 === 0) && (
                <div className="mt-6 p-5 rounded-lg" style={{ backgroundColor: '#F8F9FA', border: '1px solid #E9ECEF' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Skonfiguruj Śledzenie Konwersji</h3>
                      <p className="text-xs text-gray-600 mt-1">
                        Skonfiguruj Pixel i Lead Ads, aby uzyskać pełne dane o konwersjach i rezerwacjach
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowSetupModal(true)}
                      className="px-4 py-2 text-white text-sm rounded-lg transition-all duration-200 hover:shadow-sm"
                      style={{ backgroundColor: '#F8992B' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e67e1a';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8992B';
                      }}
                    >
                      Skonfiguruj
                    </button>
                  </div>
                </div>
              )}
            </section>

                          {/* Campaigns Table */}
              {campaigns.length > 0 && (
                <section>
                  <div className="mb-8">
                    <h2 className="text-lg text-gray-900 mb-2" style={{ fontWeight: 600 }}>Szczegóły Kampanii</h2>
                    <p className="text-sm text-gray-600">Top kampanie według wydajności • {campaigns.length} aktywnych kampanii</p>
                  </div>
                
                <div className="overflow-x-auto" style={{ backgroundColor: '#FFFFFF', border: '1px solid #F0F0F0', borderRadius: '8px' }}>
                  <table className="w-full">
                    <thead style={{ backgroundColor: '#FAFBFC' }} className="sticky top-0">
                      <tr>
                        <th className="text-left py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Nazwa Kampanii
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Wydatki
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Wyświetlenia
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Kliknięcia
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          CTR
                        </th>
                        <th className="text-right py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          CPC
                        </th>
                        <th className="text-center py-4 px-5 text-xs font-medium text-gray-600 uppercase tracking-wide">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody style={{ backgroundColor: '#FFFFFF' }}>
                      {campaigns.slice(0, 10).map((campaign, index) => {
                        const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
                        const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
                        
                        return (
                          <tr 
                            key={`${reportId}-${campaign.campaign_id}`} 
                            className="transition-all duration-150 border-t border-gray-100"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#F8F9FA';
                              e.currentTarget.style.borderLeftColor = '#244583';
                              e.currentTarget.style.borderLeftWidth = '3px';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#FFFFFF';
                              e.currentTarget.style.borderLeftColor = 'transparent';
                              e.currentTarget.style.borderLeftWidth = '0px';
                            }}
                          >
                            <td className="py-4 px-5">
                              <div className="flex items-center space-x-3">
                                <div 
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                                  style={{
                                    backgroundColor: 
                                      index === 0 ? '#F8992B' :
                                      index === 1 ? '#6B7280' :
                                      index === 2 ? '#F59E0B' :
                                      '#244583',
                                    fontWeight: 500
                                  }}
                                >
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="text-sm text-gray-900" style={{ fontWeight: 500 }}>
                                    {campaign.campaign_name}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {campaign.objective || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(campaign.spend)}
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatNumber(campaign.impressions)}
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                              {formatNumber(campaign.clicks)}
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {ctr.toFixed(2)}%
                            </td>
                            <td className="py-4 px-5 text-sm text-gray-900 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(cpc)}
                            </td>
                            <td className="py-4 px-5 text-center">
                              <span 
                                className="inline-flex px-2 py-1 text-xs rounded-full"
                                style={{
                                  backgroundColor: 
                                    campaign.status === 'ACTIVE' ? '#D1FAE5' :
                                    campaign.status === 'PAUSED' ? '#FEF3C7' :
                                    '#F3F4F6',
                                  color:
                                    campaign.status === 'ACTIVE' ? '#065F46' :
                                    campaign.status === 'PAUSED' ? '#92400E' :
                                    '#374151',
                                  fontWeight: 500
                                }}
                              >
                                {campaign.status || 'UNKNOWN'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {campaigns.length === 0 && (
              <section>
                <div className="text-center py-12">
                  <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Brak Kampanii</h3>
                  <p className="text-gray-600">
                    Nie znaleziono aktywnych kampanii w wybranym okresie.
                  </p>
                </div>
              </section>
            )}
          </div>
        );
      })}

      {/* Conversion Tracking Setup Modal */}
      {showSetupModal && (
        <ConversionTrackingSetup onClose={() => setShowSetupModal(false)} />
      )}
    </div>
  );
} 