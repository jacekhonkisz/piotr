import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
  progress?: number; // 0-100
}

export default function LoadingSpinner({ 
  size = 'md', 
  text = 'Loading...', 
  className = '',
  progress
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className={`${sizeClasses[size]} border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4`}></div>
      {text && <p className="text-gray-600 mb-2">{text}</p>}
      {progress !== undefined && (
        <div className="w-64 bg-gray-200 rounded-full h-2 mb-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
      {progress !== undefined && (
        <p className="text-sm text-gray-500">{progress}%</p>
      )}
    </div>
  );
} 