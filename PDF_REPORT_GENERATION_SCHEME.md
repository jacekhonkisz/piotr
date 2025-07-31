# PDF Report Generation Scheme

## Overview

This document outlines the comprehensive PDF report generation system that creates professional, branded reports matching the `/reports` page design. The system generates PDFs that can be downloaded directly or sent via email to clients.

## Architecture

### 1. API Endpoint: `/api/generate-report-pdf`

**Location**: `src/app/api/generate-report-pdf/route.ts`

**Purpose**: Generates PDF reports using Puppeteer with HTML templates that match the reports page design.

**Features**:
- Fetches report data from Supabase database
- Generates HTML with premium styling matching the reports page
- Converts HTML to PDF using Puppeteer
- Supports both download and email delivery modes
- Includes comprehensive error handling and logging

### 2. Frontend Integration

**Reports Page**: `src/app/reports/page.tsx`
- Added "Generate PDF" button in the period selector
- Downloads PDF directly to user's device
- Shows loading state during generation

**Admin Client Details**: `src/app/admin/clients/[id]/page.tsx`
- Added "Send PDF Report" button for each report
- Sends PDF via email to client
- Shows loading state during sending

## PDF Design Features

### Visual Design
- **Premium Glassmorphism**: Matches the reports page with backdrop blur effects
- **Gradient Backgrounds**: Blue to purple gradients for headers and accents
- **Modern Typography**: Inter font family for clean, professional look
- **Responsive Layout**: Optimized for A4 paper format
- **Color-coded Metrics**: Different colors for different metric types

### Content Sections

#### 1. Header Section
- Client name and branding
- Date range for the report
- Premium gradient background with subtle patterns

#### 2. Key Metrics Section
- **Spend**: Total campaign spend with trend indicators
- **Conversions**: Total conversions with trend indicators  
- **CTR**: Click-through rate with trend indicators
- Each metric includes:
  - Large, prominent value display
  - Trend arrows and percentages
  - Color-coded icons and backgrounds

#### 3. Performance Indicators Section
- **Impressions**: Total ad impressions
- **Clicks**: Total ad clicks
- **CPM**: Cost per mille (cost per 1000 impressions)
- **CPC**: Cost per click
- **Reach**: Estimated unique users reached
- **Frequency**: Average impressions per user

#### 4. Campaign Details Table
- Complete list of all campaigns in the period
- Columns: Campaign Name, Status, Spend, Impressions, Clicks, Conversions, CTR, CPC
- Color-coded status indicators
- Professional table styling

#### 5. Footer Section
- Generation timestamp
- Data source information
- Professional branding

## Technical Implementation

### HTML Template Generation

The `generateReportHTML()` function creates a complete HTML document with:

```typescript
function generateReportHTML(reportData: ReportData): string {
  // Formatting utilities
  const formatDate = (dateString: string) => { /* ... */ };
  const formatCurrency = (value: number) => `${value.toFixed(2)} zł`;
  const formatNumber = (value: number) => value.toLocaleString();
  const formatPercentage = (value: number) => `${value.toFixed(2)}%`;

  // Returns complete HTML with embedded CSS
  return `<!DOCTYPE html>...`;
}
```

### CSS Styling

The PDF uses embedded CSS with:
- **Google Fonts**: Inter font family
- **CSS Grid & Flexbox**: Modern layout techniques
- **Gradients**: Linear and radial gradients for visual appeal
- **Shadows**: Subtle shadows for depth
- **Animations**: CSS animations for visual elements
- **Print Optimization**: Media queries for PDF generation

### Puppeteer Configuration

```typescript
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await page.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });

const pdfBuffer = await page.pdf({
  format: 'A4',
  printBackground: true,
  margin: {
    top: '20mm',
    right: '20mm', 
    bottom: '20mm',
    left: '20mm'
  }
});
```

## Data Flow

### 1. Report Data Fetching
```typescript
// Get report from database
const { data: report, error: reportError } = await supabase
  .from('reports')
  .select('*')
  .eq('client_id', clientId)
  .eq('date_range_start', monthStartDate)
  .eq('date_range_end', monthEndDate)
  .order('generated_at', { ascending: false })
  .limit(1)
  .single();

// Get campaigns for this report
const { data: campaigns, error: campaignsError } = await supabase
  .from('campaigns')
  .select('*')
  .eq('client_id', clientId)
  .eq('date_range_start', monthStartDate)
  .eq('date_range_end', monthEndDate);
```

### 2. Data Processing
```typescript
// Calculate totals
const totals = campaigns?.reduce((acc, campaign) => ({
  spend: acc.spend + (campaign.spend || 0),
  impressions: acc.impressions + (campaign.impressions || 0),
  clicks: acc.clicks + (campaign.clicks || 0),
  conversions: acc.conversions + (campaign.conversions || 0)
}), { spend: 0, impressions: 0, clicks: 0, conversions: 0 }) || { spend: 0, impressions: 0, clicks: 0, conversions: 0 };

const calculatedTotals = {
  ...totals,
  ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
  cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
  cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
};
```

### 3. Email Integration
When `includeEmail: true` is specified:
```typescript
// Send email with PDF attachment
const EmailService = (await import('../../../lib/email')).default;
const emailService = EmailService.getInstance();

const emailResult = await emailService.sendReportEmail(
  client.email,
  client.name,
  {
    dateRange: `${monthStartDate} to ${monthEndDate}`,
    totalSpend: calculatedTotals.spend,
    totalImpressions: calculatedTotals.impressions,
    totalClicks: calculatedTotals.clicks,
    ctr: calculatedTotals.ctr / 100,
    cpc: calculatedTotals.cpc,
    cpm: calculatedTotals.cpm
  },
  pdfBuffer
);
```

## Usage Examples

### 1. Generate PDF for Download (Reports Page)
```typescript
const handleGeneratePDF = async () => {
  const response = await fetch('/api/generate-report-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      clientId: client.id,
      monthId: selectedMonth,
      includeEmail: false
    })
  });

  const pdfBlob = await response.blob();
  const url = window.URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `report-${client.name}-${selectedMonth}.pdf`;
  link.click();
};
```

### 2. Send PDF via Email (Admin Panel)
```typescript
const sendPDFReport = async (reportId: string) => {
  const response = await fetch('/api/generate-report-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      clientId: client.id,
      monthId: monthId,
      includeEmail: true
    })
  });
};
```

## Error Handling

### API Error Responses
```typescript
// Authentication errors
if (!session?.access_token) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Client not found
if (clientError || !client) {
  return NextResponse.json({ error: 'Client not found' }, { status: 404 });
}

// Report not found
if (reportError) {
  return NextResponse.json({ error: 'Report not found for this period' }, { status: 404 });
}

// PDF generation errors
try {
  const browser = await puppeteer.launch({...});
  // ... PDF generation
} catch (error) {
  console.error('Error generating PDF report:', error);
  return NextResponse.json({ 
    error: 'Failed to generate PDF report',
    details: error instanceof Error ? error.message : 'Unknown error'
  }, { status: 500 });
}
```

### Frontend Error Handling
```typescript
try {
  const response = await fetch('/api/generate-report-pdf', {...});
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to generate PDF');
  }
  // Handle success
} catch (error) {
  console.error('Error generating PDF:', error);
  alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
```

## Dependencies

### Required Packages
```json
{
  "puppeteer": "^21.0.0",
  "resend": "^2.0.0"
}
```

### Environment Variables
```env
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Security Considerations

### Authentication
- All API endpoints require valid JWT tokens
- Admin-only access for email sending functionality
- Client data isolation based on admin_id

### Data Validation
- Input validation for clientId and monthId
- Database queries use parameterized queries
- Error messages don't expose sensitive information

### File Handling
- PDFs are generated in memory and not stored on disk
- Temporary URLs are properly cleaned up
- File downloads use proper Content-Disposition headers

## Performance Optimization

### PDF Generation
- Puppeteer runs in headless mode
- HTML content is set directly (no external requests)
- CSS is embedded to avoid network dependencies
- Browser instance is properly closed after use

### Memory Management
- PDF buffers are streamed directly to response
- Temporary objects are garbage collected
- No persistent file storage

## Future Enhancements

### Planned Features
1. **Custom Branding**: Allow clients to customize colors and logos
2. **Multiple Formats**: Support for different paper sizes and orientations
3. **Scheduled Reports**: Automatic PDF generation and email sending
4. **Report Templates**: Different report layouts and styles
5. **Interactive Elements**: Clickable charts and navigation in PDFs
6. **Multi-language Support**: Internationalization for different languages

### Technical Improvements
1. **Caching**: Cache generated PDFs for frequently requested reports
2. **Compression**: Optimize PDF file sizes
3. **Batch Processing**: Generate multiple reports simultaneously
4. **Progress Tracking**: Real-time progress updates for large reports
5. **Error Recovery**: Retry mechanisms for failed generations

## Testing

### Manual Testing Checklist
- [ ] PDF generation works for all report periods
- [ ] Email delivery includes PDF attachments
- [ ] Error handling works for invalid inputs
- [ ] Loading states display correctly
- [ ] PDF styling matches reports page design
- [ ] File downloads work in different browsers
- [ ] Email templates render correctly

### Automated Testing
```typescript
// Example test structure
describe('PDF Report Generation', () => {
  it('should generate PDF for valid report data', async () => {
    // Test implementation
  });

  it('should handle missing report data gracefully', async () => {
    // Test implementation
  });

  it('should send email with PDF attachment', async () => {
    // Test implementation
  });
});
```

## Troubleshooting

### Common Issues

1. **Puppeteer Installation**
   - Ensure Puppeteer is installed: `npm install puppeteer`
   - On Linux servers, may need additional dependencies

2. **Memory Issues**
   - Monitor server memory usage during PDF generation
   - Consider increasing server memory for high-volume usage

3. **Email Delivery**
   - Verify Resend API key is configured
   - Check email logs in Supabase for delivery status

4. **Styling Issues**
   - Ensure all CSS is embedded in HTML
   - Test with different browsers and PDF viewers

### Debug Mode
```typescript
// Enable debug logging
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('Generating PDF for:', { clientId, monthId, includeEmail });
  console.log('Report data:', reportData);
}
```

## Conclusion

This PDF report generation scheme provides a comprehensive solution for creating professional, branded reports that match the visual design of the reports page. The system is scalable, secure, and provides both download and email delivery options. The modular architecture allows for easy customization and future enhancements. 