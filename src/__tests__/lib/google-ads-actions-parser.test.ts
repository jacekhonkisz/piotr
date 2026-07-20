import { parseGoogleAdsConversions } from '../../lib/google-ads-actions-parser';

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Google Ads actions parser', () => {
  it('uses exact client booking-step mappings before heuristic matches', () => {
    const parsed = parseGoogleAdsConversions(
      [
        { conversion_name: 'Pinea — wyszukiwanie terminu', conversions: 12 },
        { conversion_name: 'begin_checkout', conversions: 50 },
      ],
      'Pinea',
      {
        mappings: {
          google: {
            booking_step_1: ['Pinea — wyszukiwanie terminu'],
          },
        },
      }
    );

    expect(parsed.booking_step_1).toBe(12);
  });

  it('matches configured Google action names without case or diacritics', () => {
    const parsed = parseGoogleAdsConversions(
      [{ conversion_name: 'WYŚWIETLENIE ZAWARTOŚCI', conversions: 8 }],
      'Mapped client',
      {
        mappings: {
          google: {
            booking_step_2: ['wyswietlenie zawartosci'],
          },
        },
      }
    );

    expect(parsed.booking_step_2).toBe(8);
  });
});
