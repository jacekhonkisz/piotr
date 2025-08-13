'use client';

import React from 'react';
import { 
  Phone, 
  Mail, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp, 
  Target,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface ConversionMetrics {
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  reservations: number;
  reservation_value: number;
  roas: number;
  cost_per_reservation: number;
  booking_step_2: number;
}

interface ConversionMetricsCardsProps {
  conversionMetrics: ConversionMetrics;
  currency?: string;
  isLoading?: boolean;
  showInfoPanel?: boolean;
}

export default function ConversionMetricsCards({ 
  conversionMetrics, 
  currency = 'PLN',
  isLoading = false,
  showInfoPanel = true
}: ConversionMetricsCardsProps) {
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pl-PL').format(num);
  };

  const formatPercentage = (num: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(num / 100);
  };

  const metrics = [
    {
      title: 'Potencjalne kontakty telefoniczne',
      value: formatNumber(conversionMetrics.click_to_call),
      description: 'Kliknięcia w numer telefonu na reklamie',
      icon: Phone,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Potencjalne kontakty email',
      value: formatNumber(conversionMetrics.email_contacts),
      description: 'Kliknięcia w linki email (mailto:)',
      icon: Mail,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      title: 'Kroki rezerwacji – Etap 1',
      value: formatNumber(conversionMetrics.booking_step_1),
      description: 'Rozpoczęcie procesu rezerwacji',
      icon: ShoppingCart,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Rezerwacje (zakończone)',
      value: formatNumber(conversionMetrics.reservations),
      description: 'Liczba zakończonych rezerwacji',
      icon: CheckCircle,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200'
    },
    {
      title: 'Wartość rezerwacji',
      value: formatCurrency(conversionMetrics.reservation_value),
      description: 'Suma wartości wszystkich rezerwacji',
      icon: DollarSign,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    {
      title: 'ROAS (Return on Ad Spend)',
      value: conversionMetrics.roas > 0 ? `${conversionMetrics.roas.toFixed(2)}x` : '—',
      description: 'Zwrot z wydatków na reklamy',
      icon: TrendingUp,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200'
    },
    {
      title: 'Koszt per rezerwacja',
      value: conversionMetrics.cost_per_reservation > 0 ? formatCurrency(conversionMetrics.cost_per_reservation) : '—',
      description: 'Średni koszt za jedną rezerwację',
      icon: Target,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      title: 'Etap 2 rezerwacji',
      value: formatNumber(conversionMetrics.booking_step_2),
      description: 'Dodanie do koszyka / Etap 2 procesu',
      icon: ShoppingCart,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-8 w-8 bg-gray-200 rounded"></div>
            </div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Wydajność kampanii</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <AlertCircle className="h-4 w-4" />
          <span>Dane pobierane indywidualnie dla każdego klienta z Meta API</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => {
          const IconComponent = metric.icon;
          const hasValue = metric.value !== '0' && metric.value !== '—';
          
          // Special handling for metrics that might legitimately be 0
          const isPhoneMetric = metric.title.includes('telefoniczne');
          const isBookingStep2Metric = metric.title.includes('Etap 2');
          const showConfigurationWarning = !hasValue && (isPhoneMetric || isBookingStep2Metric);
          
          return (
            <div 
              key={index} 
              className={`bg-white rounded-lg border ${metric.borderColor} p-6 transition-all duration-200 hover:shadow-md ${
                hasValue ? 'opacity-100' : 'opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700 leading-tight">
                  {metric.title}
                </h3>
                <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                  <IconComponent className={`h-5 w-5 ${metric.textColor}`} />
                </div>
              </div>
              
              <div className="mb-2">
                <span className={`text-2xl font-bold ${hasValue ? metric.textColor : 'text-gray-400'}`}>
                  {metric.value}
                </span>
              </div>
              
              <p className="text-xs text-gray-500 leading-relaxed">
                {metric.description}
              </p>
              
              {showConfigurationWarning && (
                <div className="mt-3 flex items-center text-xs text-amber-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  <span>
                    {isPhoneMetric 
                      ? 'Brak śledzenia połączeń w reklamach' 
                      : 'Brak śledzenia koszyka/kroku 2'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {showInfoPanel && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Informacje o metrykach konwersji
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p className="mb-2">
                  <strong>📞 Potencjalne kontakty telefoniczne:</strong> Meta API - actions → click_to_call, phone_number_clicks
                  <br />
                  <span className="text-xs text-blue-600">💡 Skonfiguruj tracking połączeń w Facebook Ads Manager</span>
                </p>
                <p className="mb-2">
                  <strong>📧 Potencjalne kontakty email:</strong> Meta API - actions → link_click (mailto:)
                </p>
                <p className="mb-2">
                  <strong>🛒 Kroki rezerwacji – Etap 1:</strong> Meta API - actions → booking_step_1, initiate_checkout
                </p>
                <p className="mb-2">
                  <strong>✅ Rezerwacje (zakończone):</strong> Meta API - actions → purchase/reservation
                </p>
                <p className="mb-2">
                  <strong>💰 Wartość rezerwacji:</strong> Meta API - action_values → purchase value
                </p>
                <p className="mb-2">
                  <strong>🛒 Etap 2 rezerwacji:</strong> Meta API - actions → booking_step_2, add_to_cart, view_content
                  <br />
                  <span className="text-xs text-blue-600">💡 Skonfiguruj events Facebook Pixel na stronie klienta</span>
                </p>
                <p>
                  <strong>📊 ROAS & Koszt per rezerwacja:</strong> Obliczane automatycznie na podstawie wydatków i wartości
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 