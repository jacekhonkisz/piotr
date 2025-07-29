'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface ChartTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export default function ChartTabs({
  tabs,
  activeTab,
  onTabChange,
  className = ""
}: ChartTabsProps) {
  return (
    <div className={`flex space-x-1 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === tab.id
              ? 'text-blue-600 bg-blue-50'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center space-x-2">
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
          </div>
          
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
              initial={false}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      ))}
    </div>
  );
} 