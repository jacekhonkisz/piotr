import { config } from 'dotenv';
config({ path: '.env.local' });
config();
import nodemailer from 'nodemailer';

const RECIPIENT = process.argv[2] || 'ajc.honkisz@gmail.com';

async function tryConfig(label: string, opts: nodemailer.TransportOptions) {
  console.log(`\n=== Trying ${label} ===`);
  const transporter = nodemailer.createTransport(opts as any);
  try {
    await transporter.verify();
    console.log(`✅ ${label}: connection/auth verified`);
    return transporter;
  } catch (err: any) {
    console.log(`❌ ${label}: ${err.message}`);
    return null;
  }
}

async function main() {
  const user = process.env.CUSTOM_SMTP_USER!;
  const pass = process.env.CUSTOM_SMTP_PASSWORD!;
  const fromName = process.env.CUSTOM_SMTP_FROM_NAME || 'Piotr Bajerlein Marketing';

  console.log(`SMTP user: ${user}`);
  console.log(`Password length: ${pass?.length}`);

  // Primary: port 465 SSL
  let transporter = await tryConfig('smtp.gmail.com:465 (SSL)', {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });

  // Fallback: port 587 STARTTLS
  if (!transporter) {
    transporter = await tryConfig('smtp.gmail.com:587 (STARTTLS)', {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
  }

  if (!transporter) {
    console.error('\n🛑 Both port 465 and 587 failed to authenticate. Check credentials / app password.');
    process.exit(1);
  }

  console.log(`\n=== Sending test email to ${RECIPIENT} ===`);
  const info = await transporter.sendMail({
    from: `"${fromName}" <${user}>`,
    to: RECIPIENT,
    subject: 'Test wysyłki SMTP - Piotr Bajerlein Marketing',
    text: 'To jest testowa wiadomość potwierdzająca działanie systemu wysyłki SMTP.',
    html: '<p>To jest <strong>testowa wiadomość</strong> potwierdzająca działanie systemu wysyłki SMTP.</p>'
  });

  console.log(`✅ Sent! messageId: ${info.messageId}`);
  console.log(`   accepted: ${JSON.stringify(info.accepted)}`);
  console.log(`   rejected: ${JSON.stringify(info.rejected)}`);
  console.log(`   response: ${info.response}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
