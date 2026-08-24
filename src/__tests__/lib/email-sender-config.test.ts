/**
 * Guards the production email sender configuration:
 * env values must survive stray whitespace, and a sandbox Resend sender must be
 * reported as a blocker instead of failing silently at send time.
 */

const mockResendSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockResendSend }
  }))
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn(), verify: jest.fn() }))
}));

jest.mock('@/lib/email-config', () => ({
  EMAIL_CONFIG: { MONITORING_MODE: false, REVIEW_MODE_DEFAULT: true },
  isMonitoringMode: () => false,
  getEmailRecipients: (recipient: string) => [recipient],
  getEmailSubject: (subject: string) => subject,
  getEmailRecipientsAsync: jest.fn(),
  getEmailSubjectAsync: jest.fn(async (subject: string) => subject),
  resolveEmailEnvelope: jest.fn(async (to: string, cc: string[] = []) => ({
    to,
    cc,
    isRedirected: false,
    originalRecipient: to
  }))
}));

const ORIGINAL_ENV = process.env;

async function loadService() {
  jest.resetModules();
  const { FlexibleEmailService } = await import('@/lib/flexible-email');
  return new FlexibleEmailService();
}

describe('email sender configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.CUSTOM_SMTP_HOST;
    delete process.env.CUSTOM_SMTP_USER;
    delete process.env.CUSTOM_SMTP_PASSWORD;
    delete process.env.EMAIL_PROVIDER;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('strips stray newlines from the configured sender address', async () => {
    process.env.RESEND_API_KEY = 're_test_key\n';
    process.env.EMAIL_FROM_ADDRESS = 'raporty@pbmreports.pl\n';

    const service = await loadService();

    expect(service.getProviderReadiness('client@example.com')).toMatchObject({
      provider: 'resend',
      ready: true,
      fromAddress: 'raporty@pbmreports.pl'
    });
  });

  it('reports the Resend sandbox sender as a configuration blocker', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM_ADDRESS = 'onboarding@resend.dev';

    const service = await loadService();
    const readiness = service.getProviderReadiness('client@example.com');

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(' ')).toContain('resend.com/domains');
  });

  it('reports a missing Resend API key as a configuration blocker', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM_ADDRESS = 'raporty@pbmreports.pl';

    const service = await loadService();

    expect(service.getProviderReadiness('client@example.com').blockers).toContain('Brak RESEND_API_KEY.');
  });

  it('keeps the provider rejection reason in the returned error', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM_ADDRESS = 'onboarding@resend.dev';
    mockResendSend.mockResolvedValue({
      data: null,
      error: { message: 'You can only send testing emails to your own email address' }
    });

    const service = await loadService();
    const result = await service.sendEmail({
      to: 'client@example.com',
      subject: 'Raport',
      html: '<p>Raport</p>'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('You can only send testing emails to your own email address');
    expect(result.error).toContain('onboarding@resend.dev');
    expect(result.error).toContain('client@example.com');
  });
});
