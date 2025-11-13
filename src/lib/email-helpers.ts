/**
 * Email Helper Functions
 * Utility functions for email generation
 */

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
  previousYearData?: any
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
  const googleMicro = (googleAdsData?.formSubmits || 0) + 
                      (googleAdsData?.emailClicks || 0) + 
                      (googleAdsData?.phoneClicks || 0);
  const metaMicro = (metaAdsData?.formSubmits || 0) + 
                    (metaAdsData?.emailClicks || 0) + 
                    (metaAdsData?.phoneClicks || 0);
  const totalMicroConversions = googleMicro + metaMicro;
  
  // Calculate 20% offline estimate
  const estimatedOfflineReservations = Math.round(totalMicroConversions * 0.2);
  
  // Calculate average reservation value for offline estimate
  const avgReservationValue = totalOnlineReservations > 0 
    ? totalOnlineValue / totalOnlineReservations 
    : 0;
  const estimatedOfflineValue = estimatedOfflineReservations * avgReservationValue;
  
  // Calculate final totals with offline
  const totalReservations = totalOnlineReservations + estimatedOfflineReservations;
  const totalValue = totalOnlineValue + estimatedOfflineValue;
  const finalCostPercentage = totalValue > 0 
    ? (totalSpend / totalValue) * 100 
    : 0;
  
  // Year-over-year comparison (if previous year data available)
  let yoyComparison = undefined;
  if (previousYearData) {
    const googlePrevValue = previousYearData.googleAds?.reservationValue || 0;
    const metaPrevValue = previousYearData.metaAds?.reservationValue || 0;
    
    yoyComparison = {
      googleAdsIncrease: googlePrevValue > 0 
        ? ((googleValue - googlePrevValue) / googlePrevValue) * 100 
        : undefined,
      metaAdsIncrease: metaPrevValue > 0 
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
      cpc: googleAdsData.cpc || 0,
      ctr: googleAdsData.ctr || 0,
      formSubmits: googleAdsData.formSubmits || 0,
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
      formSubmits: metaAdsData.formSubmits || 0,
      emailClicks: metaAdsData.emailClicks || 0,
      phoneClicks: metaAdsData.phoneClicks || 0,
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




