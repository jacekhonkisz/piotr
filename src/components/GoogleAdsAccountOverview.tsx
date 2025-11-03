'use client';

import React from 'react';
import { TrendingUp, MousePointer, Eye, Target, DollarSign } from 'lucide-react';

interface GoogleAdsAccountOverviewProps {
  accountData: {
    customerId: string;
    customerName: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    conversions: number;
    conversion_value: number;
    roas: number;
    cost_per_conversion: number;
  };
  currency?: string;
}

/**
 * RMF R.10: Account-level (Customer) performance overview
 * Displays aggregate metrics for the entire Google Ads account
 * Required metrics: clicks, cost_micros, impressions, conversions, conversions_value
 */
export default function GoogleAdsAccountOverview({ accountData, currency = 'PLN' }: GoogleAdsAccountOverviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pl-PL').format(Math.round(num));
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  const metrics = [
    {
      label: 'Całkowite wydatki',
      value: formatCurrency(accountData.spend),
      icon: <DollarSign className="w-5 h-5" />,
      color: 'from-blue-500 to-blue-600',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Wyświetlenia',
      value: formatNumber(accountData.impressions),
      icon: <Eye className="w-5 h-5" />,
      color: 'from-purple-500 to-purple-600',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      label: 'Kliknięcia',
      value: formatNumber(accountData.clicks),
      icon: <MousePointer className="w-5 h-5" />,
      color: 'from-green-500 to-green-600',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Konwersje',
      value: formatNumber(accountData.conversions),
      icon: <Target className="w-5 h-5" />,
      color: 'from-orange-500 to-orange-600',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      label: 'Wartość konwersji',
      value: formatCurrency(accountData.conversion_value),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'from-indigo-500 to-indigo-600',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ];

  const secondaryMetrics = [
    { label: 'CTR', value: formatPercentage(accountData.ctr) },
    { label: 'CPC', value: formatCurrency(accountData.cpc) },
    { label: 'ROAS', value: `${accountData.roas.toFixed(2)}x` },
    { label: 'Koszt konwersji', value: formatCurrency(accountData.cost_per_conversion) }
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-slate-900">
            Przegląd konta Google Ads
          </h2>
          <div className="px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full">
            R.10 Compliant
          </div>
        </div>
        <p className="text-sm text-slate-600">
          {accountData.customerName} (ID: {accountData.customerId})
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Zagregowane metryki dla całego konta Google Ads
        </p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className={`${metric.bgColor} rounded-xl p-4 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className={`p-2 ${metric.bgColor} rounded-lg ${metric.textColor}`}>
                {metric.icon}
              </div>
            </div>
            <div className="mt-2">
              <p className="text-xs text-slate-600 font-medium mb-1">{metric.label}</p>
              <p className={`text-2xl font-bold ${metric.textColor}`}>
                {metric.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
        {secondaryMetrics.map((metric, index) => (
          <div key={index} className="text-center">
            <p className="text-xs text-slate-600 font-medium mb-1">{metric.label}</p>
            <p className="text-lg font-bold text-slate-900">{metric.value}</p>
          </div>
        ))}
      </div>

      {/* RMF Compliance Note */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          <strong>RMF R.10 Required Metrics:</strong> ✅ clicks, ✅ cost_micros (spend), 
          ✅ impressions, ✅ conversions, ✅ conversions_value
        </p>
      </div>
    </div>
  );
}



