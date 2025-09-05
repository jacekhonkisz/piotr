'use client';

import React from 'react';
import { BarChart3, Eye, MousePointer, Target, DollarSign, Calendar, PhoneCall, Mail, TrendingUp, Users, Zap, Award, Search, Activity } from 'lucide-react';
import ConversionFunnel from './ConversionFunnel';

interface PlatformData {
  enabled: boolean;
  stats: {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    averageCtr: number;
    averageCpc: number;
    averageCpa?: number;
    averageCpm?: number;
    // Meta-specific metrics
    frequency?: number;
    reach?: number;
    relevanceScore?: number;
    landingPageViews?: number;
    // Google-specific metrics
    searchImpressionShare?: number;
    viewThroughConversions?: number;
    qualityScore?: number;
    searchBudgetLostImpressionShare?: number;
  };
  conversionMetrics: {
    click_to_call: number;
    email_contacts: number;
    booking_step_1: number;
    booking_step_2: number;
    booking_step_3: number;
    reservations: number;
    reservation_value: number;
    roas: number;
    cost_per_reservation: number;
  };
  campaigns: any[];
  error?: string | null;
}

interface PlatformSeparatedMetricsProps {
  metaData: PlatformData;
  googleData: PlatformData;
  combinedData: {
    stats: PlatformData['stats'];
    conversionMetrics: PlatformData['conversionMetrics'];
  };
  className?: string;
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

const MetricCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
}> = ({ title, value, subtitle, icon, color = "bg-slate-50" }) => (
  <div className={`${color} rounded-xl p-6 border border-slate-200`}>
    <div className="flex items-center justify-between mb-3">
      <div className="p-2 bg-white rounded-lg shadow-sm">
        {icon}
      </div>
    </div>
    <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
    <div className="text-sm font-medium text-slate-700 mb-1">{title}</div>
    {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
  </div>
);

const PlatformSeparatedMetrics: React.FC<PlatformSeparatedMetricsProps> = ({
  metaData,
  googleData,
  combinedData,
  className = ""
}) => {
  return (
    <div className={`space-y-8 ${className}`}>
      {/* Platform Comparison Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Wydajność kampanii</h2>
        <p className="text-slate-600">Porównanie wyników Meta Ads i Google Ads</p>
      </div>

      {/* Meta Ads Section */}
      {metaData.enabled && (
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border border-blue-200">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-blue-900 mb-2">Meta - Podstawowe metryki</h3>
            <p className="text-blue-700">Wyniki kampanii Meta Ads (Facebook & Instagram)</p>
            {metaData.error && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                Błąd: {metaData.error}
              </div>
            )}
          </div>
          
          {/* Meta Core Metrics - Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <MetricCard
              title="Wydana kwota"
              value={formatCurrency(metaData.stats.totalSpend)}
              subtitle="Meta Ads"
              icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="Wyświetlenia"
              value={formatNumber(metaData.stats.totalImpressions)}
              subtitle="Meta Ads"
              icon={<Eye className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="Kliknięcia linku"
              value={formatNumber(metaData.stats.totalClicks)}
              subtitle="Meta Ads"
              icon={<MousePointer className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="CTR"
              value={`${metaData.stats.averageCtr.toFixed(2)}%`}
              subtitle="Meta Ads"
              icon={<Target className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="CPC"
              value={formatCurrency(metaData.stats.averageCpc)}
              subtitle="Meta Ads"
              icon={<DollarSign className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
          </div>

          {/* Meta Additional Core Metrics - Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <MetricCard
              title="Konwersje"
              value={formatNumber(metaData.stats.totalConversions)}
              subtitle="Meta Ads"
              icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="CPA"
              value={formatCurrency(metaData.stats.averageCpa || 0)}
              subtitle="Meta Ads"
              icon={<Target className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="CPM"
              value={formatCurrency(metaData.stats.averageCpm || 0)}
              subtitle="Meta Ads"
              icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="Zasięg"
              value={formatNumber(metaData.stats.reach || 0)}
              subtitle="Meta Ads"
              icon={<Users className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
          </div>

          {/* Meta Specific Metrics - Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <MetricCard
              title="Częstotliwość"
              value={`${(metaData.stats.frequency || 0).toFixed(2)}x`}
              subtitle="Meta Ads"
              icon={<Activity className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="Ocena trafności"
              value={`${(metaData.stats.relevanceScore || 0).toFixed(1)}/10`}
              subtitle="Meta Ads"
              icon={<Award className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="Wyświetlenia strony docelowej"
              value={formatNumber(metaData.stats.landingPageViews || 0)}
              subtitle="Meta Ads"
              icon={<Eye className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
          </div>

          {/* Meta Conversion Funnel */}
          <ConversionFunnel
            step1={metaData.conversionMetrics.booking_step_1}
            step2={metaData.conversionMetrics.booking_step_2}
            step3={metaData.conversionMetrics.booking_step_3}
            reservations={metaData.conversionMetrics.reservations}
            reservationValue={metaData.conversionMetrics.reservation_value}
            roas={metaData.conversionMetrics.roas}
            className="mb-4"
          />

          {/* Meta Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Potencjalne kontakty telefoniczne"
              value={metaData.conversionMetrics.click_to_call.toString()}
              subtitle="Meta - Wartość rezerwacji online"
              icon={<PhoneCall className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="Potencjalne kontakty email"
              value={metaData.conversionMetrics.email_contacts.toString()}
              subtitle="Meta - Koszt pozyskania rezerwacji"
              icon={<Mail className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
            <MetricCard
              title="ROAS"
              value={`${metaData.conversionMetrics.roas.toFixed(2)}x`}
              subtitle="Meta - ROAS"
              icon={<Calendar className="w-5 h-5 text-blue-600" />}
              color="bg-blue-50"
            />
          </div>
        </div>
      )}

      {/* Google Ads Section */}
      {googleData.enabled && (
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 border border-green-200">
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-green-900 mb-2">Google - Podstawowe metryki</h3>
            <p className="text-green-700">Wyniki kampanii Google Ads</p>
            {googleData.error && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                Błąd: {googleData.error}
              </div>
            )}
          </div>
          
          {/* Google Core Metrics - Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <MetricCard
              title="Wydana kwota"
              value={formatCurrency(googleData.stats.totalSpend)}
              subtitle="Google Ads"
              icon={<BarChart3 className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="Wyświetlenia"
              value={formatNumber(googleData.stats.totalImpressions)}
              subtitle="Google Ads"
              icon={<Eye className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="Kliknięcia linku"
              value={formatNumber(googleData.stats.totalClicks)}
              subtitle="Google Ads"
              icon={<MousePointer className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="CTR"
              value={`${googleData.stats.averageCtr.toFixed(2)}%`}
              subtitle="Google Ads"
              icon={<Target className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="CPC"
              value={formatCurrency(googleData.stats.averageCpc)}
              subtitle="Google Ads"
              icon={<DollarSign className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
          </div>

          {/* Google Additional Core Metrics - Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <MetricCard
              title="Konwersje"
              value={formatNumber(googleData.stats.totalConversions)}
              subtitle="Google Ads"
              icon={<TrendingUp className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="CPA"
              value={formatCurrency(googleData.stats.averageCpa || 0)}
              subtitle="Google Ads"
              icon={<Target className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="CPM"
              value={formatCurrency(googleData.stats.averageCpm || 0)}
              subtitle="Google Ads"
              icon={<BarChart3 className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="Konwersje wyświetleniowe"
              value={formatNumber(googleData.stats.viewThroughConversions || 0)}
              subtitle="Google Ads"
              icon={<Eye className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
          </div>

          {/* Google Specific Metrics - Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <MetricCard
              title="Udział wyświetleń w wyszukiwaniu"
              value={`${((googleData.stats.searchImpressionShare || 0) * 100).toFixed(1)}%`}
              subtitle="Google Ads"
              icon={<Search className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="Ocena jakości"
              value={`${(googleData.stats.qualityScore || 0).toFixed(1)}/10`}
              subtitle="Google Ads"
              icon={<Award className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="Utracone wyświetlenia (budżet)"
              value={`${((googleData.stats.searchBudgetLostImpressionShare || 0) * 100).toFixed(1)}%`}
              subtitle="Google Ads"
              icon={<Zap className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
          </div>

          {/* Google Conversion Funnel */}
          <ConversionFunnel
            step1={googleData.conversionMetrics.booking_step_1}
            step2={googleData.conversionMetrics.booking_step_2}
            step3={googleData.conversionMetrics.booking_step_3}
            reservations={googleData.conversionMetrics.reservations}
            reservationValue={googleData.conversionMetrics.reservation_value}
            roas={googleData.conversionMetrics.roas}
            className="mb-4"
          />

          {/* Google Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Potencjalne kontakty telefoniczne"
              value={googleData.conversionMetrics.click_to_call.toString()}
              subtitle="Google - Wartość rezerwacji online"
              icon={<PhoneCall className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="Potencjalne kontakty email"
              value={googleData.conversionMetrics.email_contacts.toString()}
              subtitle="Google - Koszt pozyskania rezerwacji"
              icon={<Mail className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
            <MetricCard
              title="ROAS"
              value={`${googleData.conversionMetrics.roas.toFixed(2)}x`}
              subtitle="Google - ROAS"
              icon={<Calendar className="w-5 h-5 text-green-600" />}
              color="bg-green-50"
            />
          </div>
        </div>
      )}

      {/* Combined Summary */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Łączne wyniki</h3>
          <p className="text-slate-700">Suma wyników ze wszystkich platform</p>
        </div>
        
        {/* Combined Core Metrics - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <MetricCard
            title="Wydana kwota"
            value={formatCurrency(combinedData.stats.totalSpend)}
            subtitle="Wszystkie platformy"
            icon={<BarChart3 className="w-5 h-5 text-slate-600" />}
            color="bg-slate-50"
          />
          <MetricCard
            title="Wyświetlenia"
            value={formatNumber(combinedData.stats.totalImpressions)}
            subtitle="Wszystkie platformy"
            icon={<Eye className="w-5 h-5 text-slate-600" />}
            color="bg-slate-50"
          />
          <MetricCard
            title="Kliknięcia linku"
            value={formatNumber(combinedData.stats.totalClicks)}
            subtitle="Wszystkie platformy"
            icon={<MousePointer className="w-5 h-5 text-slate-600" />}
            color="bg-slate-50"
          />
          <MetricCard
            title="CTR"
            value={`${combinedData.stats.averageCtr.toFixed(2)}%`}
            subtitle="Wszystkie platformy"
            icon={<Target className="w-5 h-5 text-slate-600" />}
            color="bg-slate-50"
          />
          <MetricCard
            title="CPC"
            value={formatCurrency(combinedData.stats.averageCpc)}
            subtitle="Wszystkie platformy"
            icon={<DollarSign className="w-5 h-5 text-slate-600" />}
            color="bg-slate-50"
          />
        </div>

        {/* Combined Additional Metrics - Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <MetricCard
            title="Konwersje"
            value={formatNumber(combinedData.stats.totalConversions)}
            subtitle="Wszystkie platformy"
            icon={<TrendingUp className="w-5 h-5 text-slate-600" />}
            color="bg-slate-50"
          />
          <MetricCard
            title="CPA"
            value={formatCurrency((combinedData.stats.averageCpa || 0))}
            subtitle="Wszystkie platformy"
            icon={<Target className="w-5 h-5 text-slate-600" />}
            color="bg-slate-50"
          />
          <MetricCard
            title="CPM"
            value={formatCurrency((combinedData.stats.averageCpm || 0))}
            subtitle="Wszystkie platformy"
            icon={<BarChart3 className="w-5 h-5 text-slate-600" />}
            color="bg-slate-50"
          />
        </div>

        {/* Combined Conversion Funnel */}
        <ConversionFunnel
          step1={combinedData.conversionMetrics.booking_step_1}
          step2={combinedData.conversionMetrics.booking_step_2}
          step3={combinedData.conversionMetrics.booking_step_3}
          reservations={combinedData.conversionMetrics.reservations}
          reservationValue={combinedData.conversionMetrics.reservation_value}
          roas={combinedData.conversionMetrics.roas}
          className="mb-4"
        />
      </div>
    </div>
  );
};

export default PlatformSeparatedMetrics;
