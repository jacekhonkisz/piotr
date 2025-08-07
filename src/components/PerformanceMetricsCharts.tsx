'use client';

import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart, 
  Activity,
  ArrowUpRight,
  Phone,
  Mail,
  ShoppingCart,
  DollarSign,
  Target
} from 'lucide-react';

interface ConversionData {
  click_to_call: number;
  lead: number;
  purchase: number;
  purchase_value: number;
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3: number;
  roas: number;
  cost_per_reservation: number;
}

interface PerformanceMetricsChartsProps {
  conversionData: ConversionData;
  impressions: number;
  clicks: number;
  previousPeriodData?: ConversionData | undefined;
}

export default function PerformanceMetricsCharts({ 
  conversionData, 
  impressions, 
  clicks,
  previousPeriodData 
}: PerformanceMetricsChartsProps) {
  const [activeChart, setActiveChart] = useState<'funnel' | 'trends' | 'comparison' | 'roas'>('funnel');

  // Calculate conversion rates
  const calculateConversionRates = () => {
    const rates = {
      clickToCall: clicks > 0 ? (conversionData.click_to_call / clicks) * 100 : 0,
      lead: clicks > 0 ? (conversionData.lead / clicks) * 100 : 0,
      bookingStep1: clicks > 0 ? (conversionData.booking_step_1 / clicks) * 100 : 0,
      bookingStep2: conversionData.booking_step_1 > 0 ? (conversionData.booking_step_2 / conversionData.booking_step_1) * 100 : 0,
      bookingStep3: conversionData.booking_step_2 > 0 ? (conversionData.booking_step_3 / conversionData.booking_step_2) * 100 : 0,
      purchase: conversionData.booking_step_3 > 0 ? (conversionData.purchase / conversionData.booking_step_3) * 100 : 0
    };
    return rates;
  };

  const conversionRates = calculateConversionRates();

  // Funnel chart data
  const funnelData = [
    { stage: 'Impressions', value: impressions, color: '#F59E0B', icon: Activity },
    { stage: 'Clicks', value: clicks, color: '#EF4444', icon: Target },
    { stage: 'Phone Calls', value: conversionData.click_to_call, color: '#3B82F6', icon: Phone },
    { stage: 'Leads', value: conversionData.lead, color: '#8B5CF6', icon: Mail },
    { stage: 'Step 1', value: conversionData.booking_step_1, color: '#10B981', icon: ShoppingCart },
    { stage: 'Step 2', value: conversionData.booking_step_2, color: '#F97316', icon: ShoppingCart },
    { stage: 'Step 3', value: conversionData.booking_step_3, color: '#EC4899', icon: ShoppingCart },
    { stage: 'Purchases', value: conversionData.purchase, color: '#059669', icon: DollarSign }
  ].filter(item => item.value > 0);

  // Trends data (monthly comparison)
  const trendsData = [
    { month: 'Sty', current: conversionData.purchase, previous: previousPeriodData?.purchase || 0 },
    { month: 'Lut', current: conversionData.lead, previous: previousPeriodData?.lead || 0 },
    { month: 'Mar', current: conversionData.click_to_call, previous: previousPeriodData?.click_to_call || 0 },
    { month: 'Kwi', current: conversionData.booking_step_1, previous: previousPeriodData?.booking_step_1 || 0 },
    { month: 'Maj', current: conversionData.booking_step_2, previous: previousPeriodData?.booking_step_2 || 0 },
    { month: 'Cze', current: conversionData.booking_step_3, previous: previousPeriodData?.booking_step_3 || 0 }
  ];

  // ROAS and cost metrics
  const roasData = [
    { metric: 'ROAS', value: conversionData.roas, target: 3.0, color: '#10B981' },
    { metric: 'Cost/Reservation', value: conversionData.cost_per_reservation, target: 50, color: '#EF4444' },
    { metric: 'Conversion Rate', value: conversionRates.purchase, target: 2.5, color: '#3B82F6' },
    { metric: 'Lead Rate', value: conversionRates.lead, target: 5.0, color: '#8B5CF6' }
  ];

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount);
  };

  const getChangeIndicator = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      isPositive: change > 0,
      icon: change > 0 ? TrendingUp : TrendingDown
    };
  };

  return (
    <div className="space-y-6">
      {/* Chart Navigation */}
      <div className="flex space-x-2 bg-gray-50 rounded-lg p-1">
        {[
          { id: 'funnel', label: 'Lejek Konwersji', icon: BarChart3 },
          { id: 'trends', label: 'Trendy', icon: TrendingUp },
          { id: 'comparison', label: 'Porównanie', icon: PieChart },
          { id: 'roas', label: 'ROAS & Koszty', icon: DollarSign }
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveChart(id as any)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeChart === id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Funnel Chart */}
      {activeChart === 'funnel' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Lejek Konwersji</h3>
          <div className="flex items-center justify-center space-x-8">
            {funnelData.map((stage, index) => (
              <div key={stage.stage} className="flex flex-col items-center space-y-3">
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                  style={{ backgroundColor: stage.color }}
                >
                  <stage.icon className="h-6 w-6" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900">{stage.stage}</div>
                  <div className="text-lg font-bold text-gray-700">{formatNumber(stage.value)}</div>
                  <div className="text-xs text-gray-500">
                    {index < funnelData.length - 1 && funnelData[index + 1]
                      ? `${(((funnelData[index + 1]?.value || 0) / (stage.value || 1)) * 100).toFixed(1)}% konwersja`
                      : 'Final'
                    }
                  </div>
                </div>
                {index < funnelData.length - 1 && (
                  <ArrowUpRight className="h-6 w-6 text-gray-300 transform rotate-90" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trends Chart */}
      {activeChart === 'trends' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Trendy Konwersji</h3>
          <div className="h-64 flex items-end justify-between space-x-2">
            {trendsData.map((data) => {
              const maxValue = Math.max(...trendsData.map(d => Math.max(d.current, d.previous)));
              const currentHeight = maxValue > 0 ? (data.current / maxValue) * 100 : 0;
              const previousHeight = maxValue > 0 ? (data.previous / maxValue) * 100 : 0;
              const change = getChangeIndicator(data.current, data.previous);

              return (
                <div key={data.month} className="flex flex-col items-center space-y-2 flex-1">
                  <div className="flex flex-col items-center space-y-1">
                    <div className="text-xs text-gray-500">{data.month}</div>
                    <div className="text-sm font-medium text-gray-900">{formatNumber(data.current)}</div>
                    {change && (
                      <div className={`flex items-center text-xs ${
                        change.isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        <change.icon className="h-3 w-3 mr-1" />
                        {change.value.toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="w-full flex space-x-1">
                    <div 
                      className="bg-blue-600 rounded-t"
                      style={{ height: `${currentHeight}%`, minHeight: '4px' }}
                    />
                    <div 
                      className="bg-gray-300 rounded-t"
                      style={{ height: `${previousHeight}%`, minHeight: '4px' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-center space-x-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span>Aktualny</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-gray-300 rounded"></div>
              <span>Poprzedni</span>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Chart */}
      {activeChart === 'comparison' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Porównanie Metryk</h3>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700">Konwersje</h4>
              {[
                { label: 'Kontakty telefoniczne', value: conversionData.click_to_call, color: '#3B82F6' },
                { label: 'Leady', value: conversionData.lead, color: '#8B5CF6' },
                { label: 'Rezerwacje', value: conversionData.purchase, color: '#10B981' }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium">{formatNumber(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700">Etapy Rezerwacji</h4>
              {[
                { label: 'Etap 1', value: conversionData.booking_step_1, color: '#F59E0B' },
                { label: 'Etap 2', value: conversionData.booking_step_2, color: '#F97316' },
                { label: 'Etap 3', value: conversionData.booking_step_3, color: '#EC4899' }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium">{formatNumber(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ROAS & Costs Chart */}
      {activeChart === 'roas' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">ROAS & Koszty</h3>
          <div className="grid grid-cols-2 gap-6">
            {roasData.map((item) => {
              const percentage = item.target > 0 ? (item.value / item.target) * 100 : 0;
              const isGood = item.metric === 'ROAS' || item.metric === 'Conversion Rate' || item.metric === 'Lead Rate' 
                ? item.value >= item.target 
                : item.value <= item.target;

              return (
                <div key={item.metric} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{item.metric}</span>
                    <div className={`flex items-center space-x-1 text-xs ${
                      isGood ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isGood ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      <span>{percentage.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {item.metric === 'ROAS' ? `${item.value.toFixed(2)}x` : 
                     item.metric === 'Cost/Reservation' ? formatCurrency(item.value) :
                     `${item.value.toFixed(1)}%`}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Cel: {item.metric === 'ROAS' ? `${item.target}x` : 
                          item.metric === 'Cost/Reservation' ? formatCurrency(item.target) :
                          `${item.target}%`}
                  </div>
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isGood ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
} 