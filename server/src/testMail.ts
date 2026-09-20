import { env } from './config/env';
import { logger } from './config/logger';
import {
  configuredFrom,
  isMailConfigured,
  resolveMailProvider,
  sendMail,
  verifyMailer,
} from './utils/mailer';

/**
 * Developer tool: sends a real test email with the configured provider so the
 * mail setup can be verified without going through the signup flow.
 *
 * Usage: npm --workspace server run mail:test -- you@example.com
 */
async function testMail(): Promise<void> {
  const to = process.argv[2]?.trim();

  if (!to) {
    console.error('Usage: npm --workspace server run mail:test -- <recipient@example.com>');
    process.exitCode = 1;
    return;
  }

  const provider = resolveMailProvider();
  console.log(`\nMail provider : ${provider}`);
  console.log(`Sender        : ${configuredFrom()}`);
  if (provider === 'smtp') {
    console.log(`SMTP host     : ${env.SMTP_HOST}:${env.SMTP_PORT}`);
    console.log(`SMTP user     : ${env.SMTP_USER}`);
  }
  console.log(`Recipient     : ${to}\n`);

  if (!isMailConfigured()) {
    await verifyMailer();
    console.error(
      '❌ No mail provider is configured, so nothing was sent.\n' +
        '   Set BREVO_API_KEY (Brevo API) or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS (e.g. Gmail)\n' +
        '   in server/.env, then run this command again.',
    );
    process.exitCode = 1;
    return;
  }

  // Check connectivity/credentials first so failures are easy to read.
  await verifyMailer();

  const result = await sendMail({
    to,
    subject: '✅ MealMate mail test',
    text:
      'MealMate test email — if you can read this, your mail provider is configured ' +
      'correctly and verification emails will be delivered.',
    html: `<h2 style="font-family:sans-serif">MealMate mail test</h2>
      <p style="font-family:sans-serif">If you can read this, your mail provider is configured
      correctly and verification emails will be delivered.</p>`,
  });

  if (result.delivered) {
    console.log(`\n✅ Test email accepted by ${provider} for ${to}. Check the inbox (and spam folder).`);
  } else {
    console.error(`\n❌ Sending failed: ${result.error}`);
    process.exitCode = 1;
  }
}

testMail()
  .catch((err) => {
    console.error('mail:test failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Let pino's transport flush before the process exits.
    logger.flush?.();
    setTimeout(() => process.exit(process.exitCode ?? 0), 300);
  });