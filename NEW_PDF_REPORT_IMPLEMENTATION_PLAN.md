# NEW PDF REPORT IMPLEMENTATION PLAN

## Overview
Complete redesign of the PDF report generation system based on user requirements, using navy blue color scheme and premium design inspired by the provided image.

## 8-Section Structure

### Section 1: Title Page with AI Summary
- **Logo**: Company logo at top (if configured)
- **Company Name**: Name of the report company
- **AI Summary**: Generated using existing OpenAI integration from `/api/generate-executive-summary`
- **Date Range**: Report period
- **Generation Date**: When report was created

### Section 2: Year-to-Year Comparison
- **Meta Ads YoY**: Podstawowe wydatki and wartość rezerwacji comparison
- **Google Ads YoY**: Podstawowe wydatki and wartość rezerwacji comparison
- **Combined Charts**: Visual comparison charts
- **Data Source**: Use existing `/api/year-over-year-comparison` endpoint

### Section 3: Meta Ads Metrics
- **All metrics from /reports**: Spend, impressions, clicks, CTR, CPC, etc.
- **Exclude funnel data**: Only standalone metrics, not funnel visualization
- **Data Source**: Same as /reports page Meta data fetching

### Section 4: Meta Ads Funnel
- **Exact UX/UI Copy**: Use identical styling and layout from ConversionFunnel.tsx
- **Same Data**: Booking steps 1-3, reservations, reservation value, ROAS
- **Visual Elements**: Trapezoid shapes, gradient backgrounds, icons

### Section 5: Google Ads Metrics  
- **All metrics from /reports**: Spend, impressions, clicks, CTR, CPC, etc.
- **Exclude funnel data**: Only standalone metrics, not funnel visualization
- **Data Source**: Same as /reports page Google data fetching

### Section 6: Google Ads Funnel
- **Exact UX/UI Copy**: Use identical styling and layout from ConversionFunnel.tsx
- **Same Data**: Booking steps 1-3, reservations, reservation value, ROAS
- **Visual Elements**: Trapezoid shapes, gradient backgrounds, icons

### Section 7: Meta Ads Campaign Details (Szczegóły kampanii)
- **Campaign Tables**: Active campaigns with spend for the period
- **Demographics**: Circle bar graphics from DemographicPieCharts.tsx
- **Placement Performance**: Top placement performance table
- **Ad Relevance**: Quality rankings and relevance scores
- **Data Source**: MetaAdsTables component data

### Section 8: Google Ads Campaign Details (Szczegóły kampanii)
- **Campaign Tables**: Active campaigns with spend for the period
- **Network Performance**: Google Ads network performance
- **Device Performance**: Performance by device type
- **Keyword Performance**: Top performing keywords
- **Data Source**: GoogleAdsTables component data

## Design Requirements

### Color Scheme
- **Primary**: Navy blue (#1e293b, #0f172a) instead of green
- **Accent**: Complementary blues and grays
- **Background**: Clean white with subtle gradients

### Design Principles
- **Clean**: No unnecessary containers or clutter
- **Premium**: High-quality, professional appearance
- **Consistent**: Unified design language throughout
- **Readable**: Clear typography and spacing

## Technical Implementation

### Data Fetching Strategy
- **Reuse Existing APIs**: Use same endpoints as /reports page
- **No New Fetching**: Don't create duplicate data fetching systems
- **Consistent Data**: Ensure PDF shows exactly same data as /reports

### Component Replication
- **ConversionFunnel**: Copy exact HTML/CSS structure for sections 4 & 6
- **DemographicPieCharts**: Recreate circle bar graphics for section 7
- **MetaAdsTables**: Copy table structures and styling
- **GoogleAdsTables**: Copy table structures and styling

### PDF Generation
- **Replace Current**: Completely replace existing PDF generation
- **Single Version**: Only one PDF generation system
- **Puppeteer**: Continue using Puppeteer for HTML to PDF conversion

## Implementation Steps

1. **Create New PDF HTML Generator**: Build new HTML template with 8 sections
2. **Implement AI Summary**: Integrate existing OpenAI summary generation
3. **Copy Funnel Components**: Recreate ConversionFunnel HTML/CSS exactly
4. **Implement Demographics**: Recreate circle charts for Meta demographics
5. **Add Campaign Tables**: Copy table structures from existing components
6. **Apply Navy Design**: Implement navy blue color scheme throughout
7. **Replace Current System**: Update route to use new generator
8. **Test & Validate**: Ensure data consistency with /reports page

## File Changes Required

### New Files
- Enhanced `/api/generate-pdf/route.ts` with new 8-section structure

### Modified Files
- Update any references to old PDF structure
- Ensure single PDF generation endpoint

### Data Sources
- `/api/generate-executive-summary` - AI summary
- `/api/year-over-year-comparison` - YoY data
- `/api/fetch-live-data` - Meta data (same as /reports)
- `/api/fetch-google-ads-live-data` - Google data (same as /reports)
- MetaAdsTables data fetching
- GoogleAdsTables data fetching

## Success Criteria

1. **Visual Match**: PDF matches premium design inspiration
2. **Data Consistency**: Shows exactly same data as /reports page
3. **Complete Sections**: All 8 sections implemented correctly
4. **Navy Theme**: Consistent navy blue color scheme
5. **Funnel Accuracy**: Exact UX/UI copy of funnel components
6. **Demographics**: Circle bar graphics for Meta demographics
7. **Active Campaigns**: Only shows campaigns with spend in period
8. **Single System**: Only one PDF generation system exists
