'use client';

import React, { useState } from 'react';
import { 
  BarChart3, 
  HelpCircle,
  Calendar,
  Clock
} from 'lucide-react';
import ConversionMetricsCards from './ConversionMetricsCards';




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
  
  // Conversion tracking metrics
  click_to_call?: number;
  email_contacts?: number;
  booking_step_1?: number;
  reservations?: number;
  reservation_value?: number;
  roas?: number;
  cost_per_reservation?: number;
  booking_step_2?: number;
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
  tooltip
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  tooltip?: string;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const card = (
    <div 
      className="relative p-5 transition-all duration-200"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #F0F0F0',
        borderRadius: '8px',
        boxShadow: isHovered ? '0 2px 8px rgba(36, 69, 131, 0.08)' : '0 1px 3px rgba(0, 0, 0, 0.02)'
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
        <p className="text-xl text-gray-900" style={{ fontWeight: 600 }}>
          {value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );

  return tooltip ? <Tooltip content={tooltip}>{card}</Tooltip> : card;
};



export default function WeeklyReportView({ reports, viewType = 'weekly' }: WeeklyReportViewProps) {
  const reportIds = Object.keys(reports);
  
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
              </div>
            </section>

            {/* Conversion Metrics Section */}
            {(() => {
              // Calculate conversion metrics totals from campaigns
              const conversionTotals = campaigns.reduce((acc, campaign) => {
                return {
                  click_to_call: acc.click_to_call + (campaign.click_to_call || 0),
                  email_contacts: acc.email_contacts + (campaign.email_contacts || 0),
                  booking_step_1: acc.booking_step_1 + (campaign.booking_step_1 || 0),
                  reservations: acc.reservations + (campaign.reservations || 0),
                  reservation_value: acc.reservation_value + (campaign.reservation_value || 0),
                  booking_step_2: acc.booking_step_2 + (campaign.booking_step_2 || 0),
                  total_spend: acc.total_spend + (campaign.spend || 0)
                };
              }, {
                click_to_call: 0,
                email_contacts: 0,
                booking_step_1: 0,
                reservations: 0,
                reservation_value: 0,
                booking_step_2: 0,
                total_spend: 0
              });

              // Calculate ROAS and cost per reservation
              const roas = conversionTotals.total_spend > 0 && conversionTotals.reservation_value > 0 
                ? conversionTotals.reservation_value / conversionTotals.total_spend 
                : 0;
              
              const cost_per_reservation = conversionTotals.reservations > 0 
                ? conversionTotals.total_spend / conversionTotals.reservations 
                : 0;

              const conversionMetrics = {
                click_to_call: conversionTotals.click_to_call,
                email_contacts: conversionTotals.email_contacts,
                booking_step_1: conversionTotals.booking_step_1,
                reservations: conversionTotals.reservations,
                reservation_value: conversionTotals.reservation_value,
                roas: roas,
                cost_per_reservation: cost_per_reservation,
                booking_step_2: conversionTotals.booking_step_2
              };

              return (
                <section className="mb-8">
                  <ConversionMetricsCards 
                    conversionMetrics={conversionMetrics}
                    currency="PLN"
                    isLoading={false}
                  />
                </section>
              );
            })()}

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


    </div>
  );
} 