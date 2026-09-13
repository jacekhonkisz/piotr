import {
  getDefaultAdsProvider,
  hasGoogleAds,
  hasMetaAds,
} from '../../lib/ads-provider-utils';

const bothConnected = {
  meta_access_token: 'token',
  ad_account_id: 'act_1',
  google_ads_enabled: true,
  google_ads_customer_id: '123',
};

describe('report platform visibility', () => {
  it('shows a connected platform by default', () => {
    expect(hasMetaAds(bothConnected)).toBe(true);
    expect(hasGoogleAds(bothConnected)).toBe(true);
  });

  it('hides a connected platform when the report flag is off', () => {
    expect(hasMetaAds(bothConnected, { metaEnabled: false })).toBe(false);
    expect(hasGoogleAds(bothConnected, { googleEnabled: false })).toBe(false);
  });

  it('does not show a disconnected platform even when the flag is on', () => {
    expect(hasMetaAds({ ...bothConnected, meta_access_token: null }, { metaEnabled: true })).toBe(false);
    expect(hasGoogleAds({ ...bothConnected, google_ads_enabled: false }, { googleEnabled: true })).toBe(false);
  });

  it('defaults to the remaining visible platform', () => {
    expect(getDefaultAdsProvider(bothConnected, { metaEnabled: false, googleEnabled: true })).toBe('google');
    expect(getDefaultAdsProvider(bothConnected, { metaEnabled: true, googleEnabled: false })).toBe('meta');
  });
});
