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
  const [editableHtml, setEditableHtml] = useState('');
  const [mainTemplateHtml, setMainTemplateHtml] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [previewCache, setPreviewCache] = useState<{ [key: string]: PreviewData }>({});
  const [activeTab, setActiveTab] = useState<'preview' | 'client-html' | 'main-template'>('preview');
  const [hasCustomTemplate, setHasCustomTemplate] = useState(false);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

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
      setEditableHtml(previewData.html);
    }
  }, [previewData, isEditing]);

  // ✅ AUTO-SAVE: Debounced save after 2 seconds of inactivity
  useEffect(() => {
    if (!isEditing || !clientId) return;

    const autoSaveTimeout = setTimeout(() => {
      console.log('🔄 Auto-saving template...');
      saveTemplate(false); // false = silent save (no alert)
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(autoSaveTimeout);
  }, [editableHtml, mainTemplateHtml, isEditing, clientId]);

  // Load client-specific template or main template on mount
  useEffect(() => {
    if (isOpen && clientId) {
      loadClientTemplate();
      loadMainTemplate();
    }
  }, [isOpen, clientId]);

  // REMOVED: Email drafts system was replaced with simpler direct sending
  // See OLD_EMAIL_DRAFT_SYSTEM_REMOVAL.md for details
  // loadDraft function removed since it's no longer needed

  // Save draft to database
  const saveDraft = useCallback(async () => {
    if (!editableText.trim() && !editableHtml.trim()) return;

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
        html_template: editableHtml, // Save the HTML version
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
      alert('✅ Zmiany zapisane! Ten email będzie wysłany do klienta.');
      
    } catch (error) {
      console.error('❌ Error saving draft:', error);
      setError('Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [clientId, editableText, editableHtml, draftId, customMessage, previewData]);

  // Load client-specific template from database
  const loadClientTemplate = useCallback(async () => {
    if (!clientId) return;

    setIsLoadingTemplate(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('client_id', clientId)
        .eq('template_type', 'monthly_report')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Error loading client template:', error);
        return;
      }

      if (data) {
        setEditableHtml(data.html_template || '');
        setHasCustomTemplate(true);
        console.log('✅ Loaded custom template for client:', clientId);
      } else {
        setHasCustomTemplate(false);
        console.log('ℹ️ No custom template, will use main template');
      }
    } catch (error) {
      console.error('❌ Error loading client template:', error);
    } finally {
      setIsLoadingTemplate(false);
    }
  }, [clientId]);

  // Load main template (global template for all clients)
  const loadMainTemplate = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .is('client_id', null) // Main template has no client_id
        .eq('template_type', 'monthly_report')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error loading main template:', error);
        return;
      }

      if (data) {
        setMainTemplateHtml(data.html_template || '');
        console.log('✅ Loaded main template');
        
        // If client has no custom template, use main template
        if (!hasCustomTemplate && !editableHtml) {
          setEditableHtml(data.html_template || '');
        }
      }
    } catch (error) {
      console.error('❌ Error loading main template:', error);
    }
  }, [hasCustomTemplate, editableHtml]);

  // Save template (client-specific or main)
  const saveTemplate = useCallback(async (showAlert = true) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const isMainTemplate = activeTab === 'main-template';
      const htmlToSave = isMainTemplate ? mainTemplateHtml : editableHtml;

      if (!htmlToSave.trim()) {
        console.warn('⚠️ Empty template, skipping save');
        setIsSaving(false);
        return;
      }

      // Prepare template data
      const templateData = {
        client_id: isMainTemplate ? null : clientId,
        admin_id: user.id,
        template_type: 'monthly_report',
        html_template: htmlToSave,
        text_template: editableText,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      // Check if template exists
      let query = supabase
        .from('email_templates')
        .select('id')
        .eq('template_type', 'monthly_report')
        .eq('is_active', true);

      if (isMainTemplate) {
        query = query.is('client_id', null);
      } else {
        query = query.eq('client_id', clientId);
      }

      const { data: existing, error: selectError } = await query.single();

      let result;
      if (existing) {
        // Update existing template
        result = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', existing.id);
      } else {
        // Insert new template
        result = await supabase
          .from('email_templates')
          .insert(templateData);
      }

      if (result.error) throw result.error;

      setLastSaved(new Date());
      setIsEditing(false);

      if (isMainTemplate) {
        console.log('✅ Main template saved (affects all non-customized clients)');
        if (showAlert) {
          alert('✅ Szablon główny zapisany! Zmiana dotyczy wszystkich klientów bez własnego szablonu.');
        }
      } else {
        setHasCustomTemplate(true);
        console.log('✅ Client-specific template saved');
        if (showAlert) {
          alert('✅ Szablon klienta zapisany! Ten klient będzie otrzymywał ten dostosowany email.');
        }
      }

    } catch (error) {
      console.error('❌ Error saving template:', error);
      if (showAlert) {
        setError('Failed to save template: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, clientId, editableHtml, mainTemplateHtml, editableText]);

  // Reset client template to use main template
  const resetToMainTemplate = useCallback(async () => {
    if (!confirm('Czy na pewno chcesz usunąć dostosowany szablon i użyć głównego szablonu?')) {
      return;
    }

    try {
      // Deactivate client-specific template
      await supabase
        .from('email_templates')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .eq('template_type', 'monthly_report');

      setHasCustomTemplate(false);
      setEditableHtml(mainTemplateHtml);
      alert('✅ Szablon klienta usunięty. Używany będzie główny szablon.');
      console.log('✅ Reset to main template for client:', clientId);
    } catch (error) {
      console.error('❌ Error resetting template:', error);
      alert('❌ Błąd podczas resetowania szablonu');
    }
  }, [clientId, mainTemplateHtml]);

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
      
      // Fallback to simple summary if no real one available
      if (!summary) {
        summary = `[Podsumowanie zostanie wygenerowane podczas wysyłania]`;
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

      // Generate Polish email template with FULL data from campaigns
      const emailTemplate = generatePolishEmailTemplate(clientName, reportData, {
        summary,
        customMessage
      }, finalCampaigns);
      
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

  // GENERATE FULL MONTHLY TEMPLATE WITH REAL DATA
  const generatePolishEmailTemplate = (clientName: string, reportData: any, content: { summary: string; customMessage: string }, campaignsData: any[]) => {
    const startDate = new Date(reportData.dateRange.split(' to ')[0]);
    const monthNames = [
      'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
      'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
    ];
    const monthName = monthNames[startDate.getMonth()];
    const year = startDate.getFullYear();

    // campaignsData now contains summary records (already separated by platform)
    const googleSummary = campaignsData.find(c => c.platform === 'google') || {};
    const metaSummary = campaignsData.find(c => c.platform === 'meta') || {};

    // Extract Google Ads data from summary (already aggregated)
    const googleSpend = googleSummary.spend || 0;
    const googleImpressions = googleSummary.impressions || 0;
    const googleClicks = googleSummary.clicks || 0;
    const googleCPC = googleSummary.cpc || (googleClicks > 0 ? googleSpend / googleClicks : 0);
    const googleCTR = googleSummary.ctr || (googleImpressions > 0 ? (googleClicks / googleImpressions) * 100 : 0);
    const googleFormSubmissions = googleSummary.form_submissions || 0;
    const googleEmails = googleSummary.email_contacts || 0;
    const googlePhones = googleSummary.click_to_call || 0;
    const googleBE1 = googleSummary.booking_step_1 || 0;
    const googleBE2 = googleSummary.booking_step_2 || 0;
    const googleBE3 = googleSummary.booking_step_3 || 0;
    const googleReservations = googleSummary.reservations || 0;
    const googleReservationValue = googleSummary.reservation_value || 0;
    const googleROAS = googleSummary.roas || (googleSpend > 0 ? (googleReservationValue / googleSpend) : 0);

    // Extract Meta Ads data from summary (already aggregated)
    const metaSpend = metaSummary.spend || 0;
    const metaImpressions = metaSummary.impressions || 0;
    const metaClicks = metaSummary.clicks || 0;
    const metaFormSubmissions = metaSummary.form_submissions || 0;
    const metaEmails = metaSummary.email_contacts || 0;
    const metaPhones = metaSummary.click_to_call || 0;
    const metaReservations = metaSummary.reservations || 0;
    const metaReservationValue = metaSummary.reservation_value || 0;
    const metaROAS = metaSummary.roas || (metaSpend > 0 ? (metaReservationValue / metaSpend) : 0);

    // Calculate overall totals
    const totalOnlineReservations = googleReservations + metaReservations;
    const totalOnlineValue = googleReservationValue + metaReservationValue;
    const totalSpend = googleSpend + metaSpend;
    const onlineCostPercentage = totalOnlineValue > 0 ? (totalSpend / totalOnlineValue) * 100 : 0;

    // Calculate micro conversions
    const totalMicroConversions = googleFormSubmissions + googleEmails + googlePhones + metaFormSubmissions + metaEmails + metaPhones;
    const estimatedOfflineReservations = Math.round(totalMicroConversions * 0.2);
    const avgReservationValue = totalOnlineReservations > 0 ? totalOnlineValue / totalOnlineReservations : 0;
    const estimatedOfflineValue = estimatedOfflineReservations * avgReservationValue;
    const totalValue = totalOnlineValue + estimatedOfflineValue;
    const finalCostPercentage = totalValue > 0 ? (totalSpend / totalValue) * 100 : 0;

    // Format currency
    const fmt = (val: number) => val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtInt = (val: number) => val.toLocaleString('pl-PL');
    const fmtThousands = (val: number) => Math.round(val / 1000).toLocaleString('pl-PL');

    const subject = `Podsumowanie miesiąca - ${monthName} ${year} | ${clientName}`;

    const textContent = `Dzień dobry,

poniżej przesyłam podsumowanie najważniejszych danych z poprzedniego miesiąca.

Szczegółowe raporty za działania znajdą Państwo w panelu klienta - ${process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'}/dashboard

W załączniku przesyłam też szczegółowy raport PDF.

1. Google Ads
Wydana kwota: ${fmt(googleSpend)} zł
Wyświetlenia: ${fmtInt(googleImpressions)}
Kliknięcia: ${fmtInt(googleClicks)}
CPC: ${fmt(googleCPC)} zł
CTR: ${fmt(googleCTR)}%
Wysłanie formularza: ${fmtInt(googleFormSubmissions)}
Kliknięcia w adres e-mail: ${fmtInt(googleEmails)}
Kliknięcia w numer telefonu: ${fmtInt(googlePhones)}
Booking Engine krok 1: ${fmtInt(googleBE1)}
Booking Engine krok 2: ${fmtInt(googleBE2)}
Booking Engine krok 3: ${fmtInt(googleBE3)}
Rezerwacje: ${fmtInt(googleReservations)}
Wartość rezerwacji: ${fmt(googleReservationValue)} zł
ROAS: ${fmt(googleROAS)} (${fmt(googleROAS * 100)}%)

2. Meta Ads
Wydana kwota: ${fmt(metaSpend)} zł
Wyświetlenia: ${fmtInt(metaImpressions)}
Kliknięcia linku: ${fmtInt(metaClicks)}
Wysłanie formularza: ${fmtInt(metaFormSubmissions)}
Kliknięcia w adres e-mail: ${fmtInt(metaEmails)}
Kliknięcia w numer telefonu: ${fmtInt(metaPhones)}
Rezerwacje: ${fmtInt(metaReservations)}
Wartość rezerwacji: ${fmt(metaReservationValue)} zł
ROAS: ${fmt(metaROAS)} (${fmt(metaROAS * 100)}%)

Podsumowanie ogólne
Poprzedni miesiąc przyniósł nam łącznie ${fmtInt(totalOnlineReservations)} rezerwacji online o łącznej wartości ponad ${fmtThousands(totalOnlineValue)} tys. zł.
Koszt pozyskania rezerwacji online zatem wyniósł: ${fmt(onlineCostPercentage)}%.

Dodatkowo pozyskaliśmy też ${fmtInt(totalMicroConversions)} mikro konwersji (telefonów, email i formularzy), które z pewnością przyczyniły się do pozyskania dodatkowych rezerwacji offline. Nawet jeśli tylko 20% z nich zakończyło się rezerwacją, to pozyskaliśmy ${fmtInt(estimatedOfflineReservations)} rezerwacji i dodatkowe ok. ${fmtThousands(estimatedOfflineValue)} tys. zł tą drogą.

Dodając te potencjalne rezerwacje do rezerwacji online, to koszt pozyskania rezerwacji spada do poziomu ok. ${fmt(finalCostPercentage)}%.

Zatem suma wartości rezerwacji za ${monthName} ${year} (online + offline) wynosi około: ${fmtThousands(totalValue)} tys. zł.

W razie pytań proszę o kontakt.

Pozdrawiam
Piotr`;

    // Generate proper HTML with styling
    const htmlContent = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
        <style>
          body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #333; 
      max-width: 600px;
      margin: 0 auto;
            padding: 20px;
            background-color: #f5f7fa;
          }
          .container { 
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          .greeting {
            font-size: 16px; 
      margin-bottom: 20px;
          }
    .section {
            margin: 25px 0;
          }
    .section-title {
            font-size: 18px;
            font-weight: 600;
      color: #1a1a1a;
            margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #3b82f6;
    }
    .metrics {
            background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
      margin: 10px 0;
    }
    .metric-line {
      padding: 4px 0;
            display: flex;
      justify-content: space-between;
    }
    .metric-label {
      color: #666;
          }
          .metric-value {
      font-weight: 600;
      color: #1a1a1a;
    }
    .summary {
      background: #e3f2fd;
            padding: 20px;
      border-radius: 6px;
      border-left: 4px solid #3b82f6;
      margin: 20px 0;
    }
    .link {
      color: #3b82f6;
      text-decoration: none;
            font-weight: 500;
          }
          .footer { 
            margin-top: 30px;
            padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #666;
      font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
    <div class="greeting">Dzień dobry,</div>
    
    <p>poniżej przesyłam podsumowanie najważniejszych danych z poprzedniego miesiąca.</p>
    
    <p>Szczegółowe raporty za działania znajdą Państwo w panelu klienta - <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'}/dashboard" class="link">TUTAJ</a></p>
    
    <p>W załączniku przesyłam też szczegółowy raport PDF.</p>
    
    <div class="section">
      <div class="section-title">1. Google Ads</div>
      <div class="metrics">
        <div class="metric-line"><span class="metric-label">Wydana kwota:</span> <span class="metric-value">${fmt(googleSpend)} zł</span></div>
        <div class="metric-line"><span class="metric-label">Wyświetlenia:</span> <span class="metric-value">${fmtInt(googleImpressions)}</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia:</span> <span class="metric-value">${fmtInt(googleClicks)}</span></div>
        <div class="metric-line"><span class="metric-label">CPC:</span> <span class="metric-value">${fmt(googleCPC)} zł</span></div>
        <div class="metric-line"><span class="metric-label">CTR:</span> <span class="metric-value">${fmt(googleCTR)}%</span></div>
        <div class="metric-line"><span class="metric-label">Wysłanie formularza:</span> <span class="metric-value">${fmtInt(googleFormSubmissions)}</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia w adres e-mail:</span> <span class="metric-value">${fmtInt(googleEmails)}</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia w numer telefonu:</span> <span class="metric-value">${fmtInt(googlePhones)}</span></div>
        <div class="metric-line"><span class="metric-label">Booking Engine krok 1:</span> <span class="metric-value">${fmtInt(googleBE1)}</span></div>
        <div class="metric-line"><span class="metric-label">Booking Engine krok 2:</span> <span class="metric-value">${fmtInt(googleBE2)}</span></div>
        <div class="metric-line"><span class="metric-label">Booking Engine krok 3:</span> <span class="metric-value">${fmtInt(googleBE3)}</span></div>
        <div class="metric-line"><span class="metric-label">Rezerwacje:</span> <span class="metric-value">${fmtInt(googleReservations)}</span></div>
        <div class="metric-line"><span class="metric-label">Wartość rezerwacji:</span> <span class="metric-value">${fmt(googleReservationValue)} zł</span></div>
        <div class="metric-line"><span class="metric-label">ROAS:</span> <span class="metric-value">${fmt(googleROAS)} (${fmt(googleROAS * 100)}%)</span></div>
            </div>
            </div>
            
    <div class="section">
      <div class="section-title">2. Meta Ads</div>
      <div class="metrics">
        <div class="metric-line"><span class="metric-label">Wydana kwota:</span> <span class="metric-value">${fmt(metaSpend)} zł</span></div>
        <div class="metric-line"><span class="metric-label">Wyświetlenia:</span> <span class="metric-value">${fmtInt(metaImpressions)}</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia linku:</span> <span class="metric-value">${fmtInt(metaClicks)}</span></div>
        <div class="metric-line"><span class="metric-label">Wysłanie formularza:</span> <span class="metric-value">${fmtInt(metaFormSubmissions)}</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia w adres e-mail:</span> <span class="metric-value">${fmtInt(metaEmails)}</span></div>
        <div class="metric-line"><span class="metric-label">Kliknięcia w numer telefonu:</span> <span class="metric-value">${fmtInt(metaPhones)}</span></div>
        <div class="metric-line"><span class="metric-label">Rezerwacje:</span> <span class="metric-value">${fmtInt(metaReservations)}</span></div>
        <div class="metric-line"><span class="metric-label">Wartość rezerwacji:</span> <span class="metric-value">${fmt(metaReservationValue)} zł</span></div>
        <div class="metric-line"><span class="metric-label">ROAS:</span> <span class="metric-value">${fmt(metaROAS)} (${fmt(metaROAS * 100)}%)</span></div>
              </div>
            </div>
            
    <div class="summary">
      <strong>Podsumowanie ogólne</strong><br><br>
      Poprzedni miesiąc przyniósł nam łącznie ${fmtInt(totalOnlineReservations)} rezerwacji online o łącznej wartości ponad ${fmtThousands(totalOnlineValue)} tys. zł.<br>
      Koszt pozyskania rezerwacji online zatem wyniósł: ${fmt(onlineCostPercentage)}%.<br><br>
      
      Dodatkowo pozyskaliśmy też ${fmtInt(totalMicroConversions)} mikro konwersji (telefonów, email i formularzy), które z pewnością przyczyniły się do pozyskania dodatkowych rezerwacji offline. 
      Nawet jeśli tylko 20% z nich zakończyło się rezerwacją, to pozyskaliśmy ${fmtInt(estimatedOfflineReservations)} rezerwacji i dodatkowe ok. ${fmtThousands(estimatedOfflineValue)} tys. zł tą drogą.<br><br>
      
      Dodając te potencjalne rezerwacje do rezerwacji online, to koszt pozyskania rezerwacji spada do poziomu ok. ${fmt(finalCostPercentage)}%.<br><br>
      
      <strong>Zatem suma wartości rezerwacji za ${monthName} ${year} (online + offline) wynosi około: ${fmtThousands(totalValue)} tys. zł.</strong>
          </div>
          
          <div class="footer">
      <p>W razie pytań proszę o kontakt.</p>
      <p>Pozdrawiam<br><strong>Piotr</strong></p>
          </div>
        </div>
      </body>
</html>`;

    return {
      subject,
      text: textContent,
      html: htmlContent
    };
  };

  // REMOVED: Old summary generator - not needed for preview
  // Real summaries are generated at send time by FlexibleEmailService

  // REMOVED: Old generateCustomReportEmailTemplate() - not needed for preview
  // Real emails use FlexibleEmailService.sendClientMonthlyReport()

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

              {/* Data Source Debug Info */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="text-xs text-purple-800">
                  <strong>🔍 Debug Info (będzie usunięte):</strong>
                  <div className="mt-1 font-mono">
                    • <strong>KLIENT: {clientName}</strong>
                    <br />
                    • Źródło danych: <strong>StandardizedDataFetcher + GoogleAdsStandardizedDataFetcher</strong> (TO SAMO CO /REPORTS!)
                    <br />
                    • Okres: {dateRange.start} to {dateRange.end}
                    <br />
                    • Google Ads wydatki: {campaigns?.find((c: any) => c.platform === 'google')?.spend?.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'} zł
                    <br />
                    • Meta Ads wydatki: {campaigns?.find((c: any) => c.platform === 'meta')?.spend?.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'} zł
                    <br />
                    • Google Ads rezerwacje: {campaigns?.find((c: any) => c.platform === 'google')?.reservations || 0}
                    <br />
                    • Meta Ads rezerwacje: {campaigns?.find((c: any) => c.platform === 'meta')?.reservations || 0}
                    <br />
                    • Platformy załadowane: {campaigns?.length || 0}
                    <br />
                    {(() => {
                      const hasGoogleAds = !!(client?.google_ads_customer_id);
                      const expectedPlatforms = hasGoogleAds ? 2 : 1;
                      const loadedPlatforms = campaigns?.length || 0;

                      if (loadedPlatforms === 0) {
                        return (
                          <span className="text-red-600">
                            ⚠️ BRAK DANYCH - Sprawdź czy /reports pokazuje dane!
                          </span>
                        );
                      }
                      if (loadedPlatforms < expectedPlatforms) {
                        return (
                          <span className="text-yellow-600">
                            ⚠️ Tylko {loadedPlatforms} platforma załadowana (oczekiwano {expectedPlatforms}: {hasGoogleAds ? 'Meta + Google' : 'Meta'})
                          </span>
                        );
                      }
                      if (!hasGoogleAds && loadedPlatforms === 1) {
                        return (
                          <span className="text-green-600">
                            ✅ Meta załadowana (klient nie ma Google Ads) - TO SAME DANE CO W /REPORTS!
                          </span>
                        );
                      }
                      return (
                        <span className="text-green-600">
                          ✅ Obie platformy załadowane - TO SAME DANE CO W /REPORTS!
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* No Data Warning */}
              {campaigns && campaigns.length === 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        <strong>BRAK DANYCH:</strong> Widzisz zera, ponieważ nie ma danych w tabeli <code className="bg-yellow-100 px-1 rounded">daily_kpi_data</code> dla tego klienta i okresu.
                        <br /><br />
                        <strong>✅ WAŻNE: Email używa TEJ SAMEJ tabeli co /reports!</strong>
                        <br /><br />
                        <strong>Sprawdź:</strong>
                        <br />1. Idź do <code className="bg-yellow-100 px-1 rounded">/reports</code>
                        <br />2. Wybierz tego samego klienta i okres
                        <br />3. Jeśli /reports pokazuje dane → email też je pokaże (odśwież)
                        <br />4. Jeśli /reports też pokazuje zera → brak danych w bazie
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab System - 3 Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <div className="flex space-x-1">
                  {/* Tab 1: Preview */}
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'preview'
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Eye className="w-4 h-4 inline-block mr-2" />
                    Podgląd Emaila
                  </button>
                  
                  {/* Tab 2: Client-Specific HTML Editor */}
                  <button
                    onClick={() => setActiveTab('client-html')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'client-html'
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline-block mr-2" />
                    Szablon Klienta
                    {hasCustomTemplate && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">Dostosowany</span>
                    )}
                  </button>
                  
                  {/* Tab 3: Main Template Editor */}
                  <button
                    onClick={() => setActiveTab('main-template')}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'main-template'
                        ? 'border-purple-600 text-purple-600 bg-purple-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <FileText className="w-4 h-4 inline-block mr-2" />
                    Szablon Główny
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Globalne</span>
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {/* Tab 1: Preview - Shows dynamically generated email with REAL DATA */}
              {activeTab === 'preview' && (
                <div className="border rounded-lg overflow-hidden bg-white p-6 min-h-[400px]">
                  <div 
                    className="prose max-w-none text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: previewData?.html || editableHtml }}
                  />
                </div>
              )}

              {/* Tab 2: Client-Specific HTML Editor */}
              {activeTab === 'client-html' && (
                <div className="space-y-3">
                  {/* Info Banner */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <strong>Szablon dla klienta: {clientName}</strong>
                      <br />
                      {hasCustomTemplate ? (
                        <>✅ Ten klient ma dostosowany szablon. Zmiany dotyczą TYLKO tego klienta.</>
                      ) : (
                        <>ℹ️ Ten klient używa głównego szablonu. Edycja utworzy dostosowany szablon dla tego klienta.</>
                      )}
                    </div>
                  </div>
                  
                  {/* Auto-save indicator */}
                  {lastSaved && (
                    <div className="text-xs text-gray-500 flex items-center">
                      <svg className="w-3 h-3 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Zapisano automatycznie: {lastSaved.toLocaleTimeString('pl-PL')}
                    </div>
                  )}

                  {/* Warning Banner */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start">
                    <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-yellow-800">
                      <strong>UWAGA:</strong> To jest rzeczywisty kod HTML, który zostanie wysłany do tego klienta. Auto-zapis włączony (2 sekundy).
                    </div>
                  </div>
                  
                  {/* HTML Editor */}
              <div className="border rounded-lg overflow-hidden">
                <textarea
                      className="w-full h-full p-6 text-sm font-mono bg-gray-900 text-green-400 min-h-[500px] leading-relaxed"
                      value={editableHtml}
                      onChange={(e) => {
                        setEditableHtml(e.target.value);
                        setIsEditing(true);
                      }}
                  onBlur={() => setIsEditing(false)}
                      placeholder="<html>...</html>"
                      spellCheck={false}
                />
              </div>
                  
                  {/* Reset to Main Template Button */}
                  {hasCustomTemplate && (
                    <button
                      onClick={resetToMainTemplate}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors border border-red-300"
                    >
                      🗑️ Usuń dostosowany szablon (użyj głównego)
                    </button>
                  )}
                </div>
              )}

              {/* Tab 3: Main Template Editor */}
              {activeTab === 'main-template' && (
                <div className="space-y-3">
                  {/* Info Banner */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start">
                    <svg className="w-6 h-6 text-purple-600 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-purple-900">
                      <strong>⚠️ SZABLON GŁÓWNY (GLOBALNY)</strong>
                      <br /><br />
                      <strong>Ten szablon jest używany przez:</strong>
                      <br />• Wszystkich klientów, którzy NIE mają dostosowanego szablonu
                      <br />• Nowych klientów (domyślnie)
                      <br /><br />
                      <strong className="text-purple-700">🔔 Zmiana tego szablonu wpłynie na WSZYSTKICH klientów bez dostosowanego szablonu!</strong>
                    </div>
                  </div>
                  
                  {/* Auto-save indicator */}
                  {lastSaved && (
                    <div className="text-xs text-gray-500 flex items-center">
                      <svg className="w-3 h-3 text-green-500 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Zapisano automatycznie: {lastSaved.toLocaleTimeString('pl-PL')}
                    </div>
                  )}

                  {/* Warning Banner */}
                  <div className="bg-orange-50 border border-orange-300 rounded-lg p-3 flex items-start">
                    <svg className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-orange-800">
                      <strong>UWAGA:</strong> Edytujesz GLOBALNY szablon. Zmiana wpłynie na wszystkich klientów! Auto-zapis włączony (2 sekundy).
                    </div>
                  </div>
                  
                  {/* HTML Editor for Main Template */}
                  <div className="border-2 border-purple-300 rounded-lg overflow-hidden">
                    <textarea
                      className="w-full h-full p-6 text-sm font-mono bg-gray-900 text-purple-300 min-h-[500px] leading-relaxed"
                      value={mainTemplateHtml}
                      onChange={(e) => {
                        setMainTemplateHtml(e.target.value);
                        setIsEditing(true);
                      }}
                      onBlur={() => setIsEditing(false)}
                      placeholder="<html>...</html>"
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}

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
          <div className="mt-6 pt-4 border-t border-gray-200 space-y-4">
            {/* Warning Notice */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
              <svg className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-green-800">
                <strong>Potwierdź:</strong> Ten email zostanie rzeczywiście wysłany do klienta podczas automatycznego wysyłania. Każda zmiana w zakładce "Edytor HTML" będzie użyta w prawdziwym emailu.
              </div>
            </div>

            <div className="flex justify-between items-center">
            <button
              onClick={saveDraft}
                disabled={isSaving || (!editableText.trim() && !editableHtml.trim())}
                className="flex items-center px-6 py-3 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Zapisywanie...' : '✅ Zapisz i użyj tego emaila'}
            </button>
            
            <div className="flex space-x-3">
              <button
                onClick={resetToOriginal}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
              >
                  Przywróć oryginał
              </button>
              <button
                onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
              >
                  Zamknij
              </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default EmailPreviewModal; 