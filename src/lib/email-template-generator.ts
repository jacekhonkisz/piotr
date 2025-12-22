/**
 * Email Template Generator
 * 
 * Generates email templates that EXACTLY match what FlexibleEmailService sends
 * This ensures preview components show the same content as actual emails
 */

export interface MonthlyReportData {
  dashboardUrl: string;
  googleAds?: {
    spend: number;
    impressions: number;
    clicks: number;
    cpc: number;
    ctr: number;
    formSubmits: number;
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
    formSubmits: number;
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
Wysłanie formularza: ${reportData.googleAds.formSubmits.toLocaleString('pl-PL')}
Kliknięcia w adres e-mail: ${reportData.googleAds.emailClicks.toLocaleString('pl-PL')}
Kliknięcia w numer telefonu: ${reportData.googleAds.phoneClicks.toLocaleString('pl-PL')}
Booking Engine krok 1: ${reportData.googleAds.bookingStep1.toLocaleString('pl-PL')}
Booking Engine krok 2: ${reportData.googleAds.bookingStep2.toLocaleString('pl-PL')}
Booking Engine krok 3: ${reportData.googleAds.bookingStep3.toLocaleString('pl-PL')}
Rezerwacje: ${reportData.googleAds.reservations.toLocaleString('pl-PL')}
Wartość rezerwacji: ${reportData.googleAds.reservationValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
ROAS: ${reportData.googleAds.roas.toFixed(2)} (${(reportData.googleAds.roas * 100).toFixed(0)}%)
` : ''}
${reportData.metaAds ? `
2. Meta Ads

Wydana kwota: ${reportData.metaAds.spend.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
Wyświetlenia: ${reportData.metaAds.impressions.toLocaleString('pl-PL')}
Kliknięcia linku: ${reportData.metaAds.linkClicks.toLocaleString('pl-PL')}
Wysłanie formularza: ${reportData.metaAds.formSubmits.toLocaleString('pl-PL')}
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

Dodatkowo pozyskaliśmy też ${reportData.totalMicroConversions.toLocaleString('pl-PL')} mikro konwersji (telefonów, email i formularzy), które z pewnością przyczyniły się do pozyskania dodatkowych rezerwacji offline. Nawet jeśli tylko 20% z nich zakończyło się rezerwacją, to pozyskaliśmy ${reportData.estimatedOfflineReservations.toLocaleString('pl-PL')} rezerwacji i dodatkowe ok. ${Math.round(reportData.estimatedOfflineValue / 1000).toLocaleString('pl-PL')} tys. zł tą drogą.

Dodając te potencjalne rezerwacje do rezerwacji online, to koszt pozyskania rezerwacji spada do poziomu ok. ${reportData.finalCostPercentage.toFixed(2)}%.

Zatem suma wartości rezerwacji za ${monthName} ${year} (online + offline) wynosi około: ${Math.round(reportData.totalValue / 1000).toLocaleString('pl-PL')} 000 zł.

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





