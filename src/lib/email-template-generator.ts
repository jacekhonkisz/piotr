/**
 * Email Template Generator
 * 
 * Generates email templates that EXACTLY match what FlexibleEmailService sends
 * This ensures preview components show the same content as actual emails
 */

import { formatPlnWhole } from './email-helpers';
import { getMonthlyOfflineNarrative } from './monthly-report-offline-narrative';

export interface MonthlyReportData {
  dashboardUrl: string;
  googleAds?: {
    spend: number;
    impressions: number;
    clicks: number;
    cpc: number;
    ctr: number;
    emailClicks: number;
    phoneClicks: number;
    bookingStep1: number;
    bookingStep2: number;
    bookingStep3: number;
    reservations: number;
    reservationValue: number;
    roas: number;
  };
  metaAds?: {
    spend: number;
    impressions: number;
    linkClicks: number;
    ctr: number;
    cpc: number;
    emailClicks: number;
    phoneClicks: number;
    reservations: number;
    reservationValue: number;
    roas: number;
  };
  yoyComparison?: {
    googleAdsIncrease?: number;
    metaAdsIncrease?: number;
  };
  totalOnlineReservations: number;
  totalOnlineValue: number;
  onlineCostPercentage: number;
  totalMicroConversions: number;
  estimatedOfflineReservations: number;
  estimatedOfflineValue: number;
  finalCostPercentage: number;
  totalValue: number;
}

/**
 * Generate the NEW monthly report template
 * This EXACTLY matches FlexibleEmailService.generateClientMonthlyReportTemplate()
 */
export function generateMonthlyReportTemplate(
  clientName: string,
  monthName: string,
  year: number,
  reportData: MonthlyReportData
): { subject: string; text: string; html: string } {
  
  const subject = `Podsumowanie miesiąca - ${monthName} ${year} | ${clientName}`;

  const offlineNarrative = getMonthlyOfflineNarrative(clientName, {
    totalMicroConversions: reportData.totalMicroConversions,
    estimatedOfflineReservations: reportData.estimatedOfflineReservations,
    estimatedOfflineValue: reportData.estimatedOfflineValue,
    finalCostPercentage: reportData.finalCostPercentage,
    totalValue: reportData.totalValue,
    monthName,
    year,
    metaReservationValue: reportData.metaAds?.reservationValue ?? 0
  });
  
  // Text version (what clients actually receive)
  const text = `Dzień dobry,

poniżej przesyłam podsumowanie najważniejszych danych z poprzedniego miesiąca.

Szczegółowe raporty za działania znajdą Państwo w panelu klienta: ${reportData.dashboardUrl}

W załączniku przesyłam też szczegółowy raport PDF.
${reportData.googleAds ? `
1. Google Ads

Wydana kwota: ${reportData.googleAds.spend.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
Wyświetlenia: ${reportData.googleAds.impressions.toLocaleString('pl-PL')}
Kliknięcia: ${reportData.googleAds.clicks.toLocaleString('pl-PL')}
CPC: ${reportData.googleAds.cpc.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
CTR: ${reportData.googleAds.ctr.toFixed(2)}%
Kliknięcia w adres e-mail: ${reportData.googleAds.emailClicks.toLocaleString('pl-PL')}
Kliknięcia w numer telefonu: ${reportData.googleAds.phoneClicks.toLocaleString('pl-PL')}
Booking step 1: ${reportData.googleAds.bookingStep1.toLocaleString('pl-PL')}
Booking step 2: ${reportData.googleAds.bookingStep2.toLocaleString('pl-PL')}
Booking step 3: ${reportData.googleAds.bookingStep3.toLocaleString('pl-PL')}
Rezerwacje: ${reportData.googleAds.reservations.toLocaleString('pl-PL')}
Wartość rezerwacji: ${reportData.googleAds.reservationValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
ROAS: ${reportData.googleAds.roas.toFixed(2)} (${(reportData.googleAds.roas * 100).toFixed(0)}%)
` : ''}
${reportData.metaAds ? `
2. Meta Ads

Wydana kwota: ${reportData.metaAds.spend.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
Wyświetlenia: ${reportData.metaAds.impressions.toLocaleString('pl-PL')}
Kliknięcia linku: ${reportData.metaAds.linkClicks.toLocaleString('pl-PL')}
CTR (link): ${reportData.metaAds.ctr.toFixed(2)}%
CPC (link): ${reportData.metaAds.cpc.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
Kliknięcia w adres e-mail: ${reportData.metaAds.emailClicks.toLocaleString('pl-PL')}
Kliknięcia w numer telefonu: ${reportData.metaAds.phoneClicks.toLocaleString('pl-PL')}
Rezerwacje: ${reportData.metaAds.reservations.toLocaleString('pl-PL')}
Wartość rezerwacji: ${reportData.metaAds.reservationValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
ROAS: ${reportData.metaAds.roas.toFixed(2)} (${(reportData.metaAds.roas * 100).toFixed(0)}%)
` : ''}

Podsumowanie ogólne
${reportData.yoyComparison && (reportData.yoyComparison.googleAdsIncrease || reportData.yoyComparison.metaAdsIncrease) ? `
Porównanie naszych wyników rok do roku wygląda następująco:
${reportData.yoyComparison.googleAdsIncrease ? `- Google Ads - wartość rezerwacji jest wyższa aż o ${reportData.yoyComparison.googleAdsIncrease.toFixed(0)}%.\n` : ''}${reportData.yoyComparison.metaAdsIncrease ? `- Facebook Ads - wartość rezerwacji jest wyższa aż o ${reportData.yoyComparison.metaAdsIncrease.toFixed(0)}%.\n` : ''}
` : ''}Poprzedni miesiąc przyniósł nam łącznie ${reportData.totalOnlineReservations.toLocaleString('pl-PL')} rezerwacji online o łącznej wartości ponad ${Math.round(reportData.totalOnlineValue / 1000).toLocaleString('pl-PL')} tys. zł.

Koszt pozyskania rezerwacji online zatem wyniósł: ${reportData.onlineCostPercentage.toFixed(2)}%.

${offlineNarrative.highlightParagraphsText[0]}

${offlineNarrative.highlightParagraphsText[1]}

${offlineNarrative.totalClosingLine}

W razie pytań proszę o kontakt.

Pozdrawiam
Piotr`;

  // HTML version (same content, styled)
  const html = text.replace(/\n/g, '<br>');

  return { subject, text, html };
}

/**
 * Helper to get Polish month name
 */
export function getPolishMonthName(monthNumber: number): string {
  const months = [
    'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
    'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
  ];
  return months[monthNumber - 1] || 'unknown';
}





