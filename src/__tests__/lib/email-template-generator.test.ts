import { generateMonthlyReportTemplate } from '../../lib/email-template-generator';

describe('monthly email template', () => {
  it('includes the Meta booking funnel and combined phone label', () => {
    const template = generateMonthlyReportTemplate('Pinea', 'czerwiec', 2026, {
      dashboardUrl: 'https://example.test/report',
      metaAds: {
        spend: 100,
        impressions: 1000,
        linkClicks: 50,
        ctr: 5,
        cpc: 2,
        emailClicks: 0,
        phoneClicks: 19,
        bookingStep1: 4013,
        bookingStep2: 460,
        bookingStep3: 144,
        reservations: 19,
        reservationValue: 76456,
        roas: 764.56,
      },
      totalOnlineReservations: 19,
      totalOnlineValue: 76456,
      onlineCostPercentage: 0.13,
      totalMicroConversions: 19,
      estimatedOfflineReservations: 4,
      estimatedOfflineValue: 1000,
      finalCostPercentage: 0.12,
      totalValue: 77456,
    });

    expect(template.text).toContain('Wyszukiwania (booking step 1): 4013');
    expect(template.text).toContain('Wyświetlenia zawartości (booking step 2): 460');
    expect(template.text).toContain(
      'Zainicjowanie finalizacji zakupu (booking step 3): 144'
    );
    expect(template.text).toContain(
      'Kliknięcia w numer telefonu/połączenia z reklam: 19'
    );
  });
});
