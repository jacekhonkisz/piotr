import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, CreditCard, CheckCircle, Calendar } from 'lucide-react';

interface FunnelStepData {
  key: 'booking_step_1' | 'booking_step_2' | 'booking_step_3' | 'reservations';
  label: string;
  value: number;
  percentage: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface FunnelBottomCardData {
  key: 'total_conversion_value' | 'roas';
  label: string;
  value: string;
  numericValue: number;
  comparisonKey: 'totalConversionValue' | 'roas';
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
  totalConversionValue?: number; // all_conversions_value - "Łączna wartość rezerwacji" for Google Ads (includes view-through, cross-device)
  roas: number;
  className?: string;
  // Platform-specific label for conversion value card
  // - 'meta': "Wartość rezerwacji (zakupy w witrynie)"
  // - 'google': "Łączna wartość rezerwacji"
  platform?: 'meta' | 'google' | 'combined';
  // Previous year data for comparison
  previousYear?: {
    step1: number;
    step2: number;
    step3: number;
    reservations: number;
    totalConversionValue?: number;
    roas?: number;
  };
  // Pre-calculated YoY changes from API
  yoyChanges?: {
    step1: number;
    step2: number;
    step3: number;
    reservations: number;
    totalConversionValue?: number;
    roas?: number;
  };
  labels?: Partial<Record<
    | 'booking_step_1'
    | 'booking_step_2'
    | 'booking_step_3'
    | 'reservations'
    | 'reservation_value'
    | 'total_conversion_value'
    | 'roas',
    string
  >>;
  visible?: Partial<Record<
    | 'booking_step_1'
    | 'booking_step_2'
    | 'booking_step_3'
    | 'reservations'
    | 'reservation_value'
    | 'total_conversion_value'
    | 'roas',
    boolean
  >>;
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
  platform,
  previousYear,
  yoyChanges,
  labels = {},
  visible = {}
}) => {
  // 🔍 DEBUG: Log props to see what's being passed
  console.log('🎯 ConversionFunnel Props:', {
    step1,
    step2,
    step3,
    reservations,
    reservationValue,
    conversionValue,
    totalConversionValue,
    roas,
    platform
  });
  
  // "Wartość konwersji" = conversions_value (cross-platform comparable)
  const displayConversionValue = conversionValue !== undefined ? conversionValue : reservationValue;
  // "Łączna wartość rezerwacji" for Google Ads = all_conversions_value (includes view-through, cross-device)
  const displayTotalConversionValue = totalConversionValue !== undefined ? totalConversionValue : displayConversionValue;
  
  console.log('🎯 Display Values:', {
    displayConversionValue,
    displayTotalConversionValue,
    willDisplay: `${displayTotalConversionValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
  });
  
  // ✅ Platform-specific label for conversion value card
  // Meta: "Wartość rezerwacji (zakupy w witrynie)" - direct from action_values
  // Google: "Łączna wartość rezerwacji" - all_conversions_value from "PBM - Rezerwacja" action
  const conversionValueLabel = labels.total_conversion_value || labels.reservation_value || (platform === 'meta'
    ? "Wartość rezerwacji (zakupy w witrynie)"
    : "Łączna wartość rezerwacji");
  
  // ✅ Platform-specific funnel labels
  // Meta: Generic funnel labels (Polish Meta Ads standard names)
  // Google: Booking step labels (matches Google Ads conversion action names)
  const step1Label = labels.booking_step_1 || (platform === 'google' ? "Booking step 1" : "Wyszukiwania");
  const step2Label = labels.booking_step_2 || (platform === 'google' ? "Booking step 2" : "Wyświetlenia zawartości");
  const step3Label =
    labels.booking_step_3 || (platform === 'google' ? 'Booking step 3' : 'Zainicjowane przejścia do kasy');
  
  // Calculate conversion rates
  const step1ToStep2Rate = step1 > 0 ? (step2 / step1) * 100 : 0;
  const step2ToStep3Rate = step2 > 0 ? (step3 / step2) * 100 : 0;
  const step3ToReservationRate = step3 > 0 ? (reservations / step3) * 100 : 0;

  // Calculate year-over-year changes
  // Use the pre-calculated YoY changes passed from the parent component


  const allFunnelSteps: FunnelStepData[] = [
    {
      key: 'booking_step_1',
      label: step1Label,
      value: step1,
      percentage: 100,
      icon: <ShoppingCart className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-900 to-slate-800" // Darkest - very dark navy
    },
    {
      key: 'booking_step_2',
      label: step2Label,
      value: step2,
      percentage: step1ToStep2Rate,
      icon: <CreditCard className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-700 to-slate-600" // Medium dark
    },
    {
      key: 'booking_step_3',
      label: step3Label,
      value: step3,
      percentage: step2ToStep3Rate,
      icon: <CheckCircle className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-600 to-slate-500" // Medium
    },
    {
      key: 'reservations',
      label: labels.reservations || "Ilość rezerwacji",
      value: reservations,
      percentage: step3ToReservationRate,
      icon: <Calendar className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-500 to-slate-400" // Lightest - part of funnel
    }
  ];
  const funnelSteps = allFunnelSteps.filter((step) => visible[step.key] !== false);

  const allBottomCards: FunnelBottomCardData[] = [
    {
      key: 'total_conversion_value' as const,
      // ✅ Platform-specific label: Meta = "Wartość rezerwacji (zakupy w witrynie)", Google = "Łączna wartość rezerwacji"
      label: conversionValueLabel,
      value: `${displayTotalConversionValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`,
      numericValue: displayTotalConversionValue,
      comparisonKey: 'totalConversionValue',
      icon: <Calendar className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-600 to-slate-500"
    },
    {
      key: 'roas' as const,
      label: labels.roas || "ROAS",
      value: `${roas.toFixed(2)}x`,
      numericValue: roas,
      comparisonKey: 'roas',
      icon: <Calendar className="w-6 h-6" />,
      color: "text-white",
      bgColor: "bg-gradient-to-r from-slate-700 to-slate-600"
    }
  ];
  const bottomCards = allBottomCards.filter((card) => visible[card.key] !== false);

  if (funnelSteps.length === 0 && bottomCards.length === 0) {
    return null;
  }

  // Create funnel shape using clipPath
  const createFunnelPath = (index: number, total: number) => {
    const taperPercent = total > 1 ? 7 : 0;
    const topInset = index * taperPercent;
    const bottomInset = Math.min((index + 1) * taperPercent, 42);

    return `polygon(${topInset}% 0%, ${100 - topInset}% 0%, ${100 - bottomInset}% 100%, ${bottomInset}% 100%)`;
  };

  const renderComparisonText = (
    change: number | undefined,
    currentValue: number,
    previousValue: number | undefined
  ) => {
    if (
      change === undefined ||
      change === -999 ||
      currentValue === 0 ||
      !previousValue ||
      Math.abs(change) < 0.01
    ) {
      return null;
    }

    return (
      <div className="mt-1 text-[10px] font-semibold text-emerald-100 tabular-nums">
        <span className={change > 0 ? 'text-emerald-100' : 'text-red-100'}>
          {change > 0 ? '+' : '−'}{Math.abs(change).toFixed(1)}%
        </span>
        <span className="ml-1 text-white/70">vs rok temu</span>
      </div>
    );
  };

  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="mb-4 text-center">
        <h3 className="text-base font-semibold text-slate-950">Konwersje online</h3>
        <p className="text-[13px] text-slate-500">Ścieżka konwersji w systemie rezerwacji</p>
      </div>

      <div className="flex items-start justify-center gap-4">
        {/* Funnel Steps Column */}
        <div className="flex w-full flex-col items-center space-y-2">
          {funnelSteps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.2 }}
              className={`relative w-full max-w-[560px] ${step.bgColor} text-center shadow-sm transition-all duration-300 hover:shadow-md`}
              style={{
                clipPath: createFunnelPath(index, funnelSteps.length),
                height: '68px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div className="flex items-center justify-center space-x-3 px-8">
                <div className={`flex-shrink-0 rounded-md bg-slate-200/25 p-2 ${step.color}`}>
                  {step.icon}
                </div>
                <div className="text-center relative min-w-0 flex-1">
                  <div className={`truncate text-lg font-semibold leading-6 ${step.color}`}>
                    {step.value.toLocaleString()}
                  </div>
                  <div className={`truncate text-[11px] ${step.color}`}>
                    {step.label}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Bottom Cards */}
          {bottomCards.length > 0 && (
          <div className={`mt-3 grid w-full max-w-[560px] ${bottomCards.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5`}>
            {bottomCards.map((card, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (funnelSteps.length + index) * 0.2 }}
                className={`${card.bgColor} rounded-xl p-3.5 text-center shadow-sm transition-all duration-300 hover:shadow-md`}
              >
                <div className="flex items-center justify-center space-x-2.5">
                  <div className={`rounded-md bg-white/20 p-2 ${card.color}`}>
                    {card.icon}
                  </div>
                  <div className="text-center">
                    <div className={`text-base font-semibold ${card.color}`}>
                      {typeof card.value === 'string' ? card.value : (card.value as number).toLocaleString()}
                    </div>
                    {renderComparisonText(
                      yoyChanges?.[card.comparisonKey],
                      card.numericValue,
                      previousYear?.[card.comparisonKey]
                    )}
                    <div className={`text-[11px] ${card.color}`}>
                      {card.label}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          )}
        </div>

        {/* Year-over-Year Comparison Column */}
        {yoyChanges && (
          <div className="flex min-w-[78px] flex-col space-y-2">
            {funnelSteps.map((step, index) => {
              const yoyKeyByMetric = {
                booking_step_1: 'step1',
                booking_step_2: 'step2',
                booking_step_3: 'step3',
                reservations: 'reservations',
              } as const;
              const item = {
                key: yoyKeyByMetric[step.key],
                currentVal: step.value,
              };
              const change = yoyChanges[item.key as keyof typeof yoyChanges];
              const prevValue = previousYear?.[item.key as keyof typeof previousYear] ?? 0;

              const shouldHide =
                change === undefined ||
                change === -999 ||
                item.currentVal === 0 ||
                prevValue === 0 ||
                Math.abs(change ?? 0) < 0.01;

              if (shouldHide) {
                return (
                  <div key={index} style={{ height: '68px' }} />
                );
              }

              const safeChange = change ?? 0;
              const isPositive = safeChange > 0;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="min-w-[78px] rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-center text-[11px] font-medium text-white shadow-sm"
                  style={{ height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <div className="text-center">
                    <div className="font-bold">
                      {`${isPositive ? '↗' : '↘'} ${Math.abs(safeChange).toFixed(1)}%`}
                    </div>
                    <div className="text-[10px] mt-1">vs rok temu</div>
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