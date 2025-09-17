'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle, Clock, RefreshCw, Key, Shield, Upload, Trash2, Image, Calendar, Mail, Facebook, Target } from 'lucide-react';
import { MetaAPIService } from '../lib/meta-api';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';
import { getMonthBoundaries, getWeekBoundaries } from '../lib/date-range-utils';

type Client = Database['public']['Tables']['clients']['Row'];

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (clientId: string, updates: Partial<Client>) => Promise<void>;
  client: Client | null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditClientModal({ isOpen, onClose, onUpdate, client }: EditClientModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    ad_account_id: '',
    meta_access_token: '',
    system_user_token: '',
    // Google Ads fields
    google_ads_customer_id: '',
    google_ads_refresh_token: '',
    google_ads_enabled: false,
    reporting_frequency: 'monthly' as Database['public']['Enums']['reporting_frequency'],
    send_day: 5,
    notes: '',
    contact_emails: [] as string[]
  });
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    meta: { status: 'idle' | 'validating' | 'valid' | 'invalid'; message: string; };
    google: { status: 'idle' | 'validating' | 'valid' | 'invalid'; message: string; };
  }>({ 
    meta: { status: 'idle', message: '' },
    google: { status: 'idle', message: '' }
  });
  const [submitError, setSubmitError] = useState<string>('');
  const [showTokenFields, setShowTokenFields] = useState(false);
  const [adAccountIdError, setAdAccountIdError] = useState<string>('');
  const [selectedPlatform, setSelectedPlatform] = useState<'meta' | 'google'>('meta');
  
  // Logo upload states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add new state for scheduled emails preview
  const [upcomingEmails, setUpcomingEmails] = useState<Array<{
    date: string;
    period: string;
    type: string;
  }>>([]);

  // Initialize form data when client changes
  useEffect(() => {
    if (client) {
      // Get all contact emails except the main email (which is shown separately)
      const contactEmails = client.contact_emails || [];
      const additionalEmails = contactEmails.filter(email => email !== client.email);
      
      console.log('Initializing client form:', {
        mainEmail: client.email,
        allContactEmails: contactEmails,
        additionalEmails: additionalEmails,
        logoUrl: client.logo_url
      });
      
      setFormData({
        name: client.name || '',
        email: client.email || '', // This should always be the original login email
        company: client.company || '',
        ad_account_id: client.ad_account_id || '',
        meta_access_token: '', // Don't pre-fill tokens for security
        system_user_token: '', // Don't pre-fill tokens for security
        // Google Ads fields
        google_ads_customer_id: client.google_ads_customer_id || '',
        google_ads_refresh_token: client.google_ads_refresh_token || '',
        google_ads_enabled: client.google_ads_enabled || false,
        reporting_frequency: client.reporting_frequency || 'monthly',
        send_day: client.send_day || 5,
        notes: client.notes || '',
        contact_emails: additionalEmails
      });
      
      // Set logo preview if client has a logo
      setLogoPreview(client.logo_url || '');
      setLogoFile(null);
      setLogoError('');
      
      setValidationStatus({ 
        meta: { status: 'idle', message: '' },
        google: { status: 'idle', message: '' }
      });
      setSubmitError('');
      setShowTokenFields(false);
      setAdAccountIdError('');
      setSelectedPlatform('meta'); // Reset platform selection
    }
  }, [client]);

  // Logo upload functions
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setLogoError('Nieprawidłowy typ pliku. Proszę przesłać obraz JPEG, PNG, WebP lub SVG.');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setLogoError('Plik jest za duży. Maksymalny rozmiar to 5MB.');
      return;
    }

    setLogoError('');
    setLogoFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    if (!logoFile || !client) return;

    setLogoUploading(true);
    setLogoError('');

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Brak ważnej sesji');
      }

      // Create form data
      const formData = new FormData();
      formData.append('logo', logoFile);

      // Upload logo
      const response = await fetch(`/api/clients/${client.id}/upload-logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się przesłać logo');
      }

      const result = await response.json();
      console.log('Logo uploaded successfully:', result);

      // Update the preview with the new URL
      setLogoPreview(result.logo_url);
      setLogoFile(null);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Error uploading logo:', error);
      setLogoError(error instanceof Error ? error.message : 'Nie udało się przesłać logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleLogoDelete = async () => {
    if (!client) return;

    setLogoUploading(true);
    setLogoError('');

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Brak ważnej sesji');
      }

      // Delete logo
      const response = await fetch(`/api/clients/${client.id}/upload-logo`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się usunąć logo');
      }

      console.log('Logo deleted successfully');

      // Clear preview and file
      setLogoPreview('');
      setLogoFile(null);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Error deleting logo:', error);
      setLogoError(error instanceof Error ? error.message : 'Nie udało się usunąć logo');
    } finally {
      setLogoUploading(false);
    }
  };

  // Validate Ad Account ID format in real-time
  const validateAdAccountIdFormat = (accountId: string) => {
    if (!accountId) {
      setAdAccountIdError('');
      return true;
    }
    
    // Accept both formats: "act_123456789" or just "123456789"
    const actPattern = /^(act_)?\d+$/;
    if (!actPattern.test(accountId)) {
      setAdAccountIdError('ID konta reklamowego powinien zawierać tylko cyfry lub zaczynać się od "act_" po którym następują cyfry (np. 123456789 lub act_123456789)');
      return false;
    }
    
    // Check if it's at least 9 digits (for numeric-only format) or 12 characters (for act_ format)
    const numericPart = accountId.replace('act_', '');
    if (numericPart.length < 9) {
      setAdAccountIdError('ID konta reklamowego wydaje się za krótki. Sprawdź format.');
      return false;
    }
    
    setAdAccountIdError('');
    return true;
  };

  const handleAdAccountIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setFormData({...formData, ad_account_id: newValue});
    validateAdAccountIdFormat(newValue);
  };

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  };

  // Add a new email to the contact_emails array
  const addEmail = () => {
    setFormData({
      ...formData,
      contact_emails: [...formData.contact_emails, '']
    });
  };

  // Remove an email from the contact_emails array
  const removeEmail = (index: number) => {
    if (index === 0) return; // Don't allow removing the main email
    const newEmails = formData.contact_emails.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      contact_emails: newEmails
    });
  };

  // Update an email in the contact_emails array
  const updateEmail = (index: number, value: string) => {
    const newEmails = [...formData.contact_emails];
    newEmails[index] = value;
    setFormData({
      ...formData,
      contact_emails: newEmails
    });
  };

  // Validate all emails before submission
  const validateEmails = (): boolean => {
    // Check if main email is valid
    if (!validateEmail(formData.email)) {
      return false;
    }
    
    // Check if all contact emails are valid
    for (let i = 0; i < formData.contact_emails.length; i++) {
      const email = formData.contact_emails[i];
      if (email && !validateEmail(email)) {
        return false;
      }
    }
    
    // Check for duplicates
    const allEmails = [formData.email, ...formData.contact_emails.filter(email => email && email.trim() !== '')];
    const uniqueEmails = new Set(allEmails);
    if (allEmails.length !== uniqueEmails.size) {
      return false;
    }
    
    return true;
  };

  const validateMetaCredentials = async () => {
    // Check if Ad Account ID is provided (required)
    if (!formData.ad_account_id) {
      setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: 'Meta Ad Account ID is required' } }));
      return;
    }
    
    // Validate Ad Account ID format
    if (!validateAdAccountIdFormat(formData.ad_account_id)) {
      setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: 'Please fix the Ad Account ID format before validating' } }));
      return;
    }
    
    // Check if at least one token is provided
    if (!formData.meta_access_token && !formData.system_user_token) {
      setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: 'Please provide either a Meta Access Token (60 days) or System User Token (permanent)' } }));
      return;
    }
    
    // Use System User token if provided (permanent), otherwise use regular access token (60 days)
    const tokenToUse = formData.system_user_token || formData.meta_access_token;
    const tokenType = formData.system_user_token ? 'System User Token (Permanent)' : 'Meta Access Token (60 days)';

    setValidating(true);
    setValidationStatus(prev => ({ ...prev, meta: { status: 'validating', message: `Validating ${tokenType}...` } }));

    try {
      const metaService = new MetaAPIService(tokenToUse);
      
      // Step 1: Validate and convert the access token to long-lived
      const tokenValidation = await metaService.validateAndConvertToken();
      
      if (!tokenValidation.valid) {
        let errorMessage = `Token validation failed: ${tokenValidation.error}`;
        
        // Provide helpful guidance based on error type
        if (tokenValidation.error?.includes('expired')) {
          errorMessage += '\n💡 Tip: Use a System User token for permanent access that never expires.';
        } else if (tokenValidation.error?.includes('permissions')) {
          errorMessage += '\n💡 Tip: Make sure your token has ads_read and ads_management permissions.';
        } else if (tokenValidation.error?.includes('invalid')) {
          errorMessage += '\n💡 Tip: Check that your token starts with "EAA" and is copied correctly.';
        }
        
        setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: errorMessage } }));
        return;
      }

      // Step 2: Validate the specific ad account ID
      const accountValidation = await metaService.validateAdAccount(formData.ad_account_id);
      
      if (!accountValidation.valid) {
        let errorMessage = `Ad Account validation failed: ${accountValidation.error}`;
        
        // Provide helpful guidance
        if (accountValidation.error?.includes('not found')) {
          errorMessage += '\n💡 Tip: Check your Ad Account ID format (should be like "act_123456789").';
        } else if (accountValidation.error?.includes('access denied')) {
          errorMessage += '\n💡 Tip: Make sure your token has access to this ad account.';
        }
        
        setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: errorMessage } }));
        return;
      }

      // Step 3: Test campaign access (optional but good to verify)
      try {
        const campaigns = await metaService.getCampaigns(formData.ad_account_id.replace('act_', ''));
        
        let statusMessage = `✅ Connection successful! Account: ${accountValidation.account?.name || formData.ad_account_id}. Found ${campaigns.length} campaigns.`;
        
        // Enhanced token status information with user-friendly guidance
        if (tokenValidation.convertedToken) {
          statusMessage += '\n🔄 Your token will be automatically converted to permanent access (no expiration).';
        } else if (tokenValidation.isLongLived) {
          statusMessage += '\n✅ Perfect! Your token is already permanent (System User token).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += `\n⚠️ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          } else {
            statusMessage += `\n⏰ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          }
        }
        
        setValidationStatus(prev => ({ ...prev, meta: { status: 'valid', message: statusMessage } }));
      } catch (campaignError) {
        // Campaign fetch failed, but credentials are still valid
        let statusMessage = `✅ Connection successful! Account: ${accountValidation.account?.name || formData.ad_account_id}. Campaign access may be limited.`;
        
        // Enhanced token status information with user-friendly guidance
        if (tokenValidation.convertedToken) {
          statusMessage += '\n🔄 Your token will be automatically converted to permanent access (no expiration).';
        } else if (tokenValidation.isLongLived) {
          statusMessage += '\n✅ Perfect! Your token is already permanent (System User token).';
        } else if (tokenValidation.expiresAt) {
          const daysUntilExpiry = Math.ceil((tokenValidation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry <= 7) {
            statusMessage += `\n⚠️ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          } else {
            statusMessage += `\n⏰ Token expires in ${daysUntilExpiry} days - will be converted to permanent access.`;
          }
        }
        
        setValidationStatus(prev => ({ ...prev, meta: { status: 'valid', message: statusMessage } }));
      }

    } catch (error) {
      setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` } }));
    } finally {
      setValidating(false);
    }
  };

  const validateGoogleAdsCredentials = async () => {
    // Check if required fields are provided
    if (!formData.google_ads_customer_id || !formData.google_ads_refresh_token) {
      setValidationStatus(prev => ({ 
        ...prev, 
        google: { status: 'invalid', message: 'Google Ads Customer ID i Refresh Token są wymagane' }
      }));
      return;
    }

    setValidating(true);
    setValidationStatus(prev => ({ 
      ...prev, 
      google: { status: 'validating', message: 'Walidacja Google Ads...' }
    }));

    try {
      // For now, just validate format
      const customerIdFormat = /^\d{3}-\d{3}-\d{4}$/.test(formData.google_ads_customer_id);
      const refreshTokenFormat = formData.google_ads_refresh_token.startsWith('1//');
      
      if (!customerIdFormat) {
        setValidationStatus(prev => ({ 
          ...prev, 
          google: { 
            status: 'invalid', 
            message: 'Google Ads Customer ID powinien mieć format XXX-XXX-XXXX' 
          }
        }));
        return;
      }

      if (!refreshTokenFormat) {
        setValidationStatus(prev => ({ 
          ...prev, 
          google: { 
            status: 'invalid', 
            message: 'Google Ads Refresh Token powinien zaczynać się od "1//"' 
          }
        }));
        return;
      }

      setValidationStatus(prev => ({ 
        ...prev, 
        google: { 
          status: 'valid', 
          message: '✅ Google Ads: Format poprawny! Połączenie zostanie zweryfikowane podczas pierwszego użycia.' 
        }
      }));

    } catch (error) {
      setValidationStatus(prev => ({ 
        ...prev, 
        google: { 
          status: 'invalid', 
          message: `Błąd walidacji Google Ads: ${error instanceof Error ? error.message : 'Nieznany błąd'}` 
        }
      }));
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client) return;
    
    // Clear previous errors
    setSubmitError('');
    
    // Validate emails
    if (!validateEmails()) {
      setSubmitError('Please fix email validation errors before saving');
      return;
    }
    
    // Validate Ad Account ID format
    if (!validateAdAccountIdFormat(formData.ad_account_id)) {
      setSubmitError('Please fix the Ad Account ID format before saving');
      return;
    }
    
    // If token fields are shown and filled, validate them
    if (showTokenFields && (formData.meta_access_token || formData.system_user_token) && validationStatus.meta.status !== 'valid') {
      setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: 'Proszę najpierw zweryfikować swoje poświadczenia Meta Ads' } }));
      return;
    }

    setLoading(true);
    try {
      // Prepare updates - only include fields that have changed
      const updates: Partial<Client> = {};
      
      if (formData.name !== client.name) updates.name = formData.name;
      if (formData.email !== client.email) updates.email = formData.email;
      if (formData.company !== client.company) updates.company = formData.company;
      if (formData.ad_account_id !== client.ad_account_id) updates.ad_account_id = formData.ad_account_id;
      if (formData.reporting_frequency !== client.reporting_frequency) updates.reporting_frequency = formData.reporting_frequency;
      if (formData.send_day !== client.send_day) updates.send_day = formData.send_day;
      if (formData.notes !== client.notes) updates.notes = formData.notes;
      
      // Update contact_emails - ensure main email is always first and no duplicates
      const additionalEmails = formData.contact_emails.filter(email => email && email.trim() !== '' && email !== formData.email);
      const updatedContactEmails = [formData.email, ...additionalEmails];
      
      console.log('Saving contact emails:', {
        currentClientEmails: client.contact_emails,
        newContactEmails: updatedContactEmails,
        willUpdate: JSON.stringify(updatedContactEmails) !== JSON.stringify(client.contact_emails || [client.email])
      });
      
      if (JSON.stringify(updatedContactEmails) !== JSON.stringify(client.contact_emails || [client.email])) {
        updates.contact_emails = updatedContactEmails;
      }
      
      // Only include tokens if they were changed
      if (showTokenFields) {
        // Handle Meta tokens
        if (formData.system_user_token) {
          updates.system_user_token = formData.system_user_token;
          // Clear meta_access_token if system user token is provided
          updates.meta_access_token = null;
        } else if (formData.meta_access_token) {
          updates.meta_access_token = formData.meta_access_token;
          // Clear system_user_token if meta access token is provided
          updates.system_user_token = null;
        }

        // Handle Google Ads fields
        if (formData.google_ads_customer_id !== client.google_ads_customer_id) {
          updates.google_ads_customer_id = formData.google_ads_customer_id;
        }
        if (formData.google_ads_refresh_token && formData.google_ads_refresh_token !== client.google_ads_refresh_token) {
          updates.google_ads_refresh_token = formData.google_ads_refresh_token;
        }
        if (formData.google_ads_enabled !== client.google_ads_enabled) {
          updates.google_ads_enabled = formData.google_ads_enabled;
        }
      }

      await onUpdate(client.id, updates);
      onClose();
    } catch (error) {
      console.error('Error updating client:', error);
      const errorMessage = error instanceof Error ? error.message : 'Nie udało się zaktualizować klienta. Spróbuj ponownie.';
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions (same as calendar page and reports page)
  const getWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const generatePeriodId = (date: Date, type: 'monthly' | 'weekly') => {
    if (type === 'monthly') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
  };

  const calculateUpcomingEmails = (frequency: string, sendDay: number) => {
    if (frequency === 'on_demand' || !sendDay) {
      setUpcomingEmails([]);
      return;
    }

    const emails = [];
    const today = new Date();
    
    if (frequency === 'monthly') {
      // Generate next 3 monthly emails
      for (let i = 0; i < 3; i++) {
        const targetMonth = new Date(today.getFullYear(), today.getMonth() + i, sendDay);
        
        // If the send day for this month has already passed, move to next month
        if (targetMonth < today) {
          targetMonth.setMonth(targetMonth.getMonth() + 1);
        }
        
        // Generate period ID for the month being reported
        const reportMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
        const periodId = generatePeriodId(reportMonth, 'monthly');
        
        // Calculate the actual report period dates
        const [year, month] = periodId.split('-').map(Number);
        const validYear = year || today.getFullYear();
        const validMonth = month || (today.getMonth() + 1);
        const isCurrentMonth = validYear === today.getFullYear() && validMonth === (today.getMonth() + 1);
        
        let periodDisplay;
        if (isCurrentMonth) {
          const startDate = new Date(Date.UTC(validYear, validMonth - 1, 1));
          periodDisplay = `${startDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })} (do dziś)`;
        } else {
          const dateRange = getMonthBoundaries(validYear, validMonth);
          const startDate = new Date(dateRange.start);
          periodDisplay = startDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
        }
        
        emails.push({
          date: targetMonth.toLocaleDateString('pl-PL'),
          period: periodDisplay,
          type: 'Miesięczny raport'
        });
      }
    } else if (frequency === 'weekly') {
      // Generate next 4 weekly emails
      const today = new Date();
      let currentDate = new Date(today);
      
      // Find the next occurrence of the send day
      const targetWeekday = sendDay; // 1=Monday, 7=Sunday
      const currentWeekday = currentDate.getDay() || 7; // Convert Sunday(0) to 7
      
      let daysToNext = targetWeekday - currentWeekday;
      if (daysToNext <= 0) {
        daysToNext += 7; // Move to next week
      }
      
      for (let i = 0; i < 4; i++) {
        const sendDate = new Date(currentDate);
        sendDate.setDate(currentDate.getDate() + daysToNext + (i * 7));
        
        // Generate period ID for the week being reported
        const reportWeek = new Date(sendDate);
        const weekPeriodId = generatePeriodId(reportWeek, 'weekly');
        
        // Calculate the actual report period dates
        const [year, weekStr] = weekPeriodId.split('-W');
        const week = parseInt(weekStr || '1');
        
        // Calculate week boundaries
        const yearNum = parseInt(year || today.getFullYear().toString());
        const jan4 = new Date(yearNum, 0, 4);
        const startOfWeek1 = new Date(jan4);
        startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
        const weekStartDate = new Date(startOfWeek1);
        weekStartDate.setDate(startOfWeek1.getDate() + (week - 1) * 7);
        const dateRange = getWeekBoundaries(weekStartDate);
        
        const periodDisplay = `Tydzień ${new Date(dateRange.start).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })} - ${new Date(dateRange.end).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        
        emails.push({
          date: sendDate.toLocaleDateString('pl-PL'),
          period: periodDisplay,
          type: 'Tygodniowy raport'
        });
      }
    }
    
    setUpcomingEmails(emails);
  };

  // Calculate upcoming emails when frequency or send day changes
  useEffect(() => {
    if (formData.reporting_frequency && formData.send_day && typeof formData.send_day === 'number') {
      calculateUpcomingEmails(formData.reporting_frequency, formData.send_day);
    }
  }, [formData.reporting_frequency, formData.send_day]);

  if (!isOpen || !client) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl sm:rounded-lg w-full max-w-xs sm:max-w-lg md:max-w-2xl lg:max-w-4xl mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 rounded-t-xl sm:rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate pr-2">Edytuj: {client.name}</h2>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Zamknij modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 sm:p-6">
        
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nazwa firmy *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 sm:px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-base sm:text-sm min-h-[44px]"
              placeholder="Wprowadź nazwę firmy"
            />
          </div>
          
          {/* Logo Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo klienta
            </label>
            <div className="space-y-3">
              {/* Logo Preview */}
              {logoPreview && (
                <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <div className="text-center">
                    <img 
                      src={logoPreview} 
                      alt="Logo preview" 
                      className="max-h-24 max-w-full object-contain mx-auto"
                    />
                  </div>
                </div>
              )}
              
              {/* Upload Area */}
              <div className="flex items-center space-x-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className={`flex-1 flex items-center justify-center px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    logoError ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                  }`}
                >
                  <div className="text-center">
                    <Image className="mx-auto h-6 w-6 text-gray-400" />
                    <span className="mt-1 block text-sm text-gray-600">
                      {logoFile ? logoFile.name : 'Wybierz logo'}
                    </span>
                  </div>
                </label>
                
                {logoFile && (
                  <button
                    type="button"
                    onClick={handleLogoUpload}
                    disabled={logoUploading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                  >
                    {logoUploading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>{logoUploading ? 'Przesyłanie...' : 'Prześlij'}</span>
                  </button>
                )}
                
                {logoPreview && !logoFile && (
                  <button
                    type="button"
                    onClick={handleLogoDelete}
                    disabled={logoUploading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                  >
                    {logoUploading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span>{logoUploading ? 'Usuwanie...' : 'Usuń'}</span>
                  </button>
                )}
              </div>
              
              {logoError && (
                <p className="text-xs text-red-600">{logoError}</p>
              )}
              
              <p className="text-xs text-gray-500">
                Obsługiwane formaty: JPEG, PNG, WebP, SVG. Maksymalny rozmiar: 5MB.
                Logo będzie wyświetlane w dashboardzie, raportach i PDF-ach.
              </p>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adres e-mail kontaktowy * (Główne logowanie)
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50"
              placeholder="contact@company.com"
              title="To jest główny adres e-mail logowania i nie może być zmieniony"
            />
            <p className="text-xs text-gray-500 mt-1">To jest główny adres e-mail logowania i zawsze będzie otrzymywał raporty.</p>
          </div>
          
          {/* Additional Contact Emails Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dodatkowe adresy e-mail kontaktowe
            </label>
            <div className="space-y-2">
              {formData.contact_emails.map((email, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                      email && !validateEmail(email) 
                        ? 'border-red-300 focus:ring-red-500' 
                        : email && validateEmail(email)
                        ? 'border-green-300 focus:ring-green-500'
                        : 'border-gray-300 focus:ring-primary-500'
                    }`}
                    placeholder="dodatkowy@firma.com"
                  />
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeEmail(index)}
                      className="px-2 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {email && validateEmail(email) && (
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addEmail}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
              >
                <span className="mr-1">+</span>
                Dodaj inny e-mail
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Dodatkowe adresy e-mail będą otrzymywać wszystkie raporty i powiadomienia dla tego klienta.
            </p>
          </div>
          
          {/* Token Management Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-700">Zarządzanie tokenami API</span>
              <button
                type="button"
                onClick={() => setShowTokenFields(!showTokenFields)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showTokenFields ? 'Ukryj' : 'Aktualizuj tokeny'}
              </button>
            </div>
            
            {showTokenFields ? (
              <div className="space-y-4">
                {/* Debug indicator */}
                <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                  ✅ Debug: Platform tabs should be visible (selectedPlatform: {selectedPlatform})
                </div>
                
                {/* Platform Selection Tabs */}
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform('meta')}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                      selectedPlatform === 'meta'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <Facebook className="h-4 w-4 mr-2" />
                      Meta Ads
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform('google')}
                    className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                      selectedPlatform === 'google'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <Target className="h-4 w-4 mr-2" />
                      Google Ads
                    </div>
                  </button>
                </div>

                {/* Meta Platform Configuration */}
                {selectedPlatform === 'meta' && (
                  <div className="space-y-4">
                    {/* Ad Account ID */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ID konta reklamowego Meta *
                      </label>
                      <input
                        type="text"
                        value={formData.ad_account_id}
                        onChange={(e) => setFormData({...formData, ad_account_id: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="act_123456789"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: act_XXXXXXXXX (znajdź w Ads Manager → Settings → Ad Account ID)
                      </p>
                    </div>

                    {/* Token Choice Section */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                        <Key className="h-4 w-4 mr-2" />
                        Wybierz typ tokenu (Wybierz jeden)
                      </h4>
                      
                      <div className="grid grid-cols-1 gap-4">
                        {/* Option 1: System User Token */}
                        <div className={`border-2 rounded-lg p-4 transition-colors ${
                          formData.system_user_token ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                        }`}>
                          <div className="flex items-center mb-2">
                            <Shield className="h-4 w-4 mr-2 text-blue-600" />
                            <label className="text-sm font-medium text-gray-700">
                              Token Systemowego Użytkownika (Zalecane)
                            </label>
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              value={formData.system_user_token}
                              onChange={(e) => setFormData({...formData, system_user_token: e.target.value, meta_access_token: ''})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Wklej token Systemowego Użytkownika dla trwałego dostępu"
                            />
                            {formData.system_user_token && formData.system_user_token.startsWith('EAA') && (
                              <div className="absolute right-2 top-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-2">
                            ✅ Dostęp trwały, nigdy nie wygasa
                          </p>
                        </div>

                        {/* Option 2: Meta Access Token */}
                        <div className={`border-2 rounded-lg p-4 transition-colors ${
                          formData.meta_access_token && !formData.system_user_token ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                        }`}>
                          <div className="flex items-center mb-2">
                            <Clock className="h-4 w-4 mr-2 text-orange-600" />
                            <label className="text-sm font-medium text-gray-700">
                              Token Meta Access (60 dni)
                            </label>
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              value={formData.meta_access_token}
                              onChange={(e) => setFormData({...formData, meta_access_token: e.target.value, system_user_token: ''})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                              placeholder="EAA... (zaczyna się od EAA)"
                            />
                            {formData.meta_access_token && formData.meta_access_token.startsWith('EAA') && (
                              <div className="absolute right-2 top-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-2">
                            ⏰ Wygasa za 60 dni, wymaga odnowienia
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Token Choice Status */}
                    {(formData.meta_access_token || formData.system_user_token) && (
                      <div className="p-3 bg-gray-50 rounded-md">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Status wybranego tokenu:</h4>
                        <div className="space-y-2">
                          {formData.system_user_token && (
                            <div className={`flex items-center text-sm p-2 rounded ${
                              formData.system_user_token.startsWith('EAA') 
                                ? 'text-green-700 bg-green-50 border border-green-200' 
                                : 'text-yellow-700 bg-yellow-50 border border-yellow-200'
                            }`}>
                              {formData.system_user_token.startsWith('EAA') ? (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              ) : (
                                <AlertCircle className="h-4 w-4 mr-2" />
                              )}
                              <span>
                                {formData.system_user_token.startsWith('EAA') 
                                  ? '✅ Token Systemowego Użytkownika wybrany (Dostęp trwały)' 
                                  : '⚠️ Token Systemowego Użytkownika powinien zaczynać się od "EAA" dla API Meta'
                                }
                              </span>
                            </div>
                          )}
                          
                          {formData.meta_access_token && !formData.system_user_token && (
                            <div className={`flex items-center text-sm p-2 rounded ${
                              formData.meta_access_token.startsWith('EAA') 
                                ? 'text-green-700 bg-green-50' 
                                : 'text-yellow-700 bg-yellow-50'
                            }`}>
                              {formData.meta_access_token.startsWith('EAA') ? (
                                <CheckCircle className="h-4 w-4 mr-2" />
                              ) : (
                                <AlertCircle className="h-4 w-4 mr-2" />
                              )}
                              <span>
                                {formData.meta_access_token.startsWith('EAA') 
                                  ? '✅ Token Meta Access wybrany (dostęp 60-dniowy)' 
                                  : '⚠️ Token Meta Access powinien zaczynać się od "EAA" dla API Meta'
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Validation Section */}
                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700 flex items-center">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Test połączenia i walidacja tokenu
                        </span>
                        <button
                          type="button"
                          onClick={validateMetaCredentials}
                          disabled={validating || !formData.ad_account_id || (!formData.meta_access_token && !formData.system_user_token)}
                          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {validating ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Testowanie...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Test połączenia
                            </>
                          )}
                        </button>
                      </div>
                      
                      {validationStatus.meta.status !== 'idle' && (
                        <div className={`text-sm p-3 rounded-md border ${
                          validationStatus.meta.status === 'valid' ? 'bg-green-50 text-green-800 border-green-200' :
                          validationStatus.meta.status === 'invalid' ? 'bg-red-50 text-red-800 border-red-200' :
                          'bg-yellow-50 text-yellow-800 border-yellow-200'
                        }`}>
                          <div className="flex items-start">
                            {validationStatus.meta.status === 'valid' ? (
                              <CheckCircle className="h-5 w-5 mr-2 mt-0.5 text-green-600" />
                            ) : validationStatus.meta.status === 'invalid' ? (
                              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 text-red-600" />
                            ) : (
                              <Clock className="h-5 w-5 mr-2 mt-0.5 text-yellow-600" />
                            )}
                            <div>
                              {validationStatus.meta.message}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Google Ads Platform Configuration */}
                {selectedPlatform === 'google' && (
                  <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <Shield className="h-5 w-5 mr-2 text-orange-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-orange-900 mb-1">🔑 Google Ads API Configuration</h4>
                          <p className="text-sm text-orange-800">
                            Configure Google Ads API access for this client. Customer ID and Refresh Token are required.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Google Ads Customer ID */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Google Ads Customer ID *
                      </label>
                      <input
                        type="text"
                        value={formData.google_ads_customer_id}
                        onChange={(e) => setFormData({...formData, google_ads_customer_id: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="123-456-7890"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: XXX-XXX-XXXX (znajdź w Google Ads → Account Settings → Account Info)
                      </p>
                    </div>

                    {/* Google Ads Refresh Token */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Google Ads Refresh Token *
                      </label>
                      <input
                        type="password"
                        value={formData.google_ads_refresh_token}
                        onChange={(e) => setFormData({...formData, google_ads_refresh_token: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="1//..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Zaczyna się od &quot;1//&quot; | Uzyskaj z OAuth 2.0 flow dla Google Ads API
                      </p>
                    </div>

                    {/* Google Ads Enable Toggle */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="google_ads_enabled"
                        checked={formData.google_ads_enabled}
                        onChange={(e) => setFormData({...formData, google_ads_enabled: e.target.checked})}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                      />
                      <label htmlFor="google_ads_enabled" className="ml-2 block text-sm text-gray-900">
                        Włącz raportowanie Google Ads dla tego klienta
                      </label>
                    </div>

                    {/* Validation Section for Google Ads */}
                    <div className="bg-gray-50 p-4 rounded-md">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700 flex items-center">
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Test połączenia Google Ads
                        </span>
                        <button
                          type="button"
                          onClick={validateGoogleAdsCredentials}
                          disabled={validating || !formData.google_ads_customer_id || !formData.google_ads_refresh_token}
                          className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {validating ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Testowanie...
                            </>
                          ) : (
                            <>
                              <Target className="h-4 w-4 mr-2" />
                              Test połączenia
                            </>
                          )}
                        </button>
                      </div>
                      
                      {validationStatus.google.status !== 'idle' && (
                        <div className={`text-sm p-3 rounded-md border ${
                          validationStatus.google.status === 'valid' ? 'bg-green-50 text-green-800 border-green-200' :
                          validationStatus.google.status === 'invalid' ? 'bg-red-50 text-red-800 border-red-200' :
                          'bg-yellow-50 text-yellow-800 border-yellow-200'
                        }`}>
                          <div className="flex items-start">
                            {validationStatus.google.status === 'valid' ? (
                              <CheckCircle className="h-5 w-5 mr-2 mt-0.5 text-green-600" />
                            ) : validationStatus.google.status === 'invalid' ? (
                              <AlertCircle className="h-5 w-5 mr-2 mt-0.5 text-red-600" />
                            ) : (
                              <Clock className="h-5 w-5 mr-2 mt-0.5 text-yellow-600" />
                            )}
                            <div>
                              {validationStatus.google.message}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Bieżący token: ••••••••••••••••</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    client.token_health_status === 'valid' ? 'bg-green-100 text-green-800' :
                    client.token_health_status === 'expiring_soon' ? 'bg-orange-100 text-orange-800' :
                    client.token_health_status === 'expired' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {client.token_health_status || 'unknown'}
                  </span>
                </div>
                {client.token_expires_at && (
                  <div className="text-xs text-gray-500 mt-1">
                    Wygasa: {new Date(client.token_expires_at).toLocaleDateString()}
                  </div>
                )}
                {client.last_token_validation && (
                  <div className="text-xs text-gray-500">
                    Ostatnia walidacja: {new Date(client.last_token_validation).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Submit Error Display */}
          {submitError && (
            <div className="bg-red-100 text-red-800 text-sm p-3 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                {submitError}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reporting Frequency
            </label>
            <select
              value={formData.reporting_frequency}
              onChange={(e) => setFormData({...formData, reporting_frequency: e.target.value as any})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="on_demand">On Demand</option>
            </select>
          </div>
          
          {(formData.reporting_frequency === 'monthly' || formData.reporting_frequency === 'weekly') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Send Day
                {formData.reporting_frequency === 'monthly' ? ' (Day of month)' : ' (Day of week)'}
              </label>
              <select
                value={formData.send_day}
                onChange={(e) => setFormData({...formData, send_day: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {formData.reporting_frequency === 'monthly' ? (
                  // Days 1-31 for monthly
                  Array.from({length: 31}, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))
                ) : (
                  // Days 1-7 for weekly (Monday=1, Sunday=7)
                  [
                    {value: 1, label: 'Monday'},
                    {value: 2, label: 'Tuesday'},
                    {value: 3, label: 'Wednesday'},
                    {value: 4, label: 'Thursday'},
                    {value: 5, label: 'Friday'},
                    {value: 6, label: 'Saturday'},
                    {value: 7, label: 'Sunday'}
                  ].map(day => (
                    <option key={day.value} value={day.value}>{day.label}</option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Upcoming Emails Preview */}
          {upcomingEmails.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-blue-900">Nadchodzące automatyczne email</h4>
              </div>
              <div className="space-y-2">
                {upcomingEmails.map((email, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-white rounded border border-blue-100">
                    <div className="flex items-center gap-3">
                      <Mail className="w-3 h-3 text-blue-500" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{email.type}</div>
                        <div className="text-xs text-gray-600">Okres: {email.period}</div>
                      </div>
                    </div>
                    <div className="text-sm text-blue-600 font-medium">{email.date}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-blue-700 bg-blue-100 rounded px-2 py-1">
                💡 Te email będą automatycznie wysłane zgodnie z ustawionym harmonogramem
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Optional notes about this client"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 pt-4 sm:pt-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 min-h-[44px] font-medium transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading || (showTokenFields && (formData.meta_access_token || formData.system_user_token) && validationStatus.meta.status !== 'valid') || false}
              className="w-full sm:flex-1 px-4 py-3 sm:py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 min-h-[44px] font-medium transition-colors"
            >
              {loading ? 'Aktualizowanie...' : 'Aktualizuj klienta'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
} 