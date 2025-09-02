import React from 'react';
import LoadingSpinner, { 
  DashboardLoading, 
  ReportsLoading, 
  CampaignsLoading, 
  DataLoading, 
  InlineLoading, 
  ButtonLoading,
  LoginLoading
} from './LoadingSpinner';
import { BarChart3, Download, RefreshCw } from 'lucide-react';

/**
 * LoadingExamples - Demonstrates all available loading components
 * This file shows how to use the standardized loading components throughout the app
 */

export const LoadingExamplesPage = () => {
  return (
    <div className="min-h-screen bg-page p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-text mb-8">Loading Components Examples</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Fullscreen Loading Examples */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-text">Fullscreen Loading</h2>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Dashboard Loading</h3>
              <DashboardLoading progress={45} />
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Reports Loading</h3>
              <ReportsLoading progress={78} />
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Campaigns Loading</h3>
              <CampaignsLoading />
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Login Loading</h3>
              <LoginLoading text="Inicjalizacja..." />
            </div>
          </div>
          
          {/* Card and Inline Loading Examples */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-text">Card & Inline Loading</h2>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Data Loading Card</h3>
              <DataLoading text="Ładowanie danych klienta..." progress={32} />
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Inline Loading</h3>
              <div className="flex items-center space-x-4">
                <span>Status:</span>
                <InlineLoading text="Aktualizowanie..." size="sm" />
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Button Loading States</h3>
              <div className="space-y-3">
                <button className="btn-primary" disabled>
                  <ButtonLoading text="Zapisywanie..." />
                </button>
                <button className="btn-secondary" disabled>
                  <ButtonLoading text="Pobieranie..." />
                </button>
              </div>
            </div>
          </div>
          
          {/* Custom Loading Examples */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-text">Custom Loading</h2>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">With Custom Icon</h3>
              <LoadingSpinner
                variant="card"
                size="lg"
                text="Generowanie raportu..."
                progress={67}
                icon={<BarChart3 className="w-8 h-8" />}
              />
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Minimal Variant</h3>
              <LoadingSpinner
                variant="minimal"
                size="md"
                text="Ładowanie..."
                showProgress={false}
              />
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">No Spinner, Just Progress</h3>
              <LoadingSpinner
                variant="default"
                size="lg"
                text="Przetwarzanie danych..."
                progress={89}
                showSpinner={false}
              />
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Centered Variant</h3>
              <LoadingSpinner
                variant="centered"
                size="lg"
                text="Ładowanie w kontenerze..."
              />
            </div>
          </div>
          
          {/* Usage Examples */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-text">Usage Examples</h2>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Page Loading</h3>
              <pre className="text-sm text-muted bg-gray-50 p-3 rounded">
{`// For full page loading
if (loading) {
  return <DashboardLoading progress={progress} />;
}`}
              </pre>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Component Loading</h3>
              <pre className="text-sm text-muted bg-gray-50 p-3 rounded">
{`// For component loading
if (dataLoading) {
  return <DataLoading text="Ładowanie..." progress={progress} />;
}`}
              </pre>
            </div>
            
            <div className="bg-white rounded-xl p-6 border border-stroke">
              <h3 className="font-medium text-text mb-4">Button Loading</h3>
              <pre className="text-sm text-muted bg-gray-50 p-3 rounded">
{`// For button loading states
<button disabled={isLoading}>
  {isLoading ? (
    <ButtonLoading text="Zapisywanie..." />
  ) : (
    'Zapisz'
  )}
</button>`}
              </pre>
            </div>
          </div>
        </div>
        
        {/* Implementation Guide */}
        <div className="mt-12 bg-white rounded-xl p-8 border border-stroke">
          <h2 className="text-2xl font-bold text-text mb-6">Implementation Guide</h2>
          
          <div className="prose prose-gray max-w-none">
            <h3>Available Components</h3>
            <ul>
              <li><strong>DashboardLoading</strong> - Fullscreen loading for dashboard pages</li>
              <li><strong>ReportsLoading</strong> - Fullscreen loading for reports pages</li>
              <li><strong>CampaignsLoading</strong> - Fullscreen loading for campaigns pages</li>
              <li><strong>DataLoading</strong> - Card-based loading for data components</li>
              <li><strong>InlineLoading</strong> - Small inline loading indicators</li>
              <li><strong>ButtonLoading</strong> - Loading states for buttons</li>
              <li><strong>LoadingSpinner</strong> - Base component with full customization</li>
            </ul>
            
            <h3>Key Features</h3>
            <ul>
              <li><strong>Consistent Styling</strong> - All components use the same design system</li>
              <li><strong>Progress Indicators</strong> - Optional progress bars with percentage</li>
              <li><strong>Multiple Variants</strong> - fullscreen, card, minimal, and default</li>
              <li><strong>Customizable</strong> - Size, text, progress, and icon options</li>
              <li><strong>Polish Language</strong> - Default text in Polish for the app</li>
            </ul>
            
            <h3>Color Scheme</h3>
            <p>All loading components use the standardized color palette:</p>
            <ul>
              <li><strong>Primary:</strong> navy (#1F3380)</li>
              <li><strong>Background:</strong> page (#F8FAFC)</li>
              <li><strong>Text:</strong> text (#0F172A) and muted (#64748B)</li>
              <li><strong>Borders:</strong> stroke (#E9EDF3)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingExamplesPage;
