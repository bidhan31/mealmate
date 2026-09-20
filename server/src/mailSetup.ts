import fs from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Interactive helper that configures email delivery (SMTP or Brevo) in
 * server/.env and optionally sends a live test email.
 *
 * Usage: npm --workspace server run mail:setup
 *
 * Non-interactive flags (handy for scripts/CI):
 *   --provider smtp|brevo  --host <h>  --port <n>  --secure true|false
 *   --user <u>  --pass <p>  --api-key <k>  --from "MealMate <a@b.c>"
 *   --to <recipient>  --send-test  --no-test  --dry-run
 */

/** Environment keys this tool manages. */
export const MAIL_SETUP_KEYS = [
  'MAIL_PROVIDER',
  'BREVO_API_KEY',
  'MAIL_FROM',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
] as const;

/** Quotes a value when the .env format requires it. */
export function formatEnvValue(value: string): string {
  const cleaned = value.replace(/[\r\n]+/g, ' ').trim();
  return /[\s#"']/.test(cleaned) ? `"${cleaned.replace(/"/g, '')}"` : cleaned;
}

/**
 * Updates/inserts KEY=value pairs in an .env file body while preserving every
 * other line (comments, ordering, CRLF vs LF, unrelated keys).
 */
export function upsertEnvLines(content: string, values: Record<string, string>): string {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const pending = new Map(Object.entries(values).filter(([, v]) => v !== undefined));

  const lines = content.split(/\r?\n/).map((line) => {
    const match = /^\s*([A-Za-z0-9_]+)\s*=/.exec(line);
    if (!match) return line;

    const key = match[1];
    const value = pending.get(key);
    if (value === undefined) return line;

    pending.delete(key);
    return `${key}=${formatEnvValue(value)}`;
  });

  // Anything not present yet is appended under a clear section header.
  if (pending.size > 0) {
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push('', '# ── Email delivery (written by mail:setup) ──');
    for (const [key, value] of pending) lines.push(`${key}=${formatEnvValue(value)}`);
  }

  return `${lines.join(eol).replace(/[\s\r\n]+$/, '')}${eol}`;
}

/** Readline prompter that can hide secret input. */
function createPrompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let muted = false;

  const rlAny = rl as unknown as {
    _writeToOutput?: (s: string) => void;
    output: NodeJS.WritableStream;
  };
  const originalWrite = rlAny._writeToOutput?.bind(rl);
  rlAny._writeToOutput = (s: string) => {
    if (muted) {
      // Swallow the echoed characters; keep line breaks readable.
      if (/[\r\n]/.test(s)) rlAny.output.write('\n');
      return;
    }
    if (originalWrite) originalWrite(s);
    else rlAny.output.write(s);
  };

  return {
    ask: (question: string, fallback?: string): Promise<string> =>
      new Promise((resolve) => {
        const label = fallback ? `${question} [${fallback}]: ` : `${question}: `;
        rl.question(label, (answer) => resolve(answer.trim() || fallback || ''));
      }),
    askSecret: (question: string): Promise<string> =>
      new Promise((resolve) => {
        process.stdout.write(`${question}: `);
        muted = true;
        rl.question('', (answer) => {
          muted = false;
          resolve(answer.trim());
        });
      }),
    close: () => rl.close(),
  };
}

/** Collects the settings to write, prompting only for what is missing. */
async function collectSettings(flags: SetupFlags): Promise<Record<string, string>> {
  const canBeInteractive = process.stdin.isTTY === true;
  const needsPrompt = !flags.provider || !(flags.host || flags.apiKey);
  const prompter = !flags.dryRun && canBeInteractive && needsPrompt ? createPrompter() : null;

  try {
    let provider = flags.provider;
    let host = flags.host ?? '';
    let port = flags.port ? String(flags.port) : '';
    let secure = flags.secure;
    let user = flags.user ?? '';
    let pass = flags.pass ?? '';
    let apiKey = flags.apiKey ?? '';
    let from = flags.from ?? '';

    if (!provider && prompter) {
      console.log(`
How should MealMate send verification emails?
  1) Gmail / Google Workspace SMTP   (quickest — needs a 16-char App Password)
  2) Other SMTP server               (Zoho, Outlook, Mailtrap, custom host)
  3) Brevo API                       (API key + a sender verified in Brevo)
`);
      const choice = (await prompter.ask('Enter 1, 2 or 3', '1')).trim();
      provider = choice === '3' ? 'brevo' : 'smtp';
      if (choice === '1' || (choice !== '3' && choice !== '2')) {
        host = host || 'smtp.gmail.com';
        port = port || '465';
        secure = secure ?? true;
      }
    }
    if (!provider) provider = 'smtp';

    if (provider === 'brevo') {
      if (!apiKey && prompter) apiKey = await prompter.askSecret('Brevo API key (xkeysib-…)');
      if (!from && prompter) {
        from = await prompter.ask(
          'Sender address already verified in Brevo',
          'MealMate <no-reply@mealmate.app>',
        );
      }
      return {
        MAIL_PROVIDER: 'brevo',
        ...(apiKey ? { BREVO_API_KEY: apiKey } : {}),
        ...(from ? { MAIL_FROM: from } : {}),
      };
    }

    if (!host && prompter) host = await prompter.ask('SMTP host', 'smtp.gmail.com');
    if (!port && prompter) port = await prompter.ask('SMTP port', host === 'smtp.gmail.com' ? '465' : '587');
    const useTls = secure ?? port === '465';
    const secureValue = prompter
      ? (await prompter.ask(
          'Implicit TLS? (true for port 465, false for STARTTLS)',
          String(useTls),
        )) === 'true'
      : useTls;
    if (!user && prompter) user = await prompter.ask('SMTP username (usually your email address)');
    if (!pass && prompter) pass = await prompter.askSecret('SMTP password / app password');
    if (!from && prompter) from = await prompter.ask('Sender name and address', `MealMate <${user}>`);

    return {
      MAIL_PROVIDER: 'smtp',
      SMTP_HOST: host,
      SMTP_PORT: port || (secureValue ? '465' : '587'),
      SMTP_SECURE: String(secureValue),
      SMTP_USER: user,
      SMTP_PASS: pass,
      MAIL_FROM: from || `MealMate <${user}>`,
    };
  } finally {
    prompter?.close();
  }
}

export interface SetupFlags {
  provider?: 'smtp' | 'brevo';
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  apiKey?: string;
  from?: string;
  to?: string;
  sendTest?: boolean;
  dryRun?: boolean;
}

/** Minimal flag parser — avoids adding a dependency for one script. */
export function parseFlags(argv: string[]): SetupFlags {
  const flags: SetupFlags = {};
  const read = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const has = (name: string): boolean => argv.includes(`--${name}`);

  const provider = read('provider')?.toLowerCase();
  if (provider === 'smtp' || provider === 'brevo') flags.provider = provider;

  flags.host = read('host');
  const port = read('port');
  if (port) flags.port = Number(port);
  const secure = read('secure');
  if (secure) flags.secure = secure.toLowerCase() === 'true';
  flags.user = read('user');
  flags.pass = read('pass');
  flags.apiKey = read('api-key');
  flags.from = read('from');
  flags.to = read('to');
  if (has('send-test')) flags.sendTest = true;
  if (has('no-test')) flags.sendTest = false;
  if (has('dry-run')) flags.dryRun = true;

  return flags;
}

/** .env location — works from server/ (npm workspace) or the repo root. */
function envPath(): string {
  const found = ['.env', path.join('server', '.env')].find((candidate) =>
    fs.existsSync(path.resolve(process.cwd(), candidate)),
  );
  return path.resolve(process.cwd(), found ?? '.env');
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const target = envPath();
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';

  const values = await collectSettings(flags);
  const updated = upsertEnvLines(existing, values);

  if (flags.dryRun) {
    console.log(`--- DRY RUN: ${target} would become ---\n${updated}`);
    return;
  }

  if (!MAIL_SETUP_KEYS.some((key) => values[key])) {
    console.error('❌ No credentials supplied — nothing was written.');
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(target, updated, 'utf8');
  console.log(`\n✅ Saved mail settings to ${target}`);
  for (const key of MAIL_SETUP_KEYS) {
    if (values[key]) {
      const secret = key === 'SMTP_PASS' || key === 'BREVO_API_KEY';
      console.log(`   ${key}=${secret ? '(saved, hidden)' : values[key]}`);
    }
  }

  // Apply the new values to this process, then verify + send a test email.
  for (const [key, value] of Object.entries(values)) {
    if (value) process.env[key] = value;
  }

  // Required lazily so env/mailer read the freshly written configuration.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mailer = require('./utils/mailer') as typeof import('./utils/mailer');
  const { configuredFrom, isMailConfigured, resolveMailProvider, sendMail, verifyMailer } = mailer;

  const recipient =
    flags.to ?? values.SMTP_USER ?? (values.MAIL_FROM ?? '').replace(/.*<([^>]+)>.*/, '$1');

  console.log(`\nProvider: ${resolveMailProvider()} · Sender: ${configuredFrom()}`);
  await verifyMailer();

  if (flags.sendTest === false) {
    console.log('\nNext steps:');
    console.log('  1. Restart the dev server (nodemon does not watch .env):  npm run dev');
    console.log('  2. Send a real test email:');
    console.log('     npm --workspace server run mail:test -- <you@example.com>');
    return;
  }

  if (!isMailConfigured()) {
    console.error('❌ Configuration is still incomplete — nothing was sent.');
    process.exitCode = 1;
    return;
  }

  const result = await sendMail({
    to: recipient,
    subject: '✅ MealMate mail test',
    text: 'MealMate email delivery is working — verification emails will reach your users.',
    html: '<p>Your <strong>MealMate</strong> email delivery is working — verification emails will reach your users.</p>',
  });

  if (result.delivered) {
    console.log(`\n✅ Test email sent to ${recipient} — check the inbox (and spam folder).`);
    console.log('Restart the dev server (nodemon does not watch .env), then sign up again.');
  } else {
    console.error(`\n❌ Sending failed: ${result.error}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('mail:setup failed:', err);
      process.exitCode = 1;
    })
    .finally(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { logger } = require('./config/logger') as typeof import('./config/logger');
        logger.flush?.();
      } catch {
        // logger not loaded (e.g. dry-run) — nothing to flush
      }
      // Give pino's transport a moment to flush before exiting.
      setTimeout(() => process.exit(process.exitCode ?? 0), 300);
    });
}