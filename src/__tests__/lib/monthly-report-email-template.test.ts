/**
 * The client had to click Gmail's "..." to reach the Meta Ads card, because
 * Gmail hides the trailing run of body text that repeats an earlier message in
 * the same thread. These tests pin the two properties that keep the Meta card
 * out of that hidden region: the body must end with a per-send unique marker,
 * and it must stay well under Gmail's 102 KB clipping limit.
 */
import FlexibleEmailService from '@/lib/flexible-email';

const reportData = {
  dashboardUrl: 'https://example.test/reports?clientId=abc',
  googleAds: {
    spend: 16804.88,
    impressions: 812345,
    clicks: 24680,
    cpc: 0.68,
    ctr: 3.04,
    emailClicks: 15,
    phoneClicks: 250,
    bookingStep1: 8347,
    bookingStep2: 2210,
    bookingStep3: 870,
    reservations: 66,
    reservationValue: 309843.44,
    roas: 18.44,
  },
  metaAds: {
    spend: 10556.43,
    impressions: 654321,
    linkClicks: 12345,
    ctr: 1.89,
    cpc: 0.86,
    emailClicks: 1,
    phoneClicks: 13,
    bookingStep1: 3562,
    bookingStep2: 900,
    bookingStep3: 210,
    reservations: 12,
    reservationValue: 62436,
    roas: 5.91,
  },
  totalOnlineReservations: 78,
  totalOnlineValue: 372279.44,
  onlineCostPercentage: 7.35,
  totalMicroConversions: 279,
  estimatedOfflineReservations: 56,
  estimatedOfflineValue: 267000,
  finalCostPercentage: 4.28,
  totalValue: 639279,
};

function render() {
  const service = new FlexibleEmailService();
  return (service as any).generateClientMonthlyReportTemplate(
    'Nickel Resort Grzybowo',
    'lipiec',
    2026,
    reportData
  ) as { subject: string; html: string; text: string };
}

describe('monthly report email template', () => {
  it('ends the HTML body with the per-send marker, after the Meta Ads card', () => {
    const { html } = render();

    const stampIndex = html.indexOf('Raport przygotowany');
    const metaIndex = html.indexOf('2. Meta Ads');

    expect(metaIndex).toBeGreaterThan(-1);
    expect(stampIndex).toBeGreaterThan(metaIndex);

    // Nothing but the closing tags may follow the marker.
    expect(html.slice(stampIndex).replace(/\s+/g, ' ').trim()).toMatch(
      /^Raport przygotowany [^<]+\.<\/div> <\/div> <\/div> <\/div> <\/body> <\/html>$/
    );
  });

  it('ends the plain-text body with the same marker', () => {
    const { text } = render();
    expect(text.trimEnd()).toMatch(/Raport przygotowany [^\n]+\.$/);
  });

  it('makes the marker differ between two sends', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-09-07T09:15:04Z'));
      const first = render().html;
      jest.setSystemTime(new Date('2026-09-07T09:15:39Z'));
      const second = render().html;

      const marker = (html: string) => html.slice(html.indexOf('Raport przygotowany'));
      expect(marker(first)).not.toEqual(marker(second));
    } finally {
      jest.useRealTimers();
    }
  });

  it('stays far below the 102 KB size at which Gmail clips a message', () => {
    const { html } = render();
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(102 * 1024);
  });

  it('links to a report route that exists', () => {
    const { html, text } = render();
    expect(html).toContain('https://example.test/reports?clientId=abc');
    expect(text).toContain('https://example.test/reports?clientId=abc');
    expect(html).not.toContain('/reports/monthly/');
  });
});
