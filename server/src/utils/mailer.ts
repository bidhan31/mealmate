import { BrevoClient } from '@getbrevo/brevo';
import { env } from '../config/env';
import { logger } from '../config/logger';

let brevoClient: BrevoClient | null = null;

const BREVO_SENDER_HINT =
  'For production, add and authenticate a sending domain or sender in the Brevo dashboard, ' +
  "then set MAIL_FROM to that authenticated sender (e.g. 'MealMate <no-reply@yourdomain.com>').";

function hasBrevoConfig(): boolean {
  return Boolean(env.BREVO_API_KEY);
}

function getBrevoClient(): BrevoClient {
  if (!brevoClient) {
    brevoClient = new BrevoClient({ apiKey: env.BREVO_API_KEY });
  }
  return brevoClient;
}

function parseMailbox(raw: string): { name?: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) {
    return { name: m[1].trim(), email: m[2].trim() };
  }
  return { email: raw.trim() };
}

async function sendMailViaBrevo({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const client = getBrevoClient();
  const fromRaw = env.MAIL_FROM || 'MealMate <hello@mealmate.app>';
  const sender = parseMailbox(fromRaw);
  const recipient = parseMailbox(to);

  const response = await client.transactionalEmails.sendTransacEmail({
    sender,
    to: [{ email: recipient.email, ...(recipient.name ? { name: recipient.name } : {}) }],
    subject,
    htmlContent: html,
    ...(text ? { textContent: text } : {}),
  });
  logger.info(
    { to: recipient.email, subject, messageId: response.messageId ?? null, from: sender.email },
    '📧 Email sent via Brevo REST API',
  );
}

export async function verifyBrevo(): Promise<void> {
  if (!hasBrevoConfig()) {
    logger.warn('Brevo not configured — skipping Brevo API verification');
    return;
  }
  try {
    const account = await getBrevoClient().account.getAccount();
    logger.info(
      {
        account: `${account.firstName} ${account.lastName} <${account.email}>`,
      },
      `✅ Brevo API verified successfully. ${BREVO_SENDER_HINT}`,
    );
  } catch (err) {
    logger.error({ err }, '❌ Brevo verification FAILED — check BREVO_API_KEY');
    brevoClient = null;
  }
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email.
 * Uses Brevo's transactional email REST API. In development, mail content is
 * logged when a BREVO_API_KEY has not been configured.
 */
export async function sendMail({ to, subject, html, text }: MailOptions): Promise<void> {
  if (hasBrevoConfig()) {
    try {
      await sendMailViaBrevo({ to, subject, html, text });
      return;
    } catch (brevoErr) {
      logger.error({ err: brevoErr, to, subject }, 'Brevo REST email send failed');
      throw brevoErr instanceof Error ? brevoErr : new Error('Failed to send email via Brevo');
    }
  }

  if (env.isProd) {
    const message = 'Email provider not configured for production. Set BREVO_API_KEY.';
    logger.error({ to, subject }, message);
    throw new Error(message);
  }

  logger.warn({ to, subject }, 'Brevo not configured — email not sent (logging instead)');
  logger.info({ to, subject, text: text ?? html }, 'Email content');
}

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MealMate</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f7f4;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#16a34a,#15803d);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">🍽️ MealMate</div>
              <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:6px;">Meal &amp; Expense Management</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              ${content}
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0;" />
              <p style="font-size:12px;color:#9ca3af;margin:0;text-align:center;">
                This email was sent by MealMate. If you did not request this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Verification Email ──────────────────────────────────────────────────────
export function verificationEmail(name: string, link: string): { subject: string; html: string; text: string } {
  return {
    subject: '✅ Verify your MealMate account',
    text: `Hi ${name},\n\nWelcome to MealMate! Please verify your email address by visiting:\n${link}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, you can safely ignore this email.`,
    html: emailWrapper(`
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Welcome, ${name}! 🎉</h2>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;line-height:1.6;">
        Thanks for joining MealMate. Please verify your email address to activate your account and start tracking meals and expenses with your household.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">
          Verify Email Address
        </a>
      </div>
      <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.5;">
        Or copy and paste this link into your browser:<br/>
        <a href="${link}" style="color:#16a34a;word-break:break-all;">${link}</a>
      </p>
      <p style="font-size:13px;color:#9ca3af;margin:16px 0 0;">⏳ This link expires in <strong>24 hours</strong>.</p>
    `),
  };
}

// ─── Password Reset Email ────────────────────────────────────────────────────
export function passwordResetEmail(name: string, link: string): { subject: string; html: string; text: string } {
  return {
    subject: '🔐 Reset your MealMate password',
    text: `Hi ${name},\n\nWe received a request to reset your MealMate password. Click the link below to set a new password:\n${link}\n\nThis link expires in 1 hour.\n\nIf you didn't request a password reset, please ignore this email — your password will remain unchanged.`,
    html: emailWrapper(`
      <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 8px;">Reset your password</h2>
      <p style="font-size:15px;color:#374151;margin:0 0 8px;line-height:1.6;">
        Hi <strong>${name}</strong>,
      </p>
      <p style="font-size:15px;color:#374151;margin:0 0 24px;line-height:1.6;">
        We received a request to reset the password for your MealMate account. Click the button below to create a new password.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#16a34a,#15803d);color:#ffffff;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">
          Reset Password
        </a>
      </div>
      <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.5;">
        Or copy and paste this link into your browser:<br/>
        <a href="${link}" style="color:#16a34a;word-break:break-all;">${link}</a>
      </p>
      <p style="font-size:13px;color:#9ca3af;margin:16px 0 0;">⏳ This link expires in <strong>1 hour</strong>.</p>
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:12px 16px;margin-top:20px;">
        <p style="font-size:13px;color:#92400e;margin:0;">
          ⚠️ If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
        </p>
      </div>
    `),
  };
}
