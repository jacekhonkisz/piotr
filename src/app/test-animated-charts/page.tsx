'use client';

import React from 'react';
import AnimatedMetricsCharts from '../../components/AnimatedMetricsCharts';

export default function TestAnimatedChartsPage() {
  // Sample data for testing - matching the current dashboard state
  const sampleData = {
    leads: {
      current: 0, // Current state shows 0
      previous: 308,
      change: 255.2 // This would be the target increase
    },
    reservations: {
      current: 0, // Current state shows 0
      previous: 138,
      change: -100.0 // Complete drop from previous
    },
    reservationValue: {
      current: 0, // Current state shows 0
      previous: 21500,
      change: -58.9 // Significant decrease
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Animated Metrics Charts Test
          </h1>
          <p className="text-slate-600">
            Testing the beautiful animated charts for the three key metrics
          </p>
        </div>

        <AnimatedMetricsCharts
          leads={sampleData.leads}
          reservations={sampleData.reservations}
          reservationValue={sampleData.reservationValue}
          isLoading={false}
        />

        <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-slate-200/50">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Sample Data Used
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-slate-900 mb-2">Pozyskane leady</h3>
              <p className="text-sm text-slate-600">
                Current: {sampleData.leads.current.toLocaleString()}<br/>
                Previous: {sampleData.leads.previous.toLocaleString()}<br/>
                Change: {sampleData.leads.change > 0 ? '+' : ''}{sampleData.leads.change}%
              </p>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 mb-2">Rezerwacje</h3>
              <p className="text-sm text-slate-600">
                Current: {sampleData.reservations.current}<br/>
                Previous: {sampleData.reservations.previous}<br/>
                Change: {sampleData.reservations.change > 0 ? '+' : ''}{sampleData.reservations.change}%
              </p>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 mb-2">Wartość rezerwacji</h3>
              <p className="text-sm text-slate-600">
                Current: {sampleData.reservationValue.current.toLocaleString('pl-PL')} zł<br/>
                Previous: {sampleData.reservationValue.previous.toLocaleString('pl-PL')} zł<br/>
                Change: {sampleData.reservationValue.change > 0 ? '+' : ''}{sampleData.reservationValue.change}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 