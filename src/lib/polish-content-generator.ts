/**
 * Polish Content Generator
 * Utilities for generating Polish content for automated reports
 */

interface ReportMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
}

interface ReportPeriod {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  type: 'monthly' | 'weekly';
}

interface ClientData {
  name: string;
  email: string;
}

/**
 * Format Polish currency (12 500,50 zł)
 */
export function formatPolishCurrency(amount: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format Polish numbers (250 000)
 */
export function formatPolishNumber(number: number): string {
  return new Intl.NumberFormat('pl-PL').format(number);
}

/**
 * Format Polish percentage (2,00%)
 */
export function formatPolishPercentage(percentage: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(percentage / 100);
}

/**
 * Format Polish date (31.07.2025)
 */
export function formatPolishDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL');
}

/**
 * Generate Polish subject line based on report type and period
 */
export function generatePolishSubject(reportType: string, periodStart: string, periodEnd: string): string {
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  
  if (reportType === 'monthly') {
    const months = [
      'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
      'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
    ];
    const month = months[endDate.getMonth()];
    const year = endDate.getFullYear();
    return `Raport Meta Ads - ${month} ${year}`;
  } else {
    const start = formatPolishDate(periodStart);
    const end = formatPolishDate(periodEnd);
    return `Raport Meta Ads - Tydzień ${start} - ${end}`;
  }
}

/**
 * Generate comprehensive Polish summary for email body
 */
export function generatePolishSummary(
  metrics: ReportMetrics,
  period: ReportPeriod
): string {
  const startDate = formatPolishDate(period.start);
  const endDate = formatPolishDate(period.end);
  
  const spend = formatPolishCurrency(metrics.totalSpend);
  const impressions = formatPolishNumber(metrics.totalImpressions);
  const clicks = formatPolishNumber(metrics.totalClicks);
  const conversions = formatPolishNumber(metrics.totalConversions);
  const ctr = formatPolishPercentage(metrics.ctr);
  const cpc = formatPolishCurrency(metrics.cpc);
  const cpa = formatPolishCurrency(metrics.cpa);

  // Determine period description
  const periodDescription = period.type === 'monthly' 
    ? `miesiącu od ${startDate} do ${endDate}`
    : `tygodniu od ${startDate} do ${endDate}`;

  return `W ${periodDescription} wydaliśmy na kampanie reklamowe ${spend}. Działania te zaowocowały ${impressions} wyświetleniami, a liczba kliknięć wyniosła ${clicks}, co dało CTR na poziomie ${ctr}. Średni koszt kliknięcia (CPC) wyniósł ${cpc}. W tym okresie zaobserwowaliśmy ${conversions} konwersje, co przekłada się na koszt pozyskania konwersji (CPA) na poziomie ${cpa}.`;
}

/**
 * Generate complete Polish email template
 */
export function generatePolishEmailTemplate(
  clientData: ClientData,
  metrics: ReportMetrics,
  period: ReportPeriod,
  polishSummary: string
): { html: string; text: string } {
  const periodDisplay = period.type === 'monthly'
    ? `miesiąc ${formatPolishDate(period.start)} - ${formatPolishDate(period.end)}`
    : `tydzień ${formatPolishDate(period.start)} - ${formatPolishDate(period.end)}`;

  const spend = formatPolishCurrency(metrics.totalSpend);
  const impressions = formatPolishNumber(metrics.totalImpressions);
  const clicks = formatPolishNumber(metrics.totalClicks);
  const conversions = formatPolishNumber(metrics.totalConversions);
  const ctr = formatPolishPercentage(metrics.ctr);
  const cpc = formatPolishCurrency(metrics.cpc);
  const cpm = formatPolishCurrency(metrics.cpm);

  const textContent = `Szanowni Państwo ${clientData.name},

Przesyłamy raport wyników kampanii Meta Ads za okres ${periodDisplay}.

Podsumowanie:
${polishSummary}

Kompletny szczegółowy raport znajduje się w załączeniu PDF. Prosimy o otwarcie załącznika w celu zapoznania się z pełną analizą, wykresami i szczegółami kampanii.

W razie pytań dotyczących raportu lub chęci omówienia strategii optymalizacji, prosimy o kontakt.

Z poważaniem,
Zespół Meta Ads`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Raport Meta Ads</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1877f2; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .summary { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #1877f2; }
        .metrics { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
        .metric-item { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
        .metric-item:last-child { border-bottom: none; }
        .metric-label { font-weight: bold; }
        .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        .attachment-notice { background: #e3f2fd; padding: 10px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #2196f3; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Raport Meta Ads</h1>
        <p>${periodDisplay}</p>
    </div>
    
    <div class="content">
        <p><strong>Szanowni Państwo ${clientData.name},</strong></p>
        
        <p>Przesyłamy raport wyników kampanii Meta Ads za okres <strong>${periodDisplay}</strong>.</p>
        
        <div class="summary">
            <h3>📈 Podsumowanie:</h3>
            <p>${polishSummary}</p>
        </div>
        
        <div class="metrics">
            <h3>📊 Główne wskaźniki:</h3>
            <div class="metric-item">
                <span class="metric-label">Łączne wydatki:</span>
                <span>${spend}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">Wyświetlenia:</span>
                <span>${impressions}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">Kliknięcia:</span>
                <span>${clicks}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">Konwersje:</span>
                <span>${conversions}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">CTR:</span>
                <span>${ctr}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">CPC:</span>
                <span>${cpc}</span>
            </div>
            <div class="metric-item">
                <span class="metric-label">CPM:</span>
                <span>${cpm}</span>
            </div>
        </div>
        
        <div class="attachment-notice">
            <p><strong>📎 Załącznik PDF:</strong> Kompletny szczegółowy raport znajduje się w załączeniu PDF. Prosimy o otwarcie załącznika w celu zapoznania się z pełną analizą, wykresami i szczegółami kampanii.</p>
        </div>
        
        <p>W razie pytań dotyczących raportu lub chęci omówienia strategii optymalizacji, prosimy o kontakt.</p>
        
        <p><strong>Z poważaniem,<br>Zespół Meta Ads</strong></p>
    </div>
    
    <div class="footer">
        <p>To jest automatyczny raport wygenerowany przez system zarządzania Meta Ads.<br>
        W celu uzyskania pomocy, skontaktuj się z nami pod adresem support@example.com</p>
    </div>
</body>
</html>`;

  return {
    html: htmlContent,
    text: textContent
  };
}

/**
 * Calculate period dates for monthly reports (last complete month)
 */
export function getLastCompleteMonth(): { start: string; end: string } {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const start = lastMonth.toISOString().split('T')[0]!;
  
  const endOfMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
  const end = endOfMonth.toISOString().split('T')[0]!;
  
  return { start, end };
}

/**
 * Calculate period dates for weekly reports (last complete week, Monday to Sunday)
 */
export function getLastCompleteWeek(): { start: string; end: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate last Monday
  const daysToLastMonday = dayOfWeek === 0 ? 8 : dayOfWeek + 6; // If Sunday, go back 8 days
  const lastMonday = new Date(now);
  lastMonday.setDate(now.getDate() - daysToLastMonday);
  
  // Calculate last Sunday (6 days after last Monday)
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  
  return {
    start: lastMonday.toISOString().split('T')[0]!,
    end: lastSunday.toISOString().split('T')[0]!
  };
}

/**
 * Determine if a period has ended (for automated generation)
 */
export function isPeriodComplete(periodEnd: string): boolean {
  const endDate = new Date(periodEnd);
  const now = new Date();
  
  // Reset time to compare dates only
  endDate.setHours(23, 59, 59, 999);
  now.setHours(0, 0, 0, 0);
  
  return endDate < now;
}

/**
 * Generate filename for PDF storage
 */
export function generatePDFFileName(
  clientId: string, 
  reportType: string, 
  periodStart: string, 
  periodEnd: string
): string {
  return `${clientId}_${reportType}_${periodStart}_${periodEnd}.pdf`;
}

/**
 * Generate storage path for PDF
 */
export function generatePDFStoragePath(
  clientId: string,
  reportType: string,
  periodStart: string,
  periodEnd: string
): string {
  const year = new Date(periodStart).getFullYear();
  const month = String(new Date(periodStart).getMonth() + 1).padStart(2, '0');
  const fileName = generatePDFFileName(clientId, reportType, periodStart, periodEnd);
  
  return `${year}/${month}/${reportType}/${fileName}`;
} 