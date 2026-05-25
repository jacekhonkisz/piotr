'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Shield,
  Target,
  Facebook,
  ChevronLeft,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../../components/AuthProvider';
import { supabase } from '../../lib/supabase';
import { MetaAPIService } from '../../lib/meta-api-optimized';
import type { Database } from '../../lib/database.types';
import { AdminLoading } from '../../components/LoadingSpinner';
import CredentialsModal from '../../components/CredentialsModal';
import EditClientModal from '../../components/EditClientModal';
import GenerateReportModal from '../../components/GenerateReportModal';
import PlatformTokensModal from '../../components/PlatformTokensModal';
import AdminNavbar from '../../components/AdminNavbar';
import ClientsToolbar, { type IntegrationFilter } from '../../components/admin/ClientsToolbar';
import ClientsTable from '../../components/admin/ClientsTable';
import ClientsPagination from '../../components/admin/ClientsPagination';
import EmptyClientsState from '../../components/admin/EmptyClientsState';



type Client = Database['public']['Tables']['clients']['Row'];

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (client: Partial<Client>) => Promise<void>;
}

function AddClientModal({ isOpen, onClose, onAdd }: AddClientModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    ad_account_id: '',
    meta_access_token: '',
    system_user_token: '',
    google_ads_customer_id: '',
    google_ads_refresh_token: '',
    google_ads_system_user_token: '',
    google_ads_enabled: false,
    reporting_frequency: 'monthly' as 'monthly' | 'weekly' | 'weekly_monthly',
    send_day: 5,
    monthly_send_day: 5,
    weekly_send_day: 1,
    notes: ''
  });
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
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
  const [stepError, setStepError] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<('meta' | 'google')[]>(['meta', 'google']);

  // Shared tokens state
  const [sharedTokens, setSharedTokens] = useState<{
    meta: { hasToken: boolean; tokenPreview: string; fullToken: string; };
    google: { hasRefreshToken: boolean; refreshTokenPreview: string; fullRefreshToken: string; managerCustomerId: string; };
  } | null>(null);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [useCustomMetaToken, setUseCustomMetaToken] = useState(false);
  const [useCustomGoogleToken, setUseCustomGoogleToken] = useState(false);

  const monthDays = Array.from({ length: 31 }, (_, index) => index + 1);
  const weekDays = [
    { value: 1, label: 'Poniedziałek' },
    { value: 2, label: 'Wtorek' },
    { value: 3, label: 'Środa' },
    { value: 4, label: 'Czwartek' },
    { value: 5, label: 'Piątek' },
    { value: 6, label: 'Sobota' },
    { value: 7, label: 'Niedziela' },
  ];

  const setReportingFrequency = (frequency: 'monthly' | 'weekly' | 'weekly_monthly') => {
    setFormData(prev => ({
      ...prev,
      reporting_frequency: frequency,
      send_day: frequency === 'monthly' ? prev.monthly_send_day : prev.weekly_send_day,
    }));
    setStepError('');
  };

  const togglePlatform = (platform: 'meta' | 'google') => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platform)) {
        return prev.filter(item => item !== platform);
      }
      return [...prev, platform];
    });
    setSubmitError('');
  };

  const validateStepOne = () => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.name.trim()) {
      setStepError('Nazwa firmy jest wymagana.');
      return false;
    }

    if (!formData.email.trim()) {
      setStepError('Adres e-mail kontaktowy jest wymagany.');
      return false;
    }

    if (!emailPattern.test(formData.email.trim())) {
      setStepError('Podaj poprawny adres e-mail.');
      return false;
    }

    if (!formData.reporting_frequency) {
      setStepError('Wybierz częstotliwość raportowania.');
      return false;
    }

    setStepError('');
    return true;
  };

  const goToStepTwo = () => {
    if (validateStepOne()) {
      setCurrentStep(2);
    }
  };

  const getSubmitFormData = () => ({
    name: formData.name,
    email: formData.email,
    company: formData.company,
    ad_account_id: formData.ad_account_id,
    meta_access_token: formData.meta_access_token,
    system_user_token: formData.system_user_token,
    google_ads_customer_id: formData.google_ads_customer_id,
    google_ads_refresh_token: formData.google_ads_refresh_token,
    google_ads_system_user_token: formData.google_ads_system_user_token,
    google_ads_enabled: formData.google_ads_enabled,
    reporting_frequency: (formData.reporting_frequency === 'weekly_monthly' ? 'weekly' : formData.reporting_frequency) as Client['reporting_frequency'],
    send_day: formData.reporting_frequency === 'monthly' ? formData.monthly_send_day : formData.weekly_send_day,
    notes: formData.notes,
  });

  const platformCardClass = (selected: boolean) =>
    `flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
      selected
        ? 'border-[#1F5EFF] bg-[#F5F8FF] shadow-sm'
        : 'border-[#E4E7EC] bg-white hover:border-[#BFD2FF] hover:bg-[#F9FBFF]'
    }`;

  const inputClass = 'h-10 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 text-sm text-[#101828] placeholder:text-[#98A2B3] shadow-sm outline-none transition focus:border-[#1F5EFF] focus:ring-2 focus:ring-[#BFD2FF]';

  // Load shared tokens on mount
  useEffect(() => {
    if (!isOpen) return;
    setLoadingTokens(true);
    fetch('/api/admin/shared-tokens')
      .then(res => res.json())
      .then(data => {
        setSharedTokens(data);
        setLoadingTokens(false);
      })
      .catch(() => setLoadingTokens(false));
  }, [isOpen]);

  const getEffectiveMetaToken = () => {
    if (useCustomMetaToken && formData.system_user_token) return formData.system_user_token;
    if (useCustomMetaToken && formData.meta_access_token) return formData.meta_access_token;
    return sharedTokens?.meta?.fullToken || '';
  };

  const getEffectiveGoogleToken = () => {
    if (useCustomGoogleToken && formData.google_ads_refresh_token) return formData.google_ads_refresh_token;
    return sharedTokens?.google?.fullRefreshToken || '';
  };

  const validateMetaCredentials = async () => {
    if (!selectedPlatforms.includes('meta')) return;

    if (!formData.ad_account_id) {
      setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: 'Meta Ad Account ID jest wymagane' } }));
      return;
    }

    const tokenToUse = getEffectiveMetaToken();
    if (!tokenToUse) {
      setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: 'Brak tokenu Meta. Skonfiguruj wspólny token lub podaj niestandardowy.' } }));
      return;
    }

    setValidating(true);
    setValidationStatus(prev => ({ ...prev, meta: { status: 'validating', message: 'Walidacja tokenu Meta...' } }));

    try {
      const metaService = new MetaAPIService(tokenToUse);
      const tokenValidation = await metaService.validateAndConvertToken();
      
      if (!tokenValidation.valid) {
        setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: `Walidacja tokenu nie powiodla sie: ${tokenValidation.error}` } }));
        return;
      }

      const accountValidation = await metaService.validateAdAccount(formData.ad_account_id);
      if (!accountValidation.valid) {
        setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: `Konto reklamowe nie znalezione: ${accountValidation.error}` } }));
        return;
      }

      try {
        const campaigns = await metaService.getCampaigns(formData.ad_account_id.replace('act_', ''));
        setValidationStatus(prev => ({ ...prev, meta: { status: 'valid', message: `✅ Meta Ads: Polaczenie udane! Konto: ${accountValidation.account?.name || formData.ad_account_id}. Znaleziono ${campaigns.length} kampanii.` } }));
      } catch {
        setValidationStatus(prev => ({ ...prev, meta: { status: 'valid', message: `✅ Meta Ads: Polaczenie udane! Konto: ${accountValidation.account?.name || formData.ad_account_id}.` } }));
      }
    } catch (error) {
      setValidationStatus(prev => ({ ...prev, meta: { status: 'invalid', message: `Blad walidacji Meta: ${error instanceof Error ? error.message : 'Nieznany blad'}` } }));
    } finally {
      setValidating(false);
    }
  };

  const validateGoogleAdsCredentials = async () => {
    if (!selectedPlatforms.includes('google')) return;

    if (!formData.google_ads_customer_id) {
      setValidationStatus(prev => ({ ...prev, google: { status: 'invalid', message: 'Google Ads Customer ID jest wymagane' } }));
      return;
    }

    if (!/^\d{3}-\d{3}-\d{4}$/.test(formData.google_ads_customer_id)) {
      setValidationStatus(prev => ({ ...prev, google: { status: 'invalid', message: 'Google Ads Customer ID powinien miec format XXX-XXX-XXXX' } }));
      return;
    }

    const tokenToUse = getEffectiveGoogleToken();
    if (!tokenToUse) {
      setValidationStatus(prev => ({ ...prev, google: { status: 'invalid', message: 'Brak tokenu Google Ads. Skonfiguruj wspolny token lub podaj niestandardowy.' } }));
      return;
    }

    setValidationStatus(prev => ({ ...prev, google: { status: 'valid', message: '✅ Google Ads: Format poprawny! Polaczenie zostanie zweryfikowane podczas pierwszego uzycia.' } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (selectedPlatforms.length === 0) {
      setSubmitError('Wybierz przynajmniej jedna platforme reklamowa');
      return;
    }

    if (selectedPlatforms.includes('meta') && validationStatus.meta.status !== 'valid') {
      setSubmitError('Zweryfikuj najpierw poswiadczenia Meta Ads');
      return;
    }

    if (selectedPlatforms.includes('google') && validationStatus.google.status !== 'valid') {
      setSubmitError('Zweryfikuj najpierw poswiadczenia Google Ads');
      return;
    }

    setLoading(true);
    try {
      const effectiveMetaToken = getEffectiveMetaToken();
      const effectiveGoogleToken = getEffectiveGoogleToken();
      const submitFormData = getSubmitFormData();

      const clientData = {
        ...submitFormData,
        ...(selectedPlatforms.includes('meta') ? {
          ad_account_id: submitFormData.ad_account_id,
          system_user_token: effectiveMetaToken,
          meta_access_token: effectiveMetaToken,
        } : {
          ad_account_id: '', meta_access_token: '', system_user_token: '',
        }),
        ...(selectedPlatforms.includes('google') ? {
          google_ads_customer_id: submitFormData.google_ads_customer_id,
          google_ads_refresh_token: effectiveGoogleToken,
          google_ads_enabled: true,
        } : {
          google_ads_customer_id: '', google_ads_refresh_token: '', google_ads_enabled: false,
        })
      };

      await onAdd(clientData);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Nie udalo sie dodac klienta.');
    } finally {
      setLoading(false);
    }
  };

  const renderValidationMessage = (platform: 'meta' | 'google') => {
    const status = validationStatus[platform];
    if (status.status === 'idle') return null;

    const styles = status.status === 'valid'
      ? 'border-green-200 bg-green-50 text-green-800'
      : status.status === 'invalid'
        ? 'border-red-200 bg-red-50 text-red-800'
        : 'border-amber-200 bg-amber-50 text-amber-800';
    const Icon = status.status === 'valid' ? CheckCircle : status.status === 'invalid' ? AlertCircle : Clock;

    return (
      <div className={`rounded-lg border px-3 py-2 text-xs ${styles}`}>
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{status.message}</span>
        </div>
      </div>
    );
  };

  const renderCompactTokenStatus = (platform: 'meta' | 'google') => {
    if (loadingTokens) {
      return (
        <div className="rounded-lg border border-[#E4E7EC] bg-[#F9FAFB] px-3 py-2 text-xs text-[#667085]">
          Ładowanie tokenów...
        </div>
      );
    }

    const isMeta = platform === 'meta';
    const hasToken = isMeta ? sharedTokens?.meta?.hasToken : sharedTokens?.google?.hasRefreshToken;
    const preview = isMeta ? sharedTokens?.meta?.tokenPreview : sharedTokens?.google?.refreshTokenPreview;
    const isUsingCustom = isMeta ? useCustomMetaToken : useCustomGoogleToken;
    const toggleCustom = () => isMeta ? setUseCustomMetaToken(!useCustomMetaToken) : setUseCustomGoogleToken(!useCustomGoogleToken);

    if (!hasToken) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Brak wspólnego tokenu. Podaj token poniżej.
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-green-100 bg-green-50/70 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              Token aktywny
            </p>
            {preview && <p className="mt-0.5 truncate font-mono text-[11px] text-green-700">{preview}</p>}
          </div>
          <button
            type="button"
            onClick={toggleCustom}
            className="shrink-0 text-xs font-medium text-[#1F5EFF] hover:text-[#1746B8]"
          >
            {isUsingCustom ? 'Użyj wspólnego' : 'Zmień token'}
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/45 px-3 py-4 backdrop-blur-[2px]">
      <div className="flex max-h-[94vh] w-full max-w-[1040px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(16,24,40,0.24)]">
        <div className="flex items-center justify-between px-6 pt-6 sm:px-10">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#101828]">Dodaj nowego klienta</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#667085] transition hover:bg-[#F2F4F7] hover:text-[#101828]"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pt-6 sm:px-10">
          <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${currentStep === 1 ? 'bg-[#0B5CFF] text-white' : 'bg-white text-[#0B5CFF] ring-1 ring-[#BFD2FF]'}`}>
                {currentStep > 1 ? <CheckCircle className="h-5 w-5" /> : '1'}
              </span>
              <span className={`hidden text-sm font-semibold sm:inline ${currentStep === 1 ? 'text-[#0B5CFF]' : 'text-[#344054]'}`}>Dane klienta</span>
            </div>
            <div className="h-px bg-[#D0D5DD]" />
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${currentStep === 2 ? 'bg-[#0B5CFF] text-white' : 'bg-white text-[#667085] ring-1 ring-[#D0D5DD]'}`}>2</span>
              <span className={`hidden text-sm font-semibold sm:inline ${currentStep === 2 ? 'text-[#0B5CFF]' : 'text-[#667085]'}`}>Platformy reklamowe</span>
            </div>
            <div className="h-px bg-[#D0D5DD] sm:hidden" />
            <span className="sr-only">Koniec kroków</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-10">
            {currentStep === 1 && (
              <div className="mx-auto max-w-[760px] space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#344054]">Nazwa firmy *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass}
                    placeholder="Wprowadź nazwę firmy"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[#344054]">Adres e-mail kontaktowy *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputClass}
                    placeholder="Wprowadź adres e-mail"
                  />
                </div>

                <div>
                  <label className="mb-3 block text-sm font-medium text-[#344054]">Częstotliwość raportowania</label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { value: 'monthly', label: 'Miesięcznie' },
                      { value: 'weekly', label: 'Tygodniowo' },
                      { value: 'weekly_monthly', label: 'Tygodniowo + miesięcznie' },
                    ].map(option => {
                      const isSelected = formData.reporting_frequency === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setReportingFrequency(option.value as 'monthly' | 'weekly' | 'weekly_monthly')}
                          className={`flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition ${
                            isSelected
                              ? 'border-[#0B5CFF] bg-[#F5F8FF] text-[#1F3D8A] shadow-sm'
                              : 'border-[#D0D5DD] bg-white text-[#344054] hover:border-[#BFD2FF]'
                          }`}
                        >
                          <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${isSelected ? 'border-[#0B5CFF] bg-[#0B5CFF]' : 'border-[#D0D5DD]'}`}>
                            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                          </span>
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-[#E4E7EC] bg-[#F5F8FF] p-4">
                  <div className="grid gap-4 md:grid-cols-[auto_1fr]">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0B5CFF] shadow-sm">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-[#344054]">
                          {formData.reporting_frequency === 'monthly' && 'Raporty będą generowane co miesiąc.'}
                          {formData.reporting_frequency === 'weekly' && 'Raporty będą generowane co tydzień.'}
                          {formData.reporting_frequency === 'weekly_monthly' && 'Raporty będą generowane co tydzień i co miesiąc.'}
                        </p>
                      </div>

                      {(formData.reporting_frequency === 'weekly' || formData.reporting_frequency === 'weekly_monthly') && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[#475467]">Dzień tygodnia</label>
                          <select
                            value={formData.weekly_send_day}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              setFormData({ ...formData, weekly_send_day: value, send_day: value });
                            }}
                            className={inputClass}
                          >
                            {weekDays.map(day => (
                              <option key={day.value} value={day.value}>{day.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(formData.reporting_frequency === 'monthly' || formData.reporting_frequency === 'weekly_monthly') && (
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-[#475467]">Dzień miesiąca</label>
                          <select
                            value={formData.monthly_send_day}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              setFormData({
                                ...formData,
                                monthly_send_day: value,
                                send_day: formData.reporting_frequency === 'monthly' ? value : formData.send_day,
                              });
                            }}
                            className={inputClass}
                          >
                            {monthDays.map(day => (
                              <option key={day} value={day}>{day}. dzień miesiąca</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {stepError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {stepError}
                  </div>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold text-[#101828]">Platformy reklamowe</h3>
                  <p className="mt-1 text-sm text-[#667085]">Wybierz platformy i uzupełnij wymagane dane.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => togglePlatform('meta')} className={platformCardClass(selectedPlatforms.includes('meta'))}>
                    <span className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${selectedPlatforms.includes('meta') ? 'border-[#0B5CFF] bg-[#0B5CFF] text-white' : 'border-[#D0D5DD] text-transparent'}`}>
                        <CheckCircle className="h-4 w-4" />
                      </span>
                      <Facebook className="h-7 w-7 text-[#0866FF]" />
                      <span className="text-sm font-semibold text-[#344054]">Meta Ads</span>
                    </span>
                  </button>
                  <button type="button" onClick={() => togglePlatform('google')} className={platformCardClass(selectedPlatforms.includes('google'))}>
                    <span className="flex items-center gap-3">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${selectedPlatforms.includes('google') ? 'border-[#0B5CFF] bg-[#0B5CFF] text-white' : 'border-[#D0D5DD] text-transparent'}`}>
                        <CheckCircle className="h-4 w-4" />
                      </span>
                      <Target className="h-7 w-7 text-[#34A853]" />
                      <span className="text-sm font-semibold text-[#344054]">Google Ads</span>
                    </span>
                  </button>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                  {selectedPlatforms.includes('meta') && (
                    <div className="space-y-4 rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Facebook className="h-8 w-8 text-[#0866FF]" />
                        <h4 className="text-base font-semibold text-[#1F3D8A]">Meta Ads</h4>
                      </div>

                      {renderCompactTokenStatus('meta')}

                      {(useCustomMetaToken || !sharedTokens?.meta?.hasToken) && (
                        <div className="grid gap-3 rounded-lg border border-[#DCE6FF] bg-[#F8FAFF] p-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-[#475467]">System User Token</label>
                            <input type="password" value={formData.system_user_token} onChange={(e) => setFormData({ ...formData, system_user_token: e.target.value })} className={inputClass} placeholder="EAA..." />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-[#475467]">lub Meta Access Token (60 dni)</label>
                            <input type="password" value={formData.meta_access_token} onChange={(e) => setFormData({ ...formData, meta_access_token: e.target.value })} className={inputClass} placeholder="EAA..." />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#344054]">ID konta reklamowego Meta *</label>
                        <input type="text" required={selectedPlatforms.includes('meta')} value={formData.ad_account_id} onChange={(e) => setFormData({ ...formData, ad_account_id: e.target.value })} className={inputClass} placeholder="np. act_123456789" />
                        <p className="mt-1 text-xs text-[#667085]">Ads Manager → Settings → Ad Account ID</p>
                      </div>

                      <button type="button" onClick={validateMetaCredentials} disabled={validating || !formData.ad_account_id || !getEffectiveMetaToken()} className="flex h-10 w-full items-center justify-center rounded-lg bg-[#0B5CFF] px-4 text-sm font-semibold text-white transition hover:bg-[#1746B8] disabled:cursor-not-allowed disabled:opacity-50">
                        {validating ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sprawdzanie...</> : <><Shield className="mr-2 h-4 w-4" />Zweryfikuj Meta Ads</>}
                      </button>

                      {renderValidationMessage('meta')}
                    </div>
                  )}

                  {selectedPlatforms.includes('google') && (
                    <div className="space-y-4 rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Target className="h-8 w-8 text-[#34A853]" />
                        <h4 className="text-base font-semibold text-[#1F3D8A]">Google Ads</h4>
                      </div>

                      {renderCompactTokenStatus('google')}

                      {(useCustomGoogleToken || !sharedTokens?.google?.hasRefreshToken) && (
                        <div className="rounded-lg border border-[#DCE6FF] bg-[#F8FAFF] p-3">
                          <label className="mb-1 block text-xs font-medium text-[#475467]">Refresh Token</label>
                          <input type="password" value={formData.google_ads_refresh_token} onChange={(e) => setFormData({ ...formData, google_ads_refresh_token: e.target.value })} className={inputClass} placeholder="1//..." />
                        </div>
                      )}

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-[#344054]">Google Ads Customer ID *</label>
                        <input type="text" required={selectedPlatforms.includes('google')} value={formData.google_ads_customer_id} onChange={(e) => setFormData({ ...formData, google_ads_customer_id: e.target.value })} className={inputClass} placeholder="np. 123-456-7890" />
                        <p className="mt-1 text-xs text-[#667085]">Google Ads → Account Settings</p>
                      </div>

                      <button type="button" onClick={validateGoogleAdsCredentials} disabled={validating || !formData.google_ads_customer_id || !getEffectiveGoogleToken()} className="flex h-10 w-full items-center justify-center rounded-lg bg-[#0B5CFF] px-4 text-sm font-semibold text-white transition hover:bg-[#1746B8] disabled:cursor-not-allowed disabled:opacity-50">
                        {validating ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sprawdzanie...</> : <><Target className="mr-2 h-4 w-4" />Zweryfikuj Google Ads</>}
                      </button>

                      {renderValidationMessage('google')}
                    </div>
                  )}
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {submitError}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#EAECF0] bg-white px-6 py-4 sm:px-10">
            {currentStep === 1 ? (
              <>
                <button type="button" onClick={onClose} className="rounded-lg border border-[#D0D5DD] bg-white px-5 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB]">
                  Anuluj
                </button>
                <button type="button" onClick={goToStepTwo} className="rounded-lg bg-[#0B5CFF] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1746B8]">
                  Dalej
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setCurrentStep(1)} className="flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-5 py-2.5 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB]">
                  <ChevronLeft className="h-4 w-4" />
                  Wstecz
                </button>
                <button
                  type="submit"
                  disabled={loading || selectedPlatforms.length === 0 || (selectedPlatforms.includes('meta') && validationStatus.meta.status !== 'valid') || (selectedPlatforms.includes('google') && validationStatus.google.status !== 'valid')}
                  className="flex items-center gap-2 rounded-lg bg-[#0B5CFF] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1746B8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {loading ? 'Dodawanie...' : 'Dodaj klienta'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isHeaderCondensed, setIsHeaderCondensed] = useState(false);

  const [generatingReport] = useState<string | null>(null);
  const [showGenerateReportModal, setShowGenerateReportModal] = useState(false);
  const [selectedClientForReport, setSelectedClientForReport] = useState<Client | null>(null);

  // Bulk operations state (kept for backwards-compat handlers; UI is hidden in the
  // new compact table view but handlers remain available for future bulk UI)
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  // Mark as intentionally unused for the current presentation
  void selectedClients;
  void isProcessing;
  void setIsProcessing;

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [integrationFilter, setIntegrationFilter] = useState<IntegrationFilter>('');
  const [frequencyFilter] = useState('');
  const [sortBy, setSortBy] = useState('last_report_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [credentialsModal, setCredentialsModal] = useState<{
    isOpen: boolean;
    clientId: string;
    clientName: string;
    clientEmail: string;
  }>({
    isOpen: false,
    clientId: '',
    clientName: '',
    clientEmail: ''
  });
  const [showGoogleAdsTokenModal, setShowGoogleAdsTokenModal] = useState(false);
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();

  // Listen for navbar events
  useEffect(() => {
    const handleAddClick = () => {
      setShowAddModal(true);
    };

    const handleTokensClick = () => {
      setShowGoogleAdsTokenModal(true);
    };

    window.addEventListener('navbar-add-click', handleAddClick);
    window.addEventListener('navbar-tokens-click', handleTokensClick);

    return () => {
      window.removeEventListener('navbar-add-click', handleAddClick);
      window.removeEventListener('navbar-tokens-click', handleTokensClick);
    };
  }, []);

  // Track initial load to prevent duplicate calls
  const initialLoadDone = React.useRef(false);
  const isAuthReady = !authLoading && user && profile;

  // Handle authentication and initial load
  useEffect(() => {
    // Don't do anything while auth is still loading
    if (authLoading) {
      return;
    }

    // Redirect to login if no user
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Redirect if not admin
    if (profile?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }

    // Load clients only once on initial auth completion
    if (isAuthReady && !initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchClients();
    } else if (!isAuthReady && !authLoading) {
      // If we don't have user/profile but auth is not loading, stop loading
      setLoading(false);
    }
  }, [user, profile, authLoading, router, isAuthReady]);

  // Header condensation on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsHeaderCondensed(scrollY >= 120);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Refetch clients when search/filter/sort/page-size changes - DEBOUNCED for search input
  useEffect(() => {
    // Skip if initial load hasn't happened yet
    if (!initialLoadDone.current || !isAuthReady) {
      return;
    }

    // Add debouncing to prevent rapid API calls when typing in search
    const timeoutId = setTimeout(() => {
      fetchClients(1); // Reset to first page when filters change
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter, frequencyFilter, sortBy, sortOrder, pagination.limit, isAuthReady]);

  const fetchClients = async (page = 1) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching clients for user:', user.id);
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder
      });

      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (frequencyFilter) params.append('frequency', frequencyFilter);

      const response = await fetch(`/api/clients?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const result = await response.json();
      setClients(result.clients || []);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };



  const addClient = async (clientData: Partial<Client>) => {
    if (!user) return;

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Use the server-side API endpoint
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(clientData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add client');
      }

      const result = await response.json();
      
      // Show credentials modal to admin
      if (result.credentials) {
        setCredentialsModal({
          isOpen: true,
          clientId: result.id || '',
          clientName: clientData.name || '',
          clientEmail: clientData.email || ''
        });
      }

      await fetchClients();
    } catch (error) {
      console.error('Error adding client:', error);
      throw error;
    }
  };

  const updateClient = async (clientId: string, updates: Partial<Client>) => {
    if (!user) return;

    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      // Use the server-side API endpoint
      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update client');
      }

      const result = await response.json();
      console.log('Client updated successfully:', result);

      await fetchClients();
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  };



  const generateReport = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    setSelectedClientForReport(client);
    setShowGenerateReportModal(true);
  };







  // Bulk operations functions
  const handleSelectAll = () => {
    if (selectedClients.length === clients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(clients.map(client => client.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedClients([]);
  };

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'delete',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się usunąć klientów');
      }

      const result = await response.json();
      console.log('Bulk delete result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Pomyślnie usunięto ${result.results.success.length} klientów`);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      alert('Nie udało się usunąć niektórych klientów. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };



  const handleBulkRegenerateCredentials = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'regenerate_credentials',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate credentials');
      }

      const result = await response.json();
      console.log('Bulk regenerate credentials result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Pomyślnie ponownie wygenerowano poświadczenia dla ${result.results.success.length} klientów`);
    } catch (error) {
      console.error('Error in bulk regenerate credentials:', error);
      alert('Nie udało się ponownie wygenerować niektórych poświadczeń. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkGenerateReports = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'generate_reports',
          clientIds: selectedClients
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się wygenerować raportów');
      }

      const result = await response.json();
      console.log('Bulk generate reports result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Pomyślnie wygenerowano ${result.results.success.length} raportów`);
    } catch (error) {
      console.error('Error in bulk generate reports:', error);
      alert('Nie udało się wygenerować niektórych raportów. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkChangeFrequency = async (frequency: string) => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      const response = await fetch('/api/clients/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'change_frequency',
          clientIds: selectedClients,
          frequency
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change frequency');
      }

      const result = await response.json();
      console.log('Bulk change frequency result:', result);
      
      setSelectedClients([]);
      await fetchClients();
      alert(`Pomyślnie zmieniono częstotliwość dla ${result.results.success.length} klientów`);
    } catch (error) {
      console.error('Error in bulk change frequency:', error);
      alert('Nie udało się zmienić częstotliwości dla niektórych klientów. Spróbuj ponownie.');
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteClient = async (clientId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego klienta? Usunięcie tego klienta spowoduje również usunięcie konta użytkownika z Supabase.')) return;

    try {
      console.log('Starting client deletion for ID:', clientId);
      
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No valid session found');
      }

      console.log('Session token obtained, making delete request...');

      // Use the server-side API endpoint for deletion with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('Delete response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Nie udało się usunąć klienta');
      }

      const result = await response.json();
      console.log('Delete result:', result.message);
      
      await fetchClients();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      if (error.name === 'AbortError') {
        alert('Żądanie usunięcia wygasło. Spróbuj ponownie.');
      } else {
        alert('Nie udało się usunąć klienta. Spróbuj ponownie.');
      }
    }
  };

  if (loading) {
    return <AdminLoading />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7F9FC] to-[#EEF2F7]">
      {/* Admin Navbar */}
      <AdminNavbar isCondensed={isHeaderCondensed} />

      <main className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-2">
        {/* Compact Toolbar: search + filters + sort + add */}
        <ClientsToolbar
          search={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          integrationFilter={integrationFilter}
          onIntegrationFilterChange={setIntegrationFilter}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(field, order) => {
            setSortBy(field);
            setSortOrder(order);
          }}
          onAddClient={() => setShowAddModal(true)}
        />

        {/* Client-side integration filter applied over the server-side page */}
        {(() => {
          const hasFilters =
            !!searchTerm || !!statusFilter || !!integrationFilter || !!frequencyFilter;

          const filteredClients = clients.filter((c) => {
            if (!integrationFilter) return true;
            const hasMeta = !!c.ad_account_id;
            const hasGoogle = !!c.google_ads_customer_id;
            switch (integrationFilter) {
              case 'meta':
                return hasMeta && !hasGoogle;
              case 'google':
                return hasGoogle && !hasMeta;
              case 'both':
                return hasMeta && hasGoogle;
              case 'none':
                return !hasMeta && !hasGoogle;
              default:
                return true;
            }
          });

          if (filteredClients.length === 0) {
            return (
              <EmptyClientsState
                hasFilters={hasFilters}
                onResetFilters={() => {
                  setSearchTerm('');
                  setStatusFilter('');
                  setIntegrationFilter('');
                  setSortBy('last_report_date');
                  setSortOrder('desc');
                }}
                onAddClient={() => setShowAddModal(true)}
              />
            );
          }

          // Range labels for pagination footer (account for any client-side filtering)
          const startOnServerPage =
            (pagination.page - 1) * pagination.limit + 1;
          const rangeStart =
            filteredClients.length === clients.length
              ? startOnServerPage
              : startOnServerPage; // best-effort; client-side filter may reduce visible count
          const rangeEnd = Math.min(
            startOnServerPage + filteredClients.length - 1,
            pagination.total,
          );

          return (
            <div className="bg-transparent">
              <ClientsTable
                clients={filteredClients}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={(field, order) => {
                  setSortBy(field);
                  setSortOrder(order);
                }}
                onOpenReports={(c) => router.push(`/reports?clientId=${c.id}`)}
                onOpenDashboard={(c) => router.push(`/admin/clients/${c.id}`)}
                onGenerateReport={(c) => generateReport(c.id)}
                onEdit={(c) => {
                  setEditingClient(c);
                  setShowEditModal(true);
                }}
                onCredentials={(c) =>
                  setCredentialsModal({
                    isOpen: true,
                    clientId: c.id,
                    clientName: c.name,
                    clientEmail: c.email,
                  })
                }
                onMetricsConfig={(c) => router.push(`/admin/metrics-config?clientId=${c.id}`)}
                onDelete={(c) => deleteClient(c.id)}
              />
              <ClientsPagination
                page={pagination.page}
                totalPages={Math.max(pagination.totalPages, 1)}
                total={pagination.total}
                limit={pagination.limit}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onPageChange={(p) => fetchClients(p)}
                onLimitChange={(newLimit) =>
                  setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }))
                }
              />
            </div>
          );

        })()}
      </main>

      <AddClientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addClient}
      />

      <EditClientModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingClient(null);
        }}
        onUpdate={updateClient}
        client={editingClient}
      />

      <CredentialsModal
        isOpen={credentialsModal.isOpen}
        onClose={() => setCredentialsModal({ ...credentialsModal, isOpen: false })}
        clientId={credentialsModal.clientId}
        clientName={credentialsModal.clientName}
        clientEmail={credentialsModal.clientEmail}
        onCredentialsUpdated={fetchClients}
      />

      {selectedClientForReport && (
        <GenerateReportModal
          key={`report-modal-${selectedClientForReport.id}`}
          isOpen={showGenerateReportModal}
          onClose={() => {
            setShowGenerateReportModal(false);
            setSelectedClientForReport(null);
          }}
          clientId={selectedClientForReport.id}
          clientName={selectedClientForReport.name}
          clientEmail={selectedClientForReport.email}
        />
      )}

      {/* Platform Tokens Modal (Google & Meta) */}
      <PlatformTokensModal
        isOpen={showGoogleAdsTokenModal}
        onClose={() => setShowGoogleAdsTokenModal(false)}
        onSuccess={(tokenData) => {
          setShowGoogleAdsTokenModal(false);
          // Optionally refresh client data or show success message
          if (tokenData) {
            console.log(`${tokenData.platform} token saved successfully`);
          }
        }}
      />
    </div>
  );
} 