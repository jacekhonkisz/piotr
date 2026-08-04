import {
  isGoogleAdsEmailAddressClickConversion,
  parseGoogleAdsConversions,
} from '../../lib/google-ads-actions-parser';

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

  describe('reservations — primary purchase rule (actionMeta)', () => {
    // Hotel Lambert regression: only the primary („Podstawowe”) purchase-category
    // action may feed reservation count/value; secondary GA4 "Zakup" and
    // reservation-named actions in other goal sections must be skipped.
    const lambertActionMeta = {
      'pbm - rezerwacja': { category: 4, primaryForGoal: true },
      'pbm - rezerwacja - apartamenty': { category: 9, primaryForGoal: true },
      'zakup': { category: 4, primaryForGoal: false },
      'zakup (1)': { category: 4, primaryForGoal: false },
      'morska-bryza': { category: 4, primaryForGoal: false },
    };

    it('counts ONLY primary purchase-category actions when catalog metadata is present', () => {
      const parsed = parseGoogleAdsConversions(
        [
          { conversion_name: 'PBM - Rezerwacja', conversions: 45.8, conversion_value: 193534.4 },
          { conversion_name: 'PBM - Rezerwacja - Apartamenty', conversions: 5.01, conversion_value: 10164.9 },
          { conversion_name: 'Zakup', conversions: 20.81, conversion_value: 65914.82 },
        ],
        'Lambert',
        { actionMeta: lambertActionMeta }
      );

      expect(parsed.reservations).toBe(46); // round(45.8)
      expect(parsed.reservation_value).toBe(193534.4);
    });

    it('falls back to name heuristics when no catalog metadata is provided', () => {
      const parsed = parseGoogleAdsConversions(
        [
          { conversion_name: 'PBM - Rezerwacja', conversions: 45.8, conversion_value: 193534.4 },
          { conversion_name: 'Zakup', conversions: 20.81, conversion_value: 65914.82 },
        ],
        'Lambert'
      );

      // Dedicated reservation action wins; GA4 "Zakup" duplicate is skipped.
      expect(parsed.reservations).toBe(46);
      expect(parsed.reservation_value).toBe(193534.4);
    });

    it('falls back to name heuristics when catalog has no primary purchase action', () => {
      const parsed = parseGoogleAdsConversions(
        [{ conversion_name: 'purchase', conversions: 10, conversion_value: 1000 }],
        'GA4-only client',
        { actionMeta: { purchase: { category: 4, primaryForGoal: false } } }
      );

      expect(parsed.reservations).toBe(10);
      expect(parsed.reservation_value).toBe(1000);
    });
  });

  describe('email contact matcher', () => {
    it.each([
      'Kliknięcie w adres e-mail',
      'PBM - kliknięcie w adres e-mail',
      'Kliknięcie w e-mail', // Arche Nałęczów regression: 42 e-mails in June counted as 0
      'Kliknięcie w email',
      'Click on email address',
    ])('matches "%s"', (name) => {
      expect(isGoogleAdsEmailAddressClickConversion(name)).toBe(true);
    });

    it.each([
      'PBM - kliknięcie e-mail - apartamenty', // no „w” — apartment duplicate stays excluded
      'Kontakt',
      'Zapis do newslettera',
      'Wysłanie formularza',
    ])('does NOT match "%s"', (name) => {
      expect(isGoogleAdsEmailAddressClickConversion(name)).toBe(false);
    });
  });
});
