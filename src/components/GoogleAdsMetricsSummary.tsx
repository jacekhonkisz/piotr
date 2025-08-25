'use client';

import React from 'react';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface GoogleAdsMetrics {
  wydanaKwota: number; // Wydana kwota
  wyswietlenia: number; // Wyświetlenia
  klikniecia: number; // Kliknięcia
  cpc: number; // CPC
  ctr: number; // CTR (as percentage)
  wyslanieFomularza: number; // Wysłanie formularza
  polaczeniaZReklam: number; // Połączenia z reklam
  kliknieciaWAdresEmail: number; // Kliknięcia w adres e-mail
  kliknieciaWNumerTelefonu: number; // Kliknięcia w numer telefonu
  bookingEngineKrok1: number; // Booking Engine krok 1
  bookingEngineKrok2: number; // Booking Engine krok 2
  bookingEngineKrok3: number; // Booking Engine krok 3
  rezerwacje: number; // Rezerwacje
  wartoscRezerwacji: number; // Wartość rezerwacji
  roas: number; // ROAS
}

interface GoogleAdsMetricsSummaryProps {
  data: GoogleAdsMetrics;
  isLoading?: boolean;
  dateRange?: string;
}

const GoogleAdsMetricsSummary: React.FC<GoogleAdsMetricsSummaryProps> = ({
  data,
  isLoading = false,
  dateRange,
}) => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('pl-PL').format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const getTrendIcon = (value: number, threshold: number = 0) => {
    if (value > threshold) return <TrendingUp className="w-4 h-4 text-orange-500" />;
    if (value < threshold) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getRoasColor = (roas: number): string => {
    if (roas >= 3) return 'text-orange-600';
    if (roas >= 2) return 'text-yellow-600';
    if (roas >= 1) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCtrColor = (ctr: number): string => {
    if (ctr >= 3) return 'text-orange-600';
    if (ctr >= 2) return 'text-yellow-600';
    if (ctr >= 1) return 'text-orange-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Target className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Google Ads - Kluczowe Metryki</h3>
            <p className="text-sm text-gray-600">Ładowanie danych...</p>
          </div>
        </div>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 15 }).map((_, index) => (
              <div key={index} className="bg-gray-100 rounded-lg p-4 h-20"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Target className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Google Ads - Kluczowe Metryki</h3>
            {dateRange && (
              <p className="text-sm text-gray-600">{dateRange}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Wydana kwota */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Wydana kwota</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.wydanaKwota)}</p>
            </div>
            {getTrendIcon(data.wydanaKwota)}
          </div>
        </div>

        {/* Wyświetlenia */}
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Wyświetlenia</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.wyswietlenia)}</p>
            </div>
            {getTrendIcon(data.wyswietlenia)}
          </div>
        </div>

        {/* Kliknięcia */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Kliknięcia</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.klikniecia)}</p>
            </div>
            {getTrendIcon(data.klikniecia)}
          </div>
        </div>

        {/* CPC */}
        <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CPC</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.cpc)}</p>
            </div>
            {getTrendIcon(-data.cpc)} {/* Lower CPC is better */}
          </div>
        </div>

        {/* CTR */}
        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CTR</p>
              <p className={`text-2xl font-bold ${getCtrColor(data.ctr)}`}>
                {formatPercentage(data.ctr)}
              </p>
            </div>
            {getTrendIcon(data.ctr, 2)}
          </div>
        </div>

        {/* Wysłanie formularza */}
        <div className="bg-gradient-to-r from-pink-50 to-pink-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Wysłanie formularza</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.wyslanieFomularza)}</p>
            </div>
            {getTrendIcon(data.wyslanieFomularza)}
          </div>
        </div>

        {/* Połączenia z reklam */}
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Połączenia z reklam</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.polaczeniaZReklam)}</p>
            </div>
            {getTrendIcon(data.polaczeniaZReklam)}
          </div>
        </div>

        {/* Kliknięcia w adres e-mail */}
        <div className="bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Kliknięcia w adres e-mail</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.kliknieciaWAdresEmail)}</p>
            </div>
            {getTrendIcon(data.kliknieciaWAdresEmail)}
          </div>
        </div>

        {/* Kliknięcia w numer telefonu */}
        <div className="bg-gradient-to-r from-cyan-50 to-cyan-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Kliknięcia w numer telefonu</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.kliknieciaWNumerTelefonu)}</p>
            </div>
            {getTrendIcon(data.kliknieciaWNumerTelefonu)}
          </div>
        </div>

        {/* Booking Engine krok 1 */}
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Booking Engine krok 1</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.bookingEngineKrok1)}</p>
            </div>
            {getTrendIcon(data.bookingEngineKrok1)}
          </div>
        </div>

        {/* Booking Engine krok 2 */}
        <div className="bg-gradient-to-r from-lime-50 to-lime-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Booking Engine krok 2</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.bookingEngineKrok2)}</p>
            </div>
            {getTrendIcon(data.bookingEngineKrok2)}
          </div>
        </div>

        {/* Booking Engine krok 3 */}
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Booking Engine krok 3</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(data.bookingEngineKrok3)}</p>
            </div>
            {getTrendIcon(data.bookingEngineKrok3)}
          </div>
        </div>

        {/* Rezerwacje */}
        <div className="bg-gradient-to-r from-violet-50 to-violet-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rezerwacje</p>
              <p className="text-2xl font-bold text-orange-600">{formatNumber(data.rezerwacje)}</p>
            </div>
            {getTrendIcon(data.rezerwacje)}
          </div>
        </div>

        {/* Wartość rezerwacji */}
        <div className="bg-gradient-to-r from-rose-50 to-rose-100 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Wartość rezerwacji</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.wartoscRezerwacji)}</p>
            </div>
            {getTrendIcon(data.wartoscRezerwacji)}
          </div>
        </div>

        {/* ROAS */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg p-4 md:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">ROAS</p>
              <p className={`text-3xl font-bold ${getRoasColor(data.roas)}`}>
                {data.roas.toFixed(2)}x
              </p>
            </div>
            {getTrendIcon(data.roas, 2)}
          </div>
          <div className="mt-2">
            <div className="text-xs text-gray-500">
              {data.roas >= 3 && "Excellent "}
              {data.roas >= 2 && data.roas < 3 && "Good "}
              {data.roas >= 1 && data.roas < 2 && "Acceptable "}
              {data.roas < 1 && "Needs Improvement "}
              Return on Ad Spend
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleAdsMetricsSummary; 