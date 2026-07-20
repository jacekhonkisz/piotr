import {
  parseMetaActions,
  selectMetaPhoneClicks,
  extractMetaContactFromConversions,
  enhanceCampaignsWithConversions,
  aggregateConversionMetrics,
} from '../../lib/meta-actions-parser';

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Meta actions parser', () => {
  it('uses placed calls without summing broader confirmation subtypes', () => {
    const parsed = parseMetaActions([
      { action_type: 'click_to_call_call_confirm', value: '7' },
      { action_type: 'click_to_call_native_call_placed', value: '6' },
      { action_type: 'click_to_call_native_20s_call_connect', value: '4' },
    ]);

    expect(parsed.click_to_call).toBe(6);
  });

  it('uses the PBM custom event instead of standard phone actions', () => {
    const parsed = parseMetaActions([
      { action_type: 'offsite_conversion.custom.1470262077092668', value: '19' },
      { action_type: 'click_to_call_call_confirm', value: '21' },
    ]);

    expect(parsed.click_to_call).toBe(19);
  });

  it('uses one deterministic subtype when call confirmations are absent', () => {
    const phoneClicks = selectMetaPhoneClicks(
      new Map([
        ['click_to_call_native_call_placed', 5],
        ['click_to_call_native_20s_call_connect', 3],
      ])
    );

    expect(phoneClicks).toBe(5);
  });

  it('keeps PBM-only accounts at zero when a campaign has no PBM event', () => {
    const parsed = parseMetaActions(
      [{ action_type: 'click_to_call_call_confirm', value: '8' }],
      [],
      'Campaign without PBM event',
      true
    );

    expect(parsed.click_to_call).toBe(0);
  });

  it('uses explicit client event mappings instead of global defaults', () => {
    const parsed = parseMetaActions(
      [
        { action_type: 'client.phone', value: '7' },
        { action_type: 'client.email', value: '3' },
        { action_type: 'client.step-one', value: '40' },
        { action_type: 'omni_search', value: '99' },
      ],
      [],
      'Mapped client',
      false,
      {
        meta: {
          click_to_call: ['client.phone'],
          email_contacts: ['client.email'],
          booking_step_1: ['client.step-one'],
        },
      }
    );

    expect(parsed.click_to_call).toBe(7);
    expect(parsed.email_contacts).toBe(3);
    expect(parsed.booking_step_1).toBe(40);
  });

  it('reads PBM pixel phone/email from insights conversions[] when actions[] has none', () => {
    const campaign = enhanceCampaignsWithConversions([
      {
        campaign_name: 'Nickel',
        actions: [{ action_type: 'offsite_conversion.fb_pixel_custom', value: '40' }],
        action_values: [],
        conversions: [
          {
            action_type:
              'offsite_conversion.fb_pixel_custom.PBM - kliknięcie w numer telefonu',
            value: '7',
          },
          {
            action_type:
              'offsite_conversion.fb_pixel_custom.PBM - kliknięcie w adres e-mail',
            value: '3',
          },
        ],
      },
    ])[0];

    expect(campaign.click_to_call).toBe(7);
    expect(campaign.email_contacts).toBe(3);
  });

  it('keeps call-ad phone counts from actions[] over conversions[] fallback', () => {
    const totals = aggregateConversionMetrics(
      enhanceCampaignsWithConversions([
        {
          campaign_name: 'Pinea',
          actions: [{ action_type: 'click_to_call_native_call_placed', value: '19' }],
          action_values: [],
          conversions: [
            {
              action_type:
                'offsite_conversion.fb_pixel_custom.PBM - kliknięcie w numer telefonu',
              value: '50',
            },
          ],
        },
      ])
    );

    expect(totals.click_to_call).toBe(19);
  });

  it('does not mix actions[] phones with conversions[] fallback across campaigns', () => {
    // Arche Nałęczów regression: campaign A reports phones via actions[] call ads,
    // campaign B only has a pixel phone in conversions[]. Account total must use
    // one source (actions[]) — mixing both reported 12 instead of 11.
    const totals = aggregateConversionMetrics(
      enhanceCampaignsWithConversions([
        {
          campaign_name: 'Arche call ads',
          actions: [{ action_type: 'click_to_call_native_call_placed', value: '11' }],
          action_values: [],
          conversions: [],
        },
        {
          campaign_name: 'Arche pixel campaign',
          actions: [],
          action_values: [],
          conversions: [
            {
              action_type:
                'offsite_conversion.fb_pixel_custom.PBM - kliknięcie w numer telefonu',
              value: '1',
            },
          ],
        },
      ])
    );

    expect(totals.click_to_call).toBe(11);
  });

  it('uses one account-level phone action type across campaigns', () => {
    // Arche Nałęczów regression: two campaigns report placed calls (6 + 5) and a
    // third only has the broader call_confirm subtype. Mixing subtypes per
    // campaign produced 12; Ads Manager (and the client) count 11.
    const totals = aggregateConversionMetrics(
      enhanceCampaignsWithConversions([
        {
          campaign_name: 'Senior',
          actions: [
            { action_type: 'click_to_call_native_call_placed', value: '6' },
            { action_type: 'click_to_call_call_confirm', value: '11' },
          ],
          action_values: [],
        },
        {
          campaign_name: 'Reset dla spiocha',
          actions: [
            { action_type: 'click_to_call_native_call_placed', value: '5' },
            { action_type: 'click_to_call_call_confirm', value: '11' },
          ],
          action_values: [],
        },
        {
          campaign_name: 'Sala optymizmu',
          actions: [{ action_type: 'click_to_call_call_confirm', value: '1' }],
          action_values: [],
        },
      ])
    );

    expect(totals.click_to_call).toBe(11);
  });

  it('extracts contact metrics directly from conversions[]', () => {
    const contact = extractMetaContactFromConversions([
      {
        action_type:
          'offsite_conversion.fb_pixel_custom.PBM - kliknięcie w numer telefonu',
        value: '4',
      },
      {
        action_type:
          'offsite_conversion.fb_pixel_custom.PBM - kliknięcie w adres e-mail',
        value: '2',
      },
    ]);

    expect(contact.click_to_call).toBe(4);
    expect(contact.email_contacts).toBe(2);
  });
});
