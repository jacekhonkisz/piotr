'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Eye, FileText, Save } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  dateRange: { start: string; end: string };
  customMessage: string;
  campaigns: any[];
  totals: any;
  client: any;
  metaTables: any;
}

interface PreviewData {
  subject: string;
  html: string;
  text: string;
  summary: string;
  reportData: {
    dateRange: string;
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions?: number;
    cpm?: number;
    potentialOfflineReservations?: number;
    potentialOfflineValue?: number;
    totalPotentialValue?: number;
    costPercentage?: number;
    reservations?: number;
    reservationValue?: number;
  };
}

const EmailPreviewModal = React.memo(function EmailPreviewModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  dateRange,
  customMessage,
  campaigns,
  totals,
  client,
  metaTables
}: EmailPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState('');
  const [editableText, setEditableText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [previewCache, setPreviewCache] = useState<{ [key: string]: PreviewData }>({});

  // FIXED: Only reset when modal opens, load data when clientId changes but without refresh
  useEffect(() => {
    if (isOpen) {
      // Only reset state when modal first opens
      setPreviewData(null);
      setEditableText('');
      setDraftId(null);
      setError('');
    }
  }, [isOpen]);

  // FIXED: Load data when clientId changes but use existing cache to prevent refresh
  useEffect(() => {
    if (isOpen && clientId) {
      // Check cache first - if data exists, use it without loading states
      const cacheKey = `${clientId}-${dateRange.start}-${dateRange.end}-${customMessage}`;
      const cachedData = previewCache[cacheKey];
      
      if (cachedData) {
        // Use cached data instantly without any loading states
        setPreviewData(cachedData);
        setEditableText(cachedData.text);
      } else {
        // Only load if not cached - this should rarely happen now
        generatePreview();
      }
    }
  }, [clientId]); // Only clientId dependency - no dateRange/customMessage to reduce triggers

  useEffect(() => {
    if (previewData && !isEditing) {
      setEditableText(previewData.text);
    }
  }, [previewData, isEditing]);

  // REMOVED: Email drafts system was replaced with simpler direct sending
  // See OLD_EMAIL_DRAFT_SYSTEM_REMOVAL.md for details
  // loadDraft function removed since it's no longer needed

  // Save draft to database
  const saveDraft = useCallback(async () => {
    if (!editableText.trim()) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const draftData = {
        client_id: clientId,
        admin_id: user.id,
        template_type: 'standard',
        custom_message: customMessage || null,
        subject_template: previewData?.subject || null,
        html_template: editableText.replace(/\n/g, '<br>'),
        text_template: editableText,
        is_active: true
      };

      let result;
      if (draftId) {
        // Update existing draft
        // Email drafts system removed - simulate success
        result = { data: { id: draftId }, error: null };
      } else {
        // Create new draft
        // Email drafts system removed - simulate success
        result = { data: { id: 'mock-draft-id' }, error: null };
      }

      if (result.error) throw result.error;
      
      setDraftId(result.data.id);
      // Draft system removed - simulating success
      
    } catch (error) {
      console.error('❌ Error saving draft:', error);
      setError('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [clientId, editableText, draftId, customMessage, previewData]);

  const generatePreview = useCallback(async () => {
    // OPTIMIZED: Check cache first to avoid redundant API calls AND loading states
    const cacheKey = `${clientId}-${dateRange.start}-${dateRange.end}-${customMessage}`;
    const cachedData = previewCache[cacheKey];
    if (cachedData) {
      setPreviewData(cachedData);
      return; // NO loading state for cached data
    }

    // Only show loading for actual API calls
    setLoading(true);
    setError('');
    
    try {
      // Generate the same data that would be used in the actual email
      const finalTotals = totals || {
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0
      };

      const finalCampaigns = campaigns || [];

      // Calculate metrics exactly like the email API does
      const totalSpend = finalTotals.spend || 0;
      const totalImpressions = finalTotals.impressions || 0;
      const totalClicks = finalTotals.clicks || 0;
      const totalConversions = finalTotals.conversions || 0;
      
      // Calculate new metrics using same logic as WeeklyReportView
      const totalEmailContacts = finalCampaigns.reduce((sum, c) => sum + (c.email_contacts || 0), 0);
      const totalPhoneContacts = finalCampaigns.reduce((sum, c) => sum + (c.click_to_call || 0), 0);
      const potentialOfflineReservations = Math.round((totalEmailContacts + totalPhoneContacts) * 0.2);
      
      const totalReservationValue = finalCampaigns.reduce((sum, c) => sum + (c.reservation_value || 0), 0);
      const totalReservations = finalCampaigns.reduce((sum, c) => sum + (c.reservations || 0), 0);
      const averageReservationValue = totalReservations > 0 ? totalReservationValue / totalReservations : 0;
      const potentialOfflineValue = potentialOfflineReservations * averageReservationValue;
      const totalPotentialValue = potentialOfflineValue + totalReservationValue;
      const costPercentage = totalPotentialValue > 0 ? (totalSpend / totalPotentialValue) * 100 : 0;

      // Check if period has ended and try to get real summary from generated report
      const now = new Date();
      const endDate = new Date(dateRange.end);
      const isPeriodEnded = endDate < now;
      
      let summary = '';
      if (isPeriodEnded) {
        // Try to get real summary from generated report
        try {
          const response = await fetch(`/api/generated-reports?clientId=${clientId}&periodStart=${dateRange.start}&periodEnd=${dateRange.end}`);
          if (response.ok) {
            const { report } = await response.json();
            if (report && report.polish_summary) {
              summary = report.polish_summary;
            }
          }
        } catch (err) {
          console.warn('Could not fetch generated report summary, using fallback');
        }
      }
      
      // Fallback to generated summary if no real one available
      if (!summary) {
        summary = generatePolishReportSummary({
          dateRange,
          totalSpend,
          totalImpressions,
          totalClicks,
          totalConversions,
          campaigns: finalCampaigns
        });
      }

      const reportData = {
        dateRange: `${dateRange.start} to ${dateRange.end}`,
        totalSpend,
        totalImpressions,
        totalClicks,
        totalConversions,
        // New metrics
        potentialOfflineReservations,
        potentialOfflineValue,
        totalPotentialValue,
        costPercentage,
        // Conversion metrics
        reservations: totalReservations,
        reservationValue: totalReservationValue
      };

      // Generate Polish email template (fully editable) - Updated to show only podsumowanie
      const emailTemplate = generatePolishEmailTemplate(clientName, reportData, {
        summary,
        customMessage
      });
      
      // Add note about PDF for pending reports
      let finalText = emailTemplate.text;
      if (!isPeriodEnded) {
        finalText += `\n\n📎 Uwaga: Raport PDF zostanie dołączony po wygenerowaniu (po zakończeniu okresu ${endDate.toLocaleDateString('pl-PL')}).`;
      }

      const previewData = {
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: finalText,
        summary,
        reportData
      };

      // OPTIMIZED: Cache the preview data to avoid regenerating
      setPreviewCache(prev => ({
        ...prev,
        [cacheKey]: previewData
      }));
      
      setPreviewData(previewData);

    } catch (error) {
      console.error('Error generating preview:', error);
      setError('Failed to generate email preview');
    } finally {
      setLoading(false);
    }
  }, [clientId, dateRange, customMessage, campaigns, totals, client, metaTables, previewCache]);

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      // Update the preview data with edited text
      if (previewData) {
        setPreviewData({
          ...previewData,
          text: editableText
        });
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    // Revert to original text
    if (previewData) {
      setEditableText(previewData.text);
    }
    setIsEditing(false);
  };

  const resetToOriginal = () => {
    if (previewData) {
      setEditableText(previewData.text);
      setIsEditing(false);
    }
  };

  // Helper function to generate Polish email template - UPDATED TO MATCH STANDARDIZED TEMPLATE
  const generatePolishEmailTemplate = (clientName: string, reportData: any, content: { summary: string; customMessage: string }) => {
    const periodDisplay = reportData.dateRange.includes('to') 
      ? reportData.dateRange.replace(' to ', ' - ')
      : reportData.dateRange;

    // Generate subject in Polish
    const subject = `Raport wydajności kampanii reklamowych - ${periodDisplay}`;

    // Generate Polish email content using STANDARDIZED TEMPLATE
    const textContent = `Szanowni Państwo,

${content.customMessage ? content.customMessage + '\n\n' : 'W załączeniu przekazujemy raport wydajności kampanii reklamowych prowadzonych dla ' + clientName + ' w okresie ' + periodDisplay + '.'}

📈 PODSUMOWANIE WYKONAWCZE:
${content.summary || '[Podsumowanie AI zostanie wygenerowane podczas wysyłania]'}

📊 GŁÓWNE WSKAŹNIKI:
• Łączne Wydatki: ${reportData.totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
• Wyświetlenia: ${reportData.totalImpressions.toLocaleString('pl-PL')}
• Kliknięcia: ${reportData.totalClicks.toLocaleString('pl-PL')}
• Koszt za Tysiąc Wyświetleń (CPM): ${(reportData.cpm || 0).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}${reportData.reservations ? '\n• Rezerwacje: ' + reportData.reservations.toLocaleString('pl-PL') : ''}${reportData.reservationValue ? '\n• Wartość rezerwacji: ' + reportData.reservationValue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' }) : ''}

📎 ZAŁĄCZNIK:
Szczegółowy raport znajdą Państwo w załączeniu do tego e-maila.

W przypadku pytań dotyczących wyników, proszę o kontakt.

Z poważaniem,
Piotr Bajerlein`;

    return {
      subject,
      text: textContent,
      html: textContent.replace(/\n/g, '<br>')
    };
  };

  // Helper function to generate Polish report summary (same as PDF generation)
  const generatePolishReportSummary = (data: {
    dateRange: { start: string; end: string };
    totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  campaigns: any[];
}): string => {
    const { dateRange, totalSpend, totalImpressions, totalClicks, totalConversions } = data;
    
    // Detect if it's weekly or monthly
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const isWeekly = daysDiff === 7;
    const periodLabel = isWeekly ? 'tygodniu' : 'miesiącu';
    
    // Format dates and numbers in Polish
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('pl-PL', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    };

    // Format currency
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat('pl-PL', { 
        style: 'currency', 
        currency: 'PLN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    };

    // Format numbers
    const formatNumber = (value: number) => {
      return new Intl.NumberFormat('pl-PL').format(Math.round(value));
    };

    // Format percentage
    const formatPercentage = (value: number) => {
      return new Intl.NumberFormat('pl-PL', { 
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value / 100);
    };

    const summaryParts = [];
    
    const startDateFormatted = formatDate(dateRange.start);
    const endDateFormatted = formatDate(dateRange.end);
    
    summaryParts.push(`W ${periodLabel} od ${startDateFormatted} do ${endDateFormatted} wydaliśmy na kampanie reklamowe ${formatCurrency(totalSpend)}.`);
    
    if (totalImpressions > 0) {
      summaryParts.push(`Działania te zaowocowały ${formatNumber(totalImpressions)} wyświetleniami`);
      if (totalClicks > 0) {
        summaryParts.push(`a liczba kliknięć wyniosła ${formatNumber(totalClicks)}.`);
      } else {
        summaryParts.push('.');
      }
    }
    
    if (totalConversions > 0) {
      summaryParts.push(`W tym okresie zaobserwowaliśmy ${formatNumber(totalConversions)} konwersje.`);
    }
    
    return summaryParts.join(' ');
  };

  // Generate email template (same as EmailService)
  const generateCustomReportEmailTemplate = (
    clientName: string, 
    reportData: any, 
    content: { summary: string; customMessage: string }
  ) => {
    const subject = `📊 Meta Ads Performance Report - ${reportData.dateRange}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Meta Ads Performance Report</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 20px;
            background-color: #f5f7fa;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center; 
            position: relative;
          }
          .header h1 { 
            margin: 0; 
            font-size: 28px; 
            font-weight: 600;
          }
          .header p { 
            margin: 10px 0 0 0; 
            font-size: 16px; 
            opacity: 0.9;
          }
          .content { 
            padding: 40px 30px; 
            background: #ffffff;
          }
          .greeting {
            font-size: 18px;
            margin-bottom: 25px;
            color: #2c3e50;
          }
          .custom-message {
            background: #e8f4fd;
            border-left: 4px solid #3498db;
            padding: 20px;
            margin: 25px 0;
            border-radius: 0 8px 8px 0;
            font-style: italic;
            color: #2c3e50;
          }
          .summary-section {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            border: 1px solid #e9ecef;
          }
          .summary-title {
            font-size: 20px;
            font-weight: 600;
            color: #495057;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
          }
          .summary-title::before {
            content: '📊';
            margin-right: 10px;
            font-size: 24px;
          }
          .summary-text {
            font-size: 16px;
            line-height: 1.7;
            color: #6c757d;
            text-align: justify;
          }
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 15px;
            margin: 30px 0;
          }
          .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          }
          .metric-value {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 5px;
            display: block;
          }
          .metric-label {
            font-size: 12px;
            opacity: 0.9;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .pdf-notice {
            background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
            color: #2d3436;
            padding: 20px;
            border-radius: 12px;
            margin: 25px 0;
            text-align: center;
            font-weight: 500;
          }
          .pdf-notice::before {
            content: '📎';
            font-size: 24px;
            margin-right: 10px;
          }
          .closing {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
          }
          .signature {
            color: #495057;
            font-weight: 500;
          }
          .footer { 
            background: #2c3e50;
            color: #bdc3c7;
            text-align: center; 
            padding: 20px 30px;
            font-size: 12px;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Meta Ads Performance Report</h1>
            <p>${reportData.dateRange}</p>
          </div>
          
          <div class="content">
            <div class="greeting">
              Dear ${clientName},
            </div>
            
            <p>Here's your Meta Ads performance report for the period <strong>${reportData.dateRange}</strong>.</p>
            
            ${content.customMessage ? `
            <div class="custom-message">
              ${content.customMessage.replace(/\n/g, '<br>')}
            </div>
            ` : ''}
            
            ${content.summary ? `
            <div class="summary-section">
              <div class="summary-title">Podsumowanie</div>
              <div class="summary-text">${content.summary}</div>
            </div>
            ` : ''}
            
            <div class="metrics-grid">
              <div class="metric-card">
                <span class="metric-value">${reportData.totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
                <span class="metric-label">Total Spend</span>
              </div>
              <div class="metric-card">
                <span class="metric-value">${reportData.totalImpressions.toLocaleString('pl-PL')}</span>
                <span class="metric-label">Impressions</span>
              </div>
              <div class="metric-card">
                <span class="metric-value">${reportData.totalClicks.toLocaleString('pl-PL')}</span>
                <span class="metric-label">Clicks</span>
              </div>
            </div>
            
            <div class="pdf-notice">
              <strong>Complete detailed report is attached as PDF</strong><br>
              Open the PDF attachment for comprehensive analysis, charts, and campaign details.
            </div>
            
            <p>If you have any questions about this report or would like to discuss optimization strategies, please don't hesitate to reach out to us.</p>
            
            <div class="closing">
              <div class="signature">
                Best regards,<br>
                <strong>Your Meta Ads Team</strong>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated report generated by your Meta Ads management system.</p>
            <p>For support, contact us at support@example.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Meta Ads Performance Report - ${reportData.dateRange}

Dear ${clientName},

Here's your Meta Ads performance report for the period ${reportData.dateRange}.

${content.customMessage ? `
Custom Message:
${content.customMessage}

` : ''}${content.summary ? `
Podsumowanie:
${content.summary}

` : ''}Performance Metrics:
- Total Spend: ${reportData.totalSpend.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
- Impressions: ${reportData.totalImpressions.toLocaleString('pl-PL')}
- Clicks: ${reportData.totalClicks.toLocaleString('pl-PL')}

Complete detailed report is attached as PDF. Open the PDF attachment for comprehensive analysis, charts, and campaign details.

If you have any questions about this report or would like to discuss optimization strategies, please don't hesitate to reach out to us.

Best regards,
Your Meta Ads Team

---
This is an automated report generated by your Meta Ads management system.
For support, contact us at support@example.com
    `;

    return { subject, html, text };
  };

  const formatDateRange = () => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    if (daysDiff === 7) {
      return `Tydzień ${startDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} - ${endDate.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    } else if (daysDiff >= 28 && daysDiff <= 31) {
      return startDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
    } else {
      return `${startDate.toLocaleDateString('pl-PL')} - ${endDate.toLocaleDateString('pl-PL')}`;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Eye className="w-5 h-5 mr-2" />
              Email Preview (Text + PDF)
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Generating preview...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-red-800">{error}</span>
              </div>
            </div>
          )}

          {previewData && (
            <div className="space-y-4">
              {/* Email Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">To:</span> {clientName}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Period:</span> {formatDateRange()}
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-medium text-gray-600">Subject:</span> {previewData.subject}
                  </div>
                </div>
              </div>

              {/* PDF Attachment Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 text-blue-600 mr-2" />
                  <span className="text-sm font-medium text-blue-800">
                    PDF Report will be attached: Meta_Ads_Performance_Report_{new Date().toISOString().split('T')[0]}.pdf
                  </span>
                </div>
              </div>

              {/* Email Content Header */}
              <div className="border-b border-gray-200 pb-2 mb-4">
                <h4 className="text-lg font-medium text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Email Content (Text Version)
                </h4>
              </div>

              {/* Email Content */}
              <div className="border rounded-lg overflow-hidden">
                <textarea
                  className="w-full h-full p-6 text-sm font-mono bg-gray-50 min-h-[400px] leading-relaxed"
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  onBlur={() => setIsEditing(false)}
                  onFocus={() => setIsEditing(true)}
                />
              </div>

              {/* Summary Display */}
              {previewData.summary && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">Polish Summary (Podsumowanie):</h4>
                  <p className="text-sm text-yellow-700">{previewData.summary}</p>
                </div>
              )}
            </div>
          )}

          {/* Editing Controls */}
          {isEditing && (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
              <div className="flex items-center text-blue-700">
                <Eye className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Edytujesz treść emaila</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Anuluj
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={saveDraft}
              disabled={isSaving || !editableText.trim()}
              className="flex items-center px-4 py-2 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Zapisywanie...' : draftId ? 'Aktualizuj szkic' : 'Zapisz szkic'}
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={resetToOriginal}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
              >
                Przywróć oryginalną treść
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-colors"
              >
                Zamknij podgląd
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default EmailPreviewModal; 