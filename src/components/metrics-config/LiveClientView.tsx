'use client';

import React from 'react';
import ConfiguredDashboardMetrics from '../dashboard/ConfiguredDashboardMetrics';
import GoogleAdsTables from '../GoogleAdsTables';
import MetaAdsTables from '../MetaAdsTables';
import WeeklyReportView from '../WeeklyReportView';
import { MetricsConfigOverrideProvider } from '../../lib/useMetricsConfig';
import type { MetricConfigItem } from '../../lib/default-metrics-config';

export type LiveClientViewMode = 'dashboard' | 'report' | 'tables';
export type LiveClientViewPlatform = 'meta' | 'google';

interface LiveClientViewProps {
  mode: LiveClientViewMode;
  metrics: MetricConfigItem[];
  client: {
    id: string;
    name: string;
    email: string;
  };
  platform: LiveClientViewPlatform;
  metaEnabled?: boolean;
  googleEnabled?: boolean;
  size?: 'side' | 'full';
}

const SAMPLE_DATE_START = '2026-05-01';
const SAMPLE_DATE_END = '2026-05-31';

const sampleCampaigns = [
  {
    id: 'sample-1',
    campaign_id: 'sample-1',
    campaign_name: 'Brand Search - Hotel',
    spend: 9420,
    impressions: 286540,
    clicks: 5903,
    conversions: 18,
    click_to_call: 52,
    email_contacts: 31,
    booking_step_1: 840,
    booking_step_2: 580,
    booking_step_3: 310,
    reservations: 142,
    reservation_value: 78200,
    conversion_value: 78200,
    total_conversion_value: 82100,
    roas: 8.3,
    cost_per_reservation: 66.34,
    frequency: 1.4,
    reach: 204671,
  },
  {
    id: 'sample-2',
    campaign_id: 'sample-2',
    campaign_name: 'Remarketing - Visitors',
    spend: 5180,
    impressions: 412300,
    clicks: 2840,
    conversions: 14,
    click_to_call: 38,
    email_contacts: 24,
    booking_step_1: 620,
    booking_step_2: 410,
    booking_step_3: 180,
    reservations: 86,
    reservation_value: 47400,
    conversion_value: 47400,
    total_conversion_value: 51200,
    roas: 9.15,
    cost_per_reservation: 60.23,
    frequency: 2.1,
    reach: 196333,
  },
  {
    id: 'sample-3',
    campaign_id: 'sample-3',
    campaign_name: 'Lookalike - Bookers',
    spend: 4250,
    impressions: 384200,
    clicks: 1980,
    conversions: 9,
    click_to_call: 29,
    email_contacts: 21,
    booking_step_1: 520,
    booking_step_2: 350,
    booking_step_3: 152,
    reservations: 58,
    reservation_value: 32100,
    conversion_value: 32100,
    total_conversion_value: 34800,
    roas: 7.55,
    cost_per_reservation: 73.28,
    frequency: 1.3,
    reach: 295538,
  },
];

const sampleStats = {
  totalSpend: 18850,
  totalImpressions: 1083040,
  totalClicks: 10723,
  totalConversions: 41,
  averageCtr: 0.99,
  averageCpc: 1.76,
};

const sampleConversionMetrics = {
  click_to_call: 119,
  email_contacts: 76,
  booking_step_1: 1980,
  booking_step_2: 1340,
  booking_step_3: 642,
  reservations: 286,
  reservation_value: 157700,
  conversion_value: 157700,
  total_conversion_value: 168100,
  roas: 8.36,
  cost_per_reservation: 65.91,
  reach: 696542,
  offline_reservations: 39,
  offline_value: 21400,
};

const currentSnapshot = {
  totalSpend: sampleStats.totalSpend,
  totalImpressions: sampleStats.totalImpressions,
  totalClicks: sampleStats.totalClicks,
  totalConversions: sampleStats.totalConversions,
  averageCtr: sampleStats.averageCtr,
  averageCpc: sampleStats.averageCpc,
  ...sampleConversionMetrics,
  total_value_with_offline: sampleConversionMetrics.total_conversion_value + sampleConversionMetrics.offline_value,
  cost_percentage: 11.2,
};

const previousSnapshot = {
  totalSpend: 16120,
  totalImpressions: 965400,
  totalClicks: 9400,
  totalConversions: 34,
  averageCtr: 0.94,
  averageCpc: 1.71,
  booking_step_1: 1710,
  booking_step_2: 1080,
  booking_step_3: 530,
  reservations: 238,
  reservation_value: 131400,
  conversion_value: 131400,
  total_conversion_value: 140300,
  roas: 8.7,
};

// Sample previous-year snapshot — drives the YoY layout (Porównanie rok do roku
// + Najważniejsze zmiany) so the admin preview matches the actual client dashboard.
const previousYearSnapshot = {
  totalSpend: 14580,
  totalImpressions: 870200,
  totalClicks: 8350,
  totalConversions: 28,
  averageCtr: 0.96,
  averageCpc: 1.75,
  booking_step_1: 1520,
  booking_step_2: 960,
  booking_step_3: 470,
  reservations: 196,
  reservation_value: 108400,
  conversion_value: 108400,
  total_conversion_value: 116900,
  roas: 8.02,
  cost_per_reservation: 74.39,
};

const sampleReport = {
  id: 'sample-report',
  date_range_start: SAMPLE_DATE_START,
  date_range_end: SAMPLE_DATE_END,
  generated_at: new Date().toISOString(),
  campaigns: sampleCampaigns,
  conversionMetrics: sampleConversionMetrics,
};

const sampleMetaTables = {
  placementPerformance: [
    { placement: 'Facebook Feed', spend: 8200, impressions: 420000, clicks: 5100, ctr: 1.21, cpc: 1.61, reservations: 119, reservation_value: 68100 },
    { placement: 'Instagram Stories', spend: 5400, impressions: 382000, clicks: 3200, ctr: 0.84, cpc: 1.69, reservations: 86, reservation_value: 49200 },
    { placement: 'Instagram Reels', spend: 3250, impressions: 281040, clicks: 2423, ctr: 0.86, cpc: 1.34, reservations: 81, reservation_value: 40400 },
  ],
  demographicPerformance: [
    { age: '25-34', gender: 'Kobiety', spend: 6200, impressions: 260000, clicks: 3100, ctr: 1.19, cpc: 2, reservations: 94, reservation_value: 53800, roas: 8.68, cost_per_reservation: 65.96, conversion_rate: 3.03, booking_step_1: 620, booking_step_2: 410, booking_step_3: 180, click_to_call: 34, email_contacts: 22 },
    { age: '35-44', gender: 'Mężczyźni', spend: 4800, impressions: 221000, clicks: 2400, ctr: 1.09, cpc: 2, reservations: 72, reservation_value: 41100, roas: 8.56, cost_per_reservation: 66.67, conversion_rate: 3, booking_step_1: 520, booking_step_2: 330, booking_step_3: 150, click_to_call: 28, email_contacts: 19 },
  ],
  adRelevanceResults: [],
  geographicPerformance: [],
};

const sampleGoogleTables = {
  devicePerformance: [
    { device: 'Mobile', spend: 10200, impressions: 620000, clicks: 7200, ctr: 1.16, cpc: 1.42, conversions: 28, conversionValue: 109500, roas: 10.74 },
    { device: 'Desktop', spend: 5200, impressions: 284000, clicks: 2300, ctr: 0.81, cpc: 2.26, conversions: 10, conversionValue: 42100, roas: 8.1 },
  ],
  keywordPerformance: [
    { keyword: 'hotel spa weekend', spend: 4200, impressions: 86000, clicks: 1320, ctr: 1.53, cpc: 3.18, conversions: 8, conversionValue: 38400, roas: 9.14 },
    { keyword: 'apartamenty nad morzem', spend: 3100, impressions: 94000, clicks: 1180, ctr: 1.26, cpc: 2.63, conversions: 6, conversionValue: 28200, roas: 9.1 },
  ],
  searchTermPerformance: [
    { search_term: 'hotel spa z basenem', match_type: 'Phrase', campaign_name: 'Search - Brand', ad_group_name: 'SPA', spend: 1800, impressions: 32000, clicks: 520, ctr: 1.62, cpc: 3.46, conversions: 4, conversion_value: 18400, roas: 10.22 },
  ],
  demographicPerformance: [
    { gender: 'Kobiety', spend: 6400, impressions: 290000, clicks: 3300, ctr: 1.14, cpc: 1.94, conversions: 14, conversionValue: 61500, roas: 9.61 },
    { ageRange: '35-44', spend: 5100, impressions: 230000, clicks: 2500, ctr: 1.09, cpc: 2.04, conversions: 11, conversionValue: 47200, roas: 9.25 },
  ],
  geographicPerformance: [
    { region: 'Mazowieckie', city: 'Warszawa', spend: 4900, clicks: 2300, conversions: 12, conversion_value: 56200 },
    { region: 'Pomorskie', city: 'Gdańsk', spend: 3600, clicks: 1720, conversions: 8, conversion_value: 38400 },
  ],
};

function DashboardLiveView({ client, platform }: Pick<LiveClientViewProps, 'client' | 'platform'>) {
  return (
    <div className="min-h-full w-full min-w-0 bg-[#f5f8fc] p-4 sm:p-6">
      <ConfiguredDashboardMetrics
        clientId={client.id}
        platform={platform}
        currentSnapshot={currentSnapshot}
        previousMonthSnapshot={previousSnapshot}
        previousYearSnapshot={previousYearSnapshot}
        periodLabel="Bieżący miesiąc (przykładowe dane)"
        previousYearLabel="Ten sam okres rok wcześniej"
        previousMonthLabel="Poprzedni miesiąc"
        renderKey="live-preview"
      />
    </div>
  );
}

function ReportLiveView({ client, platform }: Pick<LiveClientViewProps, 'client' | 'platform'>) {
  return (
    <WeeklyReportView
      reports={{ sample: sampleReport }}
      viewType="monthly"
      clientData={client}
      platform={platform}
      isLoading={false}
    />
  );
}

function TablesLiveView({ client, platform }: Pick<LiveClientViewProps, 'client' | 'platform'>) {
  if (platform === 'meta') {
    return (
      <MetaAdsTables
        dateStart={SAMPLE_DATE_START}
        dateEnd={SAMPLE_DATE_END}
        clientId={client.id}
        preloadedTablesData={sampleMetaTables}
      />
    );
  }

  return (
    <GoogleAdsTables
      dateStart={SAMPLE_DATE_START}
      dateEnd={SAMPLE_DATE_END}
      clientId={client.id}
      preloadedTablesData={sampleGoogleTables}
      campaignTotals={{
        spend: sampleStats.totalSpend,
        clicks: sampleStats.totalClicks,
        conversions: sampleStats.totalConversions,
        conversion_value: sampleConversionMetrics.total_conversion_value,
      }}
    />
  );
}

export default function LiveClientView({
  mode,
  metrics,
  client,
  platform,
  metaEnabled = true,
  googleEnabled = true,
}: LiveClientViewProps) {
  return (
    <MetricsConfigOverrideProvider
      value={{
        clientId: client.id,
        platform,
        metrics,
        metaEnabled,
        googleEnabled,
      }}
    >
      <div className="w-full min-w-0 bg-slate-50">
        {mode === 'dashboard' && <DashboardLiveView client={client} platform={platform} />}
        {mode === 'report' && (
          <div className="min-w-0 p-3 sm:p-4">
            <ReportLiveView client={client} platform={platform} />
          </div>
        )}
        {mode === 'tables' && (
          <div className="min-w-0 p-3 sm:p-4">
            <TablesLiveView client={client} platform={platform} />
          </div>
        )}
      </div>
    </MetricsConfigOverrideProvider>
  );
}
