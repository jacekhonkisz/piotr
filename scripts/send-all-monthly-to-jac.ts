import { createClient } from '@supabase/supabase-js';
import FlexibleEmailService from '../src/lib/flexible-email';
import { isReviewMode, setReviewMode } from '../src/lib/email-config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RECIPIENT = 'jac.honkisz@gmail.com';

const monthNames = [
  'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec',
  'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
];
const now = new Date();
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const monthName = monthNames[prev.getMonth()]!;
const year = prev.getFullYear();

// Minimal valid PDF attachment for transport test.
const minimalPdf = Buffer.from(
  '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n' +
    '4 0 obj<</Length 79>>stream\n' +
    'BT /F1 16 Tf 72 720 Td (Miesieczny raport testowy - zalacznik kontrolny) Tj ET\n' +
    'endstream endobj\n' +
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
    'xref\n0 6\n' +
    '0000000000 65535 f \n0000000010 00000 n \n0000000063 00000 n \n0000000120 00000 n \n0000000247 00000 n \n0000000376 00000 n \n' +
    'trailer<</Size 6/Root 1 0 R>>\nstartxref\n446\n%%EOF'
);

const reportData = {
  dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://piotr-gamma.vercel.app'}/dashboard`,
  totalOnlineReservations: 0,
  totalOnlineValue: 0,
  onlineCostPercentage: 0,
  totalMicroConversions: 0,
  estimatedOfflineReservations: 0,
  estimatedOfflineValue: 0,
  finalCostPercentage: 0,
  totalValue: 0,
};

async function run() {
  const originalReview = await isReviewMode();
  console.log('Original review mode:', originalReview);

  try {
    if (originalReview) {
      const disabled = await setReviewMode(false);
      console.log('Temporarily disabled review mode:', disabled);
    }

    const { data: clients, error } = await supabase
      .from('clients')
      .select('id,name,reporting_frequency,status')
      .eq('reporting_frequency', 'monthly')
      .order('name');

    if (error) throw error;

    const emailService = FlexibleEmailService.getInstance();
    const results: Array<{ client: string; success: boolean; provider: string; error: string | null; messageId: string | null }> = [];

    for (const c of clients || []) {
      try {
        const res = await emailService.sendClientMonthlyReport(
          RECIPIENT,
          c.id,
          c.name,
          monthName,
          year,
          reportData,
          minimalPdf,
          'custom_smtp'
        );

        results.push({
          client: c.name,
          success: res.success,
          provider: res.provider,
          error: res.error || null,
          messageId: res.messageId || null,
        });

        console.log(`${res.success ? 'OK' : 'FAIL'} | ${c.name} | ${res.messageId || res.error}`);
      } catch (e: any) {
        results.push({
          client: c.name,
          success: false,
          provider: 'custom_smtp',
          error: e?.message || String(e),
          messageId: null,
        });
        console.log(`FAIL | ${c.name} | ${e?.message || String(e)}`);
      }
    }

    const ok = results.filter((r) => r.success).length;
    const fail = results.length - ok;

    console.log('\n=== SUMMARY ===');
    console.log(
      JSON.stringify(
        {
          recipient: RECIPIENT,
          monthName,
          year,
          total: results.length,
          success: ok,
          failed: fail,
          results,
        },
        null,
        2
      )
    );
  } finally {
    await setReviewMode(originalReview);
    console.log('Restored review mode to:', originalReview);
  }
}

run().catch((e) => {
  console.error('Fatal error:', e?.message || String(e));
  process.exit(1);
});
