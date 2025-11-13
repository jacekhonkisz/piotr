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
    md: 'w-8 h-8 sm:w-10 sm:h-10',
    lg: 'w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20',
    xl: 'w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl md:text-2xl',
    xl: 'text-xl sm:text-2xl md:text-3xl'
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
        <div className="mb-4 text-navy flex items-center justify-center">
          {icon}
        </div>
      )}
      
      {showSpinner && (
        <div className="flex justify-center mb-6 sm:mb-8">
          {renderSpinner()}
        </div>
      )}
      
      {text && (
        <div className="flex justify-center mb-4 sm:mb-6 px-4">
          <p className={`${textSizes[size]} text-muted font-medium`}>
            {text}
          </p>
        </div>
      )}
      
      {showProgress && progress !== undefined && (
        <>
          <div className="w-48 sm:w-64 md:w-80 bg-stroke rounded-full h-2 sm:h-3 mb-3 sm:mb-4 mx-auto">
            <div 
              className="bg-gradient-to-r from-navy to-navy/80 h-2 sm:h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-center">
            <p className="text-sm sm:text-base text-muted font-medium">{progress}%</p>
          </div>
        </>
      )}
    </>
  );

  if (variant === 'fullscreen') {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="text-center w-full max-w-md mx-auto">
          {renderContent()}
        </div>
      </div>
    );
  }

  if (variant === 'centered') {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[50vh] p-4 sm:p-6">
        <div className="text-center w-full max-w-md mx-auto">
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
  <div className="flex flex-row items-center justify-center space-x-2">
    <div className="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin"></div>
    {text && <span className="text-sm text-muted font-medium">{text}</span>}
  </div>
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