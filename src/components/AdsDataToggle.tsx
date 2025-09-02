'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Target } from 'lucide-react';
import MetaAdsTables from './MetaAdsTables';
import GoogleAdsTables from './GoogleAdsTables';

interface AdsDataToggleProps {
  dateStart: string;
  dateEnd: string;
  clientId?: string;
  activeProvider?: 'meta' | 'google';
  onProviderChange?: (provider: 'meta' | 'google') => void;
  onMetaDataLoaded?: (data: any) => void;
  onGoogleDataLoaded?: (data: any) => void;
  hasMetaAds?: boolean;
  hasGoogleAds?: boolean;
}

const AdsDataToggle: React.FC<AdsDataToggleProps> = ({
  dateStart,
  dateEnd,
  clientId,
  activeProvider: externalActiveProvider,
  onProviderChange,
  onMetaDataLoaded,
  onGoogleDataLoaded,
  hasMetaAds = true,
  hasGoogleAds = true,
}) => {
  const [internalActiveProvider, setInternalActiveProvider] = useState<'meta' | 'google'>('meta');
  
  // Use external activeProvider if provided, otherwise use internal state
  const activeProvider = externalActiveProvider !== undefined ? externalActiveProvider : internalActiveProvider;
  
  const handleProviderChange = (provider: 'meta' | 'google') => {
    if (externalActiveProvider === undefined) {
      setInternalActiveProvider(provider);
    }
    onProviderChange?.(provider);
  };

  return (
    <div className="bg-white rounded-lg p-6 mb-8">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            activeProvider === 'meta' ? 'bg-blue-100' : 'bg-green-100'
          }`}>
                         {activeProvider === 'meta' ? (
               <BarChart3 className="w-5 h-5 text-blue-600" />
             ) : (
               <Target className="w-5 h-5 text-green-600" />
             )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {activeProvider === 'meta' ? 'Meta Ads Analytics' : 'Google Ads Analytics'}
            </h2>
            <p className="text-sm text-gray-600">
              {activeProvider === 'meta' 
                ? 'Szczegółowe analizy z Meta Ads API' 
                : 'Szczegółowe analizy z Google Ads API'
              }
            </p>
          </div>
        </div>
        
        {/* Toggle Switch - Only show if both platforms are available */}
        {hasMetaAds && hasGoogleAds ? (
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="flex bg-gray-100 rounded-lg p-1">
                {/* Meta Ads Tab */}
                <button
                  onClick={() => handleProviderChange('meta')}
                  className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeProvider === 'meta'
                      ? 'text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {activeProvider === 'meta' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-blue-600 rounded-md"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4" />
                    <span>Meta Ads</span>
                  </span>
                </button>

                {/* Google Ads Tab */}
                <button
                  onClick={() => handleProviderChange('google')}
                  className={`relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeProvider === 'google'
                      ? 'text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {activeProvider === 'google' && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-green-600 rounded-md"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span className="relative flex items-center space-x-2">
                    <Target className="w-4 h-4" />
                    <span>Google Ads</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Single platform indicator
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-lg">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Platforma:</span>
            <div className="flex items-center space-x-1">
              {hasMetaAds && (
                <>
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">Meta Ads</span>
                </>
              )}
              {hasGoogleAds && (
                <>
                  <Target className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Google Ads</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <motion.div
        key={activeProvider}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        {activeProvider === 'meta' ? (
          <MetaAdsTables
            dateStart={dateStart}
            dateEnd={dateEnd}
            clientId={clientId}
            onDataLoaded={onMetaDataLoaded}
          />
        ) : clientId ? (
          <GoogleAdsTables
            dateStart={dateStart}
            dateEnd={dateEnd}
            clientId={clientId}
            onDataLoaded={onGoogleDataLoaded}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No client ID provided for Google Ads data
          </div>
        )}
      </motion.div>

      {/* Provider Info */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Wyświetlane dane: {activeProvider === 'meta' ? 'Meta Ads (Facebook & Instagram)' : 'Google Ads'}
          </span>
          <span>
            Okres: {dateStart} - {dateEnd}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AdsDataToggle; 