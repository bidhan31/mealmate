import { BrevoClient } from '@getbrevo/brevo';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

let brevoClient: BrevoClient | null = null;
let smtpTransport: Transporter | null = null;

/** Sender used when MAIL_FROM is empty. */
const DEFAULT_MAIL_FROM = 'MealMate <no-reply@mealmate.app>';

const MAIL_NOT_CONFIGURED =
  'No mail provider configured — set BREVO_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS.';

const MAIL_SETUP_HINT =
  'Option A (Brevo API): set BREVO_API_KEY and MAIL_FROM to a sender activated at ' +
  'https://app.brevo.com/senders/all. ' +
  'Option B (SMTP, e.g. Gmail): set SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_USER=<address>, ' +
  'SMTP_PASS=<16-character app password> and MAIL_FROM="MealMate <same address>".';

const BREVO_SENDER_HINT =
  'MAIL_FROM must be a sender activated in your Brevo account, otherwise Brevo rejects the send (HTTP 400).';

const SMTP_HINT =
  'For Gmail use an App Password (Google Account → Security → 2-Step Verification → App passwords), ' +
  'not your normal account password.';

/** True when a Brevo API key is configured. */
export function isBrevoConfigured(): boolean {
  return Boolean(env.BREVO_API_KEY && env.BREVO_API_KEY.trim());
}

/** True when SMTP credentials are configured. */
export function isSmtpConfigured(): boolean {
  return Boolean(
    env.SMTP_HOST && env.SMTP_HOST.trim() && env.SMTP_USER && env.SMTP_USER.trim() && env.SMTP_PASS,
  );
}

/** The sender address actually used for outgoing mail. */
export function configuredFrom(): string {
  return (env.MAIL_FROM && env.MAIL_FROM.trim()) || DEFAULT_MAIL_FROM;
}

export type MailProvider = 'brevo' | 'smtp' | 'console';

export interface MailProviderConfig {
  explicit?: string;
  brevoKey?: string;
  smtpHost?: string;
  smtpUser?: string;
  smtpPass?: string;
}

/**
 * Resolves which transport delivers mail. An explicit MAIL_PROVIDER always
 * wins; otherwise the first fully configured provider is used and we fall back
 * to console logging (development) when nothing is configured.
 */
export function resolveMailProvider(cfg: MailProviderConfig = {}): MailProvider {
  const explicit = (cfg.explicit ?? env.MAIL_PROVIDER ?? '').trim().toLowerCase();
  if (explicit === 'brevo' || explicit === 'smtp' || explicit === 'console') return explicit;

  const brevoKey = cfg.brevoKey ?? env.BREVO_API_KEY;
  if (brevoKey && brevoKey.trim()) return 'brevo';

  const smtpHost = cfg.smtpHost ?? env.SMTP_HOST;
  const smtpUser = cfg.smtpUser ?? env.SMTP_USER;
  const smtpPass = cfg.smtpPass ?? env.SMTP_PASS;
  if (smtpHost && smtpHost.trim() && smtpUser && smtpUser.trim() && smtpPass) return 'smtp';

  return 'console';
}

/** True when a real transport (not console logging) is configured. */
export function isMailConfigured(): boolean {
  return resolveMailProvider() !== 'console';
}

function getBrevoClient(): BrevoClient {
  if (!brevoClient) {
    brevoClient = new BrevoClient({ apiKey: env.BREVO_API_KEY });
  }
  return brevoClient;
}

function getSmtpTransport(): Transporter {
  if (!smtpTransport) {
    const secure = env.SMTP_SECURE
      ? env.SMTP_SECURE.trim().toLowerCase() === 'true'
      : env.SMTP_PORT === 465;

    smtpTransport = nodemailer.createTransport({
      host: env.SMTP_HOST.trim(),
      port: env.SMTP_PORT,
      secure,
      auth: {
        user: env.SMTP_USER.trim(),
        // Provider app passwords are pasted with grouping spaces (e.g. Gmail)
        pass: env.SMTP_PASS.replace(/\s+/g, ''),
      },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });
  }
  return smtpTransport;
}

/**
 * Human-readable reason for a failed send, covering both the Brevo SDK
 * (`body.message`) and SMTP/nodemailer errors (`code`, `response`).
 */
function describeMailError(err: unknown): string {
  const e = err as {
    statusCode?: number;
    body?: unknown;
    message?: string;
    code?: string;
    response?: string;
  };
  const body = e?.body as { message?: string; code?: string } | undefined;
  const detail =
    body?.message ?? body?.code ?? e?.response ?? e?.message ?? e?.code ?? 'Unknown mail error';

  if (e?.statusCode) return `Brevo API ${e.statusCode}: ${detail}`;
  if (e?.code && !e?.response) return `${e.code}: ${detail}`;
  return detail;
}

function parseMailbox(raw: string): { name?: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) {
    return { name: m[1].trim(), email: m[2].trim() };
  }
  return { email: raw.trim() };
}

async function sendMailViaBrevo({ to, subject, html, text }: MailOptions): Promise<void> {
  const client = getBrevoClient();
  const sender = parseMailbox(configuredFrom());
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

/** Send an email through a standard SMTP account (Gmail, Zoho, Mailtrap, …). */
export async function sendMailViaSmtp({ to, subject, html, text }: MailOptions): Promise<void> {
  const from = configuredFrom();
  const info = await getSmtpTransport().sendMail({
    from,
    to,
    subject,
    html,
    ...(text ? { text } : {}),
  });
  logger.info(
    { to, subject, messageId: info.messageId ?? null, from, host: env.SMTP_HOST },
    '📧 Email sent via SMTP',
  );
}

export async function verifyMailer(): Promise<void> {
  const provider = resolveMailProvider();
  const sender = parseMailbox(configuredFrom()).email;

  if (provider === 'console') {
    logger.warn(
      { hint: MAIL_SETUP_HINT },
      `⚠️  ${MAIL_NOT_CONFIGURED} Emails are logged to the console instead (non-production only).`,
    );
    return;
  }

  if (provider === 'smtp') {
    try {
      await getSmtpTransport().verify();
      logger.info(
        {
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          user: env.SMTP_USER,
          sender,
        },
        '✅ SMTP connection verified — verification emails will be delivered',
      );
    } catch (err) {
      smtpTransport = null;
      logger.error(
        { reason: describeMailError(err), hint: SMTP_HINT },
        '❌ SMTP verification FAILED — check SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS',
      );
    }
    return;
  }

  // ── Brevo ──
  try {
    const client = getBrevoClient();
    const account = await client.account.getAccount();
    logger.info(
      {
        account: `${account.firstName} ${account.lastName} <${account.email}>`,
        sender,
      },
      '✅ Brevo API verified successfully',
    );

    // The most common reason verification emails never arrive is a sender that
    // is not activated in Brevo — the API then rejects the send with HTTP 400.
    try {
      const { senders } = await client.senders.getSenders();
      const active = (senders ?? []).filter((s) => s.active).map((s) => s.email);
      const isActive = active.some((email) => email.toLowerCase() === sender.toLowerCase());

      if (isActive) {
        logger.info({ sender }, '✅ MAIL_FROM is an activated Brevo sender');
      } else {
        logger.error(
          { sender, activeSenders: active, hint: BREVO_SENDER_HINT },
          '❌ MAIL_FROM is NOT an activated sender in this Brevo account — Brevo will reject every send (HTTP 400). ' +
            'Add/verify it at https://app.brevo.com/senders/all, or set MAIL_FROM to one of the active senders listed here.',
        );
      }
    } catch (senderErr) {
      logger.warn({ reason: describeMailError(senderErr) }, 'Could not list Brevo senders');
    }
  } catch (err) {
    logger.error({ reason: describeMailError(err) }, '❌ Brevo verification FAILED — check BREVO_API_KEY');
    brevoClient = null;
  }
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/** Outcome of a send attempt — never an exception, so callers can recover. */
export interface MailResult {
  /** true when the provider accepted the message for delivery. */
  delivered: boolean;
  /** true when no provider is configured, so no send was attempted. */
  skipped?: boolean;
  /** Provider/configuration reason when delivery did not happen. */
  error?: string;
}

/**
 * Send an email using the configured transport (Brevo API or SMTP).
 *
 * Never throws: the outcome is returned so a mail outage can never break the
 * caller's flow (e.g. registration). Outside production, when no provider is
 * configured, the message body (which contains the action link) is logged so
 * the flow can still be completed locally.
 */
export async function sendMail(options: MailOptions): Promise<MailResult> {
  const { to, subject, html, text } = options;
  const provider = resolveMailProvider();

  if (provider === 'brevo') {
    try {
      await sendMailViaBrevo(options);
      return { delivered: true };
    } catch (err) {
      const error = describeMailError(err);
      logger.error(
        { err, to, subject, provider, from: configuredFrom(), reason: error },
        '❌ Email send failed via Brevo',
      );
      return { delivered: false, error };
    }
  }

  if (provider === 'smtp') {
    try {
      await sendMailViaSmtp(options);
      return { delivered: true };
    } catch (err) {
      const error = describeMailError(err);
      logger.error(
        { err, to, subject, provider, from: configuredFrom(), reason: error, hint: SMTP_HINT },
        '❌ Email send failed via SMTP',
      );
      return { delivered: false, error };
    }
  }

  // ── Console fallback: no provider configured ──
  if (env.isProd) {
    logger.error({ to, subject }, `❌ ${MAIL_NOT_CONFIGURED} Emails cannot be delivered in production.`);
    return { delivered: false, skipped: true, error: MAIL_NOT_CONFIGURED };
  }

  logger.warn({ to, subject }, `⚠️  ${MAIL_NOT_CONFIGURED} Logging the email instead (development).`);
  logger.info({ to, subject, body: text ?? html }, '📧 [DEV] Email preview');
  return { delivered: false, skipped: true, error: MAIL_NOT_CONFIGURED };
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
