'use client';

import React from 'react';
import { Clock, Database, Wifi } from 'lucide-react';

interface DataSourceIndicatorProps {
  source: 'stored' | 'api';
  lastUpdated: Date;
  isHistorical: boolean;
  dataAge?: string;
  className?: string;
}

const DataSourceIndicator: React.FC<DataSourceIndicatorProps> = ({
  source,
  lastUpdated,
  isHistorical,
  dataAge,
  className = ''
}) => {
  const getIndicatorConfig = () => {
    if (source === 'stored') {
      return {
        icon: <Database className="w-4 h-4" />,
        text: `Cached data • Updated ${dataAge || formatTimeAgo(lastUpdated)}`,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      };
    }
    
    if (isHistorical) {
      return {
        icon: <Clock className="w-4 h-4" />,
        text: 'Live historical data • Fetched from Meta API',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      };
    }
    
    return {
      icon: <Wifi className="w-4 h-4" />,
      text: 'Live data • Just fetched from Meta API',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    };
  };

  const config = getIndicatorConfig();

  return (
    <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}>
      {config.icon}
      <span className={`text-sm font-medium ${config.color}`}>
        {config.text}
      </span>
    </div>
  );
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }
};

export default DataSourceIndicator; 