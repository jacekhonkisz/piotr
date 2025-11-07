import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  text?: string;
  className?: string;
  progress?: number; // 0-100
  variant?: 'default' | 'minimal' | 'fullscreen' | 'centered' | 'card';
  showProgress?: boolean;
  showSpinner?: boolean;
  icon?: React.ReactNode;
}

export default function LoadingSpinner({ 
  size = 'md', 
  text = 'Ładowanie...', 
  className = '',
  progress,
  variant = 'default',
  showProgress = true,
  showSpinner = true,
  icon
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  // Consolidated spinner rendering - default, fullscreen, centered, and card all use the same spinner
  // Only minimal variant uses different styling (thinner border)
  const renderSpinner = () => {
    const isMinimal = variant === 'minimal';
    const borderClass = isMinimal 
      ? 'border-2 border-navy/30' 
      : 'border-4 border-navy/20';
    
    return (
      <div className={`${sizeClasses[size]} ${borderClass} border-t-navy rounded-full animate-spin`}></div>
    );
  };

  const renderContent = () => (
    <>
      {icon && (
        <div className="mb-4 text-navy">
          {icon}
        </div>
      )}
      
      {showSpinner && (
        <div className="mb-4">
          {renderSpinner()}
        </div>
      )}
      
      {text && (
        <p className={`${textSizes[size]} text-muted font-medium mb-3`}>
          {text}
        </p>
      )}
      
      {showProgress && progress !== undefined && (
        <>
          <div className="w-64 bg-stroke rounded-full h-2 mb-2">
            <div 
              className="bg-gradient-to-r from-navy to-navy/80 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-muted font-medium">{progress}%</p>
        </>
      )}
    </>
  );

  if (variant === 'fullscreen') {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center">
          {renderContent()}
        </div>
      </div>
    );
  }

  if (variant === 'centered') {
    return (
      <div className="flex flex-col items-center justify-center w-full">
        <div className="text-center">
          {renderContent()}
        </div>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-stroke p-8 ${className}`}>
        <div className="text-center">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {renderContent()}
    </div>
  );
}

// Predefined loading components for common use cases
export const DashboardLoading = ({ progress, message }: { progress?: number; message?: string }) => (
  <LoadingSpinner
    variant="fullscreen"
    size="lg"
    text={message || "Ładowanie dashboardu..."}
    progress={progress}
    showProgress={progress !== undefined}
  />
);

export const ReportsLoading = ({ progress }: { progress?: number }) => (
  <LoadingSpinner
    variant="fullscreen"
    size="xl"
    text="Ładowanie raportów..."
    progress={progress}
    showProgress={progress !== undefined}
  />
);

export const CampaignsLoading = () => (
  <LoadingSpinner
    variant="fullscreen"
    size="lg"
    text="Ładowanie kampanii..."
  />
);

export const DataLoading = ({ text = "Ładowanie danych...", progress }: { text?: string; progress?: number }) => (
  <LoadingSpinner
    variant="card"
    size="md"
    text={text}
    progress={progress}
    showProgress={progress !== undefined}
  />
);

export const InlineLoading = ({ text = "Ładowanie...", size = "sm" }: { text?: string; size?: 'sm' | 'md' | 'lg' }) => (
  <LoadingSpinner
    variant="minimal"
    size={size}
    text={text}
    showProgress={false}
  />
);

export const ButtonLoading = ({ text = "Ładowanie..." }: { text?: string }) => (
  <LoadingSpinner
    variant="minimal"
    size="sm"
    text={text}
    showProgress={false}
    className="flex-row space-x-2"
  />
);

export const LoginLoading = ({ text = "Ładowanie..." }: { text?: string }) => (
  <LoadingSpinner
    variant="fullscreen"
    size="lg"
    text={text}
    showProgress={false}
    className="bg-white"
  />
);

export const AdminLoading = ({ text = "Ładowanie klientów..." }: { text?: string }) => (
  <LoadingSpinner
    variant="fullscreen"
    size="lg"
    text={text}
    showProgress={false}
  />
); 