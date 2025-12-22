import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, CreditCard, CheckCircle, Calendar } from 'lucide-react';

interface FunnelStepData {
  label: string;
  value: number;
  percentage: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface ConversionFunnelProps {
  step1: number;
  step2: number;
  step3: number;
  reservations: number;
  reservationValue: number;
  conversionValue?: number; // conversions_value - "Wartość konwersji" in Google Ads
  totalConversionValue?: number; // all_conversions_value - "Łączna wartość konwersji" (includes view-through, cross-device)
  roas: number;
  className?: string;
  // Previous year data for comparison
  previousYear?: {
    step1: number;
    step2: number;
    step3: number;
    reservations: number;
  };
  // Pre-calculated YoY changes from API
  yoyChanges?: {
    step1: number;
    step2: number;
    step3: number;
    reservations: number;
  };
}

const ConversionFunnel: React.FC<ConversionFunnelProps> = ({
  step1,
  step2,
  step3,
  reservations,
  reservationValue,
  conversionValue,
  totalConversionValue,
  roas,
  className = "",
  previousYear,
  yoyChanges
}) => {
  // "Wartość konwersji" = conversions_value (cross-platform comparable)
  const displayConversionValue = conversionValue !== undefined ? conversionValue : reservationValue;
  // "Łączna wartość konwersji" = all_conversions_value (includes view-through, cross-device)
  const displayTotalConversionValue = totalConversionValue !== undefined ? totalConversionValue : displayConversionValue;
  
  // Calculate conversion rates
  const step1ToStep2Rate = step1 > 0 ? (step2 / step1) * 100 : 0;
  const step2ToStep3Rate = step2 > 0 ? (step3 / step2) * 100 : 0;
  const step3ToReservationRate = step3 > 0 ? (reservations / step3) * 100 : 0;

  // Calculate year-over-year changes
  // Use the pre-calculated YoY changes passed from the parent component


  const funnelSteps: FunnelStepData[] = [
    {
      label: "Krok 1 w BE",
      value: step1,
      percentage: 100,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-900 to-slate-800" // Darkest - very dark navy
    },
    {
      label: "Krok 2 w BE",
      value: step2,
      percentage: step1ToStep2Rate,
      icon: <CreditCard className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-700 to-slate-600" // Medium dark
    },
    {
      label: "Krok 3 w BE",
      value: step3,
      percentage: step2ToStep3Rate,
      icon: <CheckCircle className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-600 to-slate-500" // Medium
    },
    {
      label: "Ilość rezerwacji",
      value: reservations,
      percentage: step3ToReservationRate,
      icon: <Calendar className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-500 to-slate-400" // Lightest - part of funnel
    }
  ];

  const bottomCards = [
    {
      label: "Łączna wartość konwersji",
      value: `${displayTotalConversionValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`,
      icon: <Calendar className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-600 to-slate-500" // all_conversions_value from Google Ads
    },
    {
      label: "ROAS",
      value: `${roas.toFixed(2)}x`,
      icon: <Calendar className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-700 to-slate-600" // ROAS (calculated using total_conversion_value)
    }
  ];

  // Create funnel shape using clipPath
  const createFunnelPath = (index: number, total: number) => {
    const baseWidth = 600; // Base width in pixels
    const height = 90; // Height of each step
    const taperRatio = 0.15; // How much each step narrows
    
    const stepWidth = baseWidth - (index * baseWidth * taperRatio);
    const nextStepWidth = baseWidth - ((index + 1) * baseWidth * taperRatio);
    
    // Create trapezoid shape
    const leftOffset = (baseWidth - stepWidth) / 2;
    const rightOffset = baseWidth - leftOffset;
    const nextLeftOffset = (baseWidth - nextStepWidth) / 2;
    const nextRightOffset = baseWidth - nextLeftOffset;
    
    return `polygon(${leftOffset}px 0%, ${rightOffset}px 0%, ${nextRightOffset}px 100%, ${nextLeftOffset}px 100%)`;
  };

  return (
    <div className={`bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-8 ${className}`}>
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-slate-800 mb-2">Konwersje Online</h3>
        <p className="text-slate-600">Ścieżka konwersji w systemie rezerwacji</p>
      </div>

      <div className="flex items-start justify-center gap-8">
        {/* Funnel Steps Column */}
        <div className="flex flex-col items-center space-y-4">
          {funnelSteps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 }}
              className={`relative ${step.bgColor} text-center shadow-lg hover:shadow-xl transition-all duration-300`}
              style={{
                clipPath: createFunnelPath(index, funnelSteps.length),
                width: '600px',
                height: '90px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div className="flex items-center justify-center space-x-4 px-8">
                <div className={`p-3 bg-slate-200/30 rounded-lg flex-shrink-0 ${step.color}`}>
                  {step.icon}
                </div>
                <div className="text-center relative min-w-0 flex-1">
                  <div className={`text-xl font-bold ${step.color} truncate`}>
                    {step.value.toLocaleString()}
                  </div>
                  <div className={`text-xs ${step.color} truncate`}>
                    {step.label}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Bottom Cards */}
          <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-2xl">
            {bottomCards.map((card, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (funnelSteps.length + index) * 0.2 }}
                className={`${card.bgColor} rounded-xl p-6 text-center shadow-lg hover:shadow-xl transition-all duration-300`}
              >
                <div className="flex items-center justify-center space-x-4">
                  <div className={`p-3 bg-white/20 rounded-lg ${card.color}`}>
                    {card.icon}
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-bold ${card.color}`}>
                      {typeof card.value === 'string' ? card.value : (card.value as number).toLocaleString()}
                    </div>
                    <div className={`text-xs ${card.color}`}>
                      {card.label}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Year-over-Year Comparison Column */}
        {yoyChanges && (
          <div className="flex flex-col space-y-4 min-w-[90px]">
            {/* YoY badges for funnel steps */}
            {[
              { key: 'step1', label: 'Start' },
              { key: 'step2', label: 'Step 2' },
              { key: 'step3', label: 'Step 3' },
              { key: 'reservations', label: 'Reservations' }
            ].map((item, index) => {
              const change = yoyChanges[item.key as keyof typeof yoyChanges];
              const isNoHistoricalData = change === -999; // Special value for unreliable historical data
              const isPositive = change > 0;
              const isNeutral = change === 0;
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`px-2 py-1 rounded-lg text-center min-w-[90px] text-xs font-medium shadow-md ${
                    isNoHistoricalData || isNeutral
                      ? 'bg-slate-900 text-white border border-slate-800' 
                      : 'bg-slate-900 text-white border border-slate-800'
                  }`}
                  style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div className="text-center">
                    <div className="font-bold">
                      {isNoHistoricalData ? 'N/A' : isNeutral ? 'N/A' : `${isPositive ? '↗' : '↘'} ${Math.abs(change).toFixed(1)}%`}
                    </div>
                    <div className="text-[10px] mt-1">
                      {isNoHistoricalData ? 'brak danych' : 'vs rok temu'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversionFunnel;