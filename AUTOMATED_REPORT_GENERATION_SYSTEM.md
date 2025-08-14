# Automated Report Generation & Storage System 🚀

## 🎯 **SYSTEM OVERVIEW**

Based on your requirements, implementing an **automated report generation system** that:

✅ **Generates reports AFTER period ends** (not on-demand)  
✅ **Stores PDFs and summaries in Supabase** for instant access  
✅ **Everything in Polish** (subjects, content, dates)  
✅ **Efficient retrieval** from database (no regeneration)  
✅ **Automated scheduling** for monthly/weekly periods  

---

## 📋 **DATABASE SCHEMA DESIGN**

### **New Table: `generated_reports`**
```sql
CREATE TABLE generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) NOT NULL,
  report_type VARCHAR(20) NOT NULL, -- 'monthly' | 'weekly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Polish content
  polish_summary TEXT NOT NULL,
  polish_subject VARCHAR(255) NOT NULL,
  
  -- PDF storage
  pdf_url TEXT, -- Supabase Storage URL
  pdf_size_bytes INTEGER,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Performance data (for quick access)
  total_spend DECIMAL(12,2),
  total_impressions INTEGER,
  total_clicks INTEGER,
  total_conversions INTEGER,
  ctr DECIMAL(5,2),
  cpc DECIMAL(8,2),
  cpm DECIMAL(8,2),
  cpa DECIMAL(8,2),
  
  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'completed', -- 'generating' | 'completed' | 'failed'
  
  UNIQUE(client_id, report_type, period_start, period_end)
);

-- Indexes for fast retrieval
CREATE INDEX idx_generated_reports_client_period ON generated_reports(client_id, period_start, period_end);
CREATE INDEX idx_generated_reports_status ON generated_reports(status);
```

### **Enhanced `email_logs` Table**
```sql
-- Add column to link emails to generated reports
ALTER TABLE email_logs ADD COLUMN generated_report_id UUID REFERENCES generated_reports(id);
```

---

## ⚙️ **AUTOMATED GENERATION SYSTEM**

### **1. Cron Job Scheduler**
```javascript
// File: scripts/automated-report-generator.js

// Monthly Reports: Generate on 1st day of next month
// Weekly Reports: Generate on Monday for previous week

const schedules = {
  monthly: '0 0 1 * *',    // 1st day of month at midnight
  weekly: '0 0 * * 1'      // Every Monday at midnight
};
```

### **2. Report Generation Logic**
```javascript
async function generateReportForPeriod(clientId, reportType, periodStart, periodEnd) {
  // 1. Check if report already exists
  const existingReport = await checkExistingReport(clientId, reportType, periodStart, periodEnd);
  if (existingReport) {
    console.log('✅ Report already exists');
    return existingReport;
  }

  // 2. Generate Polish summary
  const polishSummary = await generatePolishSummary(clientData, metrics, periodStart, periodEnd);
  
  // 3. Generate Polish subject
  const polishSubject = generatePolishSubject(reportType, periodStart, periodEnd);
  
  // 4. Generate PDF
  const pdfBuffer = await generatePDF(clientData, campaigns, metrics);
  
  // 5. Upload PDF to Supabase Storage
  const pdfUrl = await uploadPDFToStorage(pdfBuffer, clientId, periodStart, periodEnd);
  
  // 6. Save to database
  const reportRecord = await saveGeneratedReport({
    clientId,
    reportType,
    periodStart,
    periodEnd,
    polishSummary,
    polishSubject,
    pdfUrl,
    pdfSize: pdfBuffer.length,
    metrics
  });
  
  return reportRecord;
}
```

---

## 🇵🇱 **POLISH CONTENT GENERATION**

### **Subject Lines (All Polish)**
```javascript
function generatePolishSubject(reportType, periodStart, periodEnd) {
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
    const start = startDate.toLocaleDateString('pl-PL');
    const end = endDate.toLocaleDateString('pl-PL');
    return `Raport Meta Ads - Tydzień ${start} - ${end}`;
  }
}
```

### **Polish Summary Template**
```javascript
function generatePolishSummary(clientData, metrics, periodStart, periodEnd) {
  const startDate = new Date(periodStart).toLocaleDateString('pl-PL');
  const endDate = new Date(periodEnd).toLocaleDateString('pl-PL');
  
  const spend = formatPolishCurrency(metrics.totalSpend);
  const impressions = formatPolishNumber(metrics.totalImpressions);
  const clicks = formatPolishNumber(metrics.totalClicks);
  const conversions = formatPolishNumber(metrics.totalConversions);
  const ctr = formatPolishPercentage(metrics.ctr);
  const cpc = formatPolishCurrency(metrics.cpc);
  const cpa = formatPolishCurrency(metrics.cpa);

  return `W okresie od ${startDate} do ${endDate} wydaliśmy na kampanie reklamowe ${spend}. 

Działania te zaowocowały ${impressions} wyświetleniami, a liczba kliknięć wyniosła ${clicks}, co dało CTR na poziomie ${ctr}. 

Średni koszt kliknięcia (CPC) wyniósł ${cpc}. W tym okresie zaobserwowaliśmy ${conversions} konwersje, co przekłada się na koszt pozyskania konwersji (CPA) na poziomie ${cpa}.

Szczegółowe wyniki i analizy znajdują się w załączonym raporcie PDF.`;
}
```

### **Polish Email Template**
```javascript
function generatePolishEmailTemplate(clientName, reportData) {
  return `Szanowni Państwo ${clientName},

Przesyłamy raport wyników kampanii Meta Ads za okres ${reportData.periodDisplay}.

${reportData.polishSummary}

Główne wskaźniki:
- Łączne wydatki: ${reportData.totalSpend}
- Wyświetlenia: ${reportData.totalImpressions}
- Kliknięcia: ${reportData.totalClicks}
- CTR: ${reportData.ctr}
- CPC: ${reportData.cpc}
- CPM: ${reportData.cpm}

Kompletny szczegółowy raport znajduje się w załączeniu PDF. Prosimy o otwarcie załącznika w celu zapoznania się z pełną analizą, wykresami i szczegółami kampanii.

W razie pytań dotyczących raportu lub chęci omówienia strategii optymalizacji, prosimy o kontakt.

Z poważaniem,
Zespół Meta Ads

---
To jest automatyczny raport wygenerowany przez system zarządzania Meta Ads.
W celu uzyskania pomocy, skontaktuj się z nami pod adresem support@example.com`;
}
```

---

## 📁 **SUPABASE STORAGE INTEGRATION**

### **PDF Storage Structure**
```
bucket: generated-reports/
├── 2025/
│   ├── 01/ (January)
│   │   ├── monthly/
│   │   │   ├── client1_2025-01-01_2025-01-31.pdf
│   │   │   └── client2_2025-01-01_2025-01-31.pdf
│   │   └── weekly/
│   │       ├── client1_2025-01-06_2025-01-12.pdf
│   │       └── client1_2025-01-13_2025-01-19.pdf
│   └── 02/ (February)
└── 2024/
```

### **Storage Functions**
```javascript
async function uploadPDFToStorage(pdfBuffer, clientId, periodStart, periodEnd) {
  const fileName = `${clientId}_${periodStart}_${periodEnd}.pdf`;
  const year = new Date(periodStart).getFullYear();
  const month = String(new Date(periodStart).getMonth() + 1).padStart(2, '0');
  const reportType = determineReportType(periodStart, periodEnd);
  
  const filePath = `${year}/${month}/${reportType}/${fileName}`;
  
  const { data, error } = await supabase.storage
    .from('generated-reports')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false
    });
    
  if (error) throw error;
  
  // Generate public URL
  const { data: urlData } = supabase.storage
    .from('generated-reports')
    .getPublicUrl(filePath);
    
  return urlData.publicUrl;
}
```

---

## 🔄 **EMAIL SYSTEM INTEGRATION**

### **Modified Email Sending**
```javascript
async function sendScheduledReport(clientId, reportType, scheduledDate) {
  // 1. Get the generated report from database
  const generatedReport = await getGeneratedReport(clientId, reportType, scheduledDate);
  
  if (!generatedReport) {
    console.log('⚠️ No generated report found, triggering generation...');
    generatedReport = await generateReportForPeriod(clientId, reportType, startDate, endDate);
  }
  
  // 2. Download PDF from Supabase Storage
  const pdfBuffer = await downloadPDFFromStorage(generatedReport.pdf_url);
  
  // 3. Send email with cached content
  await emailService.sendPreGeneratedReport(
    clientEmail,
    generatedReport.polish_subject,
    generatedReport.polish_summary,
    pdfBuffer
  );
  
  // 4. Log email with reference to generated report
  await logEmail({
    clientId,
    generatedReportId: generatedReport.id,
    status: 'sent'
  });
}
```

### **Updated Calendar Interface**
```javascript
// Modified CalendarEmailPreviewModal.tsx
async function loadReportData(report) {
  // Check if pre-generated report exists
  const generatedReport = await fetchGeneratedReport(
    report.client_id, 
    report.report_type, 
    calculatePeriod(report)
  );
  
  if (generatedReport) {
    // Use cached report
    setReportData({
      ...generatedReport,
      pdfTested: true,
      pdfSize: generatedReport.pdf_size_bytes,
      pdfError: null,
      cached: true
    });
  } else {
    // Report not yet generated (period not finished)
    setReportData({
      pdfTested: false,
      pdfError: 'Raport zostanie wygenerowany po zakończeniu okresu',
      cached: false
    });
  }
}
```

---

## ⏰ **SCHEDULING SYSTEM**

### **Automated Generation Triggers**

#### **Monthly Reports**
- **Trigger**: 1st day of next month at 2 AM
- **Example**: July 2025 report generated on August 1st, 2025
- **Period**: Always complete calendar month

#### **Weekly Reports**  
- **Trigger**: Monday at 2 AM for previous week
- **Example**: Week Aug 4-10 report generated on Monday Aug 11th
- **Period**: Monday to Sunday

### **Cron Jobs Configuration**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'report-generator',
    script: 'scripts/automated-report-generator.js',
    cron_restart: '0 2 1 * *', // Monthly: 1st day at 2 AM
    watch: false,
    autorestart: false
  }, {
    name: 'weekly-report-generator', 
    script: 'scripts/weekly-report-generator.js',
    cron_restart: '0 2 * * 1', // Weekly: Monday at 2 AM
    watch: false,
    autorestart: false
  }]
};
```

---

## 📊 **PERFORMANCE BENEFITS**

### **Before (Current System)**
- ❌ PDF generated on every view (slow)
- ❌ Multiple generations for same period
- ❌ Mixed languages
- ❌ Real-time processing delays

### **After (New System)**
- ✅ PDF generated once after period ends
- ✅ Instant retrieval from Supabase Storage
- ✅ Complete Polish localization
- ✅ Scheduled generation (no delays)
- ✅ Cached summaries for instant email sending
- ✅ Reduced server load
- ✅ Consistent report availability

---

## 🚀 **IMPLEMENTATION PHASES**

### **Phase 1: Database & Storage Setup**
1. Create `generated_reports` table
2. Set up Supabase Storage bucket
3. Create Polish content generators

### **Phase 2: Report Generation System**
1. Build automated generation scripts
2. Implement PDF storage functions
3. Create Polish email templates

### **Phase 3: Integration**
1. Update calendar interface
2. Modify email sending system
3. Set up cron jobs

### **Phase 4: Migration**
1. Generate reports for existing periods
2. Update all UI text to Polish
3. Test complete workflow

---

## 🎯 **EXPECTED RESULTS**

After implementation:

✅ **Reports generated automatically** after each period ends  
✅ **All content in Polish** (subjects, summaries, UI)  
✅ **Instant PDF access** from Supabase Storage  
✅ **Efficient email sending** with cached content  
✅ **No regeneration delays** - everything pre-built  
✅ **Professional Polish email format** as shown in your example  

The system will work exactly as you described - reports generated after the period finishes, stored efficiently, and delivered in perfect Polish! 🇵🇱 