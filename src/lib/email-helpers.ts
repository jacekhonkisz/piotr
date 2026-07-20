/**
 * Email Helper Functions
 * Utility functions for email generation
 */

import {
  getBelmontePotentialOfflineValue,
  getMicroConversionsForOfflineModel,
  isBelmonteClient
} from './offline-reservation-estimate';
import { cpcFromStats, ctrPercentFromStats } from './ctr-from-stats';

/**
 * Polish month names
 */
export const POLISH_MONTHS: { [key: number]: string } = {
  1: 'styczeń',
  2: 'luty',
  3: 'marzec',
  4: 'kwiecień',
  5: 'maj',
  6: 'czerwiec',
  7: 'lipiec',
  8: 'sierpień',
  9: 'wrzesień',
  10: 'październik',
  11: 'listopad',
  12: 'grudzień'
};

/**
 * Get Polish month name from month number (1-12)
 */
export function getPolishMonthName(monthNumber: number): string {
  return POLISH_MONTHS[monthNumber] || '';
}

/**
 * Whole PLN amounts with Polish digit grouping (e.g. 2 495 000 zł).
 * Use this instead of `Math.round(n/1000) + ' 000 zł'`, which reads poorly.
 */
export function formatPlnWhole(amount: number): string {
  return `${Math.round(Number(amount) || 0).toLocaleString('pl-PL')} zł`;
}

/**
 * Get month number from date string (YYYY-MM-DD)
 */
export function getMonthFromDateString(dateString: string): number {
  const date = new Date(dateString);
  return date.getMonth() + 1; // getMonth() returns 0-11, we want 1-12
}

/**
 * Prepare client monthly report data with all calculations
 */
export function prepareClientMonthlyReportData(
  clientId: string,
  clientName: string,
  monthNumber: number,
  year: number,
  googleAdsData?: any,
  metaAdsData?: any,
  previousYearData?: any,
  /** Per-campaign Meta rows with `actions` (Belmonte offline micro from custom conversions). */
  metaCampaigns?: any[]
) {
  // Calculate totals
  const googleSpend = googleAdsData?.spend || 0;
  const metaSpend = metaAdsData?.spend || 0;
  const totalSpend = googleSpend + metaSpend;
  
  const googleReservations = googleAdsData?.reservations || 0;
  const metaReservations = metaAdsData?.reservations || 0;
  const totalOnlineReservations = googleReservations + metaReservations;
  
  const googleValue = googleAdsData?.reservationValue || 0;
  const metaValue = metaAdsData?.reservationValue || 0;
  const totalOnlineValue = googleValue + metaValue;
  
  // Calculate online cost percentage
  const onlineCostPercentage = totalOnlineValue > 0 
    ? (totalSpend / totalOnlineValue) * 100 
    : 0;
  
  // Calculate micro conversions
  const totalMicroConversions = getMicroConversionsForOfflineModel(
    clientName,
    {
      googleFormSubmits: 0,
      googleEmail: googleAdsData?.emailClicks || 0,
      googlePhone: googleAdsData?.phoneClicks || 0,
      metaFormSubmits: 0,
      metaEmail: metaAdsData?.emailClicks || 0,
      metaPhone: metaAdsData?.phoneClicks || 0
    },
    { metaCampaigns }
  );

  // Calculate 20% offline estimate (display; Belmonte offline *value* uses 10× avg — see below)
  const estimatedOfflineReservations = Math.round(totalMicroConversions * 0.2);

  let avgReservationValue =
    totalOnlineReservations > 0 ? totalOnlineValue / totalOnlineReservations : 0;
  if (isBelmonteClient(clientName) && metaReservations > 0) {
    avgReservationValue = metaValue / metaReservations;
  }
  const estimatedOfflineValue = isBelmonteClient(clientName)
    ? getBelmontePotentialOfflineValue(avgReservationValue)
    : estimatedOfflineReservations * avgReservationValue;

  const totalReservations = totalOnlineReservations + estimatedOfflineReservations;
  const totalValue = isBelmonteClient(clientName)
    ? estimatedOfflineValue + metaValue
    : totalOnlineValue + estimatedOfflineValue;
  const spendForCost = isBelmonteClient(clientName) ? metaSpend || totalSpend : totalSpend;
  const finalCostPercentage = totalValue > 0 ? (spendForCost / totalValue) * 100 : 0;
  
  // Year-over-year comparison (if previous year data available)
  let yoyComparison = undefined;
  if (previousYearData) {
    const googlePrevValue = previousYearData.googleAds?.reservationValue || 0;
    const metaPrevValue = previousYearData.metaAds?.reservationValue || 0;
    
    yoyComparison = {
      googleAdsIncrease: googleValue > 0 && googlePrevValue > 0
        ? ((googleValue - googlePrevValue) / googlePrevValue) * 100
        : undefined,
      metaAdsIncrease: metaValue > 0 && metaPrevValue > 0
        ? ((metaValue - metaPrevValue) / metaPrevValue) * 100
        : undefined
    };
  }
  
  // Generate dashboard URL
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reports/monthly/${year}-${String(monthNumber).padStart(2, '0')}?client=${clientId}`;
  
  return {
    dashboardUrl,
    googleAds: googleAdsData ? {
      spend: googleSpend,
      impressions: googleAdsData.impressions || 0,
      clicks: googleAdsData.clicks || 0,
      cpc: cpcFromStats(
        googleAdsData.averageCpc,
        googleSpend,
        googleAdsData.clicks || 0
      ),
      ctr: ctrPercentFromStats(
        googleAdsData.averageCtr,
        googleAdsData.clicks || 0,
        googleAdsData.impressions || 0
      ),
      emailClicks: googleAdsData.emailClicks || 0,
      phoneClicks: googleAdsData.phoneClicks || 0,
      bookingStep1: googleAdsData.bookingStep1 || 0,
      bookingStep2: googleAdsData.bookingStep2 || 0,
      bookingStep3: googleAdsData.bookingStep3 || 0,
      reservations: googleReservations,
      reservationValue: googleValue,
      roas: googleSpend > 0 ? googleValue / googleSpend : 0
    } : undefined,
    metaAds: metaAdsData ? {
      spend: metaSpend,
      impressions: metaAdsData.impressions || 0,
      linkClicks: metaAdsData.linkClicks || metaAdsData.clicks || 0,
      ctr: ctrPercentFromStats(
        metaAdsData.averageCtr,
        metaAdsData.linkClicks || metaAdsData.clicks || 0,
        metaAdsData.impressions || 0
      ),
      cpc: cpcFromStats(
        metaAdsData.averageCpc,
        metaSpend,
        metaAdsData.linkClicks || metaAdsData.clicks || 0
      ),
      emailClicks: metaAdsData.emailClicks || 0,
      phoneClicks: metaAdsData.phoneClicks || 0,
      bookingStep1: metaAdsData.bookingStep1 || 0,
      bookingStep2: metaAdsData.bookingStep2 || 0,
      bookingStep3: metaAdsData.bookingStep3 || 0,
      reservations: metaReservations,
      reservationValue: metaValue,
      roas: metaSpend > 0 ? metaValue / metaSpend : 0
    } : undefined,
    yoyComparison,
    totalOnlineReservations,
    totalOnlineValue,
    onlineCostPercentage,
    totalMicroConversions,
    estimatedOfflineReservations,
    estimatedOfflineValue,
    finalCostPercentage,
    totalValue
  };
}










