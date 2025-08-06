'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  Code, 
  Smartphone, 
  Mail, 
  ShoppingCart, 
  CheckCircle, 
  Copy,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface ConversionTrackingSetupProps {
  onClose?: () => void;
}

export default function ConversionTrackingSetup({ onClose }: ConversionTrackingSetupProps) {
  const [activeStep, setActiveStep] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const steps = [
    {
      id: 1,
      title: 'Instalacja Meta Pixel',
      description: 'Dodaj kod Meta Pixel do swojej strony internetowej',
      icon: Code,
      content: (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">1. Skopiuj kod Meta Pixel</h4>
            <p className="text-sm text-gray-600 mb-3">
              Przejdź do Meta Events Manager i skopiuj kod Pixel dla swojej strony.
            </p>
            <button
              onClick={() => window.open('https://business.facebook.com/events_manager2/list/pixel', '_blank')}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Otwórz Events Manager
            </button>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">2. Dodaj kod do &lt;head&gt; strony</h4>
            <div className="bg-gray-900 text-green-400 p-3 rounded text-sm font-mono overflow-x-auto">
              <pre>{`<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=YOUR_PIXEL_ID&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->`}</pre>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: 'Konfiguracja Eventów',
      description: 'Dodaj śledzenie konkretnych akcji użytkowników',
      icon: Settings,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Smartphone className="w-5 h-5 text-blue-600 mr-2" />
                <h4 className="font-semibold text-gray-900">Kontakty Telefoniczne</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Śledź kliknięcia w numery telefonów
              </p>
              <div className="bg-gray-900 text-green-400 p-2 rounded text-xs font-mono">
                <pre>{`// Dodaj do elementów z numerem telefonu
fbq('track', 'Lead', {
  content_name: 'Phone Call',
  content_category: 'Contact'
});`}</pre>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Mail className="w-5 h-5 text-green-600 mr-2" />
                <h4 className="font-semibold text-gray-900">Formularze Email</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Śledź wypełnienia formularzy kontaktowych
              </p>
              <div className="bg-gray-900 text-green-400 p-2 rounded text-xs font-mono">
                <pre>{`// Dodaj do formularzy
fbq('track', 'Lead', {
  content_name: 'Email Contact',
  content_category: 'Contact'
});`}</pre>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <ShoppingCart className="w-5 h-5 text-orange-600 mr-2" />
                <h4 className="font-semibold text-gray-900">Kroki Rezerwacji</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Śledź proces rezerwacji krok po kroku
              </p>
              <div className="bg-gray-900 text-green-400 p-2 rounded text-xs font-mono">
                <pre>{`// Etap 1 - Rozpoczęcie rezerwacji
fbq('track', 'CustomEvent', {
  event_name: 'booking_step_1'
});

// Etap 2 - Szczegóły rezerwacji
fbq('track', 'CustomEvent', {
  event_name: 'booking_step_2'
});

// Etap 3 - Potwierdzenie
fbq('track', 'CustomEvent', {
  event_name: 'booking_step_3'
});`}</pre>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <CheckCircle className="w-5 h-5 text-purple-600 mr-2" />
                <h4 className="font-semibold text-gray-900">Zakończone Rezerwacje</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Śledź zakończone rezerwacje z wartością
              </p>
              <div className="bg-gray-900 text-green-400 p-2 rounded text-xs font-mono">
                <pre>{`// Po zakończeniu rezerwacji
fbq('track', 'Purchase', {
  value: 0.00, // Wartość rezerwacji
  currency: 'PLN'
});`}</pre>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: 'Weryfikacja',
      description: 'Sprawdź czy śledzenie działa poprawnie',
      icon: CheckCircle,
      content: (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900">Sprawdź śledzenie</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Użyj Facebook Pixel Helper (rozszerzenie Chrome) aby sprawdzić czy eventy są wysyłane poprawnie.
                </p>
                <button
                  onClick={() => window.open('https://chrome.google.com/webstore/detail/facebook-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc', '_blank')}
                  className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors mt-2"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Pobierz Pixel Helper
                </button>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900">Test śledzenia</h4>
                <p className="text-sm text-green-700 mt-1">
                  Wykonaj testowe akcje na swojej stronie (kliknij telefon, wypełnij formularz) i sprawdź czy eventy pojawiają się w Events Manager.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-900">Czas oczekiwania</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Po skonfigurowaniu śledzenia, dane mogą pojawić się w raportach z opóźnieniem do 24 godzin.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(type);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Settings className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Konfiguracja Śledzenia Konwersji</h2>
                <p className="text-blue-100">Krok po kroku przewodnik konfiguracji Meta Pixel</p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  activeStep >= step.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {activeStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-1 mx-2 ${
                    activeStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {steps[activeStep - 1]?.title || 'Krok'}
            </h3>
            <p className="text-gray-600">
              {steps[activeStep - 1]?.description || ''}
            </p>
          </div>

          {steps[activeStep - 1]?.content}
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setActiveStep(Math.max(1, activeStep - 1))}
              disabled={activeStep === 1}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Poprzedni
            </button>

            <div className="text-sm text-gray-500">
              Krok {activeStep} z {steps.length}
            </div>

            <button
              onClick={() => setActiveStep(Math.min(steps.length, activeStep + 1))}
              disabled={activeStep === steps.length}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {activeStep === steps.length ? 'Zakończ' : 'Następny →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 