# New Email Template Implementation

## Overview

This document shows how to implement the new client-focused email template based on your specifications.

---

## 1. Email Subject Format

```typescript
const subject = `Podsumowanie miesiąca - ${monthName} ${year} | ${clientName}`;
```

Example: `"Podsumowanie miesiąca - sierpień 2025 | Belmonte Hotel"`

---

## 2. Template Function (Add to EmailService)

Add this method to `src/lib/email.ts`:

```typescript
private generateClientReportEmailTemplate(
  clientName: string,
  monthName: string, // e.g., "sierpień"
  year: number,
  reportData: {
    dateRange: string;
    dashboardUrl: string; // Link to client panel
    
    // Google Ads Data
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
    
    // Meta Ads Data
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
    
    // Year-over-Year Comparison (optional)
    yoyComparison?: {
      googleAdsIncrease?: number; // percentage
      metaAdsIncrease?: number; // percentage
    };
    
    // Summary calculations
    totalOnlineReservations: number;
    totalOnlineValue: number;
    onlineCostPercentage: number;
    totalMicroConversions: number;
    estimatedOfflineReservations: number; // 20% of micro conversions
    estimatedOfflineValue: number;
    finalCostPercentage: number; // with offline included
    totalValue: number; // online + offline
  }
): EmailTemplate {
  const subject = `Podsumowanie miesiąca - ${monthName} ${year} | ${clientName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.8; 
          color: #333; 
          margin: 0; 
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container { 
          max-width: 650px; 
          margin: 0 auto; 
          background: #ffffff;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 20px;
        }
        .intro {
          margin-bottom: 30px;
          line-height: 1.8;
        }
        .section {
          margin: 30px 0;
          padding: 20px;
          background: #f9f9f9;
          border-left: 4px solid #4285f4;
          border-radius: 4px;
        }
        .section.meta {
          border-left-color: #1877f2;
        }
        .section.summary {
          border-left-color: #34a853;
          background: #f0f8f4;
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 15px;
          color: #1a1a1a;
        }
        .metric-line {
          margin: 8px 0;
          font-size: 15px;
        }
        .metric-label {
          display: inline-block;
          width: 200px;
          color: #555;
        }
        .metric-value {
          font-weight: 600;
          color: #1a1a1a;
        }
        .highlight {
          background: #fff3cd;
          padding: 15px;
          border-radius: 4px;
          margin: 20px 0;
          border-left: 4px solid #ffc107;
        }
        .link {
          color: #4285f4;
          text-decoration: none;
          font-weight: 600;
        }
        .link:hover {
          text-decoration: underline;
        }
        .closing {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
        }
        .comparison {
          margin: 15px 0;
          padding-left: 20px;
        }
        .total-box {
          background: #e8f5e9;
          padding: 20px;
          border-radius: 6px;
          margin: 20px 0;
          text-align: center;
          border: 2px solid #4caf50;
        }
        .total-box .amount {
          font-size: 28px;
          font-weight: bold;
          color: #2e7d32;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="greeting">
          Dzień dobry,
        </div>
        
        <div class="intro">
          <p>poniżej przesyłam podsumowanie najważniejszych danych z poprzedniego miesiąca.</p>
          
          <p>Szczegółowe raporty za działania znajdą Państwo w panelu klienta - <a href="${reportData.dashboardUrl}" class="link">TUTAJ</a></p>
          
          <p>W załączniku przesyłam też szczegółowy raport PDF.</p>
        </div>

        ${reportData.googleAds ? `
        <!-- Google Ads Section -->
        <div class="section">
          <div class="section-title">1. Google Ads</div>
          
          <div class="metric-line">
            <span class="metric-label">Wydana kwota:</span>
            <span class="metric-value">${reportData.googleAds.spend.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Wyświetlenia:</span>
            <span class="metric-value">${reportData.googleAds.impressions.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Kliknięcia:</span>
            <span class="metric-value">${reportData.googleAds.clicks.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">CPC:</span>
            <span class="metric-value">${reportData.googleAds.cpc.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">CTR:</span>
            <span class="metric-value">${reportData.googleAds.ctr.toFixed(2)}%</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Wysłanie formularza:</span>
            <span class="metric-value">${reportData.googleAds.formSubmits.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Kliknięcia w adres e-mail:</span>
            <span class="metric-value">${reportData.googleAds.emailClicks.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Kliknięcia w numer telefonu:</span>
            <span class="metric-value">${reportData.googleAds.phoneClicks.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Booking Engine krok 1:</span>
            <span class="metric-value">${reportData.googleAds.bookingStep1.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Booking Engine krok 2:</span>
            <span class="metric-value">${reportData.googleAds.bookingStep2.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Booking Engine krok 3:</span>
            <span class="metric-value">${reportData.googleAds.bookingStep3.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Rezerwacje:</span>
            <span class="metric-value">${reportData.googleAds.reservations.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Wartość rezerwacji:</span>
            <span class="metric-value">${reportData.googleAds.reservationValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">ROAS:</span>
            <span class="metric-value">${reportData.googleAds.roas.toFixed(2)} (${(reportData.googleAds.roas * 100).toFixed(0)}%)</span>
          </div>
        </div>
        ` : ''}

        ${reportData.metaAds ? `
        <!-- Meta Ads Section -->
        <div class="section meta">
          <div class="section-title">2. Meta Ads</div>
          
          <div class="metric-line">
            <span class="metric-label">Wydana kwota:</span>
            <span class="metric-value">${reportData.metaAds.spend.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Wyświetlenia:</span>
            <span class="metric-value">${reportData.metaAds.impressions.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Kliknięcia linku:</span>
            <span class="metric-value">${reportData.metaAds.linkClicks.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Wysłanie formularza:</span>
            <span class="metric-value">${reportData.metaAds.formSubmits.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Kliknięcia w adres e-mail:</span>
            <span class="metric-value">${reportData.metaAds.emailClicks.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Kliknięcia w numer telefonu:</span>
            <span class="metric-value">${reportData.metaAds.phoneClicks.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Rezerwacje:</span>
            <span class="metric-value">${reportData.metaAds.reservations.toLocaleString('pl-PL')}</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">Wartość rezerwacji:</span>
            <span class="metric-value">${reportData.metaAds.reservationValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</span>
          </div>
          <div class="metric-line">
            <span class="metric-label">ROAS:</span>
            <span class="metric-value">${reportData.metaAds.roas.toFixed(2)} (${(reportData.metaAds.roas * 100).toFixed(0)}%)</span>
          </div>
        </div>
        ` : ''}

        <!-- Summary Section -->
        <div class="section summary">
          <div class="section-title">Podsumowanie ogólne</div>
          
          ${reportData.yoyComparison && (reportData.yoyComparison.googleAdsIncrease || reportData.yoyComparison.metaAdsIncrease) ? `
          <p><strong>Porównanie naszych wyników rok do roku wygląda następująco:</strong></p>
          <div class="comparison">
            ${reportData.yoyComparison.googleAdsIncrease ? `• Google Ads - wartość rezerwacji jest wyższa aż o <strong>${reportData.yoyComparison.googleAdsIncrease.toFixed(0)}%</strong>.<br>` : ''}
            ${reportData.yoyComparison.metaAdsIncrease ? `• Facebook Ads - wartość rezerwacji jest wyższa aż o <strong>${reportData.yoyComparison.metaAdsIncrease.toFixed(0)}%</strong>.` : ''}
          </div>
          ` : ''}

          <div style="margin: 25px 0;">
            <p>Poprzedni miesiąc przyniósł nam łącznie <strong>${reportData.totalOnlineReservations.toLocaleString('pl-PL')} rezerwacji online</strong> o łącznej wartości ponad <strong>${Math.round(reportData.totalOnlineValue / 1000).toLocaleString('pl-PL')} tys. zł</strong>.</p>
            <p>Koszt pozyskania rezerwacji online zatem wyniósł: <strong>${reportData.onlineCostPercentage.toFixed(2)}%</strong>.</p>
          </div>

          <div class="highlight">
            <p>Dodatkowo pozyskaliśmy też <strong>${reportData.totalMicroConversions.toLocaleString('pl-PL')} mikro konwersji</strong> (telefonów, email i formularzy), które z pewnością przyczyniły się do pozyskania dodatkowych rezerwacji offline. Nawet jeśli tylko 20% z nich zakończyło się rezerwacją, to pozyskaliśmy <strong>${reportData.estimatedOfflineReservations.toLocaleString('pl-PL')} rezerwacji</strong> i dodatkowe ok. <strong>${Math.round(reportData.estimatedOfflineValue / 1000).toLocaleString('pl-PL')} tys. zł</strong> tą drogą.</p>
            
            <p>Dodając te potencjalne rezerwacje do rezerwacji online, to koszt pozyskania rezerwacji spada do poziomu ok. <strong>${reportData.finalCostPercentage.toFixed(2)}%</strong>.</p>
          </div>

          <div class="total-box">
            <p style="margin: 0; font-size: 18px; color: #555;">Suma wartości rezerwacji za ${monthName} ${year} (online + offline):</p>
            <div class="amount">około ${Math.round(reportData.totalValue / 1000).toLocaleString('pl-PL')} 000 zł</div>
          </div>
        </div>

        <div class="closing">
          <p>W razie pytań proszę o kontakt.</p>
          <p>Pozdrawiam<br><strong>Piotr</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Text version
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
` : ''}
Poprzedni miesiąc przyniósł nam łącznie ${reportData.totalOnlineReservations.toLocaleString('pl-PL')} rezerwacji online o łącznej wartości ponad ${Math.round(reportData.totalOnlineValue / 1000).toLocaleString('pl-PL')} tys. zł.

Koszt pozyskania rezerwacji online zatem wyniósł: ${reportData.onlineCostPercentage.toFixed(2)}%.

Dodatkowo pozyskaliśmy też ${reportData.totalMicroConversions.toLocaleString('pl-PL')} mikro konwersji (telefonów, email i formularzy), które z pewnością przyczyniły się do pozyskania dodatkowych rezerwacji offline. Nawet jeśli tylko 20% z nich zakończyło się rezerwacją, to pozyskaliśmy ${reportData.estimatedOfflineReservations.toLocaleString('pl-PL')} rezerwacji i dodatkowe ok. ${Math.round(reportData.estimatedOfflineValue / 1000).toLocaleString('pl-PL')} tys. zł tą drogą.

Dodając te potencjalne rezerwacje do rezerwacji online, to koszt pozyskania rezerwacji spada do poziomu ok. ${reportData.finalCostPercentage.toFixed(2)}%.

Zatem suma wartości rezerwacji za ${monthName} ${year} (online + offline) wynosi około: ${Math.round(reportData.totalValue / 1000).toLocaleString('pl-PL')} 000 zł.

W razie pytań proszę o kontakt.

Pozdrawiam
Piotr`;

  return { subject, html, text };
}
```

---

## 3. Data Preparation Helper

Add this helper function to calculate all the summary metrics:

```typescript
function prepareClientReportData(
  clientId: string,
  clientName: string,
  monthName: string,
  year: number,
  googleData: any, // Your Google Ads data
  metaData: any,   // Your Meta Ads data
  previousYearData?: any // Optional for YoY comparison
) {
  // Calculate totals
  const googleSpend = googleData?.spend || 0;
  const metaSpend = metaData?.spend || 0;
  const totalSpend = googleSpend + metaSpend;
  
  const googleReservations = googleData?.reservations || 0;
  const metaReservations = metaData?.reservations || 0;
  const totalOnlineReservations = googleReservations + metaReservations;
  
  const googleValue = googleData?.reservationValue || 0;
  const metaValue = metaData?.reservationValue || 0;
  const totalOnlineValue = googleValue + metaValue;
  
  // Calculate online cost percentage
  const onlineCostPercentage = totalOnlineValue > 0 
    ? (totalSpend / totalOnlineValue) * 100 
    : 0;
  
  // Calculate micro conversions
  const googleMicro = (googleData?.formSubmits || 0) + 
                      (googleData?.emailClicks || 0) + 
                      (googleData?.phoneClicks || 0);
  const metaMicro = (metaData?.formSubmits || 0) + 
                    (metaData?.emailClicks || 0) + 
                    (metaData?.phoneClicks || 0);
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
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reports/monthly/${year}-${String(month).padStart(2, '0')}?client=${clientId}`;
  
  return {
    dateRange: `${year}-${String(month).padStart(2, '0')}`,
    dashboardUrl,
    googleAds: googleData ? {
      spend: googleSpend,
      impressions: googleData.impressions || 0,
      clicks: googleData.clicks || 0,
      cpc: googleData.cpc || 0,
      ctr: googleData.ctr || 0,
      formSubmits: googleData.formSubmits || 0,
      emailClicks: googleData.emailClicks || 0,
      phoneClicks: googleData.phoneClicks || 0,
      bookingStep1: googleData.bookingStep1 || 0,
      bookingStep2: googleData.bookingStep2 || 0,
      bookingStep3: googleData.bookingStep3 || 0,
      reservations: googleReservations,
      reservationValue: googleValue,
      roas: googleSpend > 0 ? googleValue / googleSpend : 0
    } : undefined,
    metaAds: metaData ? {
      spend: metaSpend,
      impressions: metaData.impressions || 0,
      linkClicks: metaData.linkClicks || 0,
      formSubmits: metaData.formSubmits || 0,
      emailClicks: metaData.emailClicks || 0,
      phoneClicks: metaData.phoneClicks || 0,
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
```

---

## 4. Public Method (Add to EmailService)

```typescript
async sendClientMonthlyReport(
  clientEmail: string,
  clientName: string,
  monthName: string, // "sierpień", "styczeń", etc.
  year: number,
  reportData: any, // Use the prepared data structure
  pdfBuffer?: Buffer
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const fromEmail = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourdomain.com';
  
  const emailTemplate = this.generateClientReportEmailTemplate(
    clientName,
    monthName,
    year,
    reportData
  );
  
  const emailData: EmailData = {
    to: clientEmail,
    from: fromEmail,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text,
  };

  if (pdfBuffer) {
    const fileName = `Raport_${monthName}_${year}_${clientName.replace(/\s+/g, '_')}.pdf`;
    emailData.attachments = [{
      filename: fileName,
      content: pdfBuffer,
      contentType: 'application/pdf'
    }];
  }

  return this.sendEmail(emailData);
}
```

---

## 5. Usage Example

```typescript
// In your email sending route or scheduler
const emailService = EmailService.getInstance();

// Prepare the data
const reportData = prepareClientReportData(
  client.id,
  client.name,
  'sierpień', // month name in Polish
  2025,
  googleAdsData,
  metaAdsData,
  previousYearData // optional
);

// Generate PDF (using your existing PDF generation)
const pdfBuffer = await generatePDF(reportData);

// Send the email
const result = await emailService.sendClientMonthlyReport(
  client.email,
  client.name,
  'sierpień',
  2025,
  reportData,
  pdfBuffer
);
```

---

## 6. Month Names Helper

```typescript
const POLISH_MONTHS = {
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

function getPolishMonthName(monthNumber: number): string {
  return POLISH_MONTHS[monthNumber as keyof typeof POLISH_MONTHS] || '';
}
```

---

## 7. Key Features

✅ **Subject Line:** `Podsumowanie miesiąca - [month] [year] | [client name]`  
✅ **Dashboard Link:** Links to client's online report panel  
✅ **Google Ads Section:** All metrics with Polish formatting  
✅ **Meta Ads Section:** All metrics with Polish formatting  
✅ **Year-over-Year Comparison:** Conditional - only shows if data available  
✅ **Micro Conversions:** Calculates phones + emails + forms  
✅ **Offline Estimate:** 20% of micro conversions  
✅ **Cost Percentages:** Both online-only and with offline included  
✅ **Total Value Box:** Highlighted final summary  
✅ **PDF Attachment:** Attached with proper filename  
✅ **Professional Closing:** "W razie pytań proszę o kontakt. Pozdrawiam Piotr"

---

## 8. Notes

- Year-over-year comparison section is **conditionally rendered** - it won't show if there's no previous year data
- All numbers use **Polish formatting** (space as thousands separator, comma as decimal)
- Dashboard URL is **dynamically generated** based on client ID and report period
- The template is **responsive** and looks good on mobile devices
- The design is **simpler and more business-focused** than the previous colorful template





