'use client';

import React, { useState } from 'react';
import DemographicPieCharts from '../../components/DemographicPieCharts';

// Sample demographic data for testing
const sampleDemographicData = [
  { age: '18-24', gender: 'Kobiety', spend: 1000, impressions: 13200, clicks: 97, ctr: 0.73, cpc: 10.31 },
  { age: '25-34', gender: 'Kobiety', spend: 2500, impressions: 52900, clicks: 979, ctr: 1.85, cpc: 2.55 },
  { age: '35-44', gender: 'Kobiety', spend: 3000, impressions: 62000, clicks: 1400, ctr: 2.26, cpc: 2.14 },
  { age: '18-24', gender: 'Mężczyźni', spend: 800, impressions: 8900, clicks: 67, ctr: 0.75, cpc: 11.94 },
  { age: '25-34', gender: 'Mężczyźni', spend: 2000, impressions: 42000, clicks: 750, ctr: 1.79, cpc: 2.67 },
  { age: '35-44', gender: 'Mężczyźni', spend: 2500, impressions: 51000, clicks: 1200, ctr: 2.35, cpc: 2.08 },
  { age: '18-24', gender: 'Nieznana', spend: 100, impressions: 2100, clicks: 25, ctr: 1.19, cpc: 4.00 },
  { age: '25-34', gender: 'Nieznana', spend: 200, impressions: 4100, clicks: 45, ctr: 1.10, cpc: 4.44 },
  { age: '35-44', gender: 'Nieznana', spend: 300, impressions: 5200, clicks: 60, ctr: 1.15, cpc: 5.00 },
];

export default function TestChartsPage() {
  const [metric, setMetric] = useState<'impressions' | 'clicks'>('impressions');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Test Demographic Charts</h1>
          <p className="text-gray-600 mb-6">Testing the demographic pie charts functionality</p>
          
          {/* Metric Toggle */}
          <div className="flex items-center space-x-4 mb-6">
            <label className="text-sm font-medium text-gray-700">Metric:</label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setMetric('impressions')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  metric === 'impressions'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Wyświetlenia
              </button>
              <button
                onClick={() => setMetric('clicks')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  metric === 'clicks'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Kliknięcia
              </button>
            </div>
          </div>

          {/* Sample Data Display */}
          <div className="bg-white rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Sample Data</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Gender Distribution:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>Kobiety: {sampleDemographicData.filter(d => d.gender === 'Kobiety').reduce((sum, d) => sum + d[metric], 0).toLocaleString()}</li>
                  <li>Mężczyźni: {sampleDemographicData.filter(d => d.gender === 'Mężczyźni').reduce((sum, d) => sum + d[metric], 0).toLocaleString()}</li>
                  <li>Nieznana: {sampleDemographicData.filter(d => d.gender === 'Nieznana').reduce((sum, d) => sum + d[metric], 0).toLocaleString()}</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">Age Distribution:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>18-24: {sampleDemographicData.filter(d => d.age === '18-24').reduce((sum, d) => sum + d[metric], 0).toLocaleString()}</li>
                  <li>25-34: {sampleDemographicData.filter(d => d.age === '25-34').reduce((sum, d) => sum + d[metric], 0).toLocaleString()}</li>
                  <li>35-44: {sampleDemographicData.filter(d => d.age === '35-44').reduce((sum, d) => sum + d[metric], 0).toLocaleString()}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="bg-white rounded-lg p-6">
          <DemographicPieCharts data={sampleDemographicData} metric={metric} />
        </div>
      </div>
    </div>
  );
} 