'use client';

import React, { useState } from 'react';
import DemographicPieCharts from '../../components/DemographicPieCharts';

const sampleDemographicData = [
  { age: '18-24', gender: 'Kobiety', spend: 1000, impressions: 24000, clicks: 1200, ctr: 5.0, cpc: 0.83 },
  { age: '25-34', gender: 'Kobiety', spend: 2000, impressions: 45000, clicks: 2250, ctr: 5.0, cpc: 0.89 },
  { age: '35-44', gender: 'Kobiety', spend: 1500, impressions: 38000, clicks: 1900, ctr: 5.0, cpc: 0.79 },
  { age: '18-24', gender: 'Mężczyźni', spend: 800, impressions: 18000, clicks: 900, ctr: 5.0, cpc: 0.89 },
  { age: '25-34', gender: 'Mężczyźni', spend: 1800, impressions: 40000, clicks: 2000, ctr: 5.0, cpc: 0.90 },
  { age: '35-44', gender: 'Mężczyźni', spend: 1200, impressions: 30000, clicks: 1500, ctr: 5.0, cpc: 0.80 },
  { age: '18-24', gender: 'Nieznana', spend: 200, impressions: 4000, clicks: 200, ctr: 5.0, cpc: 1.00 },
  { age: '25-34', gender: 'Nieznana', spend: 300, impressions: 6000, clicks: 300, ctr: 5.0, cpc: 1.00 },
  { age: '35-44', gender: 'Nieznana', spend: 250, impressions: 5000, clicks: 250, ctr: 5.0, cpc: 1.00 }
];

export default function TestSimplePage() {
  const [metric, setMetric] = useState<'impressions' | 'clicks'>('impressions');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Simple Test Page</h1>
          
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Demographic Charts</h2>
            <div className="flex items-center space-x-4 mb-6">
              <label className="text-sm font-medium text-gray-700">Metric:</label>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setMetric('impressions')} 
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    metric === 'impressions' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Wyświetlenia
                </button>
                <button 
                  onClick={() => setMetric('clicks')} 
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    metric === 'clicks' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Kliknięcia
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-500 text-white p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Tailwind Test</h2>
              <p>This should be blue with white text if Tailwind is working.</p>
            </div>
            <div className="bg-green-500 text-white p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Another Test</h2>
              <p>This should be green with white text.</p>
            </div>
          </div>
          
          <div className="mt-8 p-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Gradient Test</h2>
            <p>This should have a purple to pink gradient background.</p>
          </div>
          
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Chart.js Test</h2>
            <div className="bg-gray-100 p-4 rounded-lg">
              <p className="text-gray-600 mb-4">
                If you can see this page with proper styling, Tailwind is working.<br/>
                The demographic charts should be available below.
              </p>
              
              <div className="bg-white rounded-lg p-6">
                <DemographicPieCharts data={sampleDemographicData} metric={metric} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 