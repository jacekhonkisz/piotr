'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface Campaign {
  campaignId: string;
  campaignName: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  reservation_value: number;
}

interface AdGroup {
  adGroupId: string;
  adGroupName: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
}

interface Ad {
  adId: string;
  adType: string;
  headline: string;
  description: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversion_value: number;
}

interface GoogleAdsExpandableCampaignTableProps {
  campaigns: Campaign[];
  clientId: string;
  dateStart: string;
  dateEnd: string;
  currency?: string;
}

/**
 * RMF-Compliant Expandable Campaign Table
 * Shows:
 * - R.20: Campaign-level metrics
 * - R.30: Ad Group-level metrics (expandable)
 * - R.40: Ad-level metrics (expandable)
 */
export default function GoogleAdsExpandableCampaignTable({
  campaigns,
  clientId,
  dateStart,
  dateEnd,
  currency = 'PLN'
}: GoogleAdsExpandableCampaignTableProps) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdGroups, setExpandedAdGroups] = useState<Set<string>>(new Set());
  const [adGroups, setAdGroups] = useState<{ [campaignId: string]: AdGroup[] }>({});
  const [ads, setAds] = useState<{ [adGroupId: string]: Ad[] }>({});
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('pl-PL').format(Math.round(num));
  };

  const formatPercentage = (num: number) => {
    return `${num.toFixed(2)}%`;
  };

  const toggleCampaign = async (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
      setExpandedCampaigns(newExpanded);
    } else {
      newExpanded.add(campaignId);
      setExpandedCampaigns(newExpanded);
      
      // Fetch ad groups if not already loaded
      if (!adGroups[campaignId]) {
        await fetchAdGroups(campaignId);
      }
    }
  };

  const toggleAdGroup = async (adGroupId: string) => {
    const newExpanded = new Set(expandedAdGroups);
    
    if (newExpanded.has(adGroupId)) {
      newExpanded.delete(adGroupId);
      setExpandedAdGroups(newExpanded);
    } else {
      newExpanded.add(adGroupId);
      setExpandedAdGroups(newExpanded);
      
      // Fetch ads if not already loaded
      if (!ads[adGroupId]) {
        await fetchAds(adGroupId);
      }
    }
  };

  const fetchAdGroups = async (campaignId: string) => {
    setLoading(prev => ({ ...prev, [`campaign-${campaignId}`]: true }));
    
    try {
      const response = await fetch('/api/google-ads-ad-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          campaignId,
          dateStart,
          dateEnd
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ad groups');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setAdGroups(prev => ({ ...prev, [campaignId]: result.data }));
        console.log(`✅ Fetched ${result.data.length} ad groups for campaign ${campaignId}`);
      }

    } catch (error) {
      console.error('❌ Error fetching ad groups:', error);
      setAdGroups(prev => ({ ...prev, [campaignId]: [] }));
    } finally {
      setLoading(prev => ({ ...prev, [`campaign-${campaignId}`]: false }));
    }
  };

  const fetchAds = async (adGroupId: string) => {
    setLoading(prev => ({ ...prev, [`adgroup-${adGroupId}`]: true }));
    
    try {
      const response = await fetch('/api/google-ads-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          adGroupId,
          dateStart,
          dateEnd
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch ads');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        setAds(prev => ({ ...prev, [adGroupId]: result.data }));
        console.log(`✅ Fetched ${result.data.length} ads for ad group ${adGroupId}`);
      }

    } catch (error) {
      console.error('❌ Error fetching ads:', error);
      setAds(prev => ({ ...prev, [adGroupId]: [] }));
    } finally {
      setLoading(prev => ({ ...prev, [`adgroup-${adGroupId}`]: false }));
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-xl font-semibold text-slate-900 mb-1">
          Kampanie Google Ads (Rozwijane)
        </h3>
        <p className="text-sm text-slate-600">
          Kliknij kampanię, aby zobaczyć grupy reklam • Kliknij grupę, aby zobaczyć reklamy
        </p>
        <div className="mt-2 flex space-x-2">
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded">R.20 Campaign</span>
          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded">R.30 Ad Group</span>
          <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded">R.40 Ad</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-8"></th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Nazwa</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wydatki</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Wyświetlenia</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Kliknięcia</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">CTR</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">CPC</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Konwersje</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {campaigns.map((campaign, campaignIndex) => (
              <React.Fragment key={campaign.campaignId}>
                {/* Campaign Row (R.20) */}
                <tr
                  className={`${campaignIndex % 2 === 1 ? 'bg-slate-50/30' : ''} hover:bg-blue-50 cursor-pointer transition-colors`}
                  onClick={() => toggleCampaign(campaign.campaignId)}
                >
                  <td className="px-6 py-4">
                    {expandedCampaigns.has(campaign.campaignId) ? (
                      <ChevronUp className="w-4 h-4 text-slate-600" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-600" />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-1 h-8 bg-blue-500 rounded"></div>
                      <div>
                        <div className="font-medium text-slate-900">{campaign.campaignName}</div>
                        <div className="text-sm text-slate-500 capitalize">{campaign.status.toLowerCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">{formatCurrency(campaign.spend)}</td>
                  <td className="px-6 py-4 text-right text-slate-900">{formatNumber(campaign.impressions)}</td>
                  <td className="px-6 py-4 text-right text-slate-900">{formatNumber(campaign.clicks)}</td>
                  <td className="px-6 py-4 text-right text-slate-900">{formatPercentage(campaign.ctr)}</td>
                  <td className="px-6 py-4 text-right text-slate-900">{formatCurrency(campaign.cpc)}</td>
                  <td className="px-6 py-4 text-right text-slate-900">{formatNumber(campaign.conversions)}</td>
                </tr>

                {/* Ad Groups (R.30) */}
                {expandedCampaigns.has(campaign.campaignId) && (
                  <tr>
                    <td colSpan={8} className="px-0 py-0">
                      <div className="bg-purple-50/30">
                        {loading[`campaign-${campaign.campaignId}`] ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-purple-600 mr-2" />
                            <span className="text-sm text-slate-600">Ładowanie grup reklam...</span>
                          </div>
                        ) : adGroups[campaign.campaignId] && adGroups[campaign.campaignId].length > 0 ? (
                          <table className="w-full">
                            <tbody>
                              {adGroups[campaign.campaignId].map((adGroup) => (
                                <React.Fragment key={adGroup.adGroupId}>
                                  {/* Ad Group Row */}
                                  <tr
                                    className="hover:bg-purple-100 cursor-pointer transition-colors"
                                    onClick={() => toggleAdGroup(adGroup.adGroupId)}
                                  >
                                    <td className="px-6 py-3 pl-12">
                                      {expandedAdGroups.has(adGroup.adGroupId) ? (
                                        <ChevronUp className="w-4 h-4 text-slate-600" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-slate-600" />
                                      )}
                                    </td>
                                    <td className="px-6 py-3">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-1 h-6 bg-purple-500 rounded"></div>
                                        <div>
                                          <div className="font-medium text-slate-800 text-sm">{adGroup.adGroupName}</div>
                                          <div className="text-xs text-slate-500">Ad Group • {adGroup.status}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-3 text-right text-sm text-slate-800">{formatCurrency(adGroup.spend)}</td>
                                    <td className="px-6 py-3 text-right text-sm text-slate-800">{formatNumber(adGroup.impressions)}</td>
                                    <td className="px-6 py-3 text-right text-sm text-slate-800">{formatNumber(adGroup.clicks)}</td>
                                    <td className="px-6 py-3 text-right text-sm text-slate-800">{formatPercentage(adGroup.ctr)}</td>
                                    <td className="px-6 py-3 text-right text-sm text-slate-800">{formatCurrency(adGroup.cpc)}</td>
                                    <td className="px-6 py-3 text-right text-sm text-slate-800">{formatNumber(adGroup.conversions)}</td>
                                  </tr>

                                  {/* Ads (R.40) */}
                                  {expandedAdGroups.has(adGroup.adGroupId) && (
                                    <tr>
                                      <td colSpan={8} className="px-0 py-0">
                                        <div className="bg-green-50/30">
                                          {loading[`adgroup-${adGroup.adGroupId}`] ? (
                                            <div className="flex items-center justify-center py-6">
                                              <Loader2 className="w-5 h-5 animate-spin text-green-600 mr-2" />
                                              <span className="text-sm text-slate-600">Ładowanie reklam...</span>
                                            </div>
                                          ) : ads[adGroup.adGroupId] && ads[adGroup.adGroupId].length > 0 ? (
                                            <table className="w-full">
                                              <tbody>
                                                {ads[adGroup.adGroupId].map((ad) => (
                                                  <tr key={ad.adId} className="hover:bg-green-100">
                                                    <td className="px-6 py-3 pl-20"></td>
                                                    <td className="px-6 py-3">
                                                      <div className="flex items-center space-x-2">
                                                        <div className="w-1 h-6 bg-green-500 rounded"></div>
                                                        <div>
                                                          <div className="font-medium text-slate-700 text-sm">{ad.headline}</div>
                                                          <div className="text-xs text-slate-500">{ad.description}</div>
                                                          <div className="text-xs text-slate-400 mt-0.5">Ad • {ad.adType} • {ad.status}</div>
                                                        </div>
                                                      </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm text-slate-700">{formatCurrency(ad.spend)}</td>
                                                    <td className="px-6 py-3 text-right text-sm text-slate-700">{formatNumber(ad.impressions)}</td>
                                                    <td className="px-6 py-3 text-right text-sm text-slate-700">{formatNumber(ad.clicks)}</td>
                                                    <td className="px-6 py-3 text-right text-sm text-slate-700">{formatPercentage(ad.ctr)}</td>
                                                    <td className="px-6 py-3 text-right text-sm text-slate-700">{formatCurrency(ad.cpc)}</td>
                                                    <td className="px-6 py-3 text-right text-sm text-slate-700">{formatNumber(ad.conversions)}</td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          ) : (
                                            <div className="py-6 text-center text-sm text-slate-600">
                                              Brak reklam w tej grupie
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="py-6 text-center text-sm text-slate-600">
                            Brak grup reklam w tej kampanii
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* RMF Compliance Note */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
        <p className="text-xs text-slate-600">
          <strong>RMF Compliance:</strong> ✅ R.20 (Campaign), ✅ R.30 (Ad Group), ✅ R.40 (Ad) hierarchy with all required metrics
        </p>
      </div>
    </div>
  );
}

